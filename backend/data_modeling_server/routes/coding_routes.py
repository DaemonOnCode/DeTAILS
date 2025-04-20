import asyncio
import json
import os
import time
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile
import numpy as np
import pandas as pd

from config import Settings, CustomSettings
from constants import CODEBOOK_TYPE_MAP, STUDY_DATABASE_PATH
from controllers.coding_controller import build_where_clause_and_params, cluster_words_with_llm, filter_codes_by_transcript, filter_duplicate_codes_in_db, get_coded_data, initialize_vector_store, insert_responses_into_db, process_llm_task, save_context_files, summarize_codebook_explanations, summarize_with_llm
from controllers.collection_controller import count_comments, get_post_and_comments_from_id, get_reddit_post_by_id
from database.coding_context_table import CodingContextRepository
from database.context_file_table import ContextFilesRepository
from database.grouped_code_table import GroupedCodeEntriesRepository
from database.initial_codebook_table import InitialCodebookEntriesRepository
from database.keyword_entry_table import KeywordEntriesRepository
from database.keyword_table import KeywordsRepository
from database.research_question_table import ResearchQuestionsRepository
from database.selected_keywords_table import SelectedKeywordsRepository
from database.state_dump_table import StateDumpsRepository
from database.theme_table import ThemeEntriesRepository
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from models.coding_models import FilteredResponsesMetadataRequest, FinalCodingRequest, GenerateCodebookWithoutQuotesRequest, GenerateDeductiveCodesRequest, GenerateInitialCodesRequest, GenerateKeywordDefinitionsRequest, GetCodedDataRequest, GroupCodesRequest, PostResponsesRequest, RedoThemeGenerationRequest, RefineCodeRequest, RegenerateCodebookWithoutQuotesRequest, RegenerateKeywordsRequest, RegroupCodesRequest, RemakeCodebookRequest, RemakeFinalCodesRequest, ResponsesRequest, SamplePostsRequest, SelectedPostIdsRequest, ThemeGenerationRequest
from models.table_dataclasses import CodebookType, GenerationType, GroupedCodeEntry, InitialCodebookEntry, Keyword, KeywordEntry, ResponseCreatorType, SelectedKeyword, SelectedPostId, StateDump, ThemeEntry
from routes.websocket_routes import manager
from database import FunctionProgressRepository, QectRepository, SelectedPostIdsRepository
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from models import FunctionProgress, QectResponse
from database.db_helpers import execute_query
from utils.prompts import ConceptOutline, ContextPrompt, FinalCoding, GenerateCodebookWithoutQuotes, GenerateDeductiveCodesFromCodebook, GroupCodes, InitialCodePrompts, RefineSingleCode, RemakerPrompts, ThemeGeneration


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])
settings = Settings()

function_progress_repo = FunctionProgressRepository()
qect_repo = QectRepository()
selected_post_ids_repo = SelectedPostIdsRepository()
coding_context_repo = CodingContextRepository()
context_files_repo = ContextFilesRepository()
research_question_repo = ResearchQuestionsRepository()
keywords_repo = KeywordsRepository()
selected_keywords_repo = SelectedKeywordsRepository()
keyword_entries_repo = KeywordEntriesRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_codes_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

@router.post("/get-selected-post-ids")
async def get_selected_post_ids_endpoint(
    request: Request
):
    return selected_post_ids_repo.find({"dataset_id": request.headers.get("x-workspace-id")})

@router.post("/sample-posts")
async def sample_posts_endpoint(
    request: Request,
    request_body: SamplePostsRequest
):
    settings = CustomSettings()

    dataset_id = request.headers.get("x-workspace-id")

    if (request_body.sample_size <= 0 or 
        dataset_id == "" or 
        len(request_body.post_ids) == 0 or 
        request_body.divisions < 1):
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    
    post_ids = request_body.post_ids
    sample_size = request_body.sample_size
    divisions = request_body.divisions
    workspace_id = request.headers.get("x-workspace-id")

    start_time = time.time()


    try:
        selected_post_ids_repo.update({"dataset_id": dataset_id}, {"type": "ungrouped"})
    except Exception as e:
        print(e)
    
    sem = asyncio.Semaphore(os.cpu_count())

    async def fetch_and_compute_length(post_id: str):
        async with sem:
            try:
                post = await asyncio.to_thread(get_reddit_post_by_id, dataset_id, post_id, [
                    "id", "title", "selftext"
                ])
                num_comments = count_comments(post.get("comments", []))
                transcript = await asyncio.to_thread(generate_transcript, post)
                length = len(transcript)
                return post_id, length, num_comments
            except HTTPException as e:
                print(f"Post {post_id} not found: {e.detail}")
                return post_id, None, None
            except Exception as e:
                print(f"Unexpected error for post {post_id}: {e}")
                return post_id, None, None

    tasks = [fetch_and_compute_length(post_id) for post_id in post_ids]
    results = await asyncio.gather(*tasks)

    valid_results = [res for res in results if res[1] is not None]
    invalid_post_ids = [res[0] for res in results if res[1] is None]

    post_comments = {post_id: num_comments for post_id, _, num_comments in valid_results}

    if invalid_post_ids:
        print(f"Some posts were not found: {invalid_post_ids}")

    if not valid_results:
        raise HTTPException(status_code=400, detail="No valid posts found.")

    df = pd.DataFrame(valid_results, columns=['post_id', 'length', "num_comments"])
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

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "dataset_id": dataset_id,
                "sample_size": sample_size,
                "divisions": divisions,
                "groups": result,
                "post_comments": post_comments
            }),
            context=json.dumps({
                "function": "sample_posts",
                "workspace_id": workspace_id,
                "time_taken": time.time() - start_time,
            }),
        )
    )

    for group_name, post_ids in result.items():
        selected_post_ids_repo.bulk_update(
            [
                {"type": group_name} for _ in post_ids
            ],
            [{"dataset_id": dataset_id, "post_id": post_id} for post_id in post_ids],
        )
    return result


@router.post("/build-context-from-topic")
async def build_context_from_interests_endpoint(
    request: Request,
    contextFiles: List[UploadFile],
    model: str = Form(...),
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    workspace_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]

    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing started.")

    start_time = time.time()

    llm, embeddings = llm_service.get_llm_and_embeddings(model)

    print("Initialize vector store")
    vector_store = initialize_vector_store(dataset_id, model, embeddings)
    await save_context_files(app_id, dataset_id, contextFiles, vector_store)

    await manager.send_message(app_id, f"Dataset {dataset_id}: Creating retriever...")
    retriever = vector_store.as_retriever(search_kwargs={'k': 20})

    input_text = ContextPrompt.context_builder(mainTopic, researchQuestions, additionalInfo)

    parsed_keywords = await process_llm_task(
        app_id=app_id,
        workspace_id=request.headers.get("x-workspace-id"),
        dataset_id=dataset_id,
        manager=manager,
        llm_model=model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        rag_prompt_builder_func=ContextPrompt.systemPromptTemplate, 
        retriever=retriever, 
        parent_function_name="build-context-from-topic",
        input_text=input_text,  
        mainTopic=mainTopic,
        researchQuestions=researchQuestions,
        additionalInfo=additionalInfo,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
    )

    if isinstance(parsed_keywords, list):
        parsed_keywords = {"keywords": parsed_keywords}

    keywords_list = parsed_keywords.get("keywords", [])

    keywords_with_ids = [Keyword(
        id=str(uuid4()),
        word=word.get("word"),
        coding_context_id=workspace_id,
    ) for word in keywords_list]

    main_topic_id = str(uuid4())
    keywords_with_ids.append(Keyword(
        id=main_topic_id,
        word=mainTopic,
        coding_context_id=workspace_id,
    ))
    
    keywords_repo.insert_batch(keywords_with_ids)
    selected_keywords_repo.insert(
        SelectedKeyword(
            keyword_id=main_topic_id,
            coding_context_id=workspace_id,
        )
    )
    
    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing complete.")

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "dataset_id": dataset_id,
                "main_topic": mainTopic,
                "research_questions": researchQuestions,
                "additional_info": additionalInfo,
                "keywords": [
                    {
                        "id": keywords_with_ids[idx].id,
                         **word,
                    }
                    for idx, word in enumerate(keywords_list)
                ]
            }),
            context=json.dumps({
                "function": "keyword_cloud_table",
                "run":"initial",
                "workspace_id": request.headers.get("x-workspace-id"),
                "time_taken": time.time() - start_time,
            }),
        )
    )
    return {
        "message": "Context built successfully!",   
    }

def batch_list(lst, batch_size):
    for i in range(0, len(lst), batch_size):
        yield lst[i:i + batch_size]

@router.post("/generate-definitions")
async def generate_definitions_endpoint(
    request: Request,
    request_body: GenerateKeywordDefinitionsRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    
    app_id = request.headers.get("x-app-id")
    dataset_id = request.headers.get("x-workspace-id")
    workspace_id = request.headers.get("x-workspace-id")
    model = request_body.model
    coding_context = coding_context_repo.find_one({"id": workspace_id})

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    keywords = keywords_repo.find({"coding_context_id": workspace_id})
    selected_keywords = list(map(lambda x: x.keyword_id, selected_keywords_repo.find({"coding_context_id": workspace_id})))

    words = set(list(map(lambda x: x.word, filter(lambda x: x.id in selected_keywords, keywords))))


    if not len(words):
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    
    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing started.")

    start_time = time.time()
    
    llm, embeddings = llm_service.get_llm_and_embeddings(model)
    
    vector_store = initialize_vector_store(dataset_id, model, embeddings)

    await manager.send_message(app_id, f"Dataset {dataset_id}: Creating retriever...")
    retriever = vector_store.as_retriever(search_kwargs={'k': 20})
    
    word_list = [word.strip() for word in words]
    
    batch_size = 70
    
    word_batches = list(batch_list(word_list, batch_size))
    print("Word batches:", word_batches)
    
    regex_pattern = r"```json\s*([\s\S]*?)\s*```"
    
    results = []
    
    for batch_words in word_batches:
        input_text = (
                f"Main Topic: {mainTopic}\n"
                f"Additional information about main topic: {additionalInfo}\n\n"
                f"Research Questions: {researchQuestions}\n"
                f"Words to define: {', '.join(batch_words)}\n\n"
                f"Provide the response in JSON format."
            )
        
        parsed_output = await process_llm_task(
            workspace_id=request.headers.get("x-workspace-id"),
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            llm_model=model,
            regex_pattern=regex_pattern,
            rag_prompt_builder_func=ConceptOutline.definition_prompt_builder,
            retriever=retriever,
            parent_function_name="generate-definitions",
            input_text=input_text,
            llm_instance=llm,
            llm_queue_manager=llm_queue_manager,
        )
        

        if isinstance(parsed_output, list):
            parsed_output = {"keywords": parsed_output}

        results.extend(parsed_output.get("keywords", []))
        print("Parsed output:", parsed_output)

        keyword_entries = [
            KeywordEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                word=entry.get("word"),
                description=entry.get("description"),
                inclusion_criteria=", ".join(entry.get("inclusion_criteria")),
                exclusion_criteria=", ".join(entry.get("exclusion_criteria")),
            )
            for entry in results
        ]

        try:
            keyword_entries_repo.delete({"coding_context_id": workspace_id})
        except Exception as e:
            print(e)

        keyword_entries_repo.insert_batch(keyword_entries)

        state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "dataset_id": dataset_id,
                "main_topic": mainTopic,
                "research_questions": researchQuestions,
                "additional_info": additionalInfo,
                "keywords": batch_words,
                "results": results
            }),
            context=json.dumps({
                "function": "keyword_table",
                "run":"initial",
                "workspace_id": request.headers.get("x-workspace-id"),
                "time_taken": time.time() - start_time,
            }),
        )
    )
    
    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing complete.")
    
    return {
        "message": "Definitions generated successfully!",
    }

@router.post("/regenerate-keywords")
async def regenerate_keywords_endpoint(
    request: Request,
    request_body: RegenerateKeywordsRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    workspace_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    keywords = keywords_repo.find({"coding_context_id": workspace_id})
    selected_keywords = list(map(lambda x: x.keyword_id, selected_keywords_repo.find({"coding_context_id": workspace_id})))

    await manager.send_message(app_id, f"Dataset {dataset_id}: Regenerating keywords with feedback...")

    start_time = time.time()

    llm, embeddings = llm_service.get_llm_and_embeddings(request_body.model)

    vector_store = initialize_vector_store(dataset_id, request_body.model, embeddings)
    retriever = vector_store.as_retriever(search_kwargs={'k': 50})

    selected_words = list(map(lambda x: x.word, filter(lambda x: x.id in selected_keywords, keywords)))
    unselected_words = list(map(lambda x: x.word, filter(lambda x: x.id not in selected_keywords, keywords)))

    parsed_keywords = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```", 
        rag_prompt_builder_func=ContextPrompt.regenerationPromptTemplate, 
        retriever=retriever, 
        parent_function_name="regenerate-keywords",
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        input_text=ContextPrompt.refined_context_builder( 
            mainTopic, 
            researchQuestions, 
            additionalInfo, 
            selected_words, 
            unselected_words, 
            request_body.extraFeedback
        ),
        mainTopic=mainTopic,
        researchQuestions=researchQuestions,
        additionalInfo=additionalInfo,
        selectedKeywords=selected_words,
        unselectedKeywords=unselected_words,
        extraFeedback=request_body.extraFeedback,
    )

    if isinstance(parsed_keywords, list):
        parsed_keywords = {"keywords": parsed_keywords}

    keywords_list = parsed_keywords.get("keywords", [])
    keywords_with_ids = [Keyword(
        id=str(uuid4()),
        word=word.get("word"),
        coding_context_id=workspace_id,
    ) for word in keywords_list]

    keywords_repo.insert_batch(keywords_with_ids)

    await manager.send_message(app_id, f"Dataset {dataset_id}: Processing complete.")

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "dataset_id": dataset_id,
                "main_topic": mainTopic,
                "research_questions": researchQuestions,
                "additional_info": additionalInfo,
                "feedback": request_body.extraFeedback,
                "keywords": [
                    {
                        "id": keywords_with_ids[idx].id,
                        **word,
                    }
                    for idx, word in enumerate(keywords_list)
                ]
            }),
            context=json.dumps({
                "function": "keyword_cloud_table",
                "run":"regenerate",
                "workspace_id": request.headers.get("x-workspace-id"),
                "time_taken": time.time() - start_time,
            }),
        )
    )

    return {
        "message": "Keywords regenerated successfully!",
    }

@router.post("/generate-initial-codes")
async def generate_codes_endpoint(request: Request,
    request_body: GenerateInitialCodesRequest,
    batch_size: int = 100,  
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):

    dataset_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    sampled_post_ids = list(map(lambda x: x["post_id"], selected_post_ids_repo.find({"dataset_id": dataset_id, "type": "sampled"}, ["post_id"], map_to_model=False)))
    if len(sampled_post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    keyword_table = keyword_entries_repo.find({"coding_context_id": workspace_id}, map_to_model=False)


    start_time = time.time()

    function_id = str(uuid4())
    total_posts = len(sampled_post_ids)

    try:
        if function_progress_repo.find_one({"name": "codebook"}):
            function_progress_repo.delete({"name": "codebook"})
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        name="codebook",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))
    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
        
        try:
            qect_repo.delete({"dataset_id": dataset_id, "codebook_type": CodebookType.INITIAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            try:
                await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
                post_data = get_post_and_comments_from_id(post_id, dataset_id)

                await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
                transcript = generate_transcript(post_data)

                parsed_response = await process_llm_task(
                    workspace_id=workspace_id,
                    app_id=app_id,
                    dataset_id=dataset_id,
                    post_id=post_id,
                    manager=manager,
                    llm_model=request_body.model,
                    regex_pattern=r"\"codes\":\s*(\[.*?\])",
                    parent_function_name="generate-initial-codes",
                    prompt_builder_func=InitialCodePrompts.initial_code_prompt,
                    function_id=function_id,
                    llm_instance=llm,
                    llm_queue_manager=llm_queue_manager,
                    main_topic=mainTopic,
                    additional_info=additionalInfo,
                    research_questions=researchQuestions,
                    keyword_table=json.dumps(keyword_table),
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

                codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="generate-initial-codes")
                function_progress_repo.update({
                    "function_id": function_id,
                }, {
                    "current": function_progress_repo.find_one({
                        "function_id": function_id
                    }).current + 1
                })
                codes = insert_responses_into_db(codes, dataset_id, workspace_id, request_body.model, CodebookType.INITIAL.value, parent_function_name="generate-initial-codes")

                await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
                return codes

            except Exception as e:
                await manager.send_message(app_id, f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
                return []

        sampled_posts = sampled_post_ids
        batches = [sampled_posts[i:i + batch_size] for i in range(0, len(sampled_posts), batch_size)]

        for batch in batches:
            print(f"Processing batch of {len(batch)} posts...")
            await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")

            await asyncio.gather(*(process_post(post_id) for post_id in batch))

        await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

        unique_codes_query = """
            SELECT DISTINCT code 
            FROM qect 
            WHERE dataset_id = ? AND codebook_type = ?
        """
        unique_codes_result = qect_repo.execute_raw_query(
            unique_codes_query,
            (dataset_id, CodebookType.INITIAL.value),
            keys=True
        )
        unique_codes = [row["code"] for row in unique_codes_result]

        res = await cluster_words_with_llm(
            workspace_id,
            unique_codes,
            request_body.model,
            app_id,
            dataset_id,
            manager,
            llm,
            llm_queue_manager,
            parent_function_name="generate-initial-codes",
        )

        print("Clustered words with LLM", res)

        reverse_map_one_to_one = {}

        
        for topic_head, subtopics in res.items():
            for subtopic in subtopics:
                if subtopic not in reverse_map_one_to_one:
                    reverse_map_one_to_one[subtopic] = topic_head

        for subtopic, topic_head in reverse_map_one_to_one.items():
            update_query = """
                UPDATE qect 
                SET code = ? 
                WHERE code = ? AND dataset_id = ? AND codebook_type = ?
            """
            qect_repo.execute_raw_query(
                update_query,
                (topic_head, subtopic, dataset_id, CodebookType.INITIAL.value)
            )

        filter_duplicate_codes_in_db(
            dataset_id=dataset_id,
            codebook_type=CodebookType.INITIAL.value,
            generation_type=GenerationType.INITIAL.value,
            workspace_id=workspace_id,
            parent_function_name="generate-initial-codes"
        )
        state_dump_repo.insert(
            StateDump(
                state=json.dumps({ 
                    "dataset_id": dataset_id,
                    "post_ids": sampled_post_ids,
                    "results": qect_repo.find({"dataset_id": dataset_id, "codebook_type": CodebookType.INITIAL.value}, map_to_model=False),
                }),
                context=json.dumps({
                    "function": "initial_codes",
                    "run":"initial",
                    "function_id": function_id,
                    "workspace_id": workspace_id,
                    "time_taken": time.time() - start_time,
                }),
            )
        )

        return {
            "message": "Initial codes generated successfully!",
        }
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during code generation.")
    finally:
        function_progress_repo.delete({"function_id": function_id})

@router.post("/final-coding")
async def final_coding_endpoint(
    request: Request,
    request_body: FinalCodingRequest,
    batch_size: int = 100,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Final coding process started.")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    final_codebook = initial_codebook_repo.find_one({"coding_context_id": workspace_id}, map_to_model=False)
    main_topic = coding_context.main_topic
    additional_info = coding_context.additional_info or ""
    research_questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    keyword_table = keyword_entries_repo.find({"coding_context_id": workspace_id}, map_to_model=False)
    unseen_post_ids = list(map(lambda x: x["post_id"], selected_post_ids_repo.find({"dataset_id": dataset_id, "type": "unseen"}, ["post_id"], map_to_model=False)))

    start_time = time.time()

    function_id = str(uuid4())
    total_posts = len(unseen_post_ids)

    try:
        print(function_progress_repo.find())
        if function_progress_repo.find_one({"name": "final"}):
            function_progress_repo.delete({"name": "final"})
    except Exception as e:
        print(f"Error in final_coding_endpoint: {e}")

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        name="final",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        posts = unseen_post_ids
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        try:
            qect_repo.delete({"dataset_id": dataset_id, "codebook_type": CodebookType.FINAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
            post_data = get_post_and_comments_from_id(post_id, dataset_id)

            await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
            transcript = generate_transcript(post_data)

            parsed_response = await process_llm_task(
                workspace_id=workspace_id,
                app_id=app_id,
                dataset_id=dataset_id,
                post_id=post_id,
                manager=manager,
                llm_model=request_body.model,
                regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                prompt_builder_func=FinalCoding.final_coding_prompt,
                llm_instance=llm,
                parent_function_name="final-coding",
                function_id=function_id,
                llm_queue_manager=llm_queue_manager,
                final_codebook=json.dumps(final_codebook, indent=2),
                keyword_table=json.dumps(keyword_table, indent=2),
                main_topic=main_topic,
                additional_info=additional_info,
                research_questions=json.dumps(research_questions),
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
  
            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="final-coding")
            function_progress_repo.update({
                    "function_id": function_id,
                }, {
                    "current": function_progress_repo.find_one({
                        "function_id": function_id
                    }).current + 1
                })

            codes = insert_responses_into_db(codes, dataset_id, workspace_id, request_body.model, CodebookType.FINAL.value, parent_function_name="final-coding")

            await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
            return codes

        batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

        for batch in batches:
            await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
            
            await asyncio.gather(*(process_post(post_id) for post_id in batch))
            
        await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "post_ids": posts,
                    "results": qect_repo.find({"dataset_id": dataset_id, "codebook_type": CodebookType.FINAL.value}, map_to_model=False),
                }),
                context=json.dumps({
                    "function": "final_codes",
                    "run":"initial",
                    "function_id": function_id,
                    "workspace_id": workspace_id,
                    "time_taken": time.time() - start_time,
                }),
            )
        )

        return {
            "message": "Final coding completed successfully!",
        }
    except Exception as e:
        print(f"Error in final_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during final coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})


@router.post("/theme-generation")
async def theme_generation_endpoint(
    request: Request,
    request_body: ThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation process started.")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    def to_higher(code: str) -> Optional[str]:
        entry = grouped_codes_repo.find_one({
            "coding_context_id": dataset_id,
            "code": code
        })
        return entry.higher_level_code if entry else None

    summaries = await summarize_codebook_explanations(
        workspace_id = dataset_id,
        codebook_types = [
            CodebookType.INITIAL.value,
            CodebookType.FINAL.value
        ],
        llm_model = request_body.model,
        app_id = app_id,
        dataset_id = dataset_id,
        manager = manager,
        parent_function_name = "theme-generation",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        code_transform = to_higher,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )

    qec_table = [
        {"code": code, "summary": summaries[code]}
        for code in summaries
    ]

    print(qec_table)

    try:
        themes_repo.delete({"coding_context_id": dataset_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        parent_function_name="theme-generation",
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=ThemeGeneration.theme_generation_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        qec_table=json.dumps({"codes": qec_table}),  
        unique_codes=json.dumps(list(summaries.keys()))
    )

    print(parsed_response)

    if isinstance(parsed_response, list):
        parsed_response = {"themes": parsed_response}

    themes = parsed_response.get("themes", [])
    for theme in themes:
        theme["id"] = str(uuid4())

    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(summaries.keys()) - placed_codes)

    themes_repo.insert_batch([
        ThemeEntry(
            higher_level_code=code, 
            theme=theme["theme"], 
            theme_id=theme["id"],
            coding_context_id=dataset_id,
        ) 
        for theme in themes for code in theme["codes"] 
    ])

    if len(unplaced_codes) > 0:
        themes_repo.insert_batch([
            ThemeEntry(
                higher_level_code=code, 
                theme=None,
                theme_id=None,
                coding_context_id=dataset_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        themes_repo.insert(
            ThemeEntry(
                higher_level_code=None, 
                theme=None,
                theme_id=None,
                coding_context_id=dataset_id,
            ) 
        )

    

    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation completed.")

    await asyncio.sleep(5)

    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "themes": themes,
                    "unplaced_codes": unplaced_codes,
                }),
                context=json.dumps({
                    "function": "theme_generation",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )

    return {
        "message": "Themes generated successfully!",
    }


@router.post("/redo-theme-generation")
async def redo_theme_generation_endpoint(
    request: Request,
    request_body: RedoThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation redo process started.")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    def to_higher(code: str) -> Optional[str]:
        entry = grouped_codes_repo.find_one({
            "coding_context_id": dataset_id,
            "code": code
        })
        return entry.higher_level_code if entry else None

    summaries = await summarize_codebook_explanations(
        workspace_id = dataset_id,
        llm_model = request_body.model,
        app_id = app_id,
        dataset_id = dataset_id,
        manager = manager,
        parent_function_name = "redo-theme-generation",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        codebook_types = [
            CodebookType.INITIAL.value,
            CodebookType.FINAL.value
        ],
        code_transform = to_higher,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )

    qec_table = [
        {"code": code, "summary": summaries[code]}
        for code in summaries
    ]

    previous_themes = themes_repo.find({"coding_context_id": dataset_id}, map_to_model=False)

    print(qec_table)

    try:
        themes_repo.delete({"coding_context_id": dataset_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        parent_function_name="redo-theme-generation",
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=ThemeGeneration.redo_theme_generation_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        qec_table=json.dumps({"codes": qec_table}),
        unique_codes=json.dumps(list(summaries.keys())),
        previous_themes=json.dumps(previous_themes),
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

    themes_repo.insert_batch([
        ThemeEntry(
            higher_level_code=code, 
            theme=theme["theme"], 
            theme_id=theme["id"],
            coding_context_id=dataset_id,
        ) 
        for theme in themes for code in theme["codes"] 
    ])

    if len(unplaced_codes) > 0:
        themes_repo.insert_batch([
            ThemeEntry(
                higher_level_code=code, 
                theme=None,
                theme_id=None,
                coding_context_id=dataset_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        themes_repo.insert(
            ThemeEntry(
                higher_level_code=None, 
                theme=None,
                theme_id=None,
                coding_context_id=dataset_id,
            ) 
        )


    await manager.send_message(app_id, f"Dataset {dataset_id}: Theme generation redo completed.")

    await asyncio.sleep(5)

    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "themes": themes,
                    "unplaced_codes": unplaced_codes
                }),
                context=json.dumps({
                    "function": "theme_generation",
                    "run":"regenerate",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )

    return {
        "message": "Themes regenerated successfully!",
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
    
    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
    post_data = get_post_and_comments_from_id(request_body.post_id, dataset_id)
    transcript = generate_transcript(post_data)

    *chat_history, user_comment = request_body.chat_history

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=request.headers.get("x-app-id"),
        dataset_id="",
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=RefineSingleCode.refine_single_code_prompt,
        llm_instance=llm,
        parent_function_name="refine-single-code",
        llm_queue_manager=llm_queue_manager,
        transcript=transcript,
        code=request_body.code,
        quote=request_body.quote,
        chat_history=chat_history,
        user_comment=user_comment
    )


    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "post_id": request_body.post_id,
                    "quote": request_body.quote,
                    "code": request_body.code,
                    "parsed_response": parsed_response,
                    "chat_history": request_body.chat_history,
                    "user_comment": user_comment,
                }),
                context=json.dumps({
                    "function": "refine_single_code",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )

    return parsed_response


@router.post("/remake-codebook")
async def generate_codes_endpoint(
    request: Request,
    request_body: RemakeCodebookRequest,
    batch_size: int = 100,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Code generation process started.")

    start_time = time.time()


    function_id = str(uuid4())
    sampled_post_ids = list(map(lambda x: x["post_id"], selected_post_ids_repo.find({"dataset_id": dataset_id, "type": "sampled"}, ["post_id"], map_to_model=False)))
    total_posts = len(sampled_post_ids)

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")
    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    keyword_table = keyword_entries_repo.find({"coding_context_id": workspace_id}, map_to_model=False)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
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
            workspace_id = workspace_id,
            codebook_types = [CodebookType.INITIAL.value],
            llm_model = request_body.model,
            app_id = app_id,
            dataset_id = dataset_id,
            manager = manager,
            parent_function_name = "remake-codebook",
            llm_instance = llm,
            llm_queue_manager = llm_queue_manager,
            max_input_tokens = 128000,
            retries = 3,
            flush_threshold = 200,
            page_size = 500,
            concurrency_limit = 4,
            store_response = True
        )
        
        summarized_codebook = [{"code": code, "explanation": summary} 
                              for code, summary in summarized_codebook_dict.items()]

        try:
            qect_repo.delete({"dataset_id": dataset_id, "codebook_type": CodebookType.INITIAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            try:
                await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
                post_data = get_post_and_comments_from_id(post_id, dataset_id)

                await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
                transcript = generate_transcript(post_data)

                parsed_response = await process_llm_task(
                    workspace_id=workspace_id,
                    app_id=app_id,
                    dataset_id=dataset_id,
                    post_id=post_id,
                    manager=manager,
                    llm_model=request_body.model,
                    regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                    prompt_builder_func=RemakerPrompts.codebook_remake_prompt,
                    llm_instance=llm,
                    parent_function_name="remake-codebook",
                    llm_queue_manager=llm_queue_manager,
                    main_topic=mainTopic,
                    additional_info=additionalInfo,
                    research_questions=researchQuestions,
                    keyword_table=json.dumps(keyword_table),
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

                codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="remake-codebook")

                codes = insert_responses_into_db(codes, dataset_id, workspace_id, request_body.model, CodebookType.INITIAL.value, parent_function_name="remake-codebook")

                await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
                return codes

            except Exception as e:
                await manager.send_message(app_id, f"ERROR: Dataset {dataset_id}: Error processing post {post_id} - {str(e)}.")
                return []

        
        sampled_posts = sampled_post_ids
        batches = [sampled_posts[i:i + batch_size] for i in range(0, len(sampled_posts), batch_size)]

        for batch in batches:
            await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
            
            
            batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))

            for codes in batch_results:
                final_results.extend(codes)

        await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

        unique_codes_query = """
            SELECT DISTINCT code 
            FROM qect 
            WHERE dataset_id = ? AND codebook_type = ?
        """
        unique_codes_result = qect_repo.execute_raw_query(
            unique_codes_query,
            (dataset_id, CodebookType.INITIAL.value),
            keys=True
        )
        unique_codes = [row["code"] for row in unique_codes_result]

        res = await cluster_words_with_llm(
            workspace_id,
            unique_codes,
            request_body.model,
            app_id,
            dataset_id,
            manager,
            llm,
            llm_queue_manager,
            parent_function_name="remake-codebook",
        )

        print("Clustered words with LLM", res)

        reverse_map_one_to_one = {}

        
        for topic_head, subtopics in res.items():
            for subtopic in subtopics:
                
                if subtopic not in reverse_map_one_to_one:
                    reverse_map_one_to_one[subtopic] = topic_head
        
        for subtopic, topic_head in reverse_map_one_to_one.items():
            update_query = """
                UPDATE qect 
                SET code = ? 
                WHERE code = ? AND dataset_id = ? AND codebook_type = ?
            """
            qect_repo.execute_raw_query(
                update_query,
                (topic_head, subtopic, dataset_id, CodebookType.INITIAL.value)
            )

        for row in final_results:
            row["code"] = reverse_map_one_to_one.get(row["code"], row["code"])

        filter_duplicate_codes_in_db(
            dataset_id=dataset_id,
            codebook_type=CodebookType.INITIAL.value,
            generation_type=GenerationType.LATEST.value,
            workspace_id=workspace_id,
            parent_function_name="initial-codes"
        )
        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "post_ids": sampled_post_ids,
                    "results": final_results,
                    "feedback": request_body.feedback
                }),
                context=json.dumps({
                    "function": "initial_codes",
                    "run":"regenerate",
                    "function_id": function_id,
                    "workspace_id": workspace_id,
                    "time_taken": time.time() - start_time,
                }),
            )
        )

        return {
            "message": "Initial codes generated successfully!",
            "data": final_results
        }
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during code generation.")
    finally:
        function_progress_repo.delete({"function_id": function_id})

@router.post("/remake-final-codes")
async def redo_final_coding_endpoint(
    request: Request,
    request_body: RemakeFinalCodesRequest,
    batch_size: int = 100,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    await manager.send_message(app_id, f"Dataset {dataset_id}: Final coding process started.")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    final_codebook = initial_codebook_repo.find_one({"coding_context_id": workspace_id}, map_to_model=False)
    main_topic = coding_context.main_topic
    additional_info = coding_context.additional_info or ""
    research_questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    keyword_table = keyword_entries_repo.find({"coding_context_id": workspace_id}, map_to_model=False)
    unseen_post_ids = list(map(lambda x: x["post_id"], selected_post_ids_repo.find({"dataset_id": dataset_id, "type": "unseen"}, ["post_id"], map_to_model=False)))


    start_time = time.time()

    function_id = str(uuid4())
    total_posts = len(unseen_post_ids)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        name="final",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        posts = unseen_post_ids
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        summarized_current_codebook_dict = await summarize_codebook_explanations(
            workspace_id = workspace_id,
            codebook_types = [CodebookType.FINAL.value],
            llm_model = request_body.model,
            app_id = app_id,
            dataset_id = dataset_id,
            manager = manager,
            parent_function_name = "redo-final-coding",
            llm_instance = llm,
            llm_queue_manager = llm_queue_manager,
            max_input_tokens = 128000,
            retries = 3,
            flush_threshold = 200,
            page_size = 500,
            concurrency_limit = 4,
            store_response = True
        )
        summarized_current_codebook = [{"code": code, "explanation": summary} 
                                      for code, summary in summarized_current_codebook_dict.items()]
        
        try:
            qect_repo.delete({"dataset_id": dataset_id, "codebook_type": CodebookType.FINAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            await manager.send_message(app_id, f"Dataset {dataset_id}: Fetching data for post {post_id}...")
            post_data = get_post_and_comments_from_id(post_id, dataset_id)

            await manager.send_message(app_id, f"Dataset {dataset_id}: Generating transcript for post {post_id}...")
            transcript = generate_transcript(post_data)

            parsed_response = await process_llm_task(
                workspace_id=workspace_id,
                app_id=app_id,
                dataset_id=dataset_id,
                post_id=post_id,
                manager=manager,
                llm_model=request_body.model,
                regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                prompt_builder_func=RemakerPrompts.final_codebook_remake_prompt,
                llm_instance=llm,
                parent_function_name="redo-final-coding",
                llm_queue_manager=llm_queue_manager,
                final_codebook=json.dumps(final_codebook, indent=2),
                keyword_table=json.dumps(keyword_table, indent=2),
                main_topic=main_topic,
                additional_info=additional_info,
                research_questions=json.dumps(research_questions),
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

            
            if isinstance(parsed_response, list):
                parsed_response = {"codes": parsed_response}

            codes = parsed_response.get("codes", [])
            for code in codes:
                code["postId"] = post_id
                code["id"] = str(uuid4())

            codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="redo-final-coding")

            codes = insert_responses_into_db(codes, dataset_id, workspace_id, request_body.model, CodebookType.FINAL.value, parent_function_name="redo-final-coding")
            await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
            return codes

        batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

        for batch in batches:
            await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
            
            await asyncio.gather(*(process_post(post_id) for post_id in batch))


        await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")

        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "post_ids": unseen_post_ids,
                    "results": qect_repo.find({"dataset_id": dataset_id, "codebook_type": CodebookType.FINAL.value}, map_to_model=False),
                    "feedback": request_body.feedback
                }),
                context=json.dumps({
                    "function": "final_codes",
                    "run":"regenerate",
                    "function_id": function_id,
                    "workspace_id": workspace_id,
                    "time_taken": time.time() - start_time,
                }),
            )
        )

        return {
            "message": "Final coding completed successfully!"
        }
    except Exception as e:
        print(f"Error in redo_final_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during final coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})


@router.post("/group-codes")
async def group_codes_endpoint(
    request: Request,
    request_body: GroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    summarized_explanations = await summarize_codebook_explanations(
        workspace_id=dataset_id,
        codebook_types=[CodebookType.INITIAL.value, CodebookType.FINAL.value],
        llm_model=request_body.model,
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        parent_function_name="group-codes",
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000,        
        retries=3,
        flush_threshold=200,             
        page_size=500,              
        concurrency_limit=4,
        store_response=False
    )


    code_summary_table = [
        {"code": code, "summary": summary}
        for code, summary in summarized_explanations.items()
    ]

    try:
        grouped_codes_repo.delete({"coding_context_id": dataset_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        parent_function_name="group-codes",
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

    placed = {code for hl in higher_level_codes for code in hl["codes"]}
    all_codes = set(summarized_explanations.keys())
    unplaced_codes = list(all_codes - placed)

    grouped_codes_repo.insert_batch([
        GroupedCodeEntry(
            code=code, 
            higher_level_code = higher_level_code["name"],
            higher_level_code_id = higher_level_code["id"],
            coding_context_id=dataset_id,
        ) 
        for higher_level_code in higher_level_codes for code in higher_level_code["codes"]
    ])

    if len(unplaced_codes) > 0:
        grouped_codes_repo.insert_batch([
            GroupedCodeEntry(
                code=code, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=dataset_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        grouped_codes_repo.insert(
            GroupedCodeEntry(
                code=None, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=dataset_id,
            ) 
        )

    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "higher_level_codes": higher_level_codes,
                    "unplaced_codes": unplaced_codes,
                }),
                context=json.dumps({
                    "function": "code_grouping",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )

    return {
        "message": "Codes grouped successfully!",
    }

@router.post("/regroup-codes")
async def regroup_codes_endpoint(
    request: Request,
    request_body: RegroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    summarized_explanations = await summarize_codebook_explanations(
        workspace_id           = dataset_id,
        codebook_types = [
            CodebookType.INITIAL.value,
            CodebookType.FINAL.value
        ],
        llm_model = request_body.model,
        app_id = app_id,
        dataset_id = dataset_id,
        manager = manager,
        parent_function_name = "regroup-codes",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )

    code_summary_table = [
        {"code": code, "summary": summary}
        for code, summary in summarized_explanations.items()
    ]


    previous_codes = grouped_codes_repo.find({"coding_context_id": dataset_id}, map_to_model=False)
    previous_codes_json = json.dumps(previous_codes)

    try:
        grouped_codes_repo.delete({"coding_context_id": dataset_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GroupCodes.regroup_codes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        parent_function_name="regroup-codes",
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
    all_codes = set(summarized_explanations.keys())
    unplaced_codes = list(all_codes - placed_codes)

    grouped_codes_repo.insert_batch([
        GroupedCodeEntry(
            code=code, 
            higher_level_code = higher_level_code["name"],
            higher_level_code_id = higher_level_code["id"],
            coding_context_id=dataset_id,
        ) 
        for higher_level_code in higher_level_codes for code in higher_level_code["codes"]
    ])

    if len(unplaced_codes) > 0:
        grouped_codes_repo.insert_batch([
            GroupedCodeEntry(
                code=code, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=dataset_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        grouped_codes_repo.insert(
            GroupedCodeEntry(
                code=None, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=dataset_id,
            ) 
        )

    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "higher_level_codes": higher_level_codes,
                    "unplaced_codes": unplaced_codes,
                }),
                context=json.dumps({
                    "function": "code_grouping",
                    "run":"regenerate",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )


    return {
        "message": "Codes regrouped successfully!",
    }


@router.post("/generate-codebook-without-quotes")
async def generate_codebook_without_quotes_endpoint(
    request: Request,
    request_body: GenerateCodebookWithoutQuotesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    manual_coding = bool(qect_repo.find(
        {"dataset_id": dataset_id, "codebook_type": CodebookType.FINAL.value},
        map_to_model=False,
        limit=1
    ))

    codebook_types = [CodebookType.INITIAL.value]
    if manual_coding:
        codebook_types.append(CodebookType.FINAL.value)
    
    summarized_dict = await summarize_codebook_explanations(
        workspace_id           = dataset_id,
        codebook_types = codebook_types,
        llm_model = request_body.model,
        app_id = app_id,
        dataset_id = dataset_id,
        manager = manager,
        parent_function_name = "manual-codebook-generation",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )
    
    summarized_grouped_ec = {code: [summary] for code, summary in summarized_dict.items()}

    print(summarized_grouped_ec)

    try:
        initial_codebook_repo.delete({"coding_context_id": dataset_id})
    except Exception as e:
        print(e)
    
    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        parent_function_name="manual-codebook-generation",
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GenerateCodebookWithoutQuotes.generate_codebook_without_quotes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(summarized_grouped_ec)  
    )

    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "codebook": parsed_response,
                }),
                context=json.dumps({
                    "function": "manual_codebook_generation",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )
    
    initial_codebook_repo.insert_batch(
            [
                InitialCodebookEntry(
                    id=str(uuid4()),
                    coding_context_id=request.headers.get("x-workspace-id"),
                    code= pr[0],
                    definition= pr[1],
                    manual_coding=manual_coding
                ) for pr in  parsed_response.items() 
            ]
        )


    return {
        "message": "Codebook generated successfully!",
        "data": parsed_response if manual_coding else {}
    }
    
@router.post("/regenerate-codebook-without-quotes")
async def regenerate_codebook_without_quotes_endpoint(
    request: Request,
    request_body: RegenerateCodebookWithoutQuotesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    summarized_dict = await summarize_codebook_explanations(
        workspace_id           = dataset_id,
        codebook_types = [CodebookType.INITIAL.value],
        llm_model = request_body.model,
        app_id = app_id,
        dataset_id = dataset_id,
        manager = manager,
        parent_function_name = "manual-codebook-regeneration",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )

    summarized_grouped_ec = {code: [summary] for code, summary in summarized_dict.items()}

    previous_codebook = initial_codebook_repo.find_one({"coding_context_id": dataset_id}, map_to_model=False)

    previous_codebook_json = json.dumps(previous_codebook)

    try:
        initial_codebook_repo.delete({"coding_context_id": dataset_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GenerateCodebookWithoutQuotes.regenerate_codebook_without_quotes_prompt,
        llm_instance=llm,
        parent_function_name="manual-codebook-generation",
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(summarized_grouped_ec),  
        previous_codebook=previous_codebook_json  ,
        feedback = request_body.feedback
    )

    initial_codebook_repo.insert_batch(
            [
                InitialCodebookEntry(
                    id=str(uuid4()),
                    coding_context_id=request.headers.get("x-workspace-id"),
                    code= pr[0],
                    definition= pr[1],
                    manual_coding=False
                ) for pr in  parsed_response.items() 
            ]
        )

    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "codebook": parsed_response,
                }),
                context=json.dumps({
                    "function": "manual_codebook_generation",
                    "run":"regenerate",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )

    return {
        "message": "Codebook regenerated successfully!",
    }

@router.post("/generate-deductive-codes")
async def generate_deductive_codes_endpoint(
    request: Request,
    request_body: GenerateDeductiveCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    dataset_id = request.headers.get("x-workspace-id")
    batch_size = 100
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    function_id = str(uuid4())
    total_posts = len(request_body.post_ids)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request.headers.get("x-workspace-id"),
        dataset_id=dataset_id,
        name="manual",
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
                workspace_id=request.headers.get("x-workspace-id"),
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
                parent_function_name="generate-deductive-codes",
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

            codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="generate-deductive-codes")
            codes = insert_responses_into_db(codes, dataset_id, workspace_id, request_body.model, CodebookType.MANUAL.value, parent_function_name="generate-deductive-codes")
            await manager.send_message(app_id, f"Dataset {dataset_id}: Generated codes for post {post_id}...")
            return codes

        batches = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

        for batch in batches:
            await manager.send_message(app_id, f"Dataset {dataset_id}: Processing batch of {len(batch)} posts...")
            
            batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))
            
            for codes in batch_results:
                final_results.extend(codes)


        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "dataset_id": dataset_id,
                    "codebook": final_results,
                }),
                context=json.dumps({
                    "function": "generate_deductive_codes",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )
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


@router.post("/get-coded-data")
def get_coded_data_endpoint(
    request: Request,
    request_body: GetCodedDataRequest
):
    dataset_id = request.headers.get("x-workspace-id")
    coded_data = get_coded_data(request_body.codebook_names, request_body.filters, dataset_id, request_body.batch_size, request_body.offset)

    return {
        "message": "Coded data retrieved successfully!",
        "data": coded_data
    }

@router.post("/get-paginated-responses")
def get_responses(request: Request, request_body: ResponsesRequest):
    where_clause, params = build_where_clause_and_params(request_body, request.headers.get("x-workspace-id"))

    if request_body.selectedTypeFilter == 'New Data':
        check_query = """
        SELECT COUNT(*) FROM qect r
        JOIN selected_post_ids p ON r.post_id = p.post_id
        WHERE p.dataset_id = ? AND r.dataset_id = ? AND r.codebook_type = 'final' AND r.response_type = 'LLM'
        """
        check_params = [request.headers.get("x-workspace-id"), request.headers.get("x-workspace-id")]
        check_result = execute_query(check_query, check_params)
        print(f"[get_paginated_responses] Check final data: {check_query}, params: {check_params}, result: {check_result}")
        if check_result[0][0] == 0:
            print("[get_paginated_responses] No final data, falling back to initial")
            where_clause = where_clause.replace("r.codebook_type = 'final' AND r.response_type = 'LLM'", "r.codebook_type = 'initial'")
            params = [p for p in params if p not in ['final', 'LLM']]

    sql_post_ids = f"""
    SELECT DISTINCT p.post_id
    FROM selected_post_ids p
    JOIN qect r ON p.post_id = r.post_id
    WHERE {where_clause}
    ORDER BY p.post_id LIMIT ? OFFSET ?
    """
    offset = (request_body.page - 1) * request_body.pageSize
    paginated_params = params + [request_body.pageSize, offset]
    print(f"[get_paginated_responses] sql_post_ids: {sql_post_ids}")
    print(f"[get_paginated_responses] sql_post_ids params: {paginated_params}")
    res = execute_query(sql_post_ids, paginated_params, keys=True)
    print(f"[get_paginated_responses] sql_post_ids result: {res}")
    post_ids = [row['post_id'] for row in res]

    responses_dict = {}
    if post_ids:
        placeholders = ', '.join(['?'] * len(post_ids))
        sql_responses = f"""
        SELECT r.*
        FROM qect r
        JOIN selected_post_ids p ON r.post_id = p.post_id
        WHERE p.post_id IN ({placeholders}) AND {where_clause}
        """
        response_params = post_ids + params
        print(f"[get_paginated_responses] sql_responses: {sql_responses}")
        print(f"[get_paginated_responses] sql_responses params: {response_params}")
        res = execute_query(sql_responses, response_params, keys=True)
        print(f"[get_paginated_responses] sql_responses result: {res}")
        for response in res:
            post_id = response['post_id']
            responses_dict.setdefault(post_id, []).append(dict(response))

    sql_total = f"""
    SELECT COUNT(DISTINCT p.post_id)
    FROM selected_post_ids p
    JOIN qect r ON p.post_id = r.post_id
    WHERE {where_clause}
    """
    print(f"[get_paginated_responses] sql_total: {sql_total}")
    print(f"[get_paginated_responses] sql_total params: {params}")
    res = execute_query(sql_total, params)
    print(f"[get_paginated_responses] sql_total result: {res}")
    total_post_ids = res[0][0] if res else 0

    response_data = {
        "postIds": post_ids,
        "responses": responses_dict,
        "totalPostIds": total_post_ids
    }
    print(f"[get_paginated_responses] Returning: {response_data}")
    return response_data

@router.post("/get-filtered-responses-metadata")
def get_filtered_metadata(request: Request, request_body: FilteredResponsesMetadataRequest):
    where_clause, params = build_where_clause_and_params(request_body, request.headers.get("x-workspace-id"))

    if request_body.selectedTypeFilter == 'New Data':
        check_query = """
        SELECT COUNT(*) FROM qect r
        JOIN selected_post_ids p ON r.post_id = p.post_id
        WHERE p.dataset_id = ? AND r.dataset_id = ? AND r.codebook_type = 'final' AND r.response_type = 'LLM'
        """
        check_params = [request.headers.get("x-workspace-id"), request.headers.get("x-workspace-id")]
        check_result = execute_query(check_query, check_params)
        print(f"[get_filtered_metadata] Check final data: {check_query}, params: {check_params}, result: {check_result}")
        if check_result[0][0] == 0:
            print("[get_filtered_metadata] No final data, falling back to initial")
            where_clause = where_clause.replace("r.codebook_type = 'final' AND r.response_type = 'LLM'", "r.codebook_type = 'initial'")
            params = [p for p in params if p not in ['final', 'LLM']]

    sql_post_ids = f"""
    SELECT DISTINCT p.post_id
    FROM selected_post_ids p
    JOIN qect r ON p.post_id = r.post_id
    WHERE {where_clause}
    """
    print(f"[get_filtered_metadata] sql_post_ids: {sql_post_ids}")
    print(f"[get_filtered_metadata] sql_post_ids params: {params}")
    res = execute_query(sql_post_ids, params, keys=True)
    print(f"[get_filtered_metadata] sql_post_ids result: {res}")
    post_ids = [row['post_id'] for row in res]

    sql_codes = f"""
    SELECT DISTINCT r.code
    FROM qect r
    JOIN selected_post_ids p ON r.post_id = r.post_id
    WHERE {where_clause}
    """
    print(f"[get_filtered_metadata] sql_codes: {sql_codes}")
    print(f"[get_filtered_metadata] sql_codes params: {params}")
    res = execute_query(sql_codes, params, keys=True)
    print(f"[get_filtered_metadata] sql_codes result: {res}")
    codes = [row['code'] for row in res if row['code']]

    if hasattr(request_body, 'responseTypes') and request_body.responseTypes:
        mapped_types = [CODEBOOK_TYPE_MAP[t] for t in request_body.responseTypes if t in CODEBOOK_TYPE_MAP]
        placeholders = ','.join(['?' for _ in mapped_types])
        total_sql_post_ids = f"""
        SELECT DISTINCT p.post_id
        FROM selected_post_ids p
        JOIN qect r ON p.post_id = r.post_id
        WHERE p.dataset_id = ? AND r.codebook_type IN ({placeholders})
        """
        total_params = [request.headers.get("x-workspace-id")] + mapped_types
        print(f"[get_filtered_metadata] total_sql_post_ids: {total_sql_post_ids}")
        print(f"[get_filtered_metadata] total_sql_post_ids params: {total_params}")
        res = execute_query(total_sql_post_ids, total_params, keys=True)
        print(f"[get_filtered_metadata] total_sql_post_ids result: {res}")
    else:
        total_sql_post_ids = f"""
        SELECT DISTINCT p.post_id
        FROM selected_post_ids p
        WHERE p.dataset_id = ?
        """
        total_params = [request.headers.get("x-workspace-id")]
        print(f"[get_filtered_metadata] total_sql_post_ids: {total_sql_post_ids}")
        print(f"[get_filtered_metadata] total_sql_post_ids params: {total_params}")
        res = execute_query(total_sql_post_ids, total_params, keys=True)
        print(f"[get_filtered_metadata] total_sql_post_ids result: {res}")
    all_post_ids = [row['post_id'] for row in res]

    response_data = {
        "postIds": post_ids,
        "codes": codes,
        "totalPosts": len(post_ids),
        "allPostIds": all_post_ids,
        "totalCodedPosts": len(all_post_ids)
    }
    print(f"[get_filtered_metadata] Returning: {response_data}")
    return response_data

@router.post("/get-post-responses")
def get_post_responses(request: Request, request_body: PostResponsesRequest):
    where_clause, params = build_where_clause_and_params(request_body, request.headers.get("x-workspace-id"))

    if request_body.selectedTypeFilter == 'New Data':
        check_query = """
        SELECT COUNT(*) FROM qect r
        JOIN selected_post_ids p ON r.post_id = p.post_id
        WHERE p.dataset_id = ? AND r.dataset_id = ? AND r.codebook_type = 'final' AND r.response_type = 'LLM'
        """
        check_params = [request.headers.get("x-workspace-id"), request.headers.get("x-workspace-id")]
        check_result = execute_query(check_query, check_params)
        print(f"[get_post_responses] Check final data: {check_query}, params: {check_params}, result: {check_result}")
        if check_result[0][0] == 0:
            print("[get_post_responses] No final data, falling back to initial")
            where_clause = where_clause.replace("r.codebook_type = 'final' AND r.response_type = 'LLM'", "r.codebook_type = 'initial'")
            params = [p for p in params if p not in ['final', 'LLM']]

    sql = f"""
    SELECT r.*
    FROM qect r
    JOIN selected_post_ids p ON r.post_id = p.post_id
    WHERE p.post_id = ? AND {where_clause}
    """
    query_params = [request_body.postId] + params
    print(f"[get_post_responses] sql: {sql}")
    print(f"[get_post_responses] sql params: {query_params}")
    res = execute_query(sql, query_params, keys=True)
    print(f"[get_post_responses] sql result: {res}")
    print(f"[get_post_responses] Returning: {res}")
    return res