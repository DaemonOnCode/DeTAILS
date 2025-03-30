import asyncio
from calendar import c
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
import os
from typing import Annotated, List
from uuid import uuid4
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile
import numpy as np
import pandas as pd

from config import Settings, CustomSettings
from controllers.coding_controller import cluster_words_with_llm, filter_codes_by_transcript, initialize_vector_store, insert_responses_into_db, process_llm_task, save_context_files, summarize_codebook_explanations, summarize_with_llm
from controllers.collection_controller import get_reddit_post_by_id
from headers.app_id import get_app_id
from models.coding_models import CodebookRefinementRequest, DeductiveCodingRequest, GenerateCodebookWithoutQuotesRequest, GenerateDeductiveCodesRequest, GenerateInitialCodesRequest, GroupCodesRequest, RedoThemeGenerationRequest, RefineCodeRequest, RegenerateCodebookWithoutQuotesRequest, RegenerateKeywordsRequest, RegroupCodesRequest, RemakeCodebookRequest, RemakeDeductiveCodesRequest, SamplePostsRequest, SelectedPostIdsRequest, ThemeGenerationRequest
from models.table_dataclasses import CodebookType, GenerationType, ResponseCreatorType, SelectedPostId
from routes.websocket_routes import manager
from database import FunctionProgressRepository, QectRepository, SelectedPostIdsRepository
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from models import FunctionProgress, QectResponse
from database.db_helpers import get_post_and_comments_from_id
from utils.prompts_v2 import ContextPrompt, DeductiveCoding, GenerateCodebookWithoutQuotes, GenerateDeductiveCodesFromCodebook, GroupCodes, InitialCodePrompts, RefineCodebook, RefineSingleCode, RemakerPrompts, ThemeGeneration


router = APIRouter(dependencies=[Depends(get_app_id)])
settings = Settings()

function_progress_repo = FunctionProgressRepository()
qect_repo = QectRepository()
selected_post_ids_repo = SelectedPostIdsRepository()

@router.post("/get-selected-post-ids")
async def get_selected_post_ids_endpoint(
    request_body: SelectedPostIdsRequest
):
    return selected_post_ids_repo.find({"dataset_id": request_body.dataset_id})

@router.post("/sample-posts")
async def sample_posts_endpoint(request_body: SamplePostsRequest):
    settings = CustomSettings()

    if (request_body.sample_size <= 0 or 
        request_body.dataset_id == "" or 
        len(request_body.post_ids) == 0 or 
        request_body.divisions < 1):
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    
    dataset_id = request_body.dataset_id
    post_ids = request_body.post_ids
    sample_size = request_body.sample_size
    divisions = request_body.divisions
    workspace_id = request_body.workspace_id

    if len(selected_post_ids_repo.find({"dataset_id": dataset_id}))!=0:
        selected_post_ids_repo.delete({"dataset_id": dataset_id})


    sem = asyncio.Semaphore(os.cpu_count())

    async def fetch_and_compute_length(post_id: str):
        async with sem:
            try:
                post = await asyncio.to_thread(get_reddit_post_by_id, dataset_id, post_id)
                transcript = await asyncio.to_thread(generate_transcript, post)
                length = len(transcript)
                return post_id, length
            except HTTPException as e:
                print(f"Post {post_id} not found: {e.detail}")
                return post_id, None
            except Exception as e:
                print(f"Unexpected error for post {post_id}: {e}")
                return post_id, None

    tasks = [fetch_and_compute_length(post_id) for post_id in post_ids]
    results = await asyncio.gather(*tasks)

    valid_results = [res for res in results if res[1] is not None]
    invalid_post_ids = [res[0] for res in results if res[1] is None]

    if invalid_post_ids:
        print(f"Some posts were not found: {invalid_post_ids}")

    if not valid_results:
        raise HTTPException(status_code=400, detail="No valid posts found.")

    df = pd.DataFrame(valid_results, columns=['post_id', 'length'])
    np.random.seed(settings.ai.randomSeed)

    if divisions == 1:
        return {"sample": df['post_id'].tolist()}

    if divisions in [2, 3]:
        N = len(df)
        base_size = N // divisions
        remainder = N % divisions
        group_sizes = [base_size + 1 if i < remainder else base_size for i in range(divisions)]

        try:
            df['stratum'] = pd.qcut(df['length'], q=4, labels=False)
        except ValueError as e:
            if "Bin edges must be unique" in str(e):
                df = df.sample(frac=1, random_state=settings.ai.randomSeed).reset_index(drop=True)
                groups = []
                start = 0
                for size in group_sizes:
                    end = start + size
                    group_posts = df.iloc[start:end]['post_id'].tolist()
                    groups.append(group_posts)
                    start = end
            else:
                raise HTTPException(status_code=500, detail=f"Error in stratification: {e}")
        else:
            groups = []
            remaining_df = df.copy()
            for size in group_sizes:
                grouped = remaining_df.groupby('stratum')
                stratum_sizes = grouped.size()
                p = size / len(remaining_df) if len(remaining_df) > 0 else 0
                S_stratum_f = p * stratum_sizes
                S_stratum = S_stratum_f.astype(int)
                sum_S_stratum = S_stratum.sum()
                remainder_samples = size - sum_S_stratum
                if remainder_samples > 0:
                    fractional_parts = S_stratum_f - S_stratum
                    top_indices = fractional_parts.nlargest(remainder_samples).index
                    S_stratum.loc[top_indices] += 1

                sampled_post_ids = []
                for stratum, group in grouped:
                    n_samples = min(S_stratum[stratum], len(group))
                    if n_samples > 0:
                        sampled = group.sample(n=n_samples, random_state=settings.ai.randomSeed)
                        sampled_post_ids.extend(sampled['post_id'].tolist())

                groups.append(sampled_post_ids)
                remaining_df = remaining_df[~remaining_df['post_id'].isin(sampled_post_ids)]
    else:
        remaining_df = df.copy()
        groups = []
        for i in range(divisions - 1):
            try:
                remaining_df['stratum'] = pd.qcut(remaining_df['length'], q=4, labels=False)
            except ValueError as e:
                if "Bin edges must be unique" in str(e):
                    sampled = remaining_df.sample(frac=sample_size, random_state=settings.ai.randomSeed)
                else:
                    raise HTTPException(status_code=500, detail=f"Error in stratification: {e}")
            else:
                grouped = remaining_df.groupby('stratum')
                stratum_sizes = grouped.size()
                p = sample_size
                total_to_sample = min(int(p * len(remaining_df)), len(remaining_df))
                S_stratum_f = p * stratum_sizes
                S_stratum = S_stratum_f.astype(int)
                sum_S_stratum = S_stratum.sum()
                remainder = total_to_sample - sum_S_stratum
                if remainder > 0:
                    fractional_parts = S_stratum_f - S_stratum
                    top_indices = fractional_parts.nlargest(remainder).index
                    S_stratum.loc[top_indices] += 1

                sampled_post_ids = []
                for stratum, group in grouped:
                    n_samples = min(S_stratum[stratum], len(group))
                    if n_samples > 0:
                        sampled = group.sample(n=n_samples, random_state=settings.ai.randomSeed)
                        sampled_post_ids.extend(sampled['post_id'].tolist())
                sampled = remaining_df[remaining_df['post_id'].isin(sampled_post_ids)]

            groups.append(sampled['post_id'].tolist())
            remaining_df = remaining_df[~remaining_df['post_id'].isin(sampled['post_id'])]

        groups.append(remaining_df['post_id'].tolist())

    if divisions == 2:
        group_names = ["sampled", "unseen"]
    elif divisions == 3:
        group_names = ["sampled", "unseen", "test"]
    else:
        group_names = [f"group_{i+1}" for i in range(divisions)]

    result = {group_names[i]: groups[i] for i in range(divisions)}

    if result.get("sampled"):
        selected_post_ids_repo.insert_batch(
            list(map(
                lambda post_id: SelectedPostId(
                    dataset_id=dataset_id,
                    post_id=post_id,
                    type="sampled"
                ),
                result["sampled"]
            ))
        )
    if result.get("unseen"):
        selected_post_ids_repo.insert_batch(
            list(map(
                lambda post_id: SelectedPostId(
                    dataset_id=dataset_id,
                    post_id=post_id,
                    type="unseen"
                ),
                result["unseen"]
            ))
        )
    if result.get("test"):
        selected_post_ids_repo.insert_batch(
            list(map(
                lambda post_id: SelectedPostId(
                    dataset_id=dataset_id,
                    post_id=post_id,
                    type="test"
                ),
                result["test"]
            ))
        )
    return result

@router.post("/build-context-from-topic")
async def build_context_from_interests_endpoint(
    request: Request,
    contextFiles: List[UploadFile],
    model: str = Form(...),
    mainTopic: str = Form(...),
    additionalInfo: str = Form(""),
    researchQuestions: str = Form(...),
    datasetId: str = Form(...),
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    if not datasetId:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    dataset_id = datasetId

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing started.")

    llm, embeddings = llm_service.get_llm_and_embeddings(model)

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
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.datasetId
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Regenerating keywords with feedback...")

    llm, embeddings = llm_service.get_llm_and_embeddings(request_body.model)

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
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")


    function_id = str(uuid4())
    total_posts = len(request_body.sampled_post_ids)

    try:
        if function_progress_repo.find_one({"name": "codebook"}):
            function_progress_repo.delete({"name": "codebook"})
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        # raise HTTPException(status_code=400, detail="Codebook generation already in progress.")

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request_body.workspace_id,
        dataset_id=dataset_id,
        name="codebook",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))
    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
        final_results = []

        async def process_post(post_id: str):
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
                    function_id=function_id,
                    llm_instance=llm,
                    llm_queue_manager=llm_queue_manager,
                    main_topic=request_body.main_topic,
                    additional_info=request_body.additional_info,
                    research_questions=request_body.research_questions,
                    keyword_table=json.dumps(request_body.keyword_table),
                    post_transcript=transcript,
                    store_response=True,
                    cacheable_args={
                        "args":[],
                        "kwargs": [
                            "main_topic",
                            "additional_info",
                            "research_questions",
                            "keyword_table",
                        ]
                    }
                )

                if isinstance(parsed_response, list):
                    parsed_response = {"codes": parsed_response}

                codes = parsed_response.get("codes", [])
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())

                codes = filter_codes_by_transcript(codes, transcript)
                function_progress_repo.update({
                    "function_id": function_id,
                }, {
                    "current": function_progress_repo.find_one({
                        "function_id": function_id
                    }).current + 1
                })
                # for code in codes:
                #     if code.get("code") and code.get("quote") and code.get("explanation"):
                # qect_repo.insert_batch(list(map(lambda code: QECTResponse(
                #     id=code["id"],
                #     generation_type=GenerationType.INITIAL.value,
                #     dataset_id=dataset_id,
                #     workspace_id=request_body.workspace_id,
                #     model=request_body.model,
                #     quote=code["quote"],
                #     code=code["code"],
                #     explanation=code["explanation"],
                #     post_id=code["postId"],
                #     response_type=ResponseCreatorType.LLM.value,
                #     chat_history=None,
                #     codebook_type=CodebookType.INITIAL.value
                # ), codes)))
                codes = insert_responses_into_db(codes, dataset_id, request_body.workspace_id, request_body.model, CodebookType.INITIAL.value)

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

        # qect_responses = []
        # for code in final_results:
        #     qect_response = QECTResponse(
        #         id=code["id"],
        #         generation_type=GenerationType.INITIAL.value,
        #         dataset_id=dataset_id,
        #         workspace_id=request_body.workspace_id,
        #         model=request_body.model,
        #         quote=code["quote"],
        #         code=code["code"],
        #         explanation=code["explanation"],
        #         post_id=code["postId"],
        #         response_type=ResponseCreatorType.LLM.value,
        #         chat_history=None,
        #         codebook_type=CodebookType.INITIAL.value
        #     )
        #     qect_responses.append(qect_response)
        # qect_repo.insert_batch(qect_responses)


        unique_codes = list(set(row["code"] for row in final_results))


        res = await cluster_words_with_llm(
            unique_codes,
            request_body.model,
            app_id,
            dataset_id,
            manager,
            llm,
            llm_queue_manager,
        )

        print("Clustered words with LLM", res)

        reverse_map_one_to_one = {}

        # Iterate through each topic and each of its sub-topics
        for topic_head, subtopics in res.items():
            for subtopic in subtopics:
                # Only set the mapping if this subtopic hasn't been assigned yet
                if subtopic not in reverse_map_one_to_one:
                    reverse_map_one_to_one[subtopic] = topic_head

        for row in final_results:
            row["code"] = reverse_map_one_to_one.get(row["code"], row["code"])

        return {
            "message": "Initial codes generated successfully!",
            "data": final_results
        }
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during code generation.")
    finally:
        function_progress_repo.delete({"function_id": function_id})

@router.post("/refine-codebook")
async def refine_codebook_endpoint(
    request: Request,
    request_body: CodebookRefinementRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
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
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Deductive coding process started.")


    function_id = str(uuid4())
    total_posts = len(request_body.unseen_post_ids)

    try:
        print(function_progress_repo.find())
        if function_progress_repo.find_one({"name": "deductive"}):
            function_progress_repo.delete({"name": "deductive"})
    except Exception as e:
        print(f"Error in deductive_coding_endpoint: {e}")

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request_body.workspace_id,
        dataset_id=dataset_id,
        name="deductive",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        final_results = []
        posts = request_body.unseen_post_ids
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        async def process_post(post_id: str):
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
                function_id=function_id,
                llm_queue_manager=llm_queue_manager,
                final_codebook=json.dumps(request_body.final_codebook, indent=2),
                keyword_table=json.dumps(request_body.keyword_table, indent=2),
                main_topic=request_body.main_topic,
                additional_info=request_body.additional_info,
                research_questions=json.dumps(request_body.research_questions),
                post_transcript=transcript,
                store_response=True,
                cacheable_args={
                    "args":[],
                    "kwargs": [
                        "main_topic",
                        "additional_info",
                        "research_questions",
                        "keyword_table",
                        "final_codebook"
                    ]
                }
            )

            # Process extracted codes
            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            codes = filter_codes_by_transcript(codes, transcript)
            function_progress_repo.update({
                    "function_id": function_id,
                }, {
                    "current": function_progress_repo.find_one({
                        "function_id": function_id
                    }).current + 1
                })

            codes = insert_responses_into_db(codes, dataset_id, request_body.workspace_id, request_body.model, CodebookType.DEDUCTIVE.value)

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
    except Exception as e:
        print(f"Error in deductive_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during deductive coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})


@router.post("/theme-generation")
async def theme_generation_endpoint(
    request: Request,
    request_body: ThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation process started.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    # Combine sampled and unseen responses
    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    # Group responses by code
    grouped_qec = defaultdict(list)
    for row in rows:
        grouped_qec[row["code"]].append({
            "quote": row["quote"],
            "explanation": row["explanation"]
        })

    # Summarize explanations for each code
    summaries = await summarize_codebook_explanations(
        responses=rows,  # Pass the raw responses
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000  # Adjust based on your model's token limit
    )

    # Create a table with codes and their summarized explanations
    qec_table = [
        {"code": code, "summary": summaries[code]}
        for code in summaries
    ]

    print(qec_table)

    # Generate themes using the summarized explanations
    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=ThemeGeneration.theme_generation_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        qec_table=json.dumps({"codes": qec_table}),  # Pass summarized data
        unique_codes=json.dumps(list(summaries.keys()))
    )

    print(parsed_response)

    # Process the response
    if isinstance(parsed_response, list):
        parsed_response = {"themes": parsed_response}

    themes = parsed_response.get("themes", [])
    for theme in themes:
        theme["id"] = str(uuid4())

    # Identify placed and unplaced codes
    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(summaries.keys()) - placed_codes)

    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation completed.")

    await asyncio.sleep(5)

    return {
        "message": "Themes generated successfully!",
        "data": {
            "themes": themes,
            "unplaced_codes": unplaced_codes
        }
    }


@router.post("/redo-theme-generation")
async def redo_theme_generation_endpoint(
    request: Request,
    request_body: RedoThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation redo process started.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    grouped_qec = defaultdict(list)
    for row in rows:
        grouped_qec[row["code"]].append({
            "quote": row["quote"],
            "explanation": row["explanation"]
        })

    summaries = await summarize_codebook_explanations(
        responses=rows,
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000
    )

    qec_table = [
        {"code": code, "summary": summaries[code]}
        for code in summaries
    ]

    print(qec_table)

    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=ThemeGeneration.redo_theme_generation_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        qec_table=json.dumps({"codes": qec_table}),
        unique_codes=json.dumps(list(summaries.keys())),
        previous_themes=json.dumps(request_body.previous_themes),
        feedback=request_body.feedback
    )

    print(parsed_response)

    if isinstance(parsed_response, list):
        parsed_response = {"themes": parsed_response}

    themes = parsed_response.get("themes", [])
    for theme in themes:
        theme["id"] = str(uuid4())

    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(summaries.keys()) - placed_codes)

    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation redo completed.")

    await asyncio.sleep(5)

    return {
        "message": "Themes regenerated successfully!",
        "data": {
            "themes": themes,
            "unplaced_codes": unplaced_codes
        }
    }


@router.post("/refine-code")
async def refine_single_code_endpoint(
    request: Request,
    request_body: RefineCodeRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
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
    batch_size: int = 100,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id or len(request_body.sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")


    function_id = str(uuid4())
    total_posts = len(request_body.sampled_post_ids)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request_body.workspace_id,
        dataset_id=dataset_id,
        name="codebook",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
        final_results = []
        function_id = str(uuid4())

        summarized_codebook_dict = await summarize_codebook_explanations(
            responses=request_body.codebook,
            llm_model=request_body.model,
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            llm_instance=llm,
            llm_queue_manager=llm_queue_manager,
            max_input_tokens=128000  # Adjust based on your LLM's token limit
        )
        # Convert dictionary back to list of dictionaries
        summarized_codebook = [{"code": code, "explanation": summary} 
                              for code, summary in summarized_codebook_dict.items()]

        async def process_post(post_id: str):
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
                    current_codebook=json.dumps(summarized_codebook),
                    feedback = request_body.feedback,
                    store_response=True,
                    cacheable_args={
                        "args":[],
                        "kwargs": [
                            "main_topic",
                            "additional_info",
                            "research_questions",
                            "keyword_table",
                            "current_codebook",
                            "feedback"
                        ]
                    }
                )

                if isinstance(parsed_response, list):
                    parsed_response = {"codes": parsed_response}

                codes = parsed_response.get("codes", [])
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())

                codes = filter_codes_by_transcript(codes, transcript)

                codes = insert_responses_into_db(codes, dataset_id, request_body.workspace_id, request_body.model, CodebookType.INITIAL.value)

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
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during code generation.")
    finally:
        function_progress_repo.delete({"function_id": function_id})

@router.post("/remake-deductive-codes")
async def redo_deductive_coding_endpoint(
    request: Request,
    request_body: RemakeDeductiveCodesRequest,
    batch_size: int = 100,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Deductive coding process started.")

    function_id = str(uuid4())
    total_posts = len(request_body.unseen_post_ids)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request_body.workspace_id,
        dataset_id=dataset_id,
        name="deductive",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        final_results = []
        posts = request_body.unseen_post_ids
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        summarized_current_codebook_dict = await summarize_codebook_explanations(
            responses=request_body.current_codebook,
            llm_model=request_body.model,
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            llm_instance=llm,
            llm_queue_manager=llm_queue_manager,
            max_input_tokens=128000
        )
        summarized_current_codebook = [{"code": code, "explanation": summary} 
                                      for code, summary in summarized_current_codebook_dict.items()]

        async def process_post(post_id: str):
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
                current_codebook=json.dumps(summarized_current_codebook),
                store_response=True,
                cacheable_args={
                    "args":[],
                    "kwargs": [
                        "main_topic",
                        "additional_info",
                        "research_questions",
                        "keyword_table",
                        "final_codebook",
                        "current_codebook"
                    ]
                }
            )

            # Process extracted codes
            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            codes = filter_codes_by_transcript(codes, transcript)

            codes = insert_responses_into_db(codes, dataset_id, request_body.workspace_id, request_body.model, CodebookType.DEDUCTIVE.value)
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
    except Exception as e:
        print(f"Error in redo_deductive_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during deductive coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})


@router.post("/group-codes")
async def group_codes_endpoint(
    request: Request,
    request_body: GroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

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

    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    # Summarize explanations for each code
    summarized_explanations = await summarize_codebook_explanations(
        responses=rows,
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000  # Adjust based on your LLM's token limit
    )

    # Create a table with codes and their summarized explanations
    code_summary_table = [
        {"code": code, "summary": summary}
        for code, summary in summarized_explanations.items()
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
        codes=json.dumps([summary["code"] for summary in code_summary_table]),
        qec_table=json.dumps(code_summary_table)
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

@router.post("/regroup-codes")
async def regroup_codes_endpoint(
    request: Request,
    request_body: RegroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

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

    summarized_explanations = await summarize_codebook_explanations(
        responses=rows,
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000
    )

    code_summary_table = [
        {"code": code, "summary": summary}
        for code, summary in summarized_explanations.items()
    ]

    print(qec_table, grouped_qec)

    previous_codes_json = json.dumps(request_body.previous_codes)

    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GroupCodes.regroup_codes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps([summary["code"] for summary in code_summary_table]),
        qec_table=json.dumps(code_summary_table),
        previous_codes=previous_codes_json,
        feedback=request_body.feedback
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
        "message": "Codes regrouped successfully!",
        "data": {
            "higher_level_codes": higher_level_codes,
            "unplaced_codes": unplaced_codes
        }
    }


@router.post("/generate-codebook-without-quotes")
async def generate_codebook_without_quotes_endpoint(
    request: Request,
    request_body: GenerateCodebookWithoutQuotesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    # Combine sampled and unseen responses
    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    # Summarize the explanations for each code
    summarized_dict = await summarize_codebook_explanations(
        responses=rows,
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000  # Adjust based on model's token limit
    )

    # Convert summaries to the expected format: {code: [summary]}
    summarized_grouped_ec = {code: [summary] for code, summary in summarized_dict.items()}

    # Generate the codebook using the summarized explanations
    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GenerateCodebookWithoutQuotes.generate_codebook_without_quotes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(summarized_grouped_ec)  # Pass summarized data
    )

    return {
        "message": "Codebook generated successfully!",
        "data": parsed_response if not (isinstance(parsed_response, list) and len(parsed_response) == 0) else {}
    }
    
@router.post("/regenerate-codebook-without-quotes")
async def regenerate_codebook_without_quotes_endpoint(
    request: Request,
    request_body: RegenerateCodebookWithoutQuotesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    rows = request_body.sampled_post_responses + request_body.unseen_post_responses

    summarized_dict = await summarize_codebook_explanations(
        responses=rows,
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000 
    )

    summarized_grouped_ec = {code: [summary] for code, summary in summarized_dict.items()}

    previous_codebook_json = json.dumps(request_body.previous_codebook)

    parsed_response = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GenerateCodebookWithoutQuotes.regenerate_codebook_without_quotes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(summarized_grouped_ec),  
        previous_codebook=previous_codebook_json  ,
        feedback = request_body.feedback
    )

    return {
        "message": "Codebook regenerated successfully!",
        "data": parsed_response if not (isinstance(parsed_response, list) and len(parsed_response) == 0) else {}
    }

@router.post("/generate-deductive-codes")
async def generate_deductive_codes_endpoint(
    request: Request,
    request_body: GenerateDeductiveCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request_body.dataset_id
    batch_size = 1000
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    function_id = str(uuid4())
    total_posts = len(request_body.post_ids)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request_body.workspace_id,
        dataset_id=dataset_id,
        name="deductive",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        final_results = []
        posts = request_body.post_ids
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        async def process_post(post_id: str):
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
                function_id=function_id,
                regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                prompt_builder_func=GenerateDeductiveCodesFromCodebook.generate_deductive_codes_from_codebook_prompt,
                llm_instance=llm,
                llm_queue_manager=llm_queue_manager,
                codebook = request_body.codebook,
                post_transcript=transcript,
                store_response=True,
                cacheable_args={
                    "args":[],
                    "kwargs": [
                        "codebook"
                    ]
                }
            )

            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            codes = filter_codes_by_transcript(codes, transcript)
            codes = insert_responses_into_db(codes, dataset_id, request_body.workspace_id, request_body.model, CodebookType.MANUAL.value)
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
    except Exception as e:
        print(f"Error in manual_deductive_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during deductive coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})