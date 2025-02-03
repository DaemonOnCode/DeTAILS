import asyncio
import json
import os
import re
import time
from typing import List
from uuid import uuid4

from chromadb import HttpClient
from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
import numpy as np
from pydantic import BaseModel
from routes.modeling_routes import execute_query
from routes.websocket_routes import manager

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.chains.retrieval_qa.base import RetrievalQA
from langchain.chains.retrieval import create_retrieval_chain 
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import StreamingStdOutCallbackHandler
from langchain_ollama import OllamaLLM

from decorators.execution_time_logger import log_execution_time
from utils.coding_helpers import generate_transcript
from utils.db_helpers import get_post_with_comments
from utils.prompts_v2 import ContextPrompt, DeductiveCoding, InitialCodePrompts, RefineCodebook, ThemeGeneration


router = APIRouter()


async def process_post_with_llm(dataset_id, post_id, llm, prompt, regex = r"\"codes\":\s*(\[.*?\])"):
    try:
        post_data = get_post_with_comments(dataset_id, post_id)
        transcript = generate_transcript(post_data)
        response = await asyncio.to_thread(llm.invoke, prompt.format(transcript=transcript))

        codes_match = re.search(regex, response, re.DOTALL)
        codes = json.loads(codes_match.group(1)) if codes_match else []

        return [{"postId": post_id, "id": str(uuid4()), **code} for code in codes]
    except Exception as e:
        await manager.broadcast(f"ERROR: {dataset_id}: Error processing post {post_id} - {str(e)}.")
        return []
    
async def run_coding_pipeline(request_body, prompt_generator):
    dataset_id, posts, model = request_body.dataset_id, request_body.unseen_post_ids, request_body.model
    llm = OllamaLLM(model=model, num_ctx=30000, num_predict=30000, temperature=0.6, callbacks=[StreamingStdOutCallbackHandler()])

    final_results = []
    for post_id in posts:
        await manager.broadcast(f"Dataset {dataset_id}: Processing post {post_id}...")
        prompt = prompt_generator(request_body, post_id)
        final_results.extend(await process_post_with_llm(dataset_id, post_id, llm, prompt))

    await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")
    return {"message": "Coding completed successfully!", "data": final_results}


def initialize_vector_store(dataset_id: str, model: str):
    """Initialize Chroma vector store."""
    embeddings = OllamaEmbeddings(model=model)
    chroma_client = HttpClient(host="localhost", port=8000)
    vector_store = Chroma(
        embedding_function=embeddings,
        collection_name=f"{dataset_id.replace('-','_')}_{model.replace(':','_')}",
        client=chroma_client,
    )
    return vector_store

class SamplePostsRequest(BaseModel):
    dataset_id: str
    post_ids: list= []
    sample_size: int = 0.5


@router.post("/sample-posts")
@log_execution_time()
async def sample_posts_endpoint(request_body: SamplePostsRequest):
    if request_body.sample_size <= 0 or request_body.dataset_id == "" or len(request_body.post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        sampled_post_ids = np.random.choice(request_body.post_ids, int(request_body.sample_size * len(request_body.post_ids)), replace=False)
        return {
            "sampled" :sampled_post_ids.tolist(),
            "unseen": list(set(request_body.post_ids) - set(sampled_post_ids))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

@router.post("/build-context-from-topic")
@log_execution_time()
async def build_context_from_interests_endpoint(
    request: Request,
    contextFiles: List[UploadFile],
    model: str = Form(...),
    mainTopic: str = Form(...),
    additionalInfo: str = Form(""),
    researchQuestions: str = Form(...),
    retry: bool = Form(False),
    datasetId: str = Form(...)
):
    if not datasetId:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        print(model, mainTopic, additionalInfo, researchQuestions, retry, datasetId)
        dataset_id = datasetId


        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {dataset_id}: Processing started.")

        # Initialize embeddings and vector store
        vector_store = initialize_vector_store(dataset_id, model)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        await manager.broadcast(f"Dataset {dataset_id}: Uploading files...")

        # Process uploaded files with retry logic
        for file in contextFiles:
            retries = 3
            success = False
            while retries > 0 and not success:
                try:
                    print(f"Processing file: {file.filename}")
                    file_content = await file.read()
                    file_name = file.filename

                    temp_file_path = f"./context_files/{dataset_id}_{time.time()}_{file_name}"
                    os.makedirs("./context_files", exist_ok=True)
                    with open(temp_file_path, "wb") as temp_file:
                        temp_file.write(file_content)

                    # Load and process the document
                    loader = PyPDFLoader(temp_file_path)
                    docs = loader.load()
                    chunks = text_splitter.split_documents(docs)

                    # Offload Chroma vector store operation to thread pool
                    vector_store.add_documents(chunks)

                    success = True
                    await manager.broadcast(f"Dataset {dataset_id}: Successfully processed file {file_name}.")
                except Exception as e:
                    retries -= 1
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)")
                    if retries == 0:
                        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts.")
                        raise e

        await manager.broadcast(f"Dataset {dataset_id}: Files uploaded successfully.")

        # Notify clients that retriever creation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
        retriever = vector_store.as_retriever()

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(ContextPrompt.systemPromptTemplate(mainTopic, researchQuestions, additionalInfo))),
            ("human", "{input}")
        ])

        await manager.broadcast(f"Dataset {dataset_id}: Generating keywords...")

        # Generate keywords with retry logic
        retries = 3
        success = False
        parsed_keywords = []
        while retries > 0 and not success:
            try:
                llm = OllamaLLM(
                    model=model,
                    num_ctx=8192,
                    num_predict=8192,
                    temperature=0.3,
                    timeout=2,
                    callbacks=[StreamingStdOutCallbackHandler()]
                )
                question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=prompt_template)
                rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

                input_text = ContextPrompt.context_builder(mainTopic, researchQuestions, additionalInfo)

                # Offload LLM chain invocation to thread pool
                results = rag_chain.invoke({"input": input_text})

                await manager.broadcast(f"Dataset {dataset_id}: Parsing generated keywords...")

                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"keywords\"\s*:\s*\[(?P<keywords>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\s*\])(?:\n```)?"

                keywords_match = re.search(regex, results["answer"], re.DOTALL)
                if not keywords_match:
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: No keywords found.")
                    raise Exception("No keywords found.")
                    # return {"keywords": []}

                if keywords_match.group("keywords"):
                    keywords = keywords_match.group("keywords")
                    parsed_keywords = json.loads(f'{keywords}')['keywords']
                else:
                    keywords = keywords_match.group("standalone")
                    parsed_keywords = json.loads(f'{{"keywords": [{keywords}]}}')["keywords"]

                success = True
                await manager.broadcast(f"Dataset {dataset_id}: keywords generated successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error generating keywords - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to generate keywords after multiple attempts.")
                    raise e

        await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")
        print(parsed_keywords)

        return {
            "message": "Context built successfully!",
            "keywords": parsed_keywords,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
class RegenerateKeywordsRequest(BaseModel):
    model: str
    mainTopic: str
    additionalInfo: str = ""
    researchQuestions: list
    selectedKeywords: list
    unselectedKeywords: list
    extraFeedback: str = ""
    datasetId: str 

@router.post("/regenerate-keywords")
@log_execution_time()
async def regenerate_keywords_endpoint(
    request: RegenerateKeywordsRequest
):
    model = request.model
    mainTopic = request.mainTopic
    additionalInfo = request.additionalInfo
    researchQuestions = request.researchQuestions
    selectedKeywords = request.selectedKeywords
    unselectedKeywords = request.unselectedKeywords
    extraFeedback = request.extraFeedback
    datasetId = request.datasetId

    if not datasetId:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        print(model, mainTopic, additionalInfo, researchQuestions, selectedKeywords, extraFeedback, datasetId)
        dataset_id = datasetId

        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {dataset_id}: Regenerating keywords with feedback...")

        # Initialize embeddings and vector store
        vector_store = initialize_vector_store(dataset_id, model)
        
        retriever = vector_store.as_retriever()

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(ContextPrompt.regenerationPromptTemplate(mainTopic, researchQuestions, additionalInfo, selectedKeywords, unselectedKeywords, extraFeedback))),
            ("human", "{input}")
        ])

        await manager.broadcast(f"Dataset {dataset_id}: Generating refined keywords...")

        # Generate refined keywords with retry logic
        retries = 3
        success = False
        parsed_keywords = []
        while retries > 0 and not success:
            try:
                llm = OllamaLLM(
                    model=model,
                    num_ctx=8192,
                    num_predict=8192,
                    temperature=0.6,
                    timeout=2,
                    callbacks=[StreamingStdOutCallbackHandler()]
                )

                question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=prompt_template)
                rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

                input_text = ContextPrompt.refined_context_builder(mainTopic, researchQuestions, additionalInfo, selectedKeywords, unselectedKeywords, extraFeedback)

                # Offload LLM chain invocation to thread pool
                results = rag_chain.invoke({"input": input_text})

                await manager.broadcast(f"Dataset {dataset_id}: Parsing refined keywords...")

                regex = r"```json\s*([\s\S]*?)\s*```"

                keywords_match = re.search(regex, results["answer"], re.DOTALL)

                if not keywords_match:
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: No refined keywords found.")
                    raise Exception("No refined keywords found.")


                json_str = keywords_match.group(1).strip().replace("```json", "").replace("```", "")
                parsed_keywords = json.loads(json_str)["keywords"]

                success = True
                await manager.broadcast(f"Dataset {dataset_id}: Keywords regenerated successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error regenerating keywords - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to regenerate keywords after multiple attempts.")
                    raise e

        await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")
        print(parsed_keywords)

        return {
            "message": "Keywords regenerated successfully!",
            "keywords": parsed_keywords,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")



class GenerateInitialCodesRequest(BaseModel):
    dataset_id: str
    keyword_table: list
    model: str
    main_topic: str
    additional_info: str
    research_questions: list
    sampled_post_ids: list

@router.post("/generate-initial-codes")
@log_execution_time()
async def generate_codes_endpoint(
    request_body: GenerateInitialCodesRequest
):
    if not request_body.dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

        # Initialize LLMs
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.6,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        posts = request_body.sampled_post_ids
        dataset_id = request_body.dataset_id

        function_id = str(uuid4())

        final_results = []
        
        print(posts, dataset_id, function_id)

        while len(posts) > 0:
            post_id = posts[0]
            await manager.broadcast(f"Dataset {dataset_id}: Processing post {post_id}...")

            try:
                print("Processing post", post_id)
                # Fetch post and comments
                await manager.broadcast(f"Dataset {dataset_id}: Fetching data for post {post_id}...")
                post_data = get_post_with_comments(dataset_id, post_id)

                print("Generating transcript")
                # Generate transcript and context
                await manager.broadcast(f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
                transcript = generate_transcript(post_data)

                # Retry logic for LLM1
                retries = 3
                success = False
                result: str = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {dataset_id}: Generating with LLM1 for post {post_id}...")

                        print("LLM starting generation")
                        generation_prompt = InitialCodePrompts.initial_code_prompt(
                            request_body.main_topic,
                            request_body.additional_info,
                            request_body.research_questions,
                            json.dumps(request_body.keyword_table),
                            transcript
                        )
                        print("LLM generation prompt", generation_prompt)
                        result = await asyncio.to_thread(llm.invoke, generation_prompt)
                        print("LLM result")
                        execute_query(f"INSERT INTO llm_responses (dataset_id, post_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                                  (dataset_id, post_id, request_body.model, result.lower(), str(uuid4()), "LLM1 response", function_id)
                        )
                        print("LLM response saved to database")
                        success = True
                        await manager.broadcast(f"Dataset {dataset_id}: LLM1 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {dataset_id}: Error generating with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {dataset_id}: LLM1 failed for post {post_id} after multiple attempts."
                            )
                            raise e
                print("LLM completed generation", result)
                await manager.broadcast(f"Dataset {dataset_id}: Processed post {post_id}.")
                posts.pop(0)

                regex = r"\"codes\":\s*(\[.*?\])"
                codes_match = re.search(regex, result, re.DOTALL)
                if not codes_match:
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: No codes found for post {post_id}.")
                    continue

                codes = json.loads(codes_match.group(1))
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())
                    final_results.append(code)
            except Exception as e:
                await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
                posts.pop(0)
        await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")
        # return final_results if len(final_results) else []

        print(final_results)

        print("Returning response")
        return {
            "message": "Initial codes generated successfully!",
            "data": final_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
class CodebookRefinementRequest(BaseModel):
    dataset_id: str
    model: str
    prevCodebook: list
    currentCodebook: list

@router.post("/refine-codebook")
@log_execution_time()
async def refine_codebook_endpoint(
    request_body: CodebookRefinementRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

        # Initialize LLMs
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.6,
            callbacks=[StreamingStdOutCallbackHandler()]
        )


        dataset_id = request_body.dataset_id
        function_id = str(uuid4())

        prev_codebook_json = json.dumps(request_body.prevCodebook, indent=2)
        current_codebook_json = json.dumps(request_body.currentCodebook, indent=2)

        retries = 3
        success = False
        result = None

        while retries > 0 and not success:
            try:
                print(f"Generating refined codebook for dataset {dataset_id}...")
                
                generation_prompt = RefineCodebook.refine_codebook_prompt(prev_codebook_json, current_codebook_json)
                result = await asyncio.to_thread(llm.predict, generation_prompt)

                print("LLM completed refinement.")

                # Store response in database
                execute_query(
                    f"INSERT INTO llm_responses (dataset_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?)",
                    (dataset_id, request_body.model, result.lower(), str(uuid4()), "Refined Codebook", function_id)
                )

                success = True
                await manager.broadcast(f"Dataset {dataset_id}: Refinement completed successfully.")

            except Exception as e:
                retries -= 1
                await manager.broadcast(
                    f"WARNING: Dataset {dataset_id}: Error during refinement - {str(e)}. Retrying... ({3 - retries}/3)"
                )
                if retries == 0:
                    await manager.broadcast(
                        f"ERROR: Dataset {dataset_id}: LLM failed after multiple attempts."
                    )
                    raise e

        # Extract JSON output from the model response
        regex = r"```json\s*([\s\S]*?)\s*```"
        match = re.search(regex, result, re.DOTALL)

        if not match:
            raise HTTPException(status_code=500, detail="No valid JSON found in AI output.")

        refined_codebook_json = match.group(1).strip()
        refined_codebook = json.loads(refined_codebook_json)

        final_results = refined_codebook.get("revised_codebook", [])

        for code in final_results:
            code["id"] = str(uuid4())

        await manager.broadcast(f"Dataset {dataset_id}: Codebook refinement completed.")

        return {
            "message": "Refined codebook generated successfully!",
            "agreements": refined_codebook.get("agreements", []),
            "disagreements": refined_codebook.get("disagreements", []),
            "data": final_results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class DeductiveCodingRequest(BaseModel):
    dataset_id: str
    model: str
    final_codebook: list
    unseen_post_ids: list

@router.post("/deductive-coding")
@log_execution_time()
async def deductive_coding_endpoint(
    request_body: DeductiveCodingRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

        # Initialize LLMs
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.6,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        posts = request_body.unseen_post_ids
        dataset_id = request_body.dataset_id

        function_id = str(uuid4())

        final_results = []
        
        print(posts, dataset_id, function_id)

        while len(posts) > 0:
            post_id = posts[0]
            await manager.broadcast(f"Dataset {dataset_id}: Processing post {post_id}...")

            try:
                print("Processing post", post_id)
                # Fetch post and comments
                await manager.broadcast(f"Dataset {dataset_id}: Fetching data for post {post_id}...")
                post_data = get_post_with_comments(dataset_id, post_id)

                print("Generating transcript")
                # Generate transcript and context
                await manager.broadcast(f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
                transcript = generate_transcript(post_data)

                # Retry logic for LLM1
                retries = 3
                success = False
                result: str = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {dataset_id}: Generating with LLM1 for post {post_id}...")

                        print("LLM starting generation")
                        generation_prompt = DeductiveCoding.deductive_coding_prompt(
                            request_body.final_codebook,
                            transcript
                        )
                        print("LLM generation prompt", generation_prompt)
                        result = await asyncio.to_thread(llm.invoke, generation_prompt)
                        print("LLM result")
                        execute_query(f"INSERT INTO llm_responses (dataset_id, post_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                                  (dataset_id, post_id, request_body.model, result.lower(), str(uuid4()), "LLM response deductive coding", function_id)
                        )
                        print("LLM response saved to database")
                        success = True
                        await manager.broadcast(f"Dataset {dataset_id}: LLM1 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {dataset_id}: Error generating with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {dataset_id}: LLM1 failed for post {post_id} after multiple attempts."
                            )
                            raise e
                print("LLM completed generation", result)
                await manager.broadcast(f"Dataset {dataset_id}: Processed post {post_id}.")
                posts.pop(0)

                regex = r"\"codes\":\s*(\[.*?\])"
                codes_match = re.search(regex, result, re.DOTALL)
                if not codes_match:
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: No codes found for post {post_id}.")
                    continue

                codes = json.loads(codes_match.group(1))
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())
                    final_results.append(code)
            except Exception as e:
                await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
                posts.pop(0)
        await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")
        # return final_results if len(final_results) else []

        print(final_results)

        print("Returning response")
        return {
            "message": "Initial codes generated successfully!",
            "data": final_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
  
class ThemeGenerationRequest(BaseModel):
    dataset_id: str
    model: str
    sampled_post_responses: list
    unseen_post_responses: list

@router.post("/theme-generation")
@log_execution_time()
async def refine_codebook_endpoint(
    request_body: ThemeGenerationRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
         # Fetch posts
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

        # Initialize LLMs
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.6,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        dataset_id = request_body.dataset_id

        retries = 3
        success = False
        result: str = None
        while retries > 0 and not success:
            try:
                print("LLM starting generation")
                qec_table = []

                for row in request_body.sampled_post_responses:
                    qec_table.append({
                        "quote": row["quote"],
                        "explanation": row["explanation"],
                        "code": row["code"]
                    })
                
                for row in request_body.unseen_post_responses:
                    qec_table.append({
                        "quote": row["quote"],
                        "explanation": row["explanation"],
                        "code": row["code"]
                    })

                generation_prompt = ThemeGeneration.theme_generation_prompt(json.dumps({"codes":qec_table}))
                print("LLM generation prompt", generation_prompt)
                result = await asyncio.to_thread(llm.invoke, generation_prompt)
                print("LLM result")
                success = True
            except Exception as e:
                retries -= 1
                if retries == 0:
                    raise e
        print("LLM completed generation", result)

        regex  = r"```json.*?```"
        themes_match = re.search(regex, result, re.DOTALL)
        if not themes_match:
            return {
                "message": "No themes generated",
                "data": {
                    "themes": [],
                    "unplaced_codes": [row["code"] for row in qec_table]
                }
            }
        
        themes = json.loads(themes_match.group(0).replace("```json", "").replace("```", ""))

        print(themes)
        placed_codes = []
        for theme in themes.get("themes", []):
            theme["id"] = str(uuid4())  # Assign a unique ID
            placed_codes.extend(theme["codes"]) 
        print("Returning response")

        unplaced_codes = list(set(code["code"] for code in qec_table) - set(placed_codes))

        return {
            "message": "Themes generated successfully!",
            "data": {
                "themes": themes["themes"],
                "unplaced_codes": unplaced_codes
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    