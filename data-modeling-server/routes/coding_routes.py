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
    print("Initialize vector store")
    vector_store = initialize_vector_store(dataset_id, model, embeddings)
    await save_context_files(dataset_id, contextFiles, vector_store)

    # Create retriever from vector store
    await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
    retriever = vector_store.as_retriever()

    # Build input for LLM
    input_text = ContextPrompt.BACKGROUND_RESEARCH(mainTopic, researchQuestions, additionalInfo)

    parsed_keywords = await process_llm_task(
        dataset_id=dataset_id,
        manager=manager,
        llm_model=model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        rag_prompt_builder_func=ContextPrompt.systemPromptTemplate, 
        retriever=retriever, 
        input_text=input_text,  
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

@router.post("/regenerate-keywords")
async def regenerate_keywords_endpoint(
    request: RegenerateKeywordsRequest,
    # settings: Annotated[config.Settings, Depends(config.get_settings)],
):
    dataset_id = request.datasetId
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Regenerating keywords with feedback...")

    llm, embeddings = get_llm_and_embeddings(request.model, settings=settings)

    vector_store = initialize_vector_store(dataset_id, request.model, embeddings)
    retriever = vector_store.as_retriever(search_kwargs={'k': 10})

    parsed_keywords = await process_llm_task(
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```", 
        rag_prompt_builder_func=ContextPrompt.regenerationPromptTemplate, 
        retriever=retriever, 
        llm_instance=llm,
        input_text=ContextPrompt.refined_BACKGROUND_RESEARCH( 
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

@router.post("/generate-initial-codes")
async def generate_codes_endpoint(
    request_body: GenerateInitialCodesRequest,
    batch_size: int = 10  # Default batch size (can be overridden in request)
):
    dataset_id = request_body.dataset_id
    if not dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    await manager.broadcast(f"Dataset {dataset_id}: Code generation process started.")


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

        for codes in batch_results:
            final_results.extend(codes)

    await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Initial codes generated successfully!",
        "data": final_results
    }

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

@router.post("/deductive-coding")
async def deductive_coding_endpoint(
    request_body: DeductiveCodingRequest,
    batch_size: int = 10  
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

    batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

    for batch in batches:
        await manager.broadcast(f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))
        
        for codes in batch_results:
            final_results.extend(codes)


    await manager.broadcast(f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Deductive coding completed successfully!",
        "data": final_results
    }


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

    if isinstance(parsed_response, list):
        parsed_response = {"themes": parsed_response}

    themes = parsed_response.get("themes", [])
    for theme in themes:
        theme["id"] = str(uuid4())

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