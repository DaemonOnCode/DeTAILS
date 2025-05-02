import asyncio
from collections import defaultdict
import json
import os
import re
import time
from typing import Any, AsyncGenerator, Callable, Dict, Generator, List, Optional, Sequence, Tuple, Type, Union
import unicodedata
from uuid import uuid4

from chromadb import HttpClient
from fastapi import UploadFile

from chromadb.config import Settings as ChromaDBSettings
from constants import CHROMA_PORT, CONTEXT_FILES_DIR, PATHS, STUDY_DATABASE_PATH
from database.qect_table import QectRepository
from database.selected_post_ids_table import SelectedPostIdsRepository
from database.state_dump_table import StateDumpsRepository
from decorators import log_execution_time
from ipc import send_ipc_message
from models.table_dataclasses import CodebookType, DataClassEncoder, LlmResponse, QectResponse, ResponseCreatorType, StateDump
from routes.websocket_routes import ConnectionManager

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain.chains.retrieval import create_retrieval_chain 
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from starlette.concurrency import run_in_threadpool

from services.llm_service import GlobalQueueManager
from database import LlmResponsesRepository
from utils.prompts import TopicClustering

llm_responses_repo = LlmResponsesRepository()
qect_repo = QectRepository()
selected_post_ids_repo = SelectedPostIdsRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

def get_temperature_and_random_seed():
    with open(PATHS["settings"], "r") as f:
        settings = json.load(f)
        return settings["ai"]["temperature"], settings["ai"]["randomSeed"]


def initialize_vector_store(workspace_id: str, model: str, embeddings: Any):
    chroma_client = HttpClient(host="localhost", port=CHROMA_PORT)
    vector_store = Chroma(
        embedding_function=embeddings,
        collection_name=f"{workspace_id.replace('-','_')}_{model.replace(':','_')}"[:60],
        client=chroma_client,
        client_settings=ChromaDBSettings(anonymized_telemetry=False)
    )
    return vector_store

@log_execution_time()
async def save_context_files(app_id: str, workspace_id: str, contextFiles: List[UploadFile], vector_store: Chroma):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Uploading files...")
    await asyncio.sleep(5)

    print(f"Processing context files for dataset {workspace_id}..., num files: {len(contextFiles)}")

    for file in contextFiles:
        print(f"Processing file: {file.filename}, size: {file.size}")

    if not os.path.exists(CONTEXT_FILES_DIR):
        os.makedirs(CONTEXT_FILES_DIR)

    for file in os.listdir(CONTEXT_FILES_DIR):
        file_path = os.path.join(CONTEXT_FILES_DIR, file)
        if os.path.isfile(file_path) and file.startswith(workspace_id):
            os.remove(file_path)

    for file in contextFiles:
        retries = 3
        success = False
        file_content = await file.read()
        while retries > 0 and not success:
            try:
                file_name = file.filename

                temp_file_path = os.path.join(CONTEXT_FILES_DIR, f"{workspace_id}_{time.time()}_{file_name}")
                with open(temp_file_path, "wb") as temp_file:
                    temp_file.write(file_content)

                print("Temp file path:", temp_file_path)
                if not os.path.exists(temp_file_path):
                    print("File does not exist!")

                ext = file_name.split('.')[-1].lower()
                if ext == "pdf":
                    loader = PyPDFLoader(temp_file_path)
                elif ext == "txt":
                    loader = TextLoader(temp_file_path)
                elif ext == "docx":
                    loader = Docx2txtLoader(temp_file_path)
                else:
                    raise ValueError(f"Unsupported file type: {ext}")

                docs = await run_in_threadpool(loader.load)
                chunks = await run_in_threadpool(text_splitter.split_documents, docs)
                await run_in_threadpool(vector_store.add_documents, chunks)

                success = True
                await send_ipc_message(app_id, f"Dataset {workspace_id}: Successfully processed file {file_name}.")
            except Exception as e:
                retries -= 1
                await send_ipc_message(app_id, 
                    f"WARNING: Dataset {workspace_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)"
                )
                if retries == 0:
                    await send_ipc_message(app_id, 
                        f"ERROR: Dataset {workspace_id}: Failed to process file {file.filename} after multiple attempts."
                    )
                    raise e

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Files uploaded successfully.")
    await asyncio.sleep(1)


@log_execution_time()
async def process_llm_task(
    app_id: str,
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

    await send_ipc_message(app_id, f"Dataset {workspace_id}: LLM process started...")

    while retries > 0 and not success:
        try:

            response = None
            job_id = None
            response_future = None

            if retriever:
                if not rag_prompt_builder_func:
                    raise ValueError("RAG mode requires a 'rag_prompt_builder_func'.")

                await send_ipc_message(app_id, f"Dataset {workspace_id}: Using Retrieval-Augmented Generation (RAG)...")

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

                await send_ipc_message(app_id, f"Dataset {workspace_id}: Running direct LLM task...")

                print("Cacheable Args in collector", cacheable_args)
                if cacheable_args:
                    cacheable_args["kwargs"].append("prompt_builder_func")
                    job_id, response_future = await llm_queue_manager.submit_task(llm_instance.invoke, function_id, cacheable_args=cacheable_args, **prompt_params, prompt_builder_func=prompt_builder_func)
                else:
                    prompt_text = prompt_builder_func(**prompt_params)
                    print("Prompt Text", prompt_text)
                    if stream_output:
                        async for chunk in llm_instance.stream(prompt_text):
                            await send_ipc_message(app_id, f"Dataset {workspace_id}: {chunk}")
                    else:
                       job_id, response_future = await llm_queue_manager.submit_task(llm_instance.invoke, function_id, prompt_text)

            response = await asyncio.wait_for(response_future, timeout=5 * 60)

            response = response["answer"] if retriever else response.content
            state_dump_repo.insert(
                StateDump(
                    state=json.dumps({
                        "workspace_id": workspace_id,
                        "model": llm_model,
                        "response": response,
                        "id": function_id,
                    }),
                    context=json.dumps({
                        "function": "llm_response_before_processing",
                        "post_id": post_id,
                        "retriever": bool(retriever),
                        "workspace_id": workspace_id,
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
            await send_ipc_message(app_id, f"Dataset {workspace_id}: LLM process completed successfully.")

            if store_response and post_id:
                llm_responses_repo.insert(
                    LlmResponse(
                        workspace_id=workspace_id,
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
            await send_ipc_message(app_id, 
                f"WARNING: Dataset {workspace_id}: Error processing LLM response - {str(e)}. Retrying... ({retries}/{max_retries})"
            )
            if retries == 0:
                await send_ipc_message(app_id, f"ERROR: Dataset {workspace_id}: LLM failed after multiple attempts.")
                extracted_data = []

    return extracted_data

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    text = ''.join(char for char in text if char != '_' and unicodedata.category(char).startswith(('L', 'N', 'Z', 'P')))
    text = text.strip()
    return text

def filter_codes_by_transcript(workspace_id: str, codes: list[dict], transcript: str, parent_function_name: str = "", post_id: str = "", function_id: str = None) -> list[dict]:
    normalized_transcript = normalize_text(transcript)

    hallucination_filtered_codes = []
    for code in codes:
        quote = code.get("quote", "").strip()
        normalized_quote = normalize_text(quote)
        if normalized_quote and normalized_quote in normalized_transcript:
            hallucination_filtered_codes.append(code)
        else:
            print(f"Filtered out code entry, quote not found in transcript: {quote}")
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
                "post_id": post_id,
                "function_id": function_id
            }),
        )
    )
    
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
                "post_id": post_id,
                "function_id": function_id
            }),
        )
    )
    
    return duplicate_filtered_codes


def filter_duplicate_codes(codes: List[Dict[str, Any]], parent_function_name: str, workspace_id: str, function_id: str = None) -> List[Dict[str, Any]]:
    seen_pairs = set()
    filtered_codes = []
    for code in codes:
        code_value = code.get("code", "")
        quote = code.get("quote", "")
        pair = f"{code_value}|{quote}"
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
                "function_id": function_id
            }),
        )
    )
    
    return filtered_codes

def filter_duplicate_codes_in_db(workspace_id: str, codebook_type: str, generation_type: str, parent_function_name: str, function_id: str = None):
    count_before = qect_repo.count({
        "workspace_id": workspace_id,
        "codebook_type": codebook_type,
    })

    delete_query = """
        DELETE FROM qect
        WHERE id NOT IN (
            SELECT id
            FROM (
                SELECT id,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(TRIM(code)), LOWER(TRIM(quote))
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM qect
                WHERE workspace_id = ? AND codebook_type = ?
            ) AS sub
            WHERE rn = 1
        )
        AND workspace_id = ? AND codebook_type = ?
    """
    params = (workspace_id, codebook_type, workspace_id, codebook_type)
    qect_repo.execute_raw_query(delete_query, params)
    
    count_after = qect_repo.count({
        "workspace_id": workspace_id,
        "codebook_type": codebook_type,
    })
    
    duplicates_removed = count_before - count_after

    after_delete = qect_repo.find({
        "workspace_id": workspace_id,
        "codebook_type": codebook_type,
    })

    print(f"Duplicates removed: {duplicates_removed}, Count before: {count_before}, Count after: {count_after}")
    
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "difference": duplicates_removed,
                "workspace_id": workspace_id,
                "codebook_type": codebook_type,
                "generation_type": generation_type,
                "count_before": count_before,
                "count_after": count_after,
                "duplicate_filtered_codes": after_delete
            }, cls=DataClassEncoder),
            context=json.dumps({
                "function": "llm_response_after_filtering_duplicates",
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
                "function_id": function_id
            }),
        )
    )


def insert_responses_into_db(responses: List[Dict[str, Any]], workspace_id: str, model: str, codebook_type: str, parent_function_name: str = "", post_id: str = "", function_id: str = None) -> List[Dict[str, Any]]:
    initial_responses = responses
    responses = list(filter(lambda response: response.get("code") and response.get("quote") and response.get("explanation"), responses))
    qect_repo.insert_batch(
       list(
            map(
                lambda code: QectResponse(
                    id=code["id"],
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
                "workspace_id": workspace_id,
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
                "post_id": post_id,
                "function_id": function_id
            }),
        )
    )
    return responses

def divide_into_fixed_chunks(words: List[str], chunk_size: int) -> List[List[str]]:
    return [words[i:i + chunk_size] for i in range(0, len(words), chunk_size)]

async def cluster_words_with_llm(
    workspace_id:str, 
    words: List[str],
    llm_model: str,
    app_id: str,
    manager: Any, 
    llm_instance: Any,  
    llm_queue_manager: Any,  
    parent_function_name: str = "",
    store_response: bool = False,
    chunk_size: int = 100,
    retries: int = 3,
    **kwargs
) -> Dict[str, List[str]]:
    chunks_to_process = divide_into_fixed_chunks(words, chunk_size)
    if not chunks_to_process:
        return {}

    regex_pattern = r"```(?:json)?\s*(.*?)\s*```"
    current_clusters = None
    i = 0

    while i < len(chunks_to_process):
        chunk = chunks_to_process[i]
        if current_clusters is None:
            extracted_data = await process_llm_task(
                app_id=app_id,
                workspace_id = workspace_id, 
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
            extracted_data = await process_llm_task(
                app_id=app_id,
                workspace_id = workspace_id,
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
            if current_clusters is None:
                current_clusters = extracted_data
            else:
                for topic, new_words in extracted_data.items():
                    if topic in current_clusters:
                        current_clusters[topic].extend(new_words)
                    else:
                        current_clusters[topic] = new_words
            i += 1  
        else:
            if len(chunk) > 1:
                mid = len(chunk) // 2
                left = chunk[:mid]
                right = chunk[mid:]
                chunks_to_process = chunks_to_process[:i] + [left, right] + chunks_to_process[i+1:]
            else:
                raise ValueError(f"Failed to process single word after retries: {chunk}")

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

def truncate_text(text: str, max_tokens: int, llm_instance: Any) -> str:
    tokens = llm_instance.tokenize(text)
    if len(tokens) <= max_tokens:
        return text
    truncated_tokens = tokens[:max_tokens]
    return llm_instance.detokenize(truncated_tokens)

async def stream_qect_pages(
    workspace_id: str,
    codebook_types: List[int],
    page_size: int = 500
) -> AsyncGenerator[List[Dict[str, Any]], None]:
    table = qect_repo.table_name
    types_placeholders = ", ".join("?" for _ in codebook_types)
    base_sql = (
        f"SELECT * FROM {table} "
        f"WHERE workspace_id = ? AND codebook_type IN ({types_placeholders}) AND is_marked = 1 "
        f"ORDER BY rowid "
        f"LIMIT ? OFFSET ?"
    )
    offset = 0
    while True:
        params = [workspace_id, *codebook_types, page_size, offset]
        rows = qect_repo.execute_raw_query(base_sql, tuple(params), keys=True)
        if not rows:
            break
        yield rows
        offset += len(rows)

async def summarize_with_llm(
    workspace_id: str,
    texts: List[str],
    llm_model: str,
    app_id: str,
    manager: Any,
    llm_instance: Any,
    llm_queue_manager: Any,
    prompt_builder_func: Optional[Callable[..., str]] = None,
    parent_function_name: str = "",
    store_response: bool = False,
    max_input_tokens: int = 128000,
    retries: int = 3,
    **kwargs
) -> Dict[str, str]:
    if not texts:
        return {"summary": ""}

    def generic_prompt_builder(**params) -> str:
        docs = "\n\n".join(params['texts'])
        return (
            "Provide a concise summary (1-2 lines). "
            "Respond *only* with valid JSON, for example:\n"
            "```json\n"
            "{\"summary\": \"...\"}\n"
            "```\n\n"
            f"Texts:\n{docs}"
        )

    prompt_fn = prompt_builder_func or generic_prompt_builder

    def build_chunk(texts: List[str], max_tokens: int):
        fixed = prompt_fn(**{**kwargs, 'texts': []})
        fixed_t = llm_instance.get_num_tokens(fixed)
        sep = "\n\n"; sep_t = llm_instance.get_num_tokens(sep)
        chunk, used = [], 0
        for txt in texts:
            tkns = llm_instance.get_num_tokens(txt)
            # if one piece too big, truncate it
            if fixed_t + (sep_t if chunk else 0) + tkns > max_tokens:
                txt = truncate_text(txt, max_tokens - fixed_t - (sep_t if chunk else 0), llm_instance)
                tkns = llm_instance.get_num_tokens(txt)
            if fixed_t + used + (sep_t if chunk else 0) + tkns > max_tokens:
                break
            if chunk:
                used += sep_t
            chunk.append(txt)
            used += tkns
        rest = texts[len(chunk):]
        if not chunk and rest:
            one = truncate_text(rest[0], max_tokens - fixed_t, llm_instance)
            chunk, rest = [one], rest[1:]
        return chunk, rest

    async def summarize_chunk(chunk: List[str]) -> Dict[str, Any]:
        prompt = prompt_fn(**{**kwargs, 'texts': chunk})
        for _ in range(retries):
            out = await process_llm_task(
                workspace_id=workspace_id,
                app_id=app_id,
                manager=manager,
                llm_model=llm_model,
                regex_pattern=r"```json\s*(\{.*?\})\s*```",
                prompt_builder_func=lambda **_: prompt,
                parent_function_name=f"{parent_function_name} chunk",
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                store_response=store_response,
                retries=1,
                **kwargs
            )
            if isinstance(out, dict):
                return out
            prompt += "\n\nPlease output valid JSON as shown above."
        return {"summary": "unavailable"}


    parts: List[Dict[str, Any]] = []
    remaining = texts
    while remaining:
        chunk, remaining = build_chunk(remaining, max_input_tokens)
        if not chunk:
            break
        parts.append(await summarize_chunk(chunk))

    if len(parts) > 1:
        combined_texts = [p.get("summary", "") for p in parts]
        return await summarize_with_llm(
            workspace_id=workspace_id,
            texts=combined_texts,
            llm_model=llm_model,
            app_id=app_id,
            manager=manager,
            llm_instance=llm_instance,
            llm_queue_manager=llm_queue_manager,
            prompt_builder_func=lambda **p: (
                "Combine these summaries into one concise 1–2 line summary. "
                "Respond *only* with valid JSON object, e.g.:\n"
                "```json\n{\"summary\": \"...\"}\n```"
                + "\n\n" + "\n\n".join(p["texts"])
            ),
            parent_function_name=f"{parent_function_name} recurse",
            store_response=store_response,
            max_input_tokens=max_input_tokens,
            retries=retries
        )
    return parts[0]

def split_into_batches(
    codes: Dict[str, List[str]],
    max_tokens: int,
    llm_instance: Any
) -> List[List[str]]:
    """
    Build batches of codes so each batch fits within max_tokens.
    """
    fixed = (
        "Provide 1-2 line summaries for each code. "
        "Return *only* a single JSON object mapping code->summary, e.g.:\n"
        "```json\n{\"CODE1\": \"...\", \"CODE2\": \"...\"}\n```"
        "\n\n"
    )
    fixed_t = llm_instance.get_num_tokens(fixed)
    batches, cur, cur_t = [], [], fixed_t

    for code, exps in codes.items():
        section = f"\"{code}\": [\n" + ",\n".join(f"  {json.dumps(e)}" for e in exps) + "\n],\n"
        sec_t = llm_instance.get_num_tokens(section)
        if cur_t + sec_t > max_tokens:
            if cur:
                batches.append(cur)
                cur, cur_t = [], fixed_t
            if fixed_t + sec_t > max_tokens:
                batches.append([code])
                continue
        cur.append(code)
        cur_t += sec_t
    if cur:
        batches.append(cur)
    return batches

async def batch_multiple_codes_task(
    batch: List[str],
    codes_map: Dict[str, List[str]],
    workspace_id: str,
    app_id: str,
    manager: Any,
    llm_model: str,
    parent_function_name: str,
    llm_instance: Any,
    llm_queue_manager: Any,
    retries: int = 3,
    store_response: bool = False
) -> Dict[str, str]:

    if not batch:
        return {}

    prompt = (
        "Provide 1-2 line summaries for each code. "
        "Respond *only* with a JSON object mapping each code to its summary, for example:\n"
        "```json\n{\"CODE1\": \"summary1\", \"CODE2\": \"summary2\"}\n```"
        "\n\n"
        "Data:\n{\n"
    )
    for c in batch:
        exps = codes_map[c]
        arr = ", ".join(json.dumps(e, indent=2) for e in exps)
        prompt += f'  "{c}": [{arr}],\n'
    prompt += "}\n"

    missing_codes = set(batch)

    for _ in range(retries):
        out = await process_llm_task(
            workspace_id=workspace_id,
            app_id=app_id,
            manager=manager,
            llm_model=llm_model,
            regex_pattern=r"```json\s*(\{.*?\})\s*```",
            prompt_builder_func=lambda **_: prompt,
            parent_function_name=f"{parent_function_name} batch",
            llm_instance=llm_instance,
            llm_queue_manager=llm_queue_manager,
            store_response=store_response,
            retries=1
        )
        if isinstance(out, dict):
            if not any(c in out for c in batch):
                missing_codes = set(batch) - set(out.keys())
            else:    
                result = {c: out.get(c, "summary unavailable") for c in batch}
                return result
        prompt += "\n\nPlease respond *only* with the JSON object as specified above."
        prompt += "\n\nEnsure responses for missing codes: " + ", ".join(missing_codes)
    return {c: "summary unavailable" for c in batch}

async def _flush_and_summarize(
    grouped: Dict[str, List[str]],
    interim: Dict[str, str],
    workspace_id: str,
    app_id: str,
    manager: Any,
    llm_model: str,
    parent_function_name: str,
    llm_instance: Any,
    llm_queue_manager: Any,
    max_input_tokens: int = 128000,
    retries: int = 3,
    store_response: bool = False,
    concurrency_limit: int = 4
) -> Dict[str, str]:
    todo = {c: exps for c, exps in grouped.items() if c not in interim}
    batches = split_into_batches(todo, max_input_tokens, llm_instance)
    sem = asyncio.Semaphore(concurrency_limit)

    async def guarded(batch):
        async with sem:
            if len(batch) == 1:
                code = batch[0]
                return [(code, await summarize_with_llm(
                    workspace_id=workspace_id,
                    texts=todo[code],
                    llm_model=llm_model,
                    app_id=app_id,
                    manager=manager,
                    llm_instance=llm_instance,
                    llm_queue_manager=llm_queue_manager,
                    prompt_builder_func=lambda **p: f"Summarize code '{code}':\n\n" + "\n\n".join(p['texts']),
                    parent_function_name=f"{parent_function_name} single",
                    store_response=store_response,
                    max_input_tokens=max_input_tokens,
                    retries=retries
                ))]
            result_map = await batch_multiple_codes_task(
                batch, todo,
                workspace_id, app_id,
                manager, llm_model, parent_function_name,
                llm_instance, llm_queue_manager,
                retries, store_response
            )
            return list(result_map.items())

    results = await asyncio.gather(*(guarded(b) for b in batches))
    return {c: s for batch in results for c, s in batch}

async def summarize_codebook_explanations(
    workspace_id: str,
    llm_model: str,
    app_id: str,
    manager: Any,
    parent_function_name: str,
    llm_instance: Any,
    llm_queue_manager: Any,
    codebook_types: List[int] = [CodebookType.INITIAL.value, CodebookType.FINAL.value],
    code_transform: Optional[Callable[[str], str]] = None,
    max_input_tokens: int = 128000,
    retries: int = 3,
    flush_threshold: int = 200,
    page_size: int = 500,
    concurrency_limit: int = 4,
    store_response: bool = False
) -> Dict[str, str]:
    grouped: Dict[str, List[str]] = defaultdict(list)
    interim: Dict[str, str] = {}

    async for page in stream_qect_pages(workspace_id, codebook_types, page_size):
        for row in page:
            raw = row['code']
            code = code_transform(raw) if code_transform else raw
            grouped[code].append(row['explanation'])

        if len(grouped) >= flush_threshold:
            new = await _flush_and_summarize(
                grouped, interim,
                workspace_id, app_id, manager,
                llm_model, parent_function_name, llm_instance,
                llm_queue_manager, max_input_tokens, retries,
                store_response, concurrency_limit
            )
            interim.update(new)
            grouped.clear()

    if grouped:
        new = await _flush_and_summarize(
            grouped, interim,
            workspace_id, app_id, manager,
            llm_model, parent_function_name, llm_instance,
            llm_queue_manager, max_input_tokens, retries,
            store_response, concurrency_limit
        )
        interim.update(new)

    grouped_summaries: Dict[str, List[str]] = defaultdict(list)
    for key, summary in interim.items():
        base = key.rsplit("_", 1)[0]
        grouped_summaries[base].append(summary)

    final: Dict[str, str] = {}
    for base, sums in grouped_summaries.items():
        if len(sums) == 1:
            final[base] = sums[0]
        else:
            final[base] = await summarize_with_llm(
                workspace_id=workspace_id,
                texts=sums,
                llm_model=llm_model,
                app_id=app_id,
                manager=manager,
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                prompt_builder_func=lambda **p: "Combine these summaries into 1-2 lines:\n\n" + "\n\n".join(p["texts"]),
                parent_function_name=f"{parent_function_name} collapse",
                store_response=store_response,
                max_input_tokens=max_input_tokens,
                retries=retries
            )
    return final


def _apply_type_filters(responseTypes: List[str], filters: List[str], params: List[Any]):
    conds = []
    if not responseTypes:
        conds = [
            "(r.codebook_type = 'final')",
            "(r.codebook_type = 'initial')",
            "(r.codebook_type = 'manual')",
            "(r.codebook_type = 'initial_copy')"
        ]
    else:
        if 'unseen' in responseTypes:
            conds.append("(r.codebook_type = 'final')")
        if 'sampled_copy' in responseTypes:
            conds.append("(r.codebook_type = 'initial_copy')")
        if 'sampled' in responseTypes:
            conds.append("r.codebook_type = 'initial'")
        if 'manual' in responseTypes:
            conds.append("r.codebook_type = 'manual'")
    filters.append(f"({' OR '.join(conds)})")

def stream_selected_post_ids(
    workspace_id: str,
    responseTypes: List[str],
    page_size: int = 100
) -> Generator[list[Any], Any, None]:
    params = []
    base_sql = (
        f"SELECT post_id FROM selected_post_ids "
        f"WHERE workspace_id = ? AND type IN ({', '.join('?' for _ in responseTypes)}) "
        f"ORDER BY rowid "
        f"LIMIT ? OFFSET ?"
    )
    params.append(workspace_id)
    for responseType in responseTypes:
        params.append(responseType)
    params.append(page_size)
    offset = 0
    params.append(offset)
    while True:
        params[-1] = offset
        print("Params", params, "Base SQL", base_sql)
        rows = selected_post_ids_repo.execute_raw_query(base_sql, tuple(params), keys=True)
        if not rows:
            break
        yield [row["post_id"] for row in rows]
        offset += len(rows)