import json
import os
from re import L
import re
import time
from typing import List

from chromadb import HttpClient
from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
import numpy as np
from pydantic import BaseModel
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
from utils.prompts_v2 import ContextPrompt


router = APIRouter()


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
        embeddings = OllamaEmbeddings(model=model)
        chroma_client = HttpClient(host="localhost", port=8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name=f"{dataset_id.replace('-','_')}_{model.replace(':','_')}", client=chroma_client)
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
                    return {"keywords": []}

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
    

class GenerateKeywordTableRequest(BaseModel):
    dataset_id: str
    keywords: List[str]
    selected_keywords: List[str]

@router.post("/generate-keyword-table")
@log_execution_time()
async def generate_keyword_table_endpoint(
    request_body: GenerateKeywordTableRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class GenerateCodesRequest(BaseModel):
    dataset_id: str
    keyword_table: List[str]
    main_topic: str
    additional_info: str
    research_questions: List[str]
    sampled_post_ids: List[str]

@router.post("/generate-codes")
@log_execution_time()
async def generate_codes_endpoint(
    request_body: GenerateCodesRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
class CodebookRefinementRequest(BaseModel):
    dataset_id: str
    keyword_table: List[str]
    main_topic: str
    additional_info: str
    research_questions: List[str]
    sampled_post_ids: List[str]

@router.post("/refine-codebook")
@log_execution_time()
async def refine_codebook_endpoint(
    request_body: CodebookRefinementRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class DeductiveCodingRequest(BaseModel):
    dataset_id: str
    keyword_table: List[str]
    final_codebook: list
    unseen_post_ids: List[str]

@router.post("/deductive-coding")
@log_execution_time()
async def deductive_coding_endpoint(
    request_body: DeductiveCodingRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    