import asyncio
from collections import defaultdict
import json
from typing import Annotated, List
from uuid import uuid4
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile
import numpy as np

from config import Settings
from controllers.coding_controller import filter_codes_by_transcript, get_llm_and_embeddings, initialize_vector_store, process_llm_task, save_context_files
from headers.app_id import get_app_id
from models.coding_models import CodebookRefinementRequest, DeductiveCodingRequest, GenerateInitialCodesRequest, GroupCodesRequest, RefineCodeRequest, RegenerateKeywordsRequest, RemakeCodebookRequest, RemakeDeductiveCodesRequest, SamplePostsRequest, ThemeGenerationRequest
from routes.websocket_routes import manager

from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from database.db_helpers import get_post_and_comments_from_id
from utils.prompts_v2 import ContextPrompt, DeductiveCoding, GroupCodes, InitialCodePrompts, RefineCodebook, RefineSingleCode, RemakerPrompts, ThemeGeneration


router = APIRouter(dependencies=[Depends(get_app_id)])
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
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
):
    if not datasetId:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    dataset_id = datasetId

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing started.")

    llm, embeddings = get_llm_and_embeddings(model, settings=settings)

    # Initialize vector store & process files
    print("Initialize vector store")
    vector_store = initialize_vector_store(dataset_id, model, embeddings)
    await save_context_files(app_id, dataset_id, contextFiles, vector_store)

    # Create retriever from vector store
    await manager.send_message(app_id, f"Dataset {dataset_id}: Creating retriever...")
    retriever = vector_store.as_retriever(search_kwargs={'k': 20})

    # Build input for LLM
    input_text = ContextPrompt.context_builder(mainTopic, researchQuestions, additionalInfo)

    parsed_keywords = await process_llm_task(
        app_id=app_id,
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
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
    )

    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing complete.")

    return {
        "message": "Context built successfully!",
        "keywords": parsed_keywords.get("keywords", [])
    }

@router.post("/regenerate-keywords")
async def regenerate_keywords_endpoint(
    request: Request,
    request_body: RegenerateKeywordsRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
    # settings: Annotated[config.Settings, Depends(config.get_settings)],
):
    dataset_id = request_body.datasetId
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Regenerating keywords with feedback...")

    llm, embeddings = get_llm_and_embeddings(request_body.model, settings=settings)

    vector_store = initialize_vector_store(dataset_id, request_body.model, embeddings)
    retriever = vector_store.as_retriever(search_kwargs={'k': 50})

    parsed_keywords = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```", 
        rag_prompt_builder_func=ContextPrompt.regenerationPromptTemplate, 
        retriever=retriever, 
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        input_text=ContextPrompt.refined_context_builder( 
            request_body.mainTopic, 
            request_body.researchQuestions, 
            request_body.additionalInfo, 
            request_body.selectedKeywords, 
            request_body.unselectedKeywords, 
            request_body.extraFeedback
        ),
        mainTopic=request_body.mainTopic,
        researchQuestions=request_body.researchQuestions,
        additionalInfo=request_body.additionalInfo,
        selectedKeywords=request_body.selectedKeywords,
        unselectedKeywords=request_body.unselectedKeywords,
        extraFeedback=request_body.extraFeedback,
    )

    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing complete.")

    return {
        "message": "Keywords regenerated successfully!",
        "keywords": parsed_keywords.get("keywords", [])
    }

@router.post("/generate-initial-codes")
async def generate_codes_endpoint(request: Request,
    request_body: GenerateInitialCodesRequest,
    batch_size: int = 100,  
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
):
    dataset_id = request_body.dataset_id
    if not dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")


    llm, _ = get_llm_and_embeddings(request_body.model)
    final_results = []
    function_id = str(uuid4())

    async def process_post(post_id: str):
        """Processes a single post asynchronously."""
        try:
            await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
            post_data = get_post_and_comments_from_id(post_id, dataset_id)

            await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
            transcript = generate_transcript(post_data)

            parsed_response = await process_llm_task(
                app_id=app_id,
                dataset_id=dataset_id,
                post_id=post_id,
                manager=manager,
                llm_model=request_body.model,
                regex_pattern=r"\"codes\":\s*(\[.*?\])",
                prompt_builder_func=InitialCodePrompts.initial_code_prompt,
                llm_instance=llm,
                llm_queue_manager=llm_queue_manager,
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

            codes = filter_codes_by_transcript(codes, transcript)
            await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
            return codes

        except Exception as e:
            await manager.send_message(app_id, f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
            return []

    # Split posts into batches of `batch_size`
    sampled_posts = request_body.sampled_post_ids
    batches = [sampled_posts[i:i + batch_size] for i in range(0, len(sampled_posts), batch_size)]

    for batch in batches:
        await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        # Process posts in the batch concurrently
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))

        for codes in batch_results:
            final_results.extend(codes)

    await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Initial codes generated successfully!",
        "data": final_results
    }

@router.post("/refine-codebook")
async def refine_codebook_endpoint(
    request: Request,
    request_body: CodebookRefinementRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
    # settings: Annotated[config.Settings, Depends(config.get_settings)],
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")

    llm, _ = get_llm_and_embeddings(request_body.model, settings=settings)
    # Convert codebooks to JSON format
    prev_codebook_json = json.dumps(request_body.prevCodebook, indent=2)
    current_codebook_json = json.dumps(request_body.currentCodebook, indent=2)

    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=RefineCodebook.refine_codebook_prompt,  # Non-RAG prompt
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
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

    await manager.send_message(app_id, f"Dataset {dataset_id}: Codebook refinement completed.")

    return {
        "message": "Refined codebook generated successfully!",
        # "agreements": agreements,
        "disagreements": disagreements,
        "data": final_results
    }

@router.post("/deductive-coding")
async def deductive_coding_endpoint(
    request: Request,
    request_body: DeductiveCodingRequest,
    batch_size: int = 100,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Deductive coding process started.")

    final_results = []
    posts = request_body.unseen_post_ids
    llm, _ = get_llm_and_embeddings(request_body.model)

    async def process_post(post_id: str):
        """Processes a single post asynchronously."""
        await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
        post_data = get_post_and_comments_from_id(post_id, dataset_id)

        await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
        transcript = generate_transcript(post_data)

        parsed_response = await process_llm_task(
            app_id=app_id,
            dataset_id=dataset_id,
            post_id=post_id,
            manager=manager,
            llm_model=request_body.model,
            regex_pattern=r"```json\s*([\s\S]*?)\s*```",
            prompt_builder_func=DeductiveCoding.deductive_coding_prompt,
            llm_instance=llm,
            llm_queue_manager=llm_queue_manager,
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

        codes = filter_codes_by_transcript(codes, transcript)
        await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
        return codes

    batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

    for batch in batches:
        await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))
        
        for codes in batch_results:
            final_results.extend(codes)


    await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Deductive coding completed successfully!",
        "data": final_results
    }


@router.post("/theme-generation")
async def theme_generation_endpoint(
    request: Request,
    request_body: ThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
    # settings: Annotated[config.Settings, Depends(config.get_settings)], 
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation process started.")

    llm, _ = get_llm_and_embeddings(request_body.model, settings=settings)

    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    grouped_qec = defaultdict(list)
    for row in rows:
        grouped_qec[row["code"]].append({
            "quote": row["quote"],
            "explanation": row["explanation"]
        })

    qec_table = [
        {"code": code, "instances": instances}
        for code, instances in grouped_qec.items()
    ]

    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=ThemeGeneration.theme_generation_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        qec_table=json.dumps({"codes": qec_table}), 
        unique_codes = json.dumps(list(grouped_qec.keys()))
    )

    print(parsed_response)

    if isinstance(parsed_response, list):
        parsed_response = {"themes": parsed_response}

    themes = parsed_response.get("themes", [])
    for theme in themes:
        theme["id"] = str(uuid4())

    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(row["code"] for row in qec_table) - placed_codes)

    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation completed.")

    await asyncio.sleep(5)

    return {
        "message": "Themes generated successfully!",
        "data": {
            "themes": themes,
            "unplaced_codes": unplaced_codes
        }
    }


@router.post("/refine-code")
async def refine_single_code_endpoint(
    request: Request,
    request_body: RefineCodeRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    llm, _ = get_llm_and_embeddings(request_body.model)
    post_data = get_post_and_comments_from_id(request_body.post_id, dataset_id)
    transcript = generate_transcript(post_data)

    *chat_history, user_comment = request_body.chat_history

    parsed_response = await process_llm_task(
        app_id=request.headers.get("x-app-id"),
        dataset_id="",
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=RefineSingleCode.refine_single_code_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        transcript=transcript,
        code=request_body.code,
        quote=request_body.quote,
        chat_history=chat_history,
        user_comment=user_comment
    )


    # print(parsed_response["alternate_codes"])
    # parsed_response["alternate_codes"] = json.loads(parsed_response["alternate_codes"])

    return parsed_response


@router.post("/remake-codebook")
async def generate_codes_endpoint(request: Request,
    request_body: RemakeCodebookRequest,
    batch_size: int = 1000,  # Default batch size (can be overridden in request)
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
):
    dataset_id = request_body.dataset_id
    if not dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")


    llm, _ = get_llm_and_embeddings(request_body.model)
    final_results = []
    function_id = str(uuid4())

    async def process_post(post_id: str):
        """Processes a single post asynchronously."""
        try:
            await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
            post_data = get_post_and_comments_from_id(post_id, dataset_id)

            await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
            transcript = generate_transcript(post_data)

            parsed_response = await process_llm_task(
                app_id=app_id,
                dataset_id=dataset_id,
                post_id=post_id,
                manager=manager,
                llm_model=request_body.model,
                regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                prompt_builder_func=RemakerPrompts.codebook_remake_prompt,
                llm_instance=llm,
                llm_queue_manager=llm_queue_manager,
                main_topic=request_body.main_topic,
                additional_info=request_body.additional_info,
                research_questions=request_body.research_questions,
                keyword_table=json.dumps(request_body.keyword_table),
                function_id=function_id,
                post_transcript=transcript,
                current_codebook=json.dumps(request_body.codebook),
                feedback = request_body.feedback,
                store_response=True,
            )

            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            codes = filter_codes_by_transcript(codes, transcript)
            await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
            return codes

        except Exception as e:
            await manager.send_message(app_id, f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
            return []

    # Split posts into batches of `batch_size`
    sampled_posts = request_body.sampled_post_ids
    batches = [sampled_posts[i:i + batch_size] for i in range(0, len(sampled_posts), batch_size)]

    for batch in batches:
        await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        # Process posts in the batch concurrently
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))

        for codes in batch_results:
            final_results.extend(codes)

    await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Initial codes generated successfully!",
        "data": final_results
    }

@router.post("/remake-deductive-codes")
async def redo_deductive_coding_endpoint(
    request: Request,
    request_body: RemakeDeductiveCodesRequest,
    batch_size: int = 1000,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)  
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Deductive coding process started.")

    final_results = []
    posts = request_body.unseen_post_ids
    llm, _ = get_llm_and_embeddings(request_body.model)

    async def process_post(post_id: str):
        """Processes a single post asynchronously."""
        await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
        post_data = get_post_and_comments_from_id(post_id, dataset_id)

        await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
        transcript = generate_transcript(post_data)

        parsed_response = await process_llm_task(
            app_id=app_id,
            dataset_id=dataset_id,
            post_id=post_id,
            manager=manager,
            llm_model=request_body.model,
            regex_pattern=r"```json\s*([\s\S]*?)\s*```",
            prompt_builder_func=RemakerPrompts.deductive_codebook_remake_prompt,
            llm_instance=llm,
            llm_queue_manager=llm_queue_manager,
            final_codebook=json.dumps(request_body.final_codebook, indent=2),
            keyword_table=json.dumps(request_body.keyword_table, indent=2),
            main_topic=request_body.main_topic,
            additional_info=request_body.additional_info,
            research_questions=json.dumps(request_body.research_questions),
            post_transcript=transcript,
            current_codebook=json.dumps(request_body.current_codebook),
            store_response=True,
        )

        # Process extracted codes
        if isinstance(parsed_response, list):
            parsed_response = {"codes": parsed_response}

        codes = parsed_response.get("codes", [])
        for code in codes:
            code["postId"] = post_id
            code["id"] = str(uuid4())

        codes = filter_codes_by_transcript(codes, transcript)
        await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
        return codes

    batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

    for batch in batches:
        await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
        
        batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))
        
        for codes in batch_results:
            final_results.extend(codes)


    await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

    return {
        "message": "Deductive coding completed successfully!",
        "data": final_results
    }


@router.post("/group-codes")
async def group_codes_endpoint(
    request: Request,
    request_body: GroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    llm, _ = get_llm_and_embeddings(request_body.model, settings=settings)

    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    grouped_qec = defaultdict(list)
    for row in rows:
        grouped_qec[row["code"]].append({
            "quote": row["quote"],
            "explanation": row["explanation"]
        })

    qec_table = [
        {"code": code, "instances": instances}
        for code, instances in grouped_qec.items()
    ]

    print(qec_table, grouped_qec)

    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GroupCodes.group_codes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(list(grouped_qec.keys())),
        qec_table=json.dumps(qec_table)
    )

    print(parsed_response)

    if isinstance(parsed_response, list):
        parsed_response = {"higher_level_codes": parsed_response}

    higher_level_codes = parsed_response.get("higher_level_codes", [])
    for higher_level_code in higher_level_codes:
        higher_level_code["id"] = str(uuid4())

    placed_codes = {code for higher_level_code in higher_level_codes for code in higher_level_code["codes"]}
    unplaced_codes = list(set(row["code"] for row in qec_table) - placed_codes)

    return {
        "message": "Codes grouped successfully!",
        "data": {
            "higher_level_codes": higher_level_codes,
            "unplaced_codes": unplaced_codes
        }
    }
