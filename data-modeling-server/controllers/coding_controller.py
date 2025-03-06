import asyncio
import json
import os
import re
import time
from typing import Any, List, Optional
from uuid import uuid4

from chromadb import HttpClient
from fastapi import UploadFile
from langchain_google_vertexai import ChatVertexAI, VertexAIEmbeddings
from google.auth import load_credentials_from_file

import config
from decorators import log_execution_time
from models.table_dataclasses import LlmResponse
from routes.websocket_routes import ConnectionManager, manager

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain.chains.retrieval import create_retrieval_chain 
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import StreamingStdOutCallbackHandler
from langchain_ollama import OllamaLLM

from utils.coding_helpers import generate_transcript
from database import LlmResponsesRepository
from database.db_helpers import get_post_and_comments_from_id

llm_responses_repo = LlmResponsesRepository()


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
    )
    return vector_store

@log_execution_time()
async def save_context_files(app_id: str, dataset_id: str, contextFiles: List[UploadFile], vector_store: Chroma):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    await manager.send_message(app_id, f"Dataset {dataset_id}: Uploading files...")
    await asyncio.sleep(5)

    for file in contextFiles:
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                file_content = await file.read()
                file_name = file.filename

                temp_file_path = f"./context_files/{dataset_id}_{time.time()}_{file_name}"
                os.makedirs("./context_files", exist_ok=True)
                with open(temp_file_path, "wb") as temp_file:
                    temp_file.write(file_content)

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
                docs = loader.load()
                chunks = text_splitter.split_documents(docs)

                # Add documents to vector store
                vector_store.add_documents(chunks)

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



def get_llm_and_embeddings(
    model: str,
    settings: config.Settings = None,
    num_ctx: int = 30000,
    num_predict: int = 30000,
    temperature: float = 0.6
):
    try:
        if model.startswith("gemini") or model.startswith("google"):
            model_name = model
            if model.startswith("google"):
                model_name = "-".join(model.split("-")[1:])
            # print(settings.google_application_credentials)
            creds, project_id = load_credentials_from_file(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
            print(creds.quota_project_id, project_id)
            embeddings = VertexAIEmbeddings(
                model="text-embedding-005",
                credentials=creds,
                project=creds.quota_project_id
            )
            llm = ChatVertexAI(
                model_name=model_name, 
                num_ctx=num_ctx,
                num_predict=num_predict,
                temperature=temperature,
                callbacks=[StreamingStdOutCallbackHandler()],
                credentials = creds,
                project = creds.quota_project_id
            )
        
        elif model.startswith("ollama"):
            model_name = "-".join(model.split("-")[1:])
            llm = OllamaLLM(
                model=model_name,
                num_ctx=num_ctx,
                num_predict=num_predict,
                temperature=temperature,
                callbacks=[StreamingStdOutCallbackHandler()]
            )
            embeddings = OllamaEmbeddings(model=model)
        else:
            raise ValueError(f"Unsupported model type: {model}")

        return llm, embeddings

    except Exception as e:
        raise RuntimeError(f"Failed to initialize LLM and embeddings: {str(e)}")

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
    **prompt_params
):
    max_retries = retries
    success = False
    extracted_data = None
    function_id = function_id or str(uuid4())  

    await manager.send_message(app_id, f"Dataset {dataset_id}: LLM process started...")

    while retries > 0 and not success:
        try:

            response = None

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

                response = await asyncio.to_thread(rag_chain.invoke,{"input": input_text})  
            else:
                if not prompt_builder_func:
                    raise ValueError("Standard LLM invocation requires a 'prompt_builder_func'.")

                await manager.send_message(app_id, f"Dataset {dataset_id}: Running direct LLM task...")

                prompt_text = prompt_builder_func(**prompt_params)


                print("Prompt Text", prompt_text)
                if stream_output:
                    async for chunk in llm_instance.stream(prompt_text):
                        await manager.send_message(app_id, f"Dataset {dataset_id}: {chunk}")
                else:
                    response = await asyncio.to_thread(llm_instance.invoke, prompt_text)

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
                # execute_query(
                #     f"INSERT INTO llm_responses (dataset_id, model, response, id, additional_info, function_id) VALUES (?, ?, ?, ?, ?, ?)",
                #     (dataset_id, llm_model, response.lower(), str(uuid4()), "LLM Response", function_id)
                # )
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
                raise e

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
