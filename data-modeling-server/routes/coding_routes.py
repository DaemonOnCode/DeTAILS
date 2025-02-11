import asyncio
import json
from typing import Annotated, List
from uuid import uuid4
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile
import numpy as np

from config import Settings
from controllers.coding_controller import get_llm_and_embeddings, initialize_vector_store, process_llm_task, save_context_files
from models.coding_models import CodebookRefinementRequest, DeductiveCodingRequest, GenerateInitialCodesRequest, RegenerateKeywordsRequest, SamplePostsRequest, ThemeGenerationRequest
from routes.websocket_routes import manager

from utils.coding_helpers import generate_transcript
from database.db_helpers import get_post_and_comments_from_id
from utils.prompts_v2 import ContextPrompt, DeductiveCoding, InitialCodePrompts, RefineCodebook, ThemeGeneration


router = APIRouter()
settings = Settings()

@router.post("/sample-posts")
async def sample_posts_endpoint(request_body: SamplePostsRequest):
    if request_body.sample_size <= 0 or request_body.dataset_id == "" or len(request_body.post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    # Fetch posts
    sampled_post_ids = np.random.choice(request_body.post_ids, int(request_body.sample_size * len(request_body.post_ids)), replace=False)
    return {
        "sampled" :sampled_post_ids.tolist(),
        "unseen": list(set(request_body.post_ids) - set(sampled_post_ids))
    }
    

@router.post("/build-context-from-topic")
async def build_context_from_interests_endpoint(
    request: Request,
    # settings: Annotated[config.Settings, Depends(config.get_settings)],
    contextFiles: List[UploadFile],
    model: str = Form(...),
    mainTopic: str = Form(...),
    additionalInfo: str = Form(""),
    researchQuestions: str = Form(...),
    retry: bool = Form(False),
    datasetId: str = Form(...),
):
    if not datasetId:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    dataset_id = datasetId
    await manager.broadcast(f"Dataset {dataset_id}: Processing started.")

    llm, embeddings = get_llm_and_embeddings(model, settings=settings)

    # Initialize vector store & process files
    vector_store = initialize_vector_store(dataset_id, model, embeddings)
    await save_context_files(dataset_id, contextFiles, vector_store)

    # Create retriever from vector store
    await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
    retriever = vector_store.as_retriever()

    # Build input for LLM
    input_text = ContextPrompt.context_builder(mainTopic, researchQuestions, additionalInfo)

    parsed_keywords = await process_llm_task(
        dataset_id=dataset_id,
        manager=manager,
        llm_model=model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        rag_prompt_builder_func=ContextPrompt.systemPromptTemplate,  # Function for RAG prompts
        retriever=retriever,  # Uses retrieval-augmented generation
        input_text=input_text,  # Correctly passes research question for retrieval
        mainTopic=mainTopic,
        researchQuestions=researchQuestions,
        additionalInfo=additionalInfo,
        llm_instance=llm
    )

    await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")

    return {
        "message": "Context built successfully!",
        "keywords": parsed_keywords.get("keywords", [])
    }

# @router.post("/build-context-from-topic")
# @log_execution_time()
# async def build_context_from_interests_endpoint(
#     request: Request,
#     contextFiles: List[UploadFile],
#     model: str = Form(...),
#     mainTopic: str = Form(...),
#     additionalInfo: str = Form(""),
#     researchQuestions: str = Form(...),
#     retry: bool = Form(False),
#     datasetId: str = Form(...)
# ):
#     if not datasetId:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")
#     try:
#         # Fetch posts
#         print(model, mainTopic, additionalInfo, researchQuestions, retry, datasetId)
#         dataset_id = datasetId


#         # Notify clients that processing has started
#         await manager.broadcast(f"Dataset {dataset_id}: Processing started.")

#         # Initialize embeddings and vector store
#         vector_store = initialize_vector_store(dataset_id, model)
#         text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

#         await manager.broadcast(f"Dataset {dataset_id}: Uploading files...")

#         # Process uploaded files with retry logic
#         for file in contextFiles:
#             retries = 3
#             success = False
#             while retries > 0 and not success:
#                 try:
#                     print(f"Processing file: {file.filename}")
#                     file_content = await file.read()
#                     file_name = file.filename

#                     temp_file_path = f"./context_files/{dataset_id}_{time.time()}_{file_name}"
#                     os.makedirs("./context_files", exist_ok=True)
#                     with open(temp_file_path, "wb") as temp_file:
#                         temp_file.write(file_content)

#                     # Load and process the document
#                     loader = PyPDFLoader(temp_file_path)
#                     docs = loader.load()
#                     chunks = text_splitter.split_documents(docs)

#                     # Offload Chroma vector store operation to thread pool
#                     vector_store.add_documents(chunks)

#                     success = True
#                     await manager.broadcast(f"Dataset {dataset_id}: Successfully processed file {file_name}.")
#                 except Exception as e:
#                     retries -= 1
#                     await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)")
#                     if retries == 0:
#                         await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts.")
#                         raise e

#         await manager.broadcast(f"Dataset {dataset_id}: Files uploaded successfully.")

#         # Notify clients that retriever creation is starting
#         await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
#         retriever = vector_store.as_retriever()

#         prompt_template = ChatPromptTemplate.from_messages([
#             ("system", "\n".join(ContextPrompt.systemPromptTemplate(mainTopic, researchQuestions, additionalInfo))),
#             ("human", "{input}")
#         ])

#         await manager.broadcast(f"Dataset {dataset_id}: Generating keywords...")

#         # Generate keywords with retry logic
#         retries = 3
#         success = False
#         parsed_keywords = []
#         while retries > 0 and not success:
#             try:
#                 llm = OllamaLLM(
#                     model=model,
#                     num_ctx=8192,
#                     num_predict=8192,
#                     temperature=0.3,
#                     timeout=2,
#                     callbacks=[StreamingStdOutCallbackHandler()]
#                 )
#                 question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=prompt_template)
#                 rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

#                 input_text = ContextPrompt.context_builder(mainTopic, researchQuestions, additionalInfo)

#                 # Offload LLM chain invocation to thread pool
#                 results = rag_chain.invoke({"input": input_text})

#                 await manager.broadcast(f"Dataset {dataset_id}: Parsing generated keywords...")

#                 regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"keywords\"\s*:\s*\[(?P<keywords>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\s*\])(?:\n```)?"

#                 keywords_match = re.search(regex, results["answer"], re.DOTALL)
#                 if not keywords_match:
#                     await manager.broadcast(f"WARNING: Dataset {dataset_id}: No keywords found.")
#                     raise Exception("No keywords found.")
#                     # return {"keywords": []}

#                 if keywords_match.group("keywords"):
#                     keywords = keywords_match.group("keywords")
#                     parsed_keywords = json.loads(f'{keywords}')['keywords']
#                 else:
#                     keywords = keywords_match.group("standalone")
#                     parsed_keywords = json.loads(f'{{"keywords": [{keywords}]}}')["keywords"]

#                 success = True
#                 await manager.broadcast(f"Dataset {dataset_id}: keywords generated successfully.")
#             except Exception as e:
#                 retries -= 1
#                 await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error generating keywords - {str(e)}. Retrying... ({3 - retries}/3)")
#                 if retries == 0:
#                     await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to generate keywords after multiple attempts.")
#                     raise e

#         await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")
#         print(parsed_keywords)

#         return {
#             "message": "Context built successfully!",
#             "keywords": parsed_keywords,
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/regenerate-keywords")
async def regenerate_keywords_endpoint(
    request: RegenerateKeywordsRequest,
    # settings: Annotated[config.Settings, Depends(config.get_settings)],
):
    dataset_id = request.datasetId
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Regenerating keywords with feedback...")

    # Initialize LLM and Embeddings
    llm, embeddings = get_llm_and_embeddings(request.model, settings=settings)

    # Initialize Vector Store & Retriever
    vector_store = initialize_vector_store(dataset_id, request.model, embeddings)
    retriever = vector_store.as_retriever(search_kwargs={'k': 10})

    parsed_keywords = await process_llm_task(
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",  # Extracts JSON structure from response
        rag_prompt_builder_func=ContextPrompt.regenerationPromptTemplate,  # Uses correct RAG function
        retriever=retriever,  # Enables retrieval-augmented generation
        llm_instance=llm,
        input_text=ContextPrompt.refined_context_builder( 
            request.mainTopic, 
            request.researchQuestions, 
            request.additionalInfo, 
            request.selectedKeywords, 
            request.unselectedKeywords, 
            request.extraFeedback
        ),
        mainTopic=request.mainTopic,
        researchQuestions=request.researchQuestions,
        additionalInfo=request.additionalInfo,
        selectedKeywords=request.selectedKeywords,
        unselectedKeywords=request.unselectedKeywords,
        extraFeedback=request.extraFeedback,
    )

    await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")

    return {
        "message": "Keywords regenerated successfully!",
        "keywords": parsed_keywords.get("keywords", [])
    }

# @router.post("/regenerate-keywords")
# @log_execution_time()
# async def regenerate_keywords_endpoint(
#     request: RegenerateKeywordsRequest
# ):
#     model = request.model
#     mainTopic = request.mainTopic
#     additionalInfo = request.additionalInfo
#     researchQuestions = request.researchQuestions
#     selectedKeywords = request.selectedKeywords
#     unselectedKeywords = request.unselectedKeywords
#     extraFeedback = request.extraFeedback
#     datasetId = request.datasetId

#     if not datasetId:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")
#     try:
#         print(model, mainTopic, additionalInfo, researchQuestions, selectedKeywords, extraFeedback, datasetId)
#         dataset_id = datasetId

#         # Notify clients that processing has started
#         await manager.broadcast(f"Dataset {dataset_id}: Regenerating keywords with feedback...")

#         # Initialize embeddings and vector store
#         vector_store = initialize_vector_store(dataset_id, model)
        
#         retriever = vector_store.as_retriever()

#         prompt_template = ChatPromptTemplate.from_messages([
#             ("system", "\n".join(ContextPrompt.regenerationPromptTemplate(mainTopic, researchQuestions, additionalInfo, selectedKeywords, unselectedKeywords, extraFeedback))),
#             ("human", "{input}")
#         ])

#         await manager.broadcast(f"Dataset {dataset_id}: Generating refined keywords...")

#         # Generate refined keywords with retry logic
#         retries = 3
#         success = False
#         parsed_keywords = []
#         while retries > 0 and not success:
#             try:
#                 llm = OllamaLLM(
#                     model=model,
#                     num_ctx=8192,
#                     num_predict=8192,
#                     temperature=0.6,
#                     timeout=2,
#                     callbacks=[StreamingStdOutCallbackHandler()]
#                 )

#                 question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=prompt_template)
#                 rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

#                 input_text = ContextPrompt.refined_context_builder(mainTopic, researchQuestions, additionalInfo, selectedKeywords, unselectedKeywords, extraFeedback)

#                 # Offload LLM chain invocation to thread pool
#                 results = rag_chain.invoke({"input": input_text})

#                 await manager.broadcast(f"Dataset {dataset_id}: Parsing refined keywords...")

#                 regex = r"```json\s*([\s\S]*?)\s*```"

#                 keywords_match = re.search(regex, results["answer"], re.DOTALL)

#                 if not keywords_match:
#                     await manager.broadcast(f"WARNING: Dataset {dataset_id}: No refined keywords found.")
#                     raise Exception("No refined keywords found.")


#                 json_str = keywords_match.group(1).strip().replace("```json", "").replace("```", "")
#                 parsed_keywords = json.loads(json_str)["keywords"]

#                 success = True
#                 await manager.broadcast(f"Dataset {dataset_id}: Keywords regenerated successfully.")
#             except Exception as e:
#                 retries -= 1
#                 await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error regenerating keywords - {str(e)}. Retrying... ({3 - retries}/3)")
#                 if retries == 0:
#                     await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to regenerate keywords after multiple attempts.")
#                     raise e

#         await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")
#         print(parsed_keywords)

#         return {
#             "message": "Keywords regenerated successfully!",
#             "keywords": parsed_keywords,
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")



# @router.post("/regenerate-keywords")
# async def regenerate_keywords_endpoint(
#     request: RegenerateKeywordsRequest,
#     # settings: Annotated[config.Settings, Depends(config.get_settings)],
# ):
#     dataset_id = request.datasetId
#     if not dataset_id:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")

#     await manager.broadcast(f"Dataset {dataset_id}: Regenerating keywords with feedback...")

#     llm, embeddings = get_llm_and_embeddings(request.model, settings=settings )
#     # Initialize vector store & retriever
#     vector_store = initialize_vector_store(dataset_id, request.model, embeddings)
#     retriever = vector_store.as_retriever()

#     parsed_keywords = await process_llm_task(
#         dataset_id=dataset_id,
#         manager=manager,
#         llm_model=request.model,
#         regex_pattern=r"```json\s*([\s\S]*?)\s*```",
#         rag_prompt_builder_func=ContextPrompt.regenerationPromptTemplate,  # Uses correct RAG function
#         retriever=retriever,  # Enables Retrieval-Augmented Generation
#         llm_instance=llm,
#         input_text=ContextPrompt.refined_context_builder( 
#             request.mainTopic, 
#             request.researchQuestions, 
#             request.additionalInfo, 
#             request.selectedKeywords, 
#             request.unselectedKeywords, 
#             request.extraFeedback
#         ),
#         mainTopic=request.mainTopic,
#         researchQuestions=request.researchQuestions,
#         additionalInfo=request.additionalInfo,
#         selectedKeywords=request.selectedKeywords,
#         unselectedKeywords=request.unselectedKeywords,
#         extraFeedback=request.extraFeedback,
#     )

#     await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")

#     return {
#         "message": "Keywords regenerated successfully!",
#         "keywords": parsed_keywords.get("keywords", [])
#     }

@router.post("/generate-initial-codes")
async def generate_codes_endpoint(
    request_body: GenerateInitialCodesRequest,
    batch_size: int = 10  # Default batch size (can be overridden in request)
):
    dataset_id = request_body.dataset_id
    if not dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Code generation process started.")

    # Initialize LLM
    llm, _ = get_llm_and_embeddings(request_body.model)
    final_results = []
    function_id = str(uuid4())

    async def process_post(post_id: str):
        """Processes a single post asynchronously."""
        try:
            await manager.broadcast(f"Dataset {dataset_id}: Fetching data for post {post_id}...")
            post_data = get_post_and_comments_from_id(post_id, dataset_id)

            await manager.broadcast(f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
            transcript = generate_transcript(post_data)

            parsed_response = await process_llm_task(
                dataset_id=dataset_id,
                post_id=post_id,
                manager=manager,
                llm_model=request_body.model,
                regex_pattern=r"\"codes\":\s*(\[.*?\])",
                prompt_builder_func=InitialCodePrompts.initial_code_prompt,
                llm_instance=llm,
                main_topic=request_body.main_topic,
                additional_info=request_body.additional_info,
                research_questions=request_body.research_questions,
                keyword_table=json.dumps(request_body.keyword_table),
                function_id=function_id,
                post_transcript=transcript,
                store_response=True,
            )

            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            return codes

        except Exception as e:
            await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
            return []

    # Split posts into batches of `batch_size`
    sampled_posts = request_body.sampled_post_ids
    batches = [sampled_posts[i:i + batch_size] for i in range(0, len(sampled_posts), batch_size)]

    for batch in batches:
        await manager.broadcast(f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        # Process posts in the batch concurrently
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))

        # Flatten results since `gather` returns a list of lists
        for codes in batch_results:
            final_results.extend(codes)

    await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Initial codes generated successfully!",
        "data": final_results
    }


# @router.post("/generate-initial-codes")
# @log_execution_time()
# async def generate_codes_endpoint(
#     request_body: GenerateInitialCodesRequest
# ):
#     if not request_body.dataset_id or len(request_body.sampled_post_ids) == 0:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")
#     try:
#         # Fetch posts
#         await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

#         # Initialize LLMs
#         llm = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.6,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )

#         posts = request_body.sampled_post_ids
#         dataset_id = request_body.dataset_id

#         function_id = str(uuid4())

#         final_results = []
        
#         print(posts, dataset_id, function_id)

#         while len(posts) > 0:
#             post_id = posts[0]
#             await manager.broadcast(f"Dataset {dataset_id}: Processing post {post_id}...")

#             try:
#                 print("Processing post", post_id)
#                 # Fetch post and comments
#                 await manager.broadcast(f"Dataset {dataset_id}: Fetching data for post {post_id}...")
#                 post_data = get_post_and_comments_from_id(post_id, dataset_id)

#                 print("Generating transcript")
#                 # Generate transcript and context
#                 await manager.broadcast(f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
#                 transcript = generate_transcript(post_data)

#                 # Retry logic for LLM1
#                 retries = 3
#                 success = False
#                 result: str = None
#                 while retries > 0 and not success:
#                     try:
#                         await manager.broadcast(f"Dataset {dataset_id}: Generating with LLM1 for post {post_id}...")

#                         print("LLM starting generation")
#                         generation_prompt = InitialCodePrompts.initial_code_prompt(
#                             request_body.main_topic,
#                             request_body.additional_info,
#                             request_body.research_questions,
#                             json.dumps(request_body.keyword_table),
#                             transcript
#                         )
#                         print("LLM generation prompt", generation_prompt)
#                         result = await asyncio.to_thread(llm.invoke, generation_prompt)
#                         print("LLM result")
#                         execute_query(f"INSERT INTO llm_responses (dataset_id, post_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
#                                   (dataset_id, post_id, request_body.model, result.lower(), str(uuid4()), "LLM1 response", function_id)
#                         )
#                         print("LLM response saved to database")
#                         success = True
#                         await manager.broadcast(f"Dataset {dataset_id}: LLM1 completed generation for post {post_id}.")
#                     except Exception as e:
#                         retries -= 1
#                         await manager.broadcast(
#                             f"WARNING: Dataset {dataset_id}: Error generating with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
#                         )
#                         if retries == 0:
#                             await manager.broadcast(
#                                 f"ERROR: Dataset {dataset_id}: LLM1 failed for post {post_id} after multiple attempts."
#                             )
#                             raise e
#                 print("LLM completed generation", result)
#                 await manager.broadcast(f"Dataset {dataset_id}: Processed post {post_id}.")
#                 posts.pop(0)

#                 regex = r"\"codes\":\s*(\[.*?\])"
#                 codes_match = re.search(regex, result, re.DOTALL)
#                 if not codes_match:
#                     await manager.broadcast(f"WARNING: Dataset {dataset_id}: No codes found for post {post_id}.")
#                     continue

#                 codes = json.loads(codes_match.group(1))
#                 for code in codes:
#                     code["postId"] = post_id
#                     code["id"] = str(uuid4())
#                     final_results.append(code)
#             except Exception as e:
#                 await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
#                 posts.pop(0)
#         await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")
#         # return final_results if len(final_results) else []

#         print(final_results)

#         print("Returning response")
#         return {
#             "message": "Initial codes generated successfully!",
#             "data": final_results
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/refine-codebook")
async def refine_codebook_endpoint(
    request_body: CodebookRefinementRequest,
    # settings: Annotated[config.Settings, Depends(config.get_settings)],
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Code generation process started.")

    llm, _ = get_llm_and_embeddings(request_body.model, settings=settings)
    # Convert codebooks to JSON format
    prev_codebook_json = json.dumps(request_body.prevCodebook, indent=2)
    current_codebook_json = json.dumps(request_body.currentCodebook, indent=2)

    parsed_response = await process_llm_task(
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=RefineCodebook.refine_codebook_prompt,  # Non-RAG prompt
        llm_instance=llm,
        prev_codebook_json=prev_codebook_json,
        current_codebook_json=current_codebook_json
    )

    # Extract refined codebook details
    final_results = parsed_response.get("revised_codebook", [])
    # agreements = parsed_response.get("agreements", [])
    disagreements = parsed_response.get("disagreements", [])

    # Assign unique IDs to each refined code
    for code in final_results:
        code["id"] = str(uuid4())

    await manager.broadcast(f"Dataset {dataset_id}: Codebook refinement completed.")

    return {
        "message": "Refined codebook generated successfully!",
        # "agreements": agreements,
        "disagreements": disagreements,
        "data": final_results
    }

# @router.post("/refine-codebook")
# @log_execution_time()
# async def refine_codebook_endpoint(
#     request_body: CodebookRefinementRequest
# ):
#     if not request_body.dataset_id:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")
#     try:
#         # Fetch posts
#         await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

#         # Initialize LLMs
#         llm = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.6,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )


#         dataset_id = request_body.dataset_id
#         function_id = str(uuid4())

#         prev_codebook_json = json.dumps(request_body.prevCodebook, indent=2)
#         current_codebook_json = json.dumps(request_body.currentCodebook, indent=2)

#         retries = 3
#         success = False
#         result = None

#         while retries > 0 and not success:
#             try:
#                 print(f"Generating refined codebook for dataset {dataset_id}...")
                
#                 generation_prompt = RefineCodebook.refine_codebook_prompt(prev_codebook_json, current_codebook_json)
#                 result = await asyncio.to_thread(llm.predict, generation_prompt)

#                 print("LLM completed refinement.")

#                 # Store response in database
#                 execute_query(
#                     f"INSERT INTO llm_responses (dataset_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?)",
#                     (dataset_id, request_body.model, result.lower(), str(uuid4()), "Refined Codebook", function_id)
#                 )

#                 success = True
#                 await manager.broadcast(f"Dataset {dataset_id}: Refinement completed successfully.")

#             except Exception as e:
#                 retries -= 1
#                 await manager.broadcast(
#                     f"WARNING: Dataset {dataset_id}: Error during refinement - {str(e)}. Retrying... ({3 - retries}/3)"
#                 )
#                 if retries == 0:
#                     await manager.broadcast(
#                         f"ERROR: Dataset {dataset_id}: LLM failed after multiple attempts."
#                     )
#                     raise e

#         # Extract JSON output from the model response
#         regex = r"```json\s*([\s\S]*?)\s*```"
#         match = re.search(regex, result, re.DOTALL)

#         if not match:
#             raise HTTPException(status_code=500, detail="No valid JSON found in AI output.")

#         refined_codebook_json = match.group(1).strip()
#         refined_codebook = json.loads(refined_codebook_json)

#         final_results = refined_codebook.get("revised_codebook", [])

#         for code in final_results:
#             code["id"] = str(uuid4())

#         await manager.broadcast(f"Dataset {dataset_id}: Codebook refinement completed.")

#         return {
#             "message": "Refined codebook generated successfully!",
#             "agreements": refined_codebook.get("agreements", []),
#             "disagreements": refined_codebook.get("disagreements", []),
#             "data": final_results
#         }

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    


@router.post("/deductive-coding")
async def deductive_coding_endpoint(
    request_body: DeductiveCodingRequest,
    batch_size: int = 10  # Default batch size (can be overridden in request)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Deductive coding process started.")

    final_results = []
    posts = request_body.unseen_post_ids
    llm, _ = get_llm_and_embeddings(request_body.model)

    async def process_post(post_id: str):
        """Processes a single post asynchronously."""
        await manager.broadcast(f"Dataset {dataset_id}: Fetching data for post {post_id}...")
        post_data = get_post_and_comments_from_id(post_id, dataset_id)

        await manager.broadcast(f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
        transcript = generate_transcript(post_data)

        parsed_response = await process_llm_task(
            dataset_id=dataset_id,
            post_id=post_id,
            manager=manager,
            llm_model=request_body.model,
            regex_pattern=r"```json\s*([\s\S]*?)\s*```",
            prompt_builder_func=DeductiveCoding.deductive_coding_prompt,
            llm_instance=llm,
            final_codebook=json.dumps(request_body.final_codebook, indent=2),
            keyword_table=json.dumps(request_body.keyword_table, indent=2),
            main_topic=request_body.main_topic,
            additional_info=request_body.additional_info,
            research_questions=json.dumps(request_body.research_questions),
            post_transcript=transcript,
            store_response=True,
        )

        # Process extracted codes
        if isinstance(parsed_response, list):
            parsed_response = {"codes": parsed_response}

        codes = parsed_response.get("codes", [])
        for code in codes:
            code["postId"] = post_id
            code["id"] = str(uuid4())

        return codes

    # Split posts into batches of `batch_size`
    batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

    for batch in batches:
        await manager.broadcast(f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        # Process posts in the batch concurrently
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))
        
        # Flatten results since `gather` returns a list of lists
        for codes in batch_results:
            final_results.extend(codes)

        # await asyncio.sleep(30)

    await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Deductive coding completed successfully!",
        "data": final_results
    }


# @router.post("/deductive-coding")
# @log_execution_time()
# async def deductive_coding_endpoint(
#     request_body: DeductiveCodingRequest
# ):
#     if not request_body.dataset_id:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")
#     try:
#         # Fetch posts
#         await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

#         # Initialize LLMs
#         llm = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.6,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )

#         posts = request_body.unseen_post_ids
#         dataset_id = request_body.dataset_id

#         function_id = str(uuid4())

#         final_results = []
        
#         print(posts, dataset_id, function_id)

#         while len(posts) > 0:
#             post_id = posts[0]
#             await manager.broadcast(f"Dataset {dataset_id}: Processing post {post_id}...")

#             try:
#                 print("Processing post", post_id)
#                 # Fetch post and comments
#                 await manager.broadcast(f"Dataset {dataset_id}: Fetching data for post {post_id}...")
#                 post_data = get_post_and_comments_from_id(post_id, dataset_id)

#                 print("Generating transcript")
#                 # Generate transcript and context
#                 await manager.broadcast(f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
#                 transcript = generate_transcript(post_data)

#                 # Retry logic for LLM1
#                 retries = 3
#                 success = False
#                 result: str = None
#                 while retries > 0 and not success:
#                     try:
#                         await manager.broadcast(f"Dataset {dataset_id}: Generating with LLM1 for post {post_id}...")

#                         print("LLM starting generation")
#                         generation_prompt = DeductiveCoding.deductive_coding_prompt(
#                             request_body.final_codebook,
#                             transcript
#                         )
#                         print("LLM generation prompt", generation_prompt)
#                         result = await asyncio.to_thread(llm.invoke, generation_prompt)
#                         print("LLM result")
#                         execute_query(f"INSERT INTO llm_responses (dataset_id, post_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
#                                   (dataset_id, post_id, request_body.model, result.lower(), str(uuid4()), "LLM response deductive coding", function_id)
#                         )
#                         print("LLM response saved to database")
#                         success = True
#                         await manager.broadcast(f"Dataset {dataset_id}: LLM1 completed generation for post {post_id}.")
#                     except Exception as e:
#                         retries -= 1
#                         await manager.broadcast(
#                             f"WARNING: Dataset {dataset_id}: Error generating with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
#                         )
#                         if retries == 0:
#                             await manager.broadcast(
#                                 f"ERROR: Dataset {dataset_id}: LLM1 failed for post {post_id} after multiple attempts."
#                             )
#                             raise e
#                 print("LLM completed generation", result)
#                 await manager.broadcast(f"Dataset {dataset_id}: Processed post {post_id}.")
#                 posts.pop(0)

#                 regex = r"\"codes\":\s*(\[.*?\])"
#                 codes_match = re.search(regex, result, re.DOTALL)
#                 if not codes_match:
#                     await manager.broadcast(f"WARNING: Dataset {dataset_id}: No codes found for post {post_id}.")
#                     continue

#                 codes = json.loads(codes_match.group(1))
#                 for code in codes:
#                     code["postId"] = post_id
#                     code["id"] = str(uuid4())
#                     final_results.append(code)
#             except Exception as e:
#                 await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
#                 posts.pop(0)
#         await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")
#         # return final_results if len(final_results) else []

#         print(final_results)

#         print("Returning response")
#         return {
#             "message": "Initial codes generated successfully!",
#             "data": final_results
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/theme-generation")
async def theme_generation_endpoint(
    request_body: ThemeGenerationRequest,
    # settings: Annotated[config.Settings, Depends(config.get_settings)], 
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Theme generation process started.")

    llm, _ = get_llm_and_embeddings(request_body.model, settings=settings)
    # Prepare QEC (Quote, Explanation, Code) table
    qec_table = [
        {"quote": row["quote"], "explanation": row["explanation"], "code": row["code"]}
        for row in request_body.sampled_post_responses + request_body.unseen_post_responses
    ]

    parsed_response = await process_llm_task(
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=ThemeGeneration.theme_generation_prompt,  # Uses correct function
        llm_instance=llm,
        qec_table=json.dumps({"codes": qec_table})  # Pass QEC table as input
    )

    print(parsed_response)

    # Process extracted codes
    if isinstance(parsed_response, list):
        parsed_response = {"themes": parsed_response}

    # Process extracted themes
    themes = parsed_response.get("themes", [])
    for theme in themes:
        theme["id"] = str(uuid4())  # Assign unique ID

    # Identify unplaced codes
    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(row["code"] for row in qec_table) - placed_codes)

    await manager.broadcast(f"Dataset {dataset_id}: Theme generation completed.")

    await asyncio.sleep(5)

    return {
        "message": "Themes generated successfully!",
        "data": {
            "themes": themes,
            "unplaced_codes": unplaced_codes
        }
    }

# @router.post("/theme-generation")
# @log_execution_time()
# async def refine_codebook_endpoint(
#     request_body: ThemeGenerationRequest
# ):
#     if not request_body.dataset_id:
#         raise HTTPException(status_code=400, detail="Invalid request parameters.")
#     try:
#          # Fetch posts
#         await manager.broadcast(f"Dataset {request_body.dataset_id}: Code generation process started.")

#         # Initialize LLMs
#         llm = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.6,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )

#         dataset_id = request_body.dataset_id

#         retries = 3
#         success = False
#         result: str = None
#         while retries > 0 and not success:
#             try:
#                 print("LLM starting generation")
#                 qec_table = []

#                 for row in request_body.sampled_post_responses:
#                     qec_table.append({
#                         "quote": row["quote"],
#                         "explanation": row["explanation"],
#                         "code": row["code"]
#                     })
                
#                 for row in request_body.unseen_post_responses:
#                     qec_table.append({
#                         "quote": row["quote"],
#                         "explanation": row["explanation"],
#                         "code": row["code"]
#                     })

#                 generation_prompt = ThemeGeneration.theme_generation_prompt(json.dumps({"codes":qec_table}))
#                 print("LLM generation prompt", generation_prompt)
#                 result = await asyncio.to_thread(llm.invoke, generation_prompt)
#                 print("LLM result")
#                 success = True
#             except Exception as e:
#                 retries -= 1
#                 if retries == 0:
#                     raise e
#         print("LLM completed generation", result)

#         regex  = r"```json.*?```"
#         themes_match = re.search(regex, result, re.DOTALL)
#         if not themes_match:
#             return {
#                 "message": "No themes generated",
#                 "data": {
#                     "themes": [],
#                     "unplaced_codes": [row["code"] for row in qec_table]
#                 }
#             }
        
#         themes = json.loads(themes_match.group(0).replace("```json", "").replace("```", ""))

#         print(themes)
#         placed_codes = []
#         for theme in themes.get("themes", []):
#             theme["id"] = str(uuid4())  # Assign a unique ID
#             placed_codes.extend(theme["codes"]) 
#         print("Returning response")

#         unplaced_codes = list(set(code["code"] for code in qec_table) - set(placed_codes))

#         return {
#             "message": "Themes generated successfully!",
#             "data": {
#                 "themes": themes["themes"],
#                 "unplaced_codes": unplaced_codes
#             }
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    