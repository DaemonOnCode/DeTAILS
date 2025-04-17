import asyncio
from collections import defaultdict
import json
import os
import re
import time
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Sequence, Tuple, Type, Union
import unicodedata
from uuid import uuid4

from chromadb import HttpClient
from fastapi import UploadFile

from chromadb.config import Settings as ChromaDBSettings
from constants import CHROMA_PORT, CODEBOOK_TYPE_MAP, CONTEXT_FILES_DIR, PATHS, STUDY_DATABASE_PATH
from database.qect_table import QectRepository
from database.state_dump_table import StateDumpsRepository
from decorators import log_execution_time
from models.table_dataclasses import CodebookType, LlmResponse, QectResponse, ResponseCreatorType, StateDump
from routes.websocket_routes import ConnectionManager, manager

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain.chains.retrieval import create_retrieval_chain 
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from starlette.concurrency import run_in_threadpool

from services.llm_service import GlobalQueueManager
from database import LlmResponsesRepository
from database.db_helpers import execute_query
from utils.prompts import TopicClustering

llm_responses_repo = LlmResponsesRepository()
qect_repo = QectRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

def get_temperature_and_random_seed():
    with open(PATHS["settings"], "r") as f:
        settings = json.load(f)
        return settings["ai"]["temperature"], settings["ai"]["randomSeed"]


def initialize_vector_store(dataset_id: str, model: str, embeddings: Any):
    chroma_client = HttpClient(host="localhost", port=CHROMA_PORT)
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
            if retries == 0:
                await manager.send_message(app_id, f"ERROR: Dataset {dataset_id}: LLM failed after multiple attempts.")
                extracted_data = []

    return extracted_data

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    text = ''.join(char for char in text if char != '_' and unicodedata.category(char).startswith(('L', 'N', 'Z', 'P')))
    text = text.strip()
    return text

def filter_codes_by_transcript(workspace_id: str, codes: list[dict], transcript: str, parent_function_name: str = "") -> list[dict]:
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
            }),
        )
    )
    
    return duplicate_filtered_codes


def filter_duplicate_codes(codes: List[Dict[str, Any]], parent_function_name: str, workspace_id: str) -> List[Dict[str, Any]]:
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
            }),
        )
    )
    
    return filtered_codes

def filter_duplicate_codes_in_db(dataset_id: str, codebook_type: str, generation_type: str, workspace_id: str, parent_function_name: str):
    count_before = qect_repo.count({
        "dataset_id": dataset_id,
        "codebook_type": codebook_type,
    })

    delete_query = """
        DELETE FROM qect
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM qect
            WHERE dataset_id = ? AND codebook_type = ?
            GROUP BY LOWER(TRIM(code)), LOWER(TRIM(quote))
        )
        AND dataset_id = ? AND codebook_type = ?
    """
    params = (dataset_id, codebook_type, dataset_id, codebook_type)
    qect_repo.execute_raw_query(delete_query, params)
    
    count_after = qect_repo.count({
        "dataset_id": dataset_id,
        "codebook_type": codebook_type,
    })
    
    duplicates_removed = count_before - count_after

    print(f"Duplicates removed: {duplicates_removed}, Count before: {count_before}, Count after: {count_after}")
    
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "duplicates_removed": duplicates_removed,
                "dataset_id": dataset_id,
                "codebook_type": codebook_type,
                "generation_type": generation_type
            }),
            context=json.dumps({
                "function": "llm_response_after_filtering_duplicates",
                "parent_function_name": parent_function_name,
                "workspace_id": workspace_id,
            }),
        )
    )


def insert_responses_into_db(responses: List[Dict[str, Any]], dataset_id: str, workspace_id: str, model: str, codebook_type: str, parent_function_name: str = ""):
    initial_responses = responses
    responses = list(filter(lambda response: response.get("code") and response.get("quote") and response.get("explanation"), responses))
    qect_repo.insert_batch(
       list(
            map(
                lambda code: QectResponse(
                    id=code["id"],
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
    dataset_id: str,
    codebook_types: List[int],
    page_size: int = 500
) -> AsyncGenerator[List[Dict[str, Any]], None]:
    table = qect_repo.table_name
    types_placeholders = ", ".join("?" for _ in codebook_types)
    base_sql = (
        f"SELECT * FROM {table} "
        f"WHERE dataset_id = ? AND codebook_type IN ({types_placeholders}) "
        f"ORDER BY rowid "
        f"LIMIT ? OFFSET ?"
    )
    offset = 0
    while True:
        params = [dataset_id, *codebook_types, page_size, offset]
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
    dataset_id: str,
    manager: Any,
    llm_instance: Any,
    llm_queue_manager: Any,
    prompt_builder_func: Callable[..., str],
    parent_function_name: str = "",
    store_response: bool = False,
    max_input_tokens: int = 128000,
    retries: int = 3,
    **kwargs
) -> str:
    if not texts:
        return ""
    def generic_prompt_builder(**params) -> str:
        docs = "\n\n".join(params['texts'])
        return (
            "Provide a concise summary (1-2 lines). Return JSON:\n"
            "```json\n{\"summary\": \"...\"}\n```\n\n"
            f"Texts:\n{docs}"
        )
    def build_chunk(texts: List[str], max_tokens: int) -> Tuple[List[str], List[str]]:
        chunk, used = [], 0
        prompt_fn = prompt_builder_func if 'code' in kwargs else generic_prompt_builder
        fixed = prompt_fn(**{**kwargs, 'texts': []})
        fixed_tokens = llm_instance.get_num_tokens(fixed)
        sep, sep_tokens = "\n\n", llm_instance.get_num_tokens("\n\n")
        for txt in texts:
            tkns = llm_instance.get_num_tokens(txt)
            if tkns > max_tokens - fixed_tokens - (sep_tokens if chunk else 0):
                txt = truncate_text(txt, max_tokens - fixed_tokens - (sep_tokens if chunk else 0), llm_instance)
                tkns = llm_instance.get_num_tokens(txt)
            need = tkns + (sep_tokens if chunk else 0)
            if fixed_tokens + used + need > max_tokens:
                break
            chunk.append(txt)
            used += need
        rest = texts[len(chunk):]
        if not chunk and rest:
            one = truncate_text(rest[0], max_tokens - fixed_tokens, llm_instance)
            chunk, rest = [one], rest[1:]
        return chunk, rest

    async def summarize_chunk(chunk: List[str]) -> str:
        prompt = (prompt_builder_func if 'code' in kwargs else generic_prompt_builder)(
            **{**kwargs, 'texts': chunk}
        )
        for _ in range(retries):
            out = await process_llm_task(
                workspace_id=workspace_id,
                app_id=app_id,
                dataset_id=dataset_id,
                manager=manager,
                llm_model=llm_model,
                regex_pattern=r"```json\s*(.*?)\s*```",
                prompt_builder_func=lambda **_: prompt,
                parent_function_name=f"{parent_function_name} chunk",
                llm_instance=llm_instance,
                llm_queue_manager=llm_queue_manager,
                store_response=store_response,
                retries=1,
                **kwargs
            )
            if isinstance(out, dict) and isinstance(out.get("summary"), str):
                return out["summary"]
            if isinstance(out, str):
                 return out
            prompt += "\n\nPlease return valid JSON with key \"summary\"."
        return "Summary unavailable"

    parts: List[str] = []
    remaining = texts
    while remaining:
        chunk, remaining = build_chunk(remaining, max_input_tokens)
        if not chunk:
            break
        parts.append(await summarize_chunk(chunk))

    if len(parts) > 1:
        return await summarize_with_llm(
            workspace_id=workspace_id,
            texts=parts,
            llm_model=llm_model,
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            llm_instance=llm_instance,
            llm_queue_manager=llm_queue_manager,
            prompt_builder_func=generic_prompt_builder,
            parent_function_name=f"{parent_function_name} recurse",
            store_response=store_response,
            max_input_tokens=max_input_tokens,
            retries=retries
        )
    return parts[0] if parts else ""

def split_into_batches(
    codes: Dict[str, List[str]],
    max_tokens: int,
    llm_instance: Any
) -> List[List[str]]:
    fixed = "Provide 1-2 line summaries for each code, return single JSON wrapped in ```json ... ```.\n\n"
    fixed_t = llm_instance.get_num_tokens(fixed)
    sep, sep_t = "---\n", llm_instance.get_num_tokens("---\n")
    batches, cur, cur_t = [], [], fixed_t

    for code, exps in codes.items():
        section = f"Code: {code}\n" + "\n".join(f"- {e}" for e in exps) + "\n" + sep
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
    dataset_id: str,
    manager: Any,
    llm_model: str,
    parent_function_name: str,
    llm_instance: Any,
    llm_queue_manager: Any,
    retries: int = 3,
    store_response: bool = False
) -> List[Tuple[str, str]]:
    if not batch:
        return []
    prompt = "Provide 1-2 line summaries for each code, return single JSON wrapped in ```json ... ```.\n\n"
    for c in batch:
        prompt += f"Code: {c}\n" + "\n".join(f"- {e}" for e in codes_map[c]) + "\n---\n"

    for _ in range(retries):
        out = await process_llm_task(
            workspace_id=workspace_id,
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            llm_model=llm_model,
            regex_pattern=r"```json\s*(.*?)\s*```",
            prompt_builder_func=lambda **_: prompt,
            parent_function_name=f"{parent_function_name} batch",
            llm_instance=llm_instance,
            llm_queue_manager=llm_queue_manager,
            store_response=store_response,
            retries=1
        )

        if isinstance(out, dict):
            missing = [c for c in batch if c not in out or not isinstance(out[c], str)]
            if not missing:
                return [(c, out[c]) for c in batch]
            prompt += f"\n\nInclude missing codes: {missing}."
            prompt += "\n\nEnsure all values are strings."

        elif isinstance(out, list):
            pairs = []
            for item in out:
                if isinstance(item, (list, tuple)) and len(item) == 2 and isinstance(item[0], str) and isinstance(item[1], str):
                    pairs.append((item[0], item[1]))
            if {c for c,_ in pairs} == set(batch):
                return pairs
        elif isinstance(out, str) and len(batch) == 1:
            return [(batch[0], out)]

        prompt += "\n\nReturn valid JSON as specified."

    return [(c, "Summary unavailable") for c in batch]

async def _flush_and_summarize(
    grouped: Dict[str, List[str]],
    interim: Dict[str, str],
    workspace_id: str,
    app_id: str,
    dataset_id: str,
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
                    dataset_id=dataset_id,
                    manager=manager,
                    llm_instance=llm_instance,
                    llm_queue_manager=llm_queue_manager,
                    prompt_builder_func=lambda **p: f"Summarize code '{code}':\n\n" + "\n\n".join(p['texts']),
                    parent_function_name=f"{parent_function_name} single",
                    store_response=store_response,
                    max_input_tokens=max_input_tokens,
                    retries=retries
                ))]
            return await batch_multiple_codes_task(
                batch, todo,
                workspace_id, app_id, dataset_id,
                manager, llm_model, parent_function_name,
                llm_instance, llm_queue_manager,
                retries, store_response
            )

    results = await asyncio.gather(*(guarded(b) for b in batches))
    return {c: s for batch in results for c, s in batch}

async def summarize_codebook_explanations(
    workspace_id: str,
    llm_model: str,
    app_id: str,
    dataset_id: str,
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

    async for page in stream_qect_pages(dataset_id, codebook_types, page_size):
        for row in page:
            raw = row['code']
            code = code_transform(raw) if code_transform else raw
            grouped[code].append(row['explanation'])

        if len(grouped) >= flush_threshold:
            new = await _flush_and_summarize(
                grouped, interim,
                workspace_id, app_id, dataset_id, manager,
                llm_model, parent_function_name, llm_instance,
                llm_queue_manager, max_input_tokens, retries,
                store_response, concurrency_limit
            )
            interim.update(new)
            grouped.clear()

    if grouped:
        new = await _flush_and_summarize(
            grouped, interim,
            workspace_id, app_id, dataset_id, manager,
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
                dataset_id=dataset_id,
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


def get_coded_data(
    codebook_names: list,
    filters: dict,
    dataset_id: str,
    batch_size: int,
    offset: int,
):
    show_coder_type = filters.get("showCoderType", False)
    selected_type_filter = filters.get("selectedTypeFilter", "All")
    filter_param = filters.get("filter")
    
    base_conditions = ["dataset_id = :dataset_id"]
    params = {"dataset_id": dataset_id}

    if codebook_names:
        placeholders = ", ".join([f":codebook_{i}" for i in range(len(codebook_names))])
        base_conditions.append(f"codebook_type IN ({placeholders})")
        for i, name in enumerate(codebook_names):
            params[f"codebook_{i}"] = name

    if not show_coder_type:
        if selected_type_filter == "All":
            base_conditions.append(
                "(codebook_type = :initial OR (codebook_type = :final AND response_type = :llm))"
            )
            params["initial"] = "initial"
            params["final"] = "final"
            params["llm"] = "LLM"
        elif selected_type_filter == "New Data":
            base_conditions.append("codebook_type = :final")
            base_conditions.append("response_type = :llm")
            params["final"] = "final"
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
    
    base_where_clause = " AND ".join(base_conditions)
    
    total_ids_query = f"SELECT COUNT(*) FROM qect WHERE {base_where_clause}"
    total_ids_result = qect_repo.execute_raw_query(total_ids_query, tuple(params.values()), keys=False)
    total_ids = total_ids_result.fetchone()[0]
    
    total_data_query = f"SELECT * FROM qect WHERE {base_where_clause}"
    total_data_rows = qect_repo.execute_raw_query(total_data_query, tuple(params.values()), keys=True)
    total_data = [QectResponse(**row) for row in total_data_rows]

    unique_codes = list(set(resp.code for resp in total_data))

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
    
    if batch_size is not None:
        filtered_data = filtered_data[offset:offset + batch_size]
    else:
        filtered_data = filtered_data[offset:]
    filtered_data_serialized = [resp.to_dict() for resp in filtered_data]
    
    return {
        "filteredData": filtered_data_serialized,
        "filteredPostIds": filtered_post_ids,
        "totalIds": total_ids,
        "uniqueCodes": unique_codes
    }


def build_where_clause_and_params(request, dataset_id):
    conditions = ["p.dataset_id = ?", "r.dataset_id = ?"]
    params = [dataset_id, dataset_id]
    
    # Apply selectedTypeFilter first
    if hasattr(request, 'selectedTypeFilter') and request.selectedTypeFilter:
        print(f"[build_where_clause] selectedTypeFilter: {request.selectedTypeFilter}")
        if request.selectedTypeFilter == 'All':
            if hasattr(request, 'responseTypes') and request.responseTypes:
                mapped_types = [CODEBOOK_TYPE_MAP[t] for t in request.responseTypes if t in CODEBOOK_TYPE_MAP]
                if 'manual' in request.responseTypes:
                    conditions.append("r.codebook_type = 'manual'")
                    print("[build_where_clause] Applying 'All' for manual: r.codebook_type = 'manual'")
                elif mapped_types:
                    placeholders = ','.join(['?' for _ in mapped_types])
                    conditions.append(f"(r.codebook_type IN ({placeholders}) OR (r.codebook_type = 'final' AND r.response_type = 'LLM'))")
                    params.extend(mapped_types)
                    print(f"[build_where_clause] Applying 'All' for non-manual: r.codebook_type IN ({mapped_types}) OR (r.codebook_type = 'final' AND r.response_type = 'LLM')")
            else:
                conditions.append("(r.codebook_type = 'initial' OR (r.codebook_type = 'final' AND r.response_type = 'LLM'))")
                print("[build_where_clause] Applying 'All' default: (r.codebook_type = 'initial' OR (r.codebook_type = 'final' AND r.response_type = 'LLM'))")
        elif request.selectedTypeFilter == 'New Data':
            conditions.append("r.codebook_type = 'final' AND r.response_type = 'LLM'")
            print("[build_where_clause] Applying 'New Data': r.codebook_type = 'final' AND r.response_type = 'LLM'")
        elif request.selectedTypeFilter == 'Codebook':
            conditions.append("r.codebook_type = 'initial'")
            print("[build_where_clause] Applying 'Codebook': r.codebook_type = 'initial'")
        elif request.selectedTypeFilter == 'Human':
            conditions.append("r.codebook_type = 'manual' AND r.response_type = 'Human'")
            print("[build_where_clause] Applying 'Human': r.codebook_type = 'manual' AND r.response_type = 'Human'")
        elif request.selectedTypeFilter == 'LLM':
            conditions.append("r.codebook_type = 'manual' AND r.response_type = 'LLM'")
            print("[build_where_clause] Applying 'LLM': r.codebook_type = 'manual' AND r.response_type = 'LLM'")
    else:
        if hasattr(request, 'responseTypes') and request.responseTypes:
            mapped_types = [CODEBOOK_TYPE_MAP[t] for t in request.responseTypes if t in CODEBOOK_TYPE_MAP]
            if mapped_types:
                placeholders = ','.join(['?' for _ in mapped_types])
                conditions.append(f"r.codebook_type IN ({placeholders})")
                params.extend(mapped_types)
                print(f"[build_where_clause] responseTypes: {request.responseTypes}, mapped_types: {mapped_types}, condition: r.codebook_type IN ({mapped_types})")

    if hasattr(request, 'filter') and request.filter:
        print(f"[build_where_clause] filter: {request.filter}")
        if request.filter == 'coded-data':
            print("[build_where_clause] Filter is 'coded-data', no additional condition")
        else:
            all_post_ids_query = "SELECT DISTINCT r.post_id FROM qect r WHERE r.dataset_id = ?"
            print(f"[build_where_clause] Executing all_post_ids query: {all_post_ids_query}, params: {[dataset_id]}")
            all_post_ids = execute_query(all_post_ids_query, [dataset_id], keys=True)
            all_post_ids_list = [row['post_id'] for row in all_post_ids]
            print(f"[build_where_clause] all_post_ids result: {all_post_ids_list}")
            if request.filter in all_post_ids_list:
                conditions.append("p.post_id = ?")
                params.append(request.filter)
                print(f"[build_where_clause] Filter by postId: p.post_id = {request.filter}")
            else:
                conditions.append("r.code = ?")
                params.append(request.filter)
                print(f"[build_where_clause] Filter by code: r.code = {request.filter}")
    
    where_clause = " AND ".join(conditions)
    print(f"[build_where_clause] Final where_clause: {where_clause}, params: {params}")
    return where_clause, params
