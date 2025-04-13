import asyncio
from collections import defaultdict
from datetime import datetime
import json
import os
import re
import shutil
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Type, Union
import unicodedata
from uuid import UUID, uuid4

from chromadb import HttpClient
from fastapi import UploadFile

from chromadb.config import Settings as ChromaDBSettings
from constants import CONTEXT_FILES_DIR, PATHS, RANDOM_SEED, STUDY_DATABASE_PATH
from controllers.miscellaneous_controller import get_credential_path
from database.qect_table import QectRepository
from database.state_dump_table import StateDumpsRepository
from decorators import log_execution_time
from models.table_dataclasses import GenerationType, LlmResponse, QectResponse, ResponseCreatorType, StateDump
from routes.websocket_routes import ConnectionManager, manager

from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain.chains.retrieval import create_retrieval_chain 
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import StreamingStdOutCallbackHandler
from langchain_ollama import OllamaLLM
from starlette.concurrency import run_in_threadpool

from services.llm_service import GlobalQueueManager
from utils.coding_helpers import generate_transcript
from database import LlmResponsesRepository
from database.db_helpers import get_post_and_comments_from_id
from utils.prompts_v2 import TopicClustering

llm_responses_repo = LlmResponsesRepository()
qect_repo = QectRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

def get_temperature_and_random_seed():
    with open(PATHS["settings"], "r") as f:
        settings = json.load(f)
        return settings["ai"]["temperature"], settings["ai"]["randomSeed"]

async def process_post_with_llm(app_id, dataset_id, post_id, llm, prompt, regex = r"\"codes\":\s*(\[.*?\])"):
    try:
        post_data = get_post_and_comments_from_id(post_id, dataset_id)
        transcript = generate_transcript(post_data)
        response = await asyncio.to_thread(llm.invoke, prompt.format(transcript=transcript))

        codes_match = re.search(regex, response, re.DOTALL)
        codes = json.loads(codes_match.group(1)) if codes_match else []

        return [{"postId": post_id, "id": str(uuid4()), **code} for code in codes]
    except Exception as e:
        await manager.send_message(app_id, f"ERROR: {dataset_id}: Error processing post {post_id} - {str(e)}.")
        return []
    
async def run_coding_pipeline(app_id, request_body, prompt_generator):
    dataset_id, posts, model = request_body.dataset_id, request_body.unseen_post_ids, request_body.model
    llm = OllamaLLM(model=model, num_ctx=30000, num_predict=30000, temperature=0.6, callbacks=[StreamingStdOutCallbackHandler()])

    final_results = []
    for post_id in posts:
        await manager.send_message(app_id, f"Dataset {dataset_id}: Processing post {post_id}...")
        prompt = prompt_generator(request_body, post_id)
        final_results.extend(await process_post_with_llm(dataset_id, post_id, llm, prompt))

    await manager.send_message(app_id, f"Dataset {dataset_id}: All posts processed successfully.")
    return {"message": "Coding completed successfully!", "data": final_results}


def initialize_vector_store(dataset_id: str, model: str, embeddings: Any):
    chroma_client = HttpClient(host="localhost", port=8000)
    vector_store = Chroma(
        embedding_function=embeddings,
        collection_name=f"{dataset_id.replace('-','_')}_{model.replace(':','_')}"[:60],
        client=chroma_client,
        client_settings=ChromaDBSettings(anonymized_telemetry=False)
    )
    return vector_store

@log_execution_time()
async def save_context_files(app_id: str, dataset_id: str, contextFiles: List[UploadFile], vector_store: Chroma):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    await manager.send_message(app_id, f"Dataset {dataset_id}: Uploading files...")
    await asyncio.sleep(5)

    print(f"Processing context files for dataset {dataset_id}..., num files: {len(contextFiles)}")

    for file in contextFiles:
        print(f"Processing file: {file.filename}, size: {file.size}")

    if not os.path.exists(CONTEXT_FILES_DIR):
        os.makedirs(CONTEXT_FILES_DIR)

    for file in os.listdir(CONTEXT_FILES_DIR):
        file_path = os.path.join(CONTEXT_FILES_DIR, file)
        if os.path.isfile(file_path) and file.startswith(dataset_id):
            os.remove(file_path)

    for file in contextFiles:
        retries = 3
        success = False
        file_content = await file.read()
        while retries > 0 and not success:
            try:
                file_name = file.filename

                temp_file_path = os.path.join(CONTEXT_FILES_DIR, f"{dataset_id}_{time.time()}_{file_name}")
                with open(temp_file_path, "wb") as temp_file:
                    temp_file.write(file_content)

                print("Temp file path:", temp_file_path)
                if not os.path.exists(temp_file_path):
                    print("File does not exist!")

                # Determine loader based on file extension.
                ext = file_name.split('.')[-1].lower()
                if ext == "pdf":
                    loader = PyPDFLoader(temp_file_path)
                elif ext == "txt":
                    loader = TextLoader(temp_file_path)
                elif ext == "docx":
                    loader = Docx2txtLoader(temp_file_path)
                else:
                    raise ValueError(f"Unsupported file type: {ext}")

                # Load and process the document
                docs = await run_in_threadpool(loader.load)
                chunks = await run_in_threadpool(text_splitter.split_documents, docs)
                await run_in_threadpool(vector_store.add_documents, chunks)

                success = True
                await manager.send_message(app_id, f"Dataset {dataset_id}: Successfully processed file {file_name}.")
            except Exception as e:
                retries -= 1
                await manager.send_message(app_id, 
                    f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)"
                )
                if retries == 0:
                    await manager.send_message(app_id, 
                        f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts."
                    )
                    raise e

    await manager.send_message(app_id, f"Dataset {dataset_id}: Files uploaded successfully.")
    await asyncio.sleep(1)


@log_execution_time()
async def process_llm_task(
    app_id: str,
    dataset_id: str,
    workspace_id: str,
    manager: ConnectionManager,
    llm_model: str,
    regex_pattern: str,
    parent_function_name: str = "",
    post_id: Optional[str] = None,
    prompt_builder_func=None,
    rag_prompt_builder_func=None,  
    retriever=None,  
    function_id: str = None,
    input_text: str = None,  
    retries: int = 3,
    llm_instance: Any = None,
    store_response: bool = True,  
    stream_output: bool = False,  
    llm_queue_manager: GlobalQueueManager = None,
    cacheable_args: Optional[Dict[str, Any]] = None,
    **prompt_params
):
    max_retries = retries
    success = False
    extracted_data = None
    if not function_id:
        function_id = str(uuid4())
    # function_id = function_id or str(uuid4())  

    await manager.send_message(app_id, f"Dataset {dataset_id}: LLM process started...")

    while retries > 0 and not success:
        try:

            response = None
            job_id = None
            response_future = None

            if retriever:
                if not rag_prompt_builder_func:
                    raise ValueError("RAG mode requires a 'rag_prompt_builder_func'.")

                await manager.send_message(app_id, f"Dataset {dataset_id}: Using Retrieval-Augmented Generation (RAG)...")

                # retrieved_docs = retriever.invoke(input_text)

                prompt_template = ChatPromptTemplate.from_messages([
                    ("system", rag_prompt_builder_func(**prompt_params)),  
                    ("human", "{input}")
                ])
                question_answer_chain = create_stuff_documents_chain(llm=llm_instance, prompt=prompt_template)
                rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

                job_id, response_future = await llm_queue_manager.submit_task(rag_chain.invoke, function_id,{"input": input_text})  
            else:
                if not prompt_builder_func:
                    raise ValueError("Standard LLM invocation requires a 'prompt_builder_func'.")

                await manager.send_message(app_id, f"Dataset {dataset_id}: Running direct LLM task...")

                print("Cacheable Args in collector", cacheable_args)
                if cacheable_args:
                    cacheable_args["kwargs"].append("prompt_builder_func")
                    job_id, response_future = await llm_queue_manager.submit_task(llm_instance.invoke, function_id, cacheable_args=cacheable_args, **prompt_params, prompt_builder_func=prompt_builder_func)
                else:
                    prompt_text = prompt_builder_func(**prompt_params)
                    print("Prompt Text", prompt_text)
                    if stream_output:
                        async for chunk in llm_instance.stream(prompt_text):
                            await manager.send_message(app_id, f"Dataset {dataset_id}: {chunk}")
                    else:
                       job_id, response_future = await llm_queue_manager.submit_task(llm_instance.invoke, function_id, prompt_text)

            response = await response_future

            # print("Response", response)
            response = response["answer"] if retriever else response.content
            state_dump_repo.insert(
                StateDump(
                    state=json.dumps({
                        "dataset_id": dataset_id,
                        "model": llm_model,
                        "response": response,
                        "id": function_id,
                    }),
                    context=json.dumps({
                        "function": "llm_response_before_processing",
                        "post_id": post_id,
                        "retriever": bool(retriever),
                        "dataset_id": dataset_id,
                        "function_id": function_id,
                        "parent_function_name": parent_function_name,
                        "workspace_id": workspace_id,
                    }),
                )
            )
            match = re.search(regex_pattern, response, re.DOTALL)
            if not match:
                raise Exception("No valid structured data found in LLM response.")

            json_str = match.group(1).strip()
            extracted_data = json.loads(json_str, strict=False)

            success = True
            await manager.send_message(app_id, f"Dataset {dataset_id}: LLM process completed successfully.")

            if store_response and post_id:
                llm_responses_repo.insert(
                    LlmResponse(
                        dataset_id=dataset_id,
                        model=llm_model,
                        response=response.lower(),
                        id=str(uuid4()),
                        additional_info="LLM Response",
                        function_id=function_id,
                        post_id=post_id
                    )
                )

        except Exception as e:
            retries -= 1
            await manager.send_message(app_id, 
                f"WARNING: Dataset {dataset_id}: Error processing LLM response - {str(e)}. Retrying... ({retries}/{max_retries})"
            )
            # await asyncio.sleep(60)
            if retries == 0:
                await manager.send_message(app_id, f"ERROR: Dataset {dataset_id}: LLM failed after multiple attempts.")
                extracted_data = []
                # raise e
            # print("Error, waiting for 60 seconds", e)
            # await asyncio.sleep(60)

    return extracted_data


# async def generate_keywords_with_context(model: str, dataset_id: str, mainTopic: str, researchQuestions: list[str], additionalInfo: str, retriever: Any, ):
#     await manager.send_message(app_id, f"Dataset {dataset_id}: Generating keywords...")

#     # **Invoke LLM using the common function**
#     parsed_keywords = await process_llm_task(
#         dataset_id=dataset_id,
#         manager=manager,
#         prompt_builder_func=ContextPrompt.BACKGROUND_RESEARCH,
#         llm_model=model,
#         regex_pattern=r"(?<!\S)(?:```(?:json)?\n)?\s*\{.*?\"keywords\"\s*:\s*\[.*?\]\s*\}",
#         mainTopic=mainTopic,
#         researchQuestions=researchQuestions,
#         additionalInfo=additionalInfo
#     )

#     await manager.send_message(app_id, f"Dataset {dataset_id}: Processing complete.")
#     print(parsed_keywords)


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    text = ''.join(char for char in text if char != '_' and unicodedata.category(char).startswith(('L', 'N', 'Z', 'P')))
    text = text.strip()
    return text

def filter_codes_by_transcript(workspace_id: str, codes: list[dict], transcript: str, parent_function_name: str = "") -> list[dict]:
    # Normalize the transcript once for efficiency
    normalized_transcript = normalize_text(transcript)
    
    # Step 1: Filter out hallucinations (quotes not in transcript)
    hallucination_filtered_codes = []
    for code in codes:
        quote = code.get("quote", "").strip()
        normalized_quote = normalize_text(quote)
        if normalized_quote and normalized_quote in normalized_transcript:
            hallucination_filtered_codes.append(code)
        else:
            print(f"Filtered out code entry, quote not found in transcript: {quote}")
    
    # State Dump 1: Log results after removing hallucinations
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "hallucination_filtered_codes": hallucination_filtered_codes,
                "initial_codes": codes,
                "difference": len(codes) - len(hallucination_filtered_codes),
                "code_count": len(codes),
                "filtered_code_count": len(hallucination_filtered_codes),
            }),
            context=json.dumps({
                "function": "llm_response_after_filtering_hallucinations",
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
            }),
        )
    )
    
    # Step 2: Filter out duplicates (based on "code" and "quote")
    seen_pairs = set()
    duplicate_filtered_codes = []
    for code in hallucination_filtered_codes:
        code_value = code.get("code", "").strip()
        quote = code.get("quote", "").strip()
        normalized_code = normalize_text(code_value)
        normalized_quote = normalize_text(quote)
        pair = (normalized_code, normalized_quote)
        if pair not in seen_pairs:
            duplicate_filtered_codes.append(code)
            seen_pairs.add(pair)
        else:
            print(f"Filtered out duplicate code entry: code={code_value}, quote={quote}")
    
    # State Dump 2: Log results after removing duplicates
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "duplicate_filtered_codes": duplicate_filtered_codes,
                "hallucination_filtered_codes": hallucination_filtered_codes,
                "difference": len(hallucination_filtered_codes) - len(duplicate_filtered_codes),
                "code_count": len(hallucination_filtered_codes),
                "filtered_code_count": len(duplicate_filtered_codes),
            }),
            context=json.dumps({
                "function": "llm_response_after_filtering_duplicates",
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
            }),
        )
    )
    
    # Return the final filtered list
    return duplicate_filtered_codes


def filter_duplicate_codes(codes: List[Dict[str, Any]], parent_function_name: str, workspace_id: str) -> List[Dict[str, Any]]:
    seen_pairs = set()
    filtered_codes = []
    for code in codes:
        code_value = code.get("code", "").strip()
        quote = code.get("quote", "").strip()
        normalized_code = normalize_text(code_value)
        normalized_quote = normalize_text(quote)
        pair = f"{normalized_code}|{normalized_quote}"
        if pair not in seen_pairs:
            filtered_codes.append(code)
            seen_pairs.add(pair)
        else:
            print(f"Filtered out duplicate code entry: code={code_value}, quote={quote}")

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "filtered_codes": filtered_codes,
                "initial_codes": codes,
            }),
            context=json.dumps({
                "function": "llm_response_after_filtering_duplicates",
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
            }),
        )
    )
    
    return filtered_codes


def insert_responses_into_db(responses: List[Dict[str, Any]], dataset_id: str, workspace_id: str, model: str, codebook_type: str, parent_function_name: str = ""):
#    for response in responses:
#         if not (response["code"] and response["quote"] and response["explanation"]):
#             print(f"Skipping invalid response: {response}")
#             continue
#         qect_repo.insert(
#             QECTResponse(
#                 id=response["id"],
#                 generation_type=GenerationType.INITIAL.value,
#                 dataset_id=dataset_id,
#                 workspace_id=workspace_id,
#                 model=model,
#                 quote=response["quote"],
#                 code=response["code"],
#                 explanation=response["explanation"],
#                 post_id=response["postId"],
#                 response_type=response_type,
#                 chat_history=chat_history,
#                 codebook_type=codebook_type
#             )
#         )
    initial_responses = responses
    responses = list(filter(lambda response: response.get("code") and response.get("quote") and response.get("explanation"), responses))
    qect_repo.insert_batch(
       list(
            map(
                lambda code: QectResponse(
                    id=code["id"],
                    generation_type=GenerationType.INITIAL.value,
                    dataset_id=dataset_id,
                    workspace_id=workspace_id,
                    model=model,
                    quote=code["quote"],
                    code=code["code"],
                    explanation=code["explanation"],
                    post_id=code["postId"],
                    response_type=ResponseCreatorType.LLM.value,
                    chat_history=None,
                    codebook_type=codebook_type
                ), 
                responses
            )
        )
    )
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "final_responses": responses,
                "initial_responses": initial_responses,
                "response_count": len(responses),
                "initial_response_count": len(initial_responses),
                "difference": len(initial_responses) - len(responses),
            }),
            context=json.dumps({
                "function": "llm_response_after_filtering_empty_columns",
                "codebook_type": codebook_type,
                "dataset_id": dataset_id,
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
            }),
        )
    )
    return responses


# def get_num_tokens(text: str, llm_instance: Any) -> int:
#     return llm_instance.get_num_tokens(text)

# def divide_into_chunks(words: List[str], max_tokens: int, llm_instance: Any) -> List[List[str]]:
#     chunks = []
#     current_chunk = []
#     current_tokens = 0
#     for word in words:
#         word_tokens = get_num_tokens(word, llm_instance)
#         if current_tokens + word_tokens + 1 > max_tokens:  # +1 for comma or space
#             if current_chunk:
#                 chunks.append(current_chunk)
#             current_chunk = [word]
#             current_tokens = word_tokens
#         else:
#             current_chunk.append(word)
#             current_tokens += word_tokens + 1
#     if current_chunk:
#         chunks.append(current_chunk)
#     return chunks

# async def cluster_words_with_llm(
#     words: List[str],
#     llm_model: str,
#     app_id: str,
#     dataset_id: str,
#     manager: Any,  # ConnectionManager instance
#     llm_instance: Any,  # LLM instance
#     llm_queue_manager: Any,  # GlobalQueueManager instance
#     store_response: bool = False,
#     max_tokens: int = 8000,
#     retries: int = 3,
#     **kwargs
# ) -> Dict[str, List[str]]:
#     chunks = divide_into_chunks(words, max_tokens - 1000, llm_instance)
#     if not chunks:
#         return {}

#     regex_pattern = r"```(?:json)?\s*(.*?)\s*```" 

#     def beginning_prompt_builder(**params):
#         words_list = '\n'.join([f"- {word}" for word in chunks[0]])
#         return (
#             "Cluster the following distinct words into an appropriate number of topics. "
#             "Each word should be assigned to exactly one topic, and all words must be included in the output without duplication. "
#             "Determine the optimal number of topics based on the words provided. "
#             "Choose descriptive names for the topics that reflect the common theme or category of the words in each cluster. "
#             "Provide only the JSON output in the following format, wrapped in markdown code blocks (```json ... ```): "
#             "{ \"topic1\": [\"word1\", \"word2\", ...], \"topic2\": [\"word3\", \"word4\", ...], ... }. "
#             "Do not include any additional text or explanations. "
#             "Here are the words to cluster:\n\n" + words_list
#         )

#     extracted_data = await process_llm_task(
#         app_id=app_id,
#         dataset_id=dataset_id,
#         manager=manager,
#         llm_model=llm_model,
#         regex_pattern=regex_pattern,
#         prompt_builder_func=beginning_prompt_builder,
#         llm_instance=llm_instance,
#         llm_queue_manager=llm_queue_manager,
#         store_response=store_response,
#         retries=retries,
#         **kwargs
#     )
#     if not isinstance(extracted_data, dict):
#         raise ValueError("Failed to obtain valid clusters from the first chunk.")
#     current_clusters = extracted_data

#     for chunk in chunks[1:]:
#         def continuation_prompt_builder(**params):
#             existing_topics = list(current_clusters.keys())
#             words_list = '\n'.join([f"- {word}" for word in chunk])
#             return (
#                 f"Given the existing topic names: {json.dumps(existing_topics)}, "
#                 "assign the following distinct new words to the existing topics if they fit, "
#                 "or create new topics with descriptive names if necessary. "
#                 "Each new word should be assigned to exactly one topic, and all new words must be included in the output without duplication. "
#                 "Provide only the JSON output containing only the new words, in the following format, "
#                 "wrapped in markdown code blocks (```json ... ```): "
#                 "{ \"topic1\": [\"new_word1\", \"new_word2\", ...], \"topic2\": [\"new_word3\", ...], ... }. "
#                 "Do not include any additional text or explanations. "
#                 "Here are the new words to assign:\n\n" + words_list
#             )

#         extracted_data = await process_llm_task(
#             app_id=app_id,
#             dataset_id=dataset_id,
#             manager=manager,
#             llm_model=llm_model,
#             regex_pattern=regex_pattern,
#             prompt_builder_func=continuation_prompt_builder,
#             llm_instance=llm_instance,
#             llm_queue_manager=llm_queue_manager,
#             store_response=store_response,
#             retries=retries,
#             **kwargs
#         )
#         if not isinstance(extracted_data, dict):
#             raise ValueError("Failed to update clusters for a subsequent chunk.")

#         for topic, new_words in extracted_data.items():
#             if topic in current_clusters:
#                 current_clusters[topic].extend(new_words)
#             else:
#                 current_clusters[topic] = new_words

#     def ending_prompt_builder(**params):
#         return (
#             disclaimer +
#             f"Given the following clusters in JSON format: {json.dumps(current_clusters)}, "
#             "refine these clusters into high-level topics. "
#             "Determine the optimal number of high-level topics and assign each word to exactly one high-level topic, "
#             "ensuring all words are included without duplication. "
#             "Provide only the final JSON output in the following format, wrapped in markdown code blocks (```json ... ```): "
#             "{ \"topic1\": [\"word1\", \"word2\", ...], \"topic2\": [\"word3\", \"word4\", ...], ... }. "
#             "Do not include any additional text or explanations."
#         )

#     final_extracted_data = await process_llm_task(
#         app_id=app_id,
#         dataset_id=dataset_id,
#         manager=manager,
#         llm_model=llm_model,
#         regex_pattern=regex_pattern,
#         prompt_builder_func=ending_prompt_builder,
#         llm_instance=llm_instance,
#         llm_queue_manager=llm_queue_manager,
#         store_response=store_response,
#         retries=retries,
#         **kwargs
#     )
#     if not isinstance(final_extracted_data, dict):
#         raise ValueError("Failed to refine clusters into final topics.")

#     return final_extracted_data

def divide_into_fixed_chunks(words: List[str], chunk_size: int) -> List[List[str]]:
    return [words[i:i + chunk_size] for i in range(0, len(words), chunk_size)]

async def cluster_words_with_llm(
    workspace_id:str, 
    words: List[str],
    llm_model: str,
    app_id: str,
    dataset_id: str,
    manager: Any, 
    llm_instance: Any,  
    llm_queue_manager: Any,  
    parent_function_name: str = "",
    store_response: bool = False,
    chunk_size: int = 100,
    retries: int = 3,
    **kwargs
) -> Dict[str, List[str]]:
    # Split words into initial chunks
    chunks_to_process = divide_into_fixed_chunks(words, chunk_size)
    if not chunks_to_process:
        return {}

    regex_pattern = r"```(?:json)?\s*(.*?)\s*```"
    current_clusters = None
    i = 0

    # Process chunks dynamically
    while i < len(chunks_to_process):
        chunk = chunks_to_process[i]
        if current_clusters is None:
            # First chunk, use beginning prompt
            extracted_data = await process_llm_task(
                app_id=app_id,
                workspace_id = workspace_id, 
                dataset_id=dataset_id,
                manager=manager,
                llm_model=llm_model,
                regex_pattern=regex_pattern,
                parent_function_name=parent_function_name + " cluster words with llm beginning",
                prompt_builder_func=TopicClustering.begin_topic_clustering_prompt,
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                store_response=store_response,
                retries=retries,
                words_json=json.dumps(chunk),
                **kwargs
            )
        else:
            # Continuation chunk
            extracted_data = await process_llm_task(
                app_id=app_id,
                workspace_id = workspace_id,
                dataset_id=dataset_id,
                manager=manager,
                llm_model=llm_model,
                regex_pattern=regex_pattern,
                parent_function_name=parent_function_name + " cluster words with llm continuation",
                prompt_builder_func=TopicClustering.continuation_prompt_builder,
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                store_response=store_response,
                retries=retries,
                current_clusters_keys=json.dumps(list(current_clusters.keys())),
                words_json=json.dumps(chunk),
                **kwargs
            )
        
        if isinstance(extracted_data, dict):
            # Success: update clusters
            if current_clusters is None:
                current_clusters = extracted_data
            else:
                for topic, new_words in extracted_data.items():
                    if topic in current_clusters:
                        current_clusters[topic].extend(new_words)
                    else:
                        current_clusters[topic] = new_words
            i += 1  # Move to next chunk
        else:
            # Failure: split chunk if possible
            if len(chunk) > 1:
                mid = len(chunk) // 2
                left = chunk[:mid]
                right = chunk[mid:]
                # Insert halves at current position
                chunks_to_process = chunks_to_process[:i] + [left, right] + chunks_to_process[i+1:]
                # Do not increment i, so next iteration processes 'left'
            else:
                raise ValueError(f"Failed to process single word after retries: {chunk}")

    # Store final state
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "final_clusters": current_clusters,
                "initial_words": words,
                "cluster_count": len(current_clusters.keys()),
            }),
            context=json.dumps({
                "function": "llm_clustering_response",
                "workspace_id": workspace_id,
            }),
        )
    )
    return current_clusters


def get_num_tokens(text: str, llm_instance: Any) -> int:
    return llm_instance.get_num_tokens(text)

# async def summarize_with_llm(
#     texts: List[str],
#     llm_model: str,
#     app_id: str,
#     dataset_id: str,
#     manager: Any,
#     llm_instance: Any,
#     llm_queue_manager: Any,
#     prompt_builder_func: Callable[[Dict[str, Any]], str],
#     parent_function_name: str = "",
#     store_response: bool = False,
#     max_input_tokens: int = 128000,
#     retries: int = 3,
#     **kwargs
# ) -> str:
#     if not texts:
#         return ""

#     def generic_prompt_builder(**params) -> str:
#         texts = params['texts']
#         concatenated_text = "\n\n".join(texts)
#         return (
#             f"Provide a concise summary of the following texts. "
#             f"Return the summary in JSON format as ```json{{ \"summary\": \"your summary here\" }}```.\n\n"
#             f"Texts:\n{concatenated_text}"
#         )

#     def build_chunk(texts: List[str], max_tokens: int) -> tuple[List[str], List[str]]:
#         chunk = []
#         current_tokens = 0
#         prompt_func = prompt_builder_func if 'code' in kwargs else generic_prompt_builder
#         fixed_prompt = prompt_func(**{**kwargs, 'texts': []})
#         fixed_prompt_tokens = llm_instance.get_num_tokens(fixed_prompt)
#         separator = "\n\n"
#         separator_tokens = llm_instance.get_num_tokens(separator)

#         for text in texts:
#             text_tokens = llm_instance.get_num_tokens(text)
#             additional_tokens = separator_tokens + text_tokens if chunk else text_tokens
#             if fixed_prompt_tokens + current_tokens + additional_tokens > max_tokens:
#                 break
#             chunk.append(text)
#             current_tokens += additional_tokens

#         remaining = texts[len(chunk):]
#         return chunk, remaining

#     async def summarize_chunk(chunk: List[str]) -> str:
#         extracted_dict = await process_llm_task(
#             app_id=app_id,
#             dataset_id=dataset_id,
#             manager=manager,
#             llm_model=llm_model,
#             regex_pattern=r"```json\s*(.*?)\s*```",
#             prompt_builder_func=prompt_builder_func,
#             llm_instance=llm_instance,
#             parent_function_name=parent_function_name+" summarize chunk",
#             llm_queue_manager=llm_queue_manager,
#             store_response=store_response,
#             retries=retries,
#             texts=chunk,
#             **kwargs
#         )

#         if not isinstance(extracted_dict, dict):
#             raise ValueError(f"Expected dict, got {type(extracted_dict)}: {extracted_dict}")
#         if "summary" not in extracted_dict:
#             raise ValueError(f"Missing 'summary' key. Got: {extracted_dict}")
#         summary = extracted_dict["summary"]
#         if not isinstance(summary, str):
#             raise ValueError(f"Summary must be a string, got {type(summary)}: {summary}")
#         return summary

#     remaining_texts = texts
#     summaries = []
#     while remaining_texts:
#         chunk, remaining_texts = build_chunk(remaining_texts, max_input_tokens)
#         if not chunk:
#             break
#         summary = await summarize_chunk(chunk)
#         summaries.append(summary)

#     if len(summaries) == 1:
#         return summaries[0]
#     return await summarize_with_llm(
#         summaries,
#         llm_model,
#         app_id,
#         dataset_id,
#         manager,
#         llm_instance,
#         llm_queue_manager,
#         parent_function_name=parent_function_name+" summarize summaries",
#         prompt_builder_func=generic_prompt_builder,
#         store_response=store_response,
#         max_input_tokens=max_input_tokens,
#         retries=retries,
#         **{k: v for k, v in kwargs.items() if k != 'code'}
#     )

# def split_into_batches(
#     codes_dict: Dict[str, List[str]],
#     max_tokens: int,
#     llm_instance: Any
# ) -> List[List[str]]:
#     batches = []
#     current_batch = []
#     fixed_prompt = (
#         "Provide a concise summary of 1-2 lines for each of the following codes based on their explanations. "
#         "Return all summaries in a single JSON object where each key is the code and each value is its summary, "
#         "like {\"code1\": \"summary1\", \"code2\": \"summary2\", ...}. "
#         "Ensure the entire JSON object is wrapped in triple backticks with json specifier (```json ... ```). "
#         "Do not return multiple separate JSON objects.\n\n"
#     )
#     fixed_tokens = llm_instance.get_num_tokens(fixed_prompt)
#     separator = "---\n"
#     current_tokens = fixed_tokens

#     for code, explanations in codes_dict.items():
#         code_section = f"Code: {code}\nExplanations:\n" + "\n".join(f"- {exp}" for exp in explanations) + "\n" + separator
#         code_section_tokens = llm_instance.get_num_tokens(code_section)

#         if current_tokens + code_section_tokens > max_tokens:
#             if current_batch:
#                 batches.append(current_batch)
#                 current_batch = []
#                 current_tokens = fixed_tokens
#             if fixed_tokens + code_section_tokens > max_tokens:
#                 print(f"Single code '{code}' exceeds token limit: {fixed_tokens + code_section_tokens} > {max_tokens}")
#                 batches.append([code])
#             else:
#                 current_batch.append(code)
#                 current_tokens = fixed_tokens + code_section_tokens
#         else:
#             current_batch.append(code)
#             current_tokens += code_section_tokens

#     if current_batch:
#         batches.append(current_batch)

#     return batches

# async def summarize_codebook_explanations(
#     responses: List[Dict[str, Any]],
#     llm_model: str,
#     app_id: str,
#     dataset_id: str,
#     manager: Any,
#     parent_function_name: str,
#     llm_instance: Any,
#     llm_queue_manager: Any,
#     max_input_tokens: int = 128000,
#     **kwargs
# ) -> Dict[str, str]:
#     grouped_explanations = defaultdict(list)
#     for response in responses:
#         code = response['code']
#         explanation = response['explanation']
#         grouped_explanations[code].append(explanation)

#     batchable_codes = {code: exps for code, exps in grouped_explanations.items() if len(exps) < 4}
#     individual_codes = [code for code, exps in grouped_explanations.items() if len(exps) >= 4]

#     def prompt_builder(**params) -> str:
#         texts = params['texts']
#         code = params['code']
#         concatenated_text = "\n\n".join(texts)
#         return (
#             f"Provide a concise summary of 1-2 lines for the explanations of code '{code}'. "
#             f"Return the summary in JSON format as ```json{{ \"summary\": \"your summary here\" }}```.\n\n"
#             f"Explanations:\n{concatenated_text}"
#         )

#     async def batch_multiple_codes_task(batch: List[str]) -> List[Tuple[str, str]]:
#         if not batch:
#             return []

#         prompt = (
#             "Provide a concise summary of 1-2 lines for each of the following codes based on their explanations. "
#             "Return all summaries in a single JSON object where each key is the code and each value is its summary. "
#             "The JSON object must be wrapped in ```json ... ```. Example:\n"
#             "```json\n{\"codeA\": \"Summary A\", \"codeB\": \"Summary B\"}\n```\n\n"
#             "Codes and explanations:\n"
#         )
#         for code in batch:
#             explanations = batchable_codes[code]
#             prompt += f"Code: {code}\nExplanations:\n" + "\n".join(f"- {exp}" for exp in explanations) + "\n---\n"

#         extracted_dict = await process_llm_task(
#             app_id=app_id,
#             dataset_id=dataset_id,
#             manager=manager,
#             llm_model=llm_model,
#             regex_pattern=r"```json\s*(.*?)\s*```",
#             prompt_builder_func=lambda **_: prompt,
#             parent_function_name=parent_function_name + " summarize_batch",
#             llm_instance=llm_instance,
#             llm_queue_manager=llm_queue_manager,
#             store_response=kwargs.get('store_response', False),
#             retries=kwargs.get('retries', 3),
#             **kwargs
#         )

#         if not isinstance(extracted_dict, dict):
#             raise ValueError(f"Expected dict, got {type(extracted_dict)}: {extracted_dict}")
#         summaries = {}
#         for code in batch:
#             if code not in extracted_dict:
#                 raise ValueError(f"Missing summary for '{code}'. Got: {extracted_dict}")
#             summary = extracted_dict[code]
#             if not isinstance(summary, str):
#                 raise ValueError(f"Summary for '{code}' must be string, got {type(summary)}: {summary}")
#             summaries[code] = summary
#         return [(code, summaries[code]) for code in batch]

#     async def summarize_individual_code(code: str) -> List[Tuple[str, str]]:
#         summary = await summarize_with_llm(
#             texts=grouped_explanations[code],
#             llm_model=llm_model,
#             app_id=app_id,
#             dataset_id=dataset_id,
#             manager=manager,
#             parent_function_name=parent_function_name + " summarize_individual_code",
#             llm_instance=llm_instance,
#             llm_queue_manager=llm_queue_manager,
#             prompt_builder_func=prompt_builder,
#             code=code,
#             max_input_tokens=max_input_tokens,
#             **kwargs
#         )
#         return [(code, summary)]

#     batches = split_into_batches(batchable_codes, max_input_tokens, llm_instance) if batchable_codes else []

#     tasks = [batch_multiple_codes_task(batch) for batch in batches]
#     tasks.extend(summarize_individual_code(code) for code in individual_codes)
#     results = await asyncio.gather(*tasks)

#     all_summaries = [item for sublist in results for item in sublist]
#     return dict(all_summaries)

# Helper function to truncate text to a specified token count
def truncate_text(text: str, max_tokens: int, llm_instance: Any) -> str:
    tokens = llm_instance.tokenize(text)
    if len(tokens) <= max_tokens:
        return text
    truncated_tokens = tokens[:max_tokens]
    return llm_instance.detokenize(truncated_tokens)

# Modified summarize_with_llm to handle oversized texts
async def summarize_with_llm(
    workspace_id:str,
    texts: List[str],
    llm_model: str,
    app_id: str,
    dataset_id: str,
    manager: Any,
    llm_instance: Any,
    llm_queue_manager: Any,
    prompt_builder_func: Callable[[Dict[str, Any]], str],
    parent_function_name: str = "",
    store_response: bool = False,
    max_input_tokens: int = 128000,
    retries: int = 3,
    **kwargs
) -> str:
    if not texts:
        return ""

    def generic_prompt_builder(**params) -> str:
        texts = params['texts']
        concatenated_text = "\n\n".join(texts)
        return (
            f"Provide a concise summary of the following texts. "
            f"Return the summary in JSON format as ```json{{ \"summary\": \"your summary here\" }}```.\n\n"
            f"Texts:\n{concatenated_text}"
        )

    def build_chunk(texts: List[str], max_tokens: int) -> Tuple[List[str], List[str]]:
        chunk = []
        current_tokens = 0
        prompt_func = prompt_builder_func if 'code' in kwargs else generic_prompt_builder
        fixed_prompt = prompt_func(**{**kwargs, 'texts': []})
        fixed_prompt_tokens = llm_instance.get_num_tokens(fixed_prompt)
        separator = "\n\n"
        separator_tokens = llm_instance.get_num_tokens(separator)

        remaining_texts = texts
        for text in remaining_texts:
            text_tokens = llm_instance.get_num_tokens(text)
            # Truncate if text is too long
            if text_tokens > max_tokens - fixed_prompt_tokens - (separator_tokens if chunk else 0):
                text = truncate_text(
                    text,
                    max_tokens - fixed_prompt_tokens - (separator_tokens if chunk else 0),
                    llm_instance
                )
                text_tokens = llm_instance.get_num_tokens(text)
            additional_tokens = separator_tokens + text_tokens if chunk else text_tokens
            if fixed_prompt_tokens + current_tokens + additional_tokens > max_tokens:
                break
            chunk.append(text)
            current_tokens += additional_tokens

        remaining = remaining_texts[len(chunk):]
        # If no chunk was formed and there are texts, force truncate the first one
        if not chunk and remaining_texts:
            text = remaining_texts[0]
            truncated_text = truncate_text(text, max_tokens - fixed_prompt_tokens, llm_instance)
            chunk = [truncated_text]
            remaining = remaining_texts[1:]
        return chunk, remaining

    async def summarize_chunk(chunk: List[str]) -> str:
        prompt_func = prompt_builder_func if 'code' in kwargs else generic_prompt_builder
        prompt = prompt_func(**{**kwargs, 'texts': chunk})
        for attempt in range(retries):
            extracted_dict = await process_llm_task(
                workspace_id = workspace_id,
                app_id=app_id,
                dataset_id=dataset_id,
                manager=manager,
                llm_model=llm_model,
                regex_pattern=r"```json\s*(.*?)\s*```",
                prompt_builder_func=lambda **_: prompt,
                parent_function_name=parent_function_name + " summarize chunk",
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                store_response=store_response,
                retries=1,  # Inner retries handled here
                **kwargs
            )

            if (isinstance(extracted_dict, dict) and 
                "summary" in extracted_dict and 
                isinstance(extracted_dict["summary"], str)):
                return extracted_dict["summary"]
            # Adjust prompt based on issue
            if not isinstance(extracted_dict, dict):
                prompt += "\n\nPlease provide the response in the correct JSON format: ```json{\"summary\": \"text\"}```."
            elif "summary" not in extracted_dict:
                prompt += "\n\nThe response is missing the 'summary' key. Please include it in the JSON."
            elif not isinstance(extracted_dict["summary"], str):
                prompt += "\n\nThe 'summary' must be a string. Please correct the format."
        # If retries fail, return a default note
        return "Summary unavailable due to repeated invalid responses from LLM."

    remaining_texts = texts
    summaries = []
    while remaining_texts:
        chunk, remaining_texts = build_chunk(remaining_texts, max_input_tokens)
        if not chunk:
            break
        summary = await summarize_chunk(chunk)
        summaries.append(summary)

    if len(summaries) == 1:
        return summaries[0]
    return await summarize_with_llm(
        workspace_id,
        summaries,
        llm_model,
        app_id,
        dataset_id,
        manager,
        llm_instance,
        llm_queue_manager,
        parent_function_name=parent_function_name + " summarize summaries",
        prompt_builder_func=generic_prompt_builder,
        store_response=store_response,
        max_input_tokens=max_input_tokens,
        retries=retries,
        **{k: v for k, v in kwargs.items() if k != 'code'}
    )

# Batch splitting function (unchanged)
def split_into_batches(
    codes_dict: Dict[str, List[str]],
    max_tokens: int,
    llm_instance: Any
) -> List[List[str]]:
    batches = []
    current_batch = []
    fixed_prompt = (
        "Provide a concise summary of 1-2 lines for each of the following codes based on their explanations. "
        "Return all summaries in a single JSON object where each key is the code and each value is its summary, "
        "like {\"code1\": \"summary1\", \"code2\": \"summary2\", ...}. "
        "Ensure the entire JSON object is wrapped in triple backticks with json specifier (```json ... ```). "
        "Do not return multiple separate JSON objects.\n\n"
    )
    fixed_tokens = llm_instance.get_num_tokens(fixed_prompt)
    separator = "---\n"
    current_tokens = fixed_tokens

    for code, explanations in codes_dict.items():
        code_section = f"Code: {code}\nExplanations:\n" + "\n".join(f"- {exp}" for exp in explanations) + "\n" + separator
        code_section_tokens = llm_instance.get_num_tokens(code_section)

        if current_tokens + code_section_tokens > max_tokens:
            if current_batch:
                batches.append(current_batch)
                current_batch = []
                current_tokens = fixed_tokens
            if fixed_tokens + code_section_tokens > max_tokens:
                print(f"Single code '{code}' exceeds token limit: {fixed_tokens + code_section_tokens} > {max_tokens}")
                batches.append([code])
            else:
                current_batch.append(code)
                current_tokens = fixed_tokens + code_section_tokens
        else:
            current_batch.append(code)
            current_tokens += code_section_tokens

    if current_batch:
        batches.append(current_batch)
    return batches

# Main function with improved error handling
async def summarize_codebook_explanations(
    workspace_id:str,
    responses: List[Dict[str, Any]],
    llm_model: str,
    app_id: str,
    dataset_id: str,
    manager: Any,
    parent_function_name: str,
    llm_instance: Any,
    llm_queue_manager: Any,
    max_input_tokens: int = 128000,
    retries: int = 3,
    **kwargs
) -> Dict[str, str]:
    grouped_explanations = defaultdict(list)
    for response in responses:
        code = response['code']
        explanation = response['explanation']
        grouped_explanations[code].append(explanation)

    batchable_codes = {code: exps for code, exps in grouped_explanations.items() if len(exps) < 4}
    individual_codes = [code for code, exps in grouped_explanations.items() if len(exps) >= 4]

    def prompt_builder(**params) -> str:
        texts = params['texts']
        code = params['code']
        concatenated_text = "\n\n".join(texts)
        return (
            f"Provide a concise summary of 1-2 lines for the explanations of code '{code}'. "
            f"Return the summary in JSON format as ```json{{ \"summary\": \"your summary here\" }}```.\n\n"
            f"Explanations:\n{concatenated_text}"
        )

    async def batch_multiple_codes_task(batch: List[str]) -> List[Tuple[str, str]]:
        if not batch:
            return []

        prompt = (
            "Provide a concise summary of 1-2 lines for each of the following codes based on their explanations. "
            "Return all summaries in a single JSON object where each key is the code and each value is its summary. "
            "The JSON object must be wrapped in ```json ... ```. Example:\n"
            "```json\n{\"codeA\": \"Summary A\", \"codeB\": \"Summary B\"}\n```\n\n"
            "Codes and explanations:\n"
        )
        for code in batch:
            explanations = batchable_codes[code]
            prompt += f"Code: {code}\nExplanations:\n" + "\n".join(f"- {exp}" for exp in explanations) + "\n---\n"

        for attempt in range(retries):
            extracted_dict = await process_llm_task(
                workspace_id = workspace_id,
                app_id=app_id,
                dataset_id=dataset_id,
                manager=manager,
                llm_model=llm_model,
                regex_pattern=r"```json\s*(.*?)\s*```",
                prompt_builder_func=lambda **_: prompt,
                parent_function_name=parent_function_name + " summarize_batch",
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                store_response=kwargs.get('store_response', False),
                retries=1,
                **kwargs
            )

            if isinstance(extracted_dict, dict):
                missing_codes = [code for code in batch if code not in extracted_dict]
                all_strings = all(isinstance(extracted_dict.get(code, ""), str) for code in batch)
                if not missing_codes and all_strings:
                    return [(code, extracted_dict[code]) for code in batch]
                # Adjust prompt for specific issues
                if missing_codes:
                    prompt += f"\n\nPlease include summaries for the following missing codes: {', '.join(missing_codes)}."
                if not all_strings:
                    prompt += "\n\nAll summaries must be strings. Please correct any non-string values."
            else:
                prompt += "\n\nPlease provide the response in the correct JSON format as shown in the example."
        # Fallback after retries
        summaries = {code: "Summary unavailable due to repeated invalid responses from LLM" for code in batch}
        return [(code, summaries[code]) for code in batch]

    async def summarize_individual_code(code: str) -> List[Tuple[str, str]]:
        summary = await summarize_with_llm(
            workspace_id = workspace_id,
            texts=grouped_explanations[code],
            llm_model=llm_model,
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            parent_function_name=parent_function_name + " summarize_individual_code",
            llm_instance=llm_instance,
            llm_queue_manager=llm_queue_manager,
            prompt_builder_func=prompt_builder,
            code=code,
            max_input_tokens=max_input_tokens,
            retries=retries,
            **kwargs
        )
        return [(code, summary)]

    batches = split_into_batches(batchable_codes, max_input_tokens, llm_instance) if batchable_codes else []

    tasks = [batch_multiple_codes_task(batch) for batch in batches]
    tasks.extend(summarize_individual_code(code) for code in individual_codes)
    results = await asyncio.gather(*tasks)

    all_summaries = [item for sublist in results for item in sublist]
    return dict(all_summaries)


def get_coded_data(
    codebook_names: list,
    filters: dict,
    dataset_id: str,
    batch_size: int,
    offset: int,
):
    # Extract filter parameters
    show_coder_type = filters.get("showCoderType", False)
    selected_type_filter = filters.get("selectedTypeFilter", "All")
    filter_param = filters.get("filter")
    
    # Build the base WHERE clause
    base_conditions = ["dataset_id = :dataset_id"]
    params = {"dataset_id": dataset_id}
    
    # Filter by codebook names if provided
    if codebook_names:
        placeholders = ", ".join([f":codebook_{i}" for i in range(len(codebook_names))])
        base_conditions.append(f"codebook_type IN ({placeholders})")
        for i, name in enumerate(codebook_names):
            params[f"codebook_{i}"] = name
    
    # Apply coder type and response type filters
    if not show_coder_type:
        if selected_type_filter == "All":
            base_conditions.append(
                "(codebook_type = :initial OR (codebook_type = :deductive AND response_type = :llm))"
            )
            params["initial"] = "initial"
            params["deductive"] = "deductive"
            params["llm"] = "LLM"
        elif selected_type_filter == "New Data":
            base_conditions.append("codebook_type = :deductive")
            base_conditions.append("response_type = :llm")
            params["deductive"] = "deductive"
            params["llm"] = "LLM"
        elif selected_type_filter == "Codebook":
            base_conditions.append("codebook_type = :initial")
            params["initial"] = "initial"
    else:
        base_conditions.append("codebook_type = :manual")
        params["manual"] = "manual"
        if selected_type_filter == "Human":
            base_conditions.append("response_type = :human")
            params["human"] = "Human"
        elif selected_type_filter == "LLM":
            base_conditions.append("response_type = :llm")
            params["llm"] = "LLM"
    
    # Combine conditions into WHERE clause
    base_where_clause = " AND ".join(base_conditions)
    
    # Calculate total_ids using SQL COUNT(*)
    total_ids_query = f"SELECT COUNT(*) FROM qect WHERE {base_where_clause}"
    total_ids_result = qect_repo.execute_raw_query(total_ids_query, tuple(params.values()), keys=False)
    total_ids = total_ids_result.fetchone()[0]
    
    # Fetch total_data for unique codes and filtering
    total_data_query = f"SELECT * FROM qect WHERE {base_where_clause}"
    total_data_rows = qect_repo.execute_raw_query(total_data_query, tuple(params.values()), keys=True)
    total_data = [QectResponse(**row) for row in total_data_rows]
    
    # Compute unique codes
    unique_codes = list(set(resp.code for resp in total_data))
    
    # Apply additional filtering based on filter_param
    if filter_param:
        if filter_param == "coded-data":
            filtered_data = total_data
            filtered_post_ids = list(set(resp.post_id for resp in total_data))
        elif "|" in filter_param and filter_param.endswith("|coded-data"):
            post_id = filter_param.split("|")[0]
            filtered_data = [resp for resp in total_data if resp.post_id == post_id]
            filtered_post_ids = [post_id] if filtered_data else []
        else:
            all_post_ids = set(resp.post_id for resp in total_data)
            if filter_param in all_post_ids:
                filtered_data = [resp for resp in total_data if resp.post_id == filter_param]
                filtered_post_ids = list(set(resp.post_id for resp in total_data))
            else:
                filtered_data = [resp for resp in total_data if resp.code == filter_param]
                filtered_post_ids = list(set(resp.post_id for resp in filtered_data))
    else:
        filtered_data = total_data
        filtered_post_ids = list(set(resp.post_id for resp in total_data))
    
    # Apply batching and offsetting
    if batch_size is not None:
        filtered_data = filtered_data[offset:offset + batch_size]
    else:
        filtered_data = filtered_data[offset:]
    
    # Serialize filtered_data
    filtered_data_serialized = [resp.to_dict() for resp in filtered_data]
    
    # Return the required values
    return {
        "filteredData": filtered_data_serialized,
        "filteredPostIds": filtered_post_ids,
        "totalIds": total_ids,
        "uniqueCodes": unique_codes
    }