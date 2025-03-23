import asyncio
from datetime import datetime
import json
import os
import re
import shutil
import time
from typing import Any, Dict, List, Optional, Sequence, Type, Union
from uuid import UUID, uuid4

from chromadb import HttpClient
from fastapi import UploadFile
from langchain_core.outputs import ChatGenerationChunk, GenerationChunk, LLMResult
from langchain_google_vertexai import ChatVertexAI, VertexAIEmbeddings
from vertexai.generative_models import GenerativeModel
from google.auth import load_credentials_from_file
from langchain_google_vertexai.callbacks import VertexAICallbackHandler
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import AgentAction, AgentFinish, Document, LLMResult

import config
from chromadb.config import Settings as ChromaDBSettings
from constants import CONTEXT_FILES_DIR, PATHS, RANDOM_SEED
from controllers.miscellaneous_controller import get_credential_path
from database.qect_table import QECTRepository
from decorators import log_execution_time
from errors.credential_errors import MissingCredentialError
from errors.vertex_ai_errors import InvalidGenAIModelError, InvalidTextEmbeddingError
from models.table_dataclasses import GenerationType, LlmResponse, QECTResponse, ResponseCreatorType
from routes.websocket_routes import ConnectionManager, manager

from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import ChatOllama, OllamaEmbeddings
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

llm_responses_repo = LlmResponsesRepository()
qect_repo = QECTRepository()


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


class Color():
  PURPLE = "\033[95m"
  CYAN = "\033[96m"
  DARKCYAN = "\033[36m"
  BLUE = "\033[94m"
  GREEN = "\033[92m"
  YELLOW = "\033[93m"
  RED = "\033[91m"
  BOLD = "\033[1m"
  UNDERLINE = "\033[4m"
  ITALICS = "\x1B[3m"
  END = "\033[0m\x1B[0m"


class OutputFormatter:
  def heading(text: str) -> None:
    print(f"{Color.BOLD}{text}{Color.END}")

  def key_info(text: str) -> None:
    print(f"{Color.BOLD}{Color.DARKCYAN}{text}{Color.END}")

  def key_info_labeled(label: str,
                       contents: str,
                       contents_newlined: Optional[bool] = False
                       ) -> None:
    print(f"{Color.BOLD}{Color.DARKCYAN}{label}: {Color.END}{Color.DARKCYAN}",
          end="")
    if contents_newlined:
      contents = contents.splitlines()
    print(f"{contents}")
    print(f"{Color.END}", end="")

  def debug_info(text: str) -> None:
    print(f"{Color.BLUE}{text}{Color.END}")

  def debug_info_labeled(label: str,
                         contents: str,
                         contents_newlined: Optional[bool] = False
                         ) -> None:
    print(f"{Color.BOLD}{Color.BLUE}{label}: {Color.END}{Color.BLUE}",
          end="")
    if contents_newlined:
      contents = contents.splitlines()
    print(f"{contents}")
    print(f"{Color.END}", end="")

  def llm_call(text: str) -> None:
    print(f"{Color.ITALICS}{text}{Color.END}")

  def llm_output(text: str) -> None:
    print(f"{Color.UNDERLINE}{text}{Color.END}")

  def tool_call(text: str) -> None:
    print(f"{Color.ITALICS}{Color.PURPLE}{text}{Color.END}")

  def tool_output(text: str) -> None:
    print(f"{Color.UNDERLINE}{Color.PURPLE}{text}{Color.END}")

  def debug_error(text: str) -> None:
    print(f"{Color.BOLD}{Color.RED}{text}{Color.END}")

class AllChainDetails(BaseCallbackHandler):
    def __init__(self,
                 debug_mode: Optional[bool] = False,
                 out: Type[OutputFormatter] = OutputFormatter,
                 log_file: str = 'chain_log.jsonl',
                 log_to_file: bool = True) -> None:
        """Initialize the callback handler with logging options."""
        self.debug_mode = debug_mode
        self.out = out
        self.log_file = log_file
        self.log_to_file = log_to_file

    def _log_event(self, event_type: str, details: Dict[str, Any], run_id: Optional[UUID] = None, parent_run_id: Optional[UUID] = None) -> None:
        """Log an event to the file in JSON Lines format if logging is enabled."""
        if not self.log_to_file:
            return
        event = {
            "run_id": str(run_id) if run_id else "Unknown",
            "parent_run_id": str(parent_run_id) if parent_run_id else None,
            "event_type": event_type,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(event) + '\n')

    def on_text(self, text: str, color: Optional[str] = None, end: str = "", **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"text": text, "color": color, "end": end}
        self._log_event("on_text", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Preparing text.")
        print(text)

    def on_llm_new_token(self, token: Any, *, chunk: Any = None, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> Any:
        details = {"token": str(token), "chunk": str(chunk) if chunk else None}
        self._log_event("on_llm_new_token", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> New token.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        self.out.key_info_labeled("Token", f"{token}")

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"prompts": prompts}
        self._log_event("on_llm_start", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Sending text to the LLM.", run_id, prompts[0])

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        generated_text = response.generations[0][0].text if response.generations else "No generations"
        details = {"generated_text": generated_text}
        self._log_event("on_llm_end", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Received response from LLM.", response)

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        class_name = ".".join(serialized['id']) if 'id' in serialized else "Unknown -- serialized['id'] is missing"
        inputs_filtered = {k: v for k, v in inputs.items() if k not in ["stop", "agent_scratchpad"]}
        details = {"class_name": class_name, "inputs": inputs_filtered}
        self._log_event("on_chain_start", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Starting new chain.")
        if 'id' not in serialized.keys():
            self.out.debug_error("Missing serialized['id']")
        self.out.key_info_labeled("Chain class", f"{class_name}")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        if not inputs_filtered:
            self.out.debug_error("Chain inputs is empty.")
        else:
            self.out.key_info("Iterating through keys/values of chain inputs:")
            for key, value in inputs_filtered.items():
                self.out.key_info_labeled(f"   {key}", f"{value}")

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"outputs": outputs}
        self._log_event("on_chain_end", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Ending chain.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        if not outputs:
            self.out.debug_error("No chain outputs.")
        else:
            for key, value in outputs.items():
                self.out.key_info_labeled(f"Output {key}", f"{value}", contents_newlined=True)

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"error": str(error)}
        self._log_event("on_llm_error", details, run_id, parent_run_id)
        self.out.debug_error(f"LLM Error, {error}")
        for key, value in kwargs.items():
            self.out.debug_error(f"   {key}: {value}")

    def on_chain_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"error": str(error)}
        self._log_event("on_chain_error", details, run_id, parent_run_id)
        self.out.debug_error(f"Chain Error, {error}")

    def on_tool_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"error": str(error)}
        self._log_event("on_tool_error", details, run_id, parent_run_id)
        self.out.debug_error(f"Tool Error, {error}")

    def on_retriever_start(self, serialized: Dict[str, Any], query: str, *, run_id: UUID, parent_run_id: Optional[UUID] = None, tags: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        class_name = ".".join(serialized['id']) if 'id' in serialized else "Unknown -- serialized['id'] is missing"
        details = {"class_name": class_name, "query": query, "tags": tags, "metadata": metadata}
        self._log_event("on_retriever_start", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Querying retriever.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        self.out.key_info_labeled("Tags", f"{tags}")
        if 'id' not in serialized.keys():
            self.out.debug_error("Missing serialized['id']")
        self.out.key_info_labeled("Retriever class", f"{class_name}")
        self.out.key_info("Query sent to retriever:")
        self.out.tool_call(query)

    def on_retriever_end(self, documents: Sequence[Document], *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> Any:
        details = {
            "num_documents": len(documents),
            "documents": [{"metadata": doc.metadata, "page_content": doc.page_content} for doc in documents]
        }
        self._log_event("on_retriever_end", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Retriever finished.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        self.out.key_info(f"Found {len(documents)} documents.")
        if len(documents) == 0:
            self.out.debug_error("No documents found.")
        else:
            for doc_num, doc in enumerate(documents):
                self.out.key_info("---------------------------------------------------")
                self.out.key_info(f"Document number {doc_num} of {len(documents)}")
                self.out.key_info_labeled("Metadata", f"{doc.metadata}")
                self.out.key_info("Document contents:")
                self.out.tool_output(doc.page_content)

def get_llm_and_embeddings(
    model: str,
    num_ctx: int = None,
    num_predict: int = None,
    temperature: float = None,
    random_seed: int = None
):
    settings = config.CustomSettings()
    if not num_ctx:
        num_ctx = 128_000
        if "gemini" in model:
            num_ctx = 1_000_000
    if not num_predict:
        num_predict = 8_000
    if not temperature:
        temperature = settings.ai.temperature if settings.ai.temperature>=0 else 0.6
    if not random_seed:
        random_seed = settings.ai.randomSeed or RANDOM_SEED

    print(f"Model: {model}, Num Context: {num_ctx}, Num Predict: {num_predict}, Temperature: {temperature}, Random  Seed: {random_seed}")

    if temperature < 0.0 or temperature > 1.0:
        raise ValueError("Temperature must be between 0.0 and 1.0")
    if random_seed < 0:
        raise ValueError("Random seed must be a positive integer")
    # try:
    if model.startswith("gemini") or model.startswith("google"):
        model_name = model
        if model.startswith("google"):
            model_name = "-".join(model.split("-")[1:])
        # print(settings.google_application_credentials)
        creds, project_id = load_credentials_from_file(get_credential_path(settings) or os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
        # print(creds.quota_project_id, project_id)
        try:

            embeddings = VertexAIEmbeddings(
                model=settings.ai.textEmbedding,
                credentials=creds,
                project=creds.quota_project_id
            )
        except Exception as e:
            raise InvalidTextEmbeddingError(f"Failed to initialize embeddings: {str(e)}")
        try:
            llm = ChatVertexAI(
                model_name=model_name, 
                num_ctx=num_ctx,
                num_predict=num_predict,
                temperature=temperature,
                seed=random_seed,
                callbacks=[StreamingStdOutCallbackHandler(), AllChainDetails()],
                credentials = creds,
                project = creds.quota_project_id,
                top_p = 0.9
            )
        except Exception as e:
            raise InvalidGenAIModelError(f"Failed to initialize LLM: {str(e)}")
        # except Exception as e:
        #     raise RuntimeError(f"Failed to initialize LLM and embeddings: {str(e)}")
    
    elif model.startswith("ollama"):
        model_name = "-".join(model.split("-")[1:])
        llm = ChatOllama(
            model=model_name,
            num_ctx=num_ctx,
            num_predict=num_predict,
            temperature=temperature,
            seed=random_seed,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        embeddings = OllamaEmbeddings(model=model_name)
    else:
        raise ValueError(f"Unsupported model type: {model}")

    return llm, embeddings

    # except Exception as e:
    #     print(f"Failed to initialize LLM and embeddings: {str(e)}")
    #     raise RuntimeError(f"Failed to initialize LLM and embeddings: {str(e)}")

@log_execution_time()
async def process_llm_task(
    app_id: str,
    dataset_id: str,
    manager: ConnectionManager,
    llm_model: str,
    regex_pattern: str,
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

            print("Response", response)
            response = response["answer"] if retriever else response.content
            match = re.search(regex_pattern, response, re.DOTALL)
            if not match:
                raise Exception("No valid structured data found in LLM response.")

            json_str = match.group(1).strip()
            extracted_data = json.loads(json_str)

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


def filter_codes_by_transcript(codes: list[dict], transcript: str) -> list[dict]:
    # return codes
    filtered_codes = []
    # For case-insensitive matching, lower both the transcript and the quote.
    transcript_lower = transcript.lower()
    for code in codes:
        quote = code.get("quote", "").strip()
        # Check if quote is not empty and exists in transcript.
        # For case-insensitive check, compare lower-case versions.
        if quote and quote.lower() in transcript_lower:
            filtered_codes.append(code)
        else:
            print(f"Filtered out code entry, quote not found in transcript: {quote}")
    return filtered_codes



def insert_responses_into_db(responses: List[Dict[str, Any]], dataset_id: str, workspace_id: str, model: str, codebook_type: str):
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
    responses = list(filter(lambda response: response.get("code") and response.get("quote") and response.get("explanation"), responses))
    qect_repo.insert_batch(
       list(
            map(
                lambda code: QECTResponse(
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
    words: List[str],
    llm_model: str,
    app_id: str,
    dataset_id: str,
    manager: Any, 
    llm_instance: Any,  
    llm_queue_manager: Any,  
    store_response: bool = False,
    chunk_size: int = 100,
    retries: int = 3,
    **kwargs
) -> Dict[str, List[str]]:
    chunks = divide_into_fixed_chunks(words, chunk_size)
    if not chunks:
        return {}

    regex_pattern = r"```(?:json)?\s*(.*?)\s*```"

    def beginning_prompt_builder(**params):
        words_json = json.dumps(chunks[0])
        return (
            "Cluster the following distinct words into an appropriate number of topics. "
            "Each word should be assigned to exactly one topic, and all words must be included in the output without duplication. "
            "Determine the optimal number of topics based on the words provided. "
            "Choose descriptive names for the topics that reflect the common theme or category of the words in each cluster. "
            "Provide only the JSON output in the following format, wrapped in markdown code blocks (```json ... ```): "
            "{ \"topic1\": [\"word1\", \"word2\", ...], \"topic2\": [\"word3\", \"word4\", ...], ... }. "
            "Do not include any additional text or explanations. "
            "Here are the words to cluster in JSON format: " + words_json
        )

    extracted_data = await process_llm_task(
        app_id=app_id,
        dataset_id=dataset_id,
        manager=manager,
        llm_model=llm_model,
        regex_pattern=regex_pattern,
        prompt_builder_func=beginning_prompt_builder,
        llm_instance=llm_instance,
        llm_queue_manager=llm_queue_manager,
        store_response=store_response,
        retries=retries,
        **kwargs
    )
    if not isinstance(extracted_data, dict):
        raise ValueError("Failed to obtain valid clusters from the first chunk.")
    current_clusters = extracted_data

    print("Beginning Clusters", current_clusters)

    for chunk in chunks[1:]:
        def continuation_prompt_builder(**params):
            existing_topics = list(current_clusters.keys())
            words_json = json.dumps(chunk)
            return (
                f"Given the existing topic names: {json.dumps(existing_topics)}, "
                "assign the following distinct new words to the existing topics if they fit, "
                "or create new topics with descriptive names if necessary. "
                "Each new word should be assigned to exactly one topic, and all new words must be included in the output without duplication. "
                "Provide only the JSON output containing only the new words, in the following format, "
                "wrapped in markdown code blocks (```json ... ```): "
                "{ \"topic1\": [\"new_word1\", \"new_word2\", ...], \"topic2\": [\"new_word3\", ...], ... }. "
                "Do not include any additional text or explanations. "
                "Here are the new words to assign in JSON format: " + words_json
            )

        extracted_data = await process_llm_task(
            app_id=app_id,
            dataset_id=dataset_id,
            manager=manager,
            llm_model=llm_model,
            regex_pattern=regex_pattern,
            prompt_builder_func=continuation_prompt_builder,
            llm_instance=llm_instance,
            llm_queue_manager=llm_queue_manager,
            store_response=store_response,
            retries=retries,
            **kwargs
        )
        if not isinstance(extracted_data, dict):
            raise ValueError("Failed to update clusters for a subsequent chunk.")

        for topic, new_words in extracted_data.items():
            if topic in current_clusters:
                current_clusters[topic].extend(new_words)
            else:
                current_clusters[topic] = new_words

        print("Updated Clusters", current_clusters)

    return current_clusters

