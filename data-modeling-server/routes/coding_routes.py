import asyncio
import time
from typing import Dict, List
from fastapi import APIRouter, HTTPException, UploadFile, Form
from pydantic import BaseModel
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.chains.retrieval_qa.base import RetrievalQA
from langchain.chains.retrieval import create_retrieval_chain 
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import StreamingStdOutCallbackHandler
import os
import re
import json
from chromadb import HttpClient
import utils.prompts as prompts
from utils.prompts import CodePrompts
from utils.db_helpers import get_post_with_comments
from utils.coding_helpers import generate_context, generate_feedback, generate_transcript, generate_context_with_codebook
from routes.websocket_routes import manager

router = APIRouter()

# Request model
class AddDocumentsRequest(BaseModel):
    documents: dict  # {file_path: content}
    model: str
    regenerate: bool = False

@router.post("/add-documents-langchain")
async def add_documents_langchain(
    basisFiles: List[UploadFile],  # List of uploaded files
    model: str = Form(...),  # Model as a form field
    mainCode: str = Form(...),  # Main code as a form field
    additionalInfo: str = Form(""),  # Optional additional info
    retry: bool = Form(False),  # Retry flag
    dataset_id: str = Form(...)  # Dataset ID for identifying notifications
):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {dataset_id}: Processing started.")
        await asyncio.sleep(0)

        # Initialize embeddings and vector store
        print("Model: ", model)
        embeddings = OllamaEmbeddings(model=model)
        chroma_client = HttpClient(host="localhost", port=8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        # Notify clients that file upload is starting
        await manager.broadcast(f"Dataset {dataset_id}: Uploading files...")
        await asyncio.sleep(0)

        # Process uploaded files with retry logic
        for file in basisFiles:
            retries = 3
            success = False
            while retries > 0 and not success:
                try:
                    print(f"Processing file: {file.filename}")
                    file_content = await file.read()
                    file_name = file.filename

                    temp_file_path = f"./temp_files/{time.time()}_{file_name}"
                    os.makedirs("./temp_files", exist_ok=True)
                    with open(temp_file_path, "wb") as temp_file:
                        temp_file.write(file_content)

                    # Load and process the document
                    loader = PyPDFLoader(temp_file_path)
                    docs = loader.load()
                    chunks = text_splitter.split_documents(docs)
                    vector_store.add_documents(chunks)
                    os.remove(temp_file_path)
                    success = True
                    await manager.broadcast(f"Dataset {dataset_id}: Successfully processed file {file_name}.")
                except Exception as e:
                    retries -= 1
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)")
                    if retries == 0:
                        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts.")
                        raise e

        # Notify clients that upload is complete
        await manager.broadcast(f"Dataset {dataset_id}: Files uploaded successfully.")
        await asyncio.sleep(0)

        # Notify clients that retriever creation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
        await asyncio.sleep(0)

        retriever = vector_store.as_retriever()

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateFlashcards)),
            ("human", "{input}")
        ])

        # Notify clients that flashcard generation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Generating flashcards...")
        await asyncio.sleep(0)

        # Generate flashcards with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                llm = OllamaLLM(
                    model=model,
                    num_ctx=8192,
                    num_predict=8192,
                    temperature=0.3,
                    callbacks=[StreamingStdOutCallbackHandler()]
                )
                question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=prompt_template)
                rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

                input_text = prompts.flashcardTemplate(mainCode, additionalInfo)
                results = rag_chain.invoke({"input": input_text})

                # Notify clients that flashcards are being parsed
                await manager.broadcast(f"Dataset {dataset_id}: Parsing generated flashcards...")
                await asyncio.sleep(0)

                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"flashcards\"\s*:\s*\[(?P<flashcards>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\s*\])(?:\n```)?"

                flashcards_match = re.search(regex, results["answer"], re.DOTALL)
                if not flashcards_match:
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: No flashcards found.")
                    return {"flashcards": []}

                if flashcards_match.group("flashcards"):
                    flashcards = flashcards_match.group("flashcards")
                    parsed_flashcards = json.loads(f'{flashcards}')['flashcards']
                else:
                    flashcards = flashcards_match.group("standalone")
                    parsed_flashcards = json.loads(f'{{"flashcards": [{flashcards}]}}')["flashcards"]

                success = True
                await manager.broadcast(f"Dataset {dataset_id}: Flashcards generated successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error generating flashcards - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to generate flashcards after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")
        await asyncio.sleep(0)

        return {
            "message": "Documents processed and flashcards generated successfully.",
            "flashcards": parsed_flashcards,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error processing documents: {str(e)}")




@router.post("/add-documents-and-get-themes")
async def add_documents_and_get_themes(
    basisFiles: List[UploadFile],  # List of uploaded files
    model: str = Form(...),  # Model as a form field
    mainCode: str = Form(...),  # Main code as a form field
    additionalInfo: str = Form(""),  # Optional additional info
    retry: bool = Form(False),  # Retry flag
    dataset_id: str = Form(...)  # Dataset ID for identifying notifications
):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {dataset_id}: Processing started.")
        await asyncio.sleep(0)

        # Initialize embeddings and vector store
        print("Model: ", model)
        embeddings = OllamaEmbeddings(model=model)
        chroma_client = HttpClient(host="localhost", port=8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        # Notify clients that file upload is starting
        await manager.broadcast(f"Dataset {dataset_id}: Uploading files...")
        await asyncio.sleep(0)

        # Process uploaded files with retry logic
        for file in basisFiles:
            retries = 3
            success = False
            while retries > 0 and not success:
                try:
                    print(f"Processing file: {file.filename}")
                    file_content = await file.read()
                    file_name = file.filename

                    temp_file_path = f"./temp_files/{time.time()}_{file_name}"
                    os.makedirs("./temp_files", exist_ok=True)
                    with open(temp_file_path, "wb") as temp_file:
                        temp_file.write(file_content)

                    # Load and process the document
                    loader = PyPDFLoader(temp_file_path)
                    docs = loader.load()
                    chunks = text_splitter.split_documents(docs)
                    vector_store.add_documents(chunks)
                    os.remove(temp_file_path)
                    success = True
                    await manager.broadcast(f"Dataset {dataset_id}: Successfully processed file {file_name}.")
                except Exception as e:
                    retries -= 1
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)")
                    if retries == 0:
                        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts.")
                        raise e

        # Notify clients that upload is complete
        await manager.broadcast(f"Dataset {dataset_id}: Files uploaded successfully.")
        await asyncio.sleep(0)

        # Notify clients that retriever creation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
        await asyncio.sleep(0)

        retriever = vector_store.as_retriever()

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateThemes)),
            ("human", "{input}")
        ])

        # Notify clients that theme generation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Generating Themes...")
        await asyncio.sleep(0)

        # Generate themes with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                llm = OllamaLLM(
                    model=model,
                    num_ctx=8192,
                    num_predict=8192,
                    temperature=0.3,
                    callbacks=[StreamingStdOutCallbackHandler()]
                )
                question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=prompt_template)
                rag_chain = create_retrieval_chain(retriever=retriever, combine_docs_chain=question_answer_chain)

                input_text = prompts.themesTemplate(mainCode, additionalInfo)
                results = rag_chain.invoke({"input": input_text})

                # Notify clients that themes are being parsed
                await manager.broadcast(f"Dataset {dataset_id}: Parsing generated themes...")
                await asyncio.sleep(0)

                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"themes\"\s*:\s*\[(?P<themes>(?:\s*\".*?\"\s*,?)*?)\s*\}|\[\s*(?P<standalone>(?:\s*\".*?\"\s*,?)*?)\s*\])(?:\n```)?"

                themes_match = re.search(regex, results["answer"], re.DOTALL)
                if not themes_match:
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: No themes found.")
                    return {"themes": []}

                if themes_match.group("themes"):
                    themes = themes_match.group("themes")
                    parsed_themes = json.loads(f'{themes}')['themes']
                else:
                    themes = themes_match.group("standalone")
                    parsed_themes = json.loads(f'{{"themes": [{themes}]}}')["themes"]

                success = True
                await manager.broadcast(f"Dataset {dataset_id}: Themes generated successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error generating themes - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to generate themes after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")
        await asyncio.sleep(0)

        return {
            "message": "Documents processed and themes generated successfully.",
            "themes": parsed_themes,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error processing documents: {str(e)}")



# @router.post("/add-documents-langchain")
# async def add_documents_langchain(
#     basisFiles: List[UploadFile],  # List of uploaded files
#     model: str = Form(...),  # Model as a form field
#     mainCode: str = Form(...),  # Main code as a form field
#     additionalInfo: str = Form(""),  # Optional additional info
#     retry: bool = Form(False)  # Retry flag
# ):
#     try:
#         # Initialize embeddings and vector store
#         print("Model: ", model)
#         embeddings = OllamaEmbeddings(model=model)
#         chroma_client = HttpClient(host = "localhost",
#                port= 8000)
#         vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
#         text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

#         # Process uploaded files
#         for file in basisFiles:
#             print(f"Processing file: {file.filename}")
#             # Read the file content
#             file_content = await file.read()
#             file_name = file.filename

#             # Save the file locally (optional)
#             temp_file_path = f"./temp_files/{time.time()}_{file_name}"
#             os.makedirs("./temp_files", exist_ok=True)
#             with open(temp_file_path, "wb") as temp_file:
#                 temp_file.write(file_content)

#             # Load the document using PyPDFLoader (or adjust for other file types)
#             loader = PyPDFLoader(temp_file_path)
#             docs = loader.load()

#             # Split documents into chunks and add them to the vector store
#             chunks = text_splitter.split_documents(docs)
#             vector_store.add_documents(chunks)

#             # Remove the temporary file after processing (optional)
#             os.remove(temp_file_path)

#         print("Documents added successfully to Chroma vector store.")
#         # return {
#         #     "message": "Documents added successfully to Chroma vector store.",
#         #     "model": model,
#         #     "mainCode": mainCode,
#         #     "additionalInfo": additionalInfo,
#         #     "retry": retry
#         # }

#         retriever = vector_store.as_retriever()

#         print("Retriever created")

#         prompt_template = ChatPromptTemplate.from_messages([
#             ("system", "\n".join(prompts.systemTemplateFlashcards)),
#             ("human", "{input}")
#         ])

#         print("Prompt template created")

#         llm = OllamaLLM(
#                 model=model,
#                 num_ctx=8192,
#                 num_predict=8192,
#                 temperature=0.3,
#                 callbacks=[
#                     StreamingStdOutCallbackHandler()
#                 ]
#             )
#         print("Prompt template created")
#         # Create the question-answer chain
#         question_answer_chain = create_stuff_documents_chain(
#             llm=llm,
#             prompt=prompt_template,
#         )

#         print("Question-answer chain created")

#         # Create the RAG chain
#         rag_chain = create_retrieval_chain(
#             retriever=retriever, combine_docs_chain=question_answer_chain
#         )

#         print("RAG chain created")
#         # Generate flashcards
#         input_text = prompts.flashcardTemplate(mainCode, additionalInfo)

#         print("Generating flashcards...")
#         results = rag_chain.invoke({"input": input_text})

#         print("Flashcards generated")

#         print("Results: ", results)

#         # Parse the results to extract flashcards
#         regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"flashcards\"\s*:\s*\[(?P<flashcards>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\s*\])(?:\n```)?"

#         flashcards_match = re.search(regex, results["answer"], re.DOTALL)
#         if not flashcards_match:
#             return {"flashcards": []}

#         if flashcards_match.group("flashcards"):
#             flashcards = flashcards_match.group("flashcards")
#             parsed_flashcards = json.loads(f'{flashcards}')['flashcards']
#         else:
#             flashcards = flashcards_match.group("standalone")
#             parsed_flashcards = json.loads(f'{{"flashcards": [{flashcards}]}}')["flashcards"]
#         return {
#             "message": "Documents processed and flashcards generated successfully.",
#             "flashcards": parsed_flashcards,
#         }

#     except Exception as e:
#         print(e)
#         raise HTTPException(status_code=500, detail=f"Error processing documents: {str(e)}")

from langchain_ollama import OllamaLLM

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def qa_chain_creator(vectorstore: Chroma, prompt, llm):
    qa_chain = (
        {
            "context": vectorstore.as_retriever() | format_docs,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return qa_chain




class GenerateFlashcardsRequest(BaseModel):
    model: str
    mainCode: str
    additionalInfo: str = ""
    flashcards: List[dict[str, str]]
    feedback: str = ""
    dataset_id: str

@router.post("/generate-additional-flashcards")
async def generate_additional_flashcards(request: GenerateFlashcardsRequest):
    try:
        # Notify clients that flashcard generation has started
        await manager.broadcast(f"Dataset {request.dataset_id}: Additional flashcard generation started.")
        await asyncio.sleep(0)

        # Initialize retriever with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
                retriever = vector_store.as_retriever()
                success = True
                await manager.broadcast(f"Dataset {request.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create prompt template and LLM chain
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateFlashcards)),
            ("human", "{input}")
        ])
        await manager.broadcast(f"Dataset {request.dataset_id}: Prompt template created.")

        llm = OllamaLLM(
            model=request.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )

        # Create the question-answer chain
        question_answer_chain = create_stuff_documents_chain(
            llm=llm,
            prompt=prompt_template,
        )
        await manager.broadcast(f"Dataset {request.dataset_id}: Question-answer chain created.")

        # Create the RAG chain
        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )
        await manager.broadcast(f"Dataset {request.dataset_id}: RAG chain created.")

        # Generate flashcards with retry logic
        retries = 3
        success = False
        parsed_flashcards = []
        while retries > 0 and not success:
            try:
                input_text = prompts.flashcardRegenerationTemplate(
                    request.mainCode, request.additionalInfo, request.feedback, request.flashcards
                )
                await manager.broadcast(f"Dataset {request.dataset_id}: Generating additional flashcards...")
                results = rag_chain.invoke({"input": input_text})

                print("Flashcards generated")
                await manager.broadcast(f"Dataset {request.dataset_id}: Flashcards generated successfully.")

                # Parse the results to extract flashcards
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"flashcards\"\s*:\s*\[(?P<flashcards>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\s*\])(?:\n```)?"

                flashcards_match = re.search(regex, results["answer"], re.DOTALL)
                if not flashcards_match:
                    await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: No additional flashcards found.")
                    return {"flashcards": []}

                if flashcards_match.group("flashcards"):
                    flashcards = flashcards_match.group("flashcards")
                    parsed_flashcards = json.loads(f'{flashcards}')['flashcards']
                else:
                    flashcards = flashcards_match.group("standalone")
                    parsed_flashcards = json.loads(f'{{"flashcards": [{flashcards}]}}')["flashcards"]

                success = True
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: Error generating flashcards - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Failed to generate flashcards after multiple attempts.")
                    raise e

        # Notify clients that the process is complete
        await manager.broadcast(f"Dataset {request.dataset_id}: Additional flashcard generation process complete.")
        await asyncio.sleep(0)

        return {
            "message": "Additional flashcards generated successfully.",
            "flashcards": parsed_flashcards,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class GenerateThemesRequest(BaseModel):
    model: str
    mainCode: str
    additionalInfo: str = ""
    selectedThemes: List[str] = []
    feedback: str = ""
    dataset_id: str

@router.post("/generate-themes")
async def generate_themes(request: GenerateThemesRequest):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {request.dataset_id}: Theme generation started.")
        await asyncio.sleep(0)

        # Initialize retriever with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
                retriever = vector_store.as_retriever()
                success = True
                await manager.broadcast(f"Dataset {request.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateThemes)),
            ("human", "{input}")
        ])

        question_answer_chain = create_stuff_documents_chain(
            llm=llm,
            prompt=prompt_template,
        )

        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )

        print("RAG chain created")
        await manager.broadcast(f"Dataset {request.dataset_id}: RAG chain created successfully.")
        await asyncio.sleep(0)

        # Generate themes with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                input_text = prompts.themesRegenerationTemplate(
                    request.mainCode, request.additionalInfo, request.selectedThemes, request.feedback
                )
                
                print("Regenerating themes...")
                await manager.broadcast(f"Dataset {request.dataset_id}: Regenerating themes...")
                results = rag_chain.invoke({"input": input_text})

                print("Themes regenerated")
                await manager.broadcast(f"Dataset {request.dataset_id}: Themes regenerated successfully.")

                # Parse the results to extract themes
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"themes\"\s*:\s*\[(?P<themes>(?:\s*\".*?\"\s*,?)*?)\s*\}|\[\s*(?P<standalone>(?:\s*\".*?\"\s*,?)*?)\s*\])(?:\n```)?"
                themes_match = re.search(regex, results["answer"], re.DOTALL)

                if not themes_match:
                    await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: No themes found.")
                    return {"themes": []}

                if themes_match.group("themes"):
                    themes = themes_match.group("themes")
                    parsed_themes = json.loads(f'{themes}')['themes']
                else:
                    themes = themes_match.group("standalone")
                    parsed_themes = json.loads(f'{{"themes": [{themes}]}}')["themes"]

                success = True
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: Error regenerating themes - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Failed to regenerate themes after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request.dataset_id}: Theme generation complete.")
        await asyncio.sleep(0)

        return {
            "message": "Themes generated successfully.",
            "themes": parsed_themes,
        }
    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")



class GenerateCodeBookRequest(BaseModel):
    model: str
    mainCode: str
    additionalInfo: str = ""
    selectedThemes: List[str] = []
    regenerate: bool = False
    dataset_id: str

@router.post("/generate-codebook")
async def generate_codebook(request: GenerateCodeBookRequest):
    try:
        # Notify clients that the codebook generation process has started
        await manager.broadcast(f"Dataset {request.dataset_id}: Codebook generation started.")
        await asyncio.sleep(0)

        # Initialize retriever with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
                retriever = vector_store.as_retriever()
                success = True
                await manager.broadcast(f"Dataset {request.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateCodebook)),
            ("human", "{input}")
        ])

        question_answer_chain = create_stuff_documents_chain(
            llm=llm,
            prompt=prompt_template,
        )

        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )

        print("RAG chain created")
        await manager.broadcast(f"Dataset {request.dataset_id}: RAG chain created successfully.")
        await asyncio.sleep(0)

        # Generate codebook with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                input_text = prompts.codebookTemplate(request.mainCode, request.additionalInfo, request.selectedThemes)

                print("Generating codebook...")
                await manager.broadcast(f"Dataset {request.dataset_id}: Generating codebook...")
                results = rag_chain.invoke({"input": input_text})

                print("Codebook generated")
                await manager.broadcast(f"Dataset {request.dataset_id}: Codebook generated successfully.")

                # Parse the results to extract the codebook
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"codebook\"\s*:\s*\[(?P<codebook>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\s*\])(?:\n```)?"

                codebook_match = re.search(regex, results["answer"], re.DOTALL | re.VERBOSE)

                if not codebook_match:
                    await manager.broadcast(f"Dataset {request.dataset_id}: No valid codebook found.")
                    return {"codebook": []}

                if codebook_match.group("codebook"):
                    codebook = codebook_match.group("codebook")
                    parsed_codebook = json.loads(f'{codebook}')['codebook']
                else:
                    codebook = codebook_match.group("standalone")
                    parsed_codebook = json.loads(f'{{"codebook": [{codebook}]}}')["codebook"]

                success = True
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request.dataset_id}: Error generating codebook - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Failed to generate codebook after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request.dataset_id}: Codebook generation process complete.")
        await asyncio.sleep(0)

        return {
            "message": "Codebook generated successfully.",
            "codebook": parsed_codebook,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request.dataset_id}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")



class GenerateWordsRequest(BaseModel):
    model: str
    mainCode: str
    flashcards: List[dict[str, str]] | None = None
    regenerate: bool = False
    selectedWords: List[str] = []
    feedback: str = ""
    datasetId: str = ""

@router.post("/generate-words")
async def generate_words(request: GenerateWordsRequest):
    try:
        # Notify clients that the word generation process has started
        await manager.broadcast(f"Dataset {request.datasetId}: Word generation process started.")
        await asyncio.sleep(0)

        # Initialize retriever with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
                retriever = vector_store.as_retriever()
                success = True
                await manager.broadcast(f"Dataset {request.datasetId}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"Dataset {request.datasetId}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"Dataset {request.datasetId}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", prompts.systemTemplateWordCloud(request.mainCode)),
            ("human", "{input}")
        ])

        question_answer_chain = create_stuff_documents_chain(
            llm=llm,
            prompt=prompt_template,
        )

        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )

        print("RAG chain created")
        await manager.broadcast(f"Dataset {request.datasetId}: RAG chain created successfully.")
        await asyncio.sleep(0)

        # Generate words with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                input_text = prompts.wordCloudTemplate(request.mainCode, request.flashcards) if not request.regenerate else prompts.wordCloudRegenerationTemplate(request.mainCode, request.selectedWords, request.feedback)
                
                print("Generating words...")
                await manager.broadcast(f"Dataset {request.datasetId}: Generating words...")
                results = rag_chain.invoke({"input": input_text})

                print("Words generated")
                await manager.broadcast(f"Dataset {request.datasetId}: Words generated successfully.")

                # Parse the results to extract words
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"words\"\s*:\s*\[(?P<words>(?:\s*\".*?\"\s*,?)*?)\s*\}|\[\s*(?P<standalone>(?:\s*\".*?\"\s*,?)*?)\s*\])(?:\n```)?"
                words_match = re.search(regex, results["answer"], re.DOTALL)

                if not words_match:
                    await manager.broadcast(f"WARNING: Dataset {request.datasetId}: No words found.")
                    return {"words": []}

                if words_match.group("words"):
                    words = words_match.group("words")
                    parsed_words = json.loads(f'{words}')['words']
                else:
                    words = words_match.group("standalone")
                    parsed_words = json.loads(f'{{"words": [{words}]}}')["words"]

                success = True
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"Dataset {request.datasetId}: Error generating words - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"Dataset {request.datasetId}: Failed to generate words after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request.datasetId}: Word generation process complete.")
        await asyncio.sleep(0)

        return {
            "message": "Words generated successfully.",
            "words": parsed_words,
        }

    except Exception as e:
        await manager.broadcast(f"Dataset {request.datasetId}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class GenerateCodesRequest(BaseModel):
    model: str
    references: dict
    mainCode: str
    flashcards: list
    selectedWords: list
    selectedPosts: list
    datasetId: str


@router.post("/generate-codes")
async def generate_codes_with_feedback(request: GenerateCodesRequest):
    try:
        llm1 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]
            await manager.broadcast(f"Processing post {post_id}...")

            # Fetch post and comments
            post_data = get_post_with_comments(request.datasetId, post_id)
            await manager.broadcast(f"Post {post_id}: Generating transcript...")

            transcript = generate_transcript(post_data)
            context = generate_context(
                request.references,
                request.mainCode,
                request.flashcards,
                request.selectedWords,
            )
            # feedback_text = generate_feedback(request.feedback)

            # Retry logic for LLM1
            retries = 0
            max_retries = 3
            result1 = None
            while retries < max_retries:
                try:
                    await manager.broadcast(
                        f"Post {post_id}: Generating code with LLM1 (Attempt {retries + 1})..."
                    )
                    generation_prompt_1 = CodePrompts.generate(transcript, context)
                    result1 = llm1.invoke(generation_prompt_1)
                    await manager.broadcast(f"Post {post_id}: LLM1 completed successfully.")
                    break
                except Exception as e:
                    retries += 1
                    await manager.broadcast(f"WARNING: Post {post_id}: LLM1 failed on attempt {retries}. Retrying...")

            if result1 is None:
                await manager.broadcast(f"WARNING: Post {post_id}: LLM1 failed after {max_retries} retries.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
                posts.pop(0)
                continue

            # Retry logic for LLM2
            retries = 0
            result2 = None
            while retries < max_retries:
                try:
                    await manager.broadcast(
                        f"Post {post_id}: Generating code with LLM2 (Attempt {retries + 1})..."
                    )
                    generation_prompt_2 = CodePrompts.generate(transcript, context)
                    result2 = llm2.invoke(generation_prompt_2)
                    await manager.broadcast(f"Post {post_id}: LLM2 completed successfully.")
                    break
                except Exception as e:
                    retries += 1
                    await manager.broadcast(f"WARNING: Post {post_id}: LLM2 failed on attempt {retries}. Retrying...")

            if result2 is None:
                await manager.broadcast(f"ERROR: Post {post_id}: LLM2 failed after {max_retries} retries.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
                posts.pop(0)
                continue

            # Retry logic for Validation (judge_llm)
            retries = 0
            validation_result = None
            while retries < max_retries:
                try:
                    await manager.broadcast(
                        f"Post {post_id}: Validating results with judge LLM (Attempt {retries + 1})..."
                    )
                    validate_prompt = CodePrompts.judge_validate(
                        result1, result2, transcript, request.mainCode
                    )
                    validation_result = judge_llm.invoke(validate_prompt)
                    await manager.broadcast(f"Post {post_id}: Validation completed successfully.")
                    break
                except Exception as e:
                    retries += 1
                    await manager.broadcast(
                        f"WARNING: Post {post_id}: Validation failed on attempt {retries}. Retrying..."
                    )

            if validation_result is None:
                await manager.broadcast(f"ERROR: Post {post_id}: Validation failed after {max_retries} retries.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
                raise HTTPException(status_code=500, detail=f"Error: Validation failed after {max_retries} retries.")
                continue

            # Parse validation results
            match = re.search(
                r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                validation_result,
            )

            if not match:
                await manager.broadcast(f"WARNING: Post {post_id}: Validation result parsing failed.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
            else:
                try:
                    unified_codebook = json.loads(match.group(1))
                    recoded_transcript = (
                        json.loads(match.group(2)) if match.group(2) else []
                    )
                    final_results.append(
                        {
                            "unified_codebook": unified_codebook,
                            "recoded_transcript": recoded_transcript,
                        }
                    )
                    await manager.broadcast(f"Post {post_id}: Post processing completed successfully.")
                except json.JSONDecodeError as e:
                    await manager.broadcast(f"ERROR: Post {post_id}: Error parsing JSON validation results.")
                    raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

            # Remove processed post from queue
            posts.pop(0)

        await manager.broadcast("All posts processed.")
        return final_results if len(final_results) else []

    except Exception as e:
        print("Inside Exception", e)
        await manager.broadcast("ERROR: Error encountered during processing.")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")



class GenerateCodesWithFeedbackRequest(GenerateCodesRequest):
    feedback : list

@router.post("/generate-codes-with-feedback")
async def generate_codes_with_feedback(request: GenerateCodesWithFeedbackRequest):
    try:
        llm1 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]
            await manager.broadcast(f"Processing post {post_id}...")

            # Fetch post and comments
            post_data = get_post_with_comments(request.datasetId, post_id)
            await manager.broadcast(f"Post {post_id}: Generating transcript...")

            transcript = generate_transcript(post_data)
            context = generate_context(
                request.references,
                request.mainCode,
                request.flashcards,
                request.selectedWords,
            )
            feedback_text = generate_feedback(request.feedback)

            # Retry logic for LLM1
            retries = 0
            max_retries = 3
            result1 = None
            while retries < max_retries:
                try:
                    await manager.broadcast(
                        f"Post {post_id}: Generating code with LLM1 (Attempt {retries + 1})..."
                    )
                    generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                    result1 = llm1.invoke(generation_prompt_1)
                    await manager.broadcast(f"Post {post_id}: LLM1 completed successfully.")
                    break
                except Exception as e:
                    retries += 1
                    await manager.broadcast(f"Post {post_id}: LLM1 failed on attempt {retries}. Retrying...")

            if result1 is None:
                await manager.broadcast(f"Post {post_id}: LLM1 failed after {max_retries} retries.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
                posts.pop(0)
                continue

            # Retry logic for LLM2
            retries = 0
            result2 = None
            while retries < max_retries:
                try:
                    await manager.broadcast(
                        f"Post {post_id}: Generating code with LLM2 (Attempt {retries + 1})..."
                    )
                    generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                    result2 = llm2.invoke(generation_prompt_2)
                    await manager.broadcast(f"Post {post_id}: LLM2 completed successfully.")
                    break
                except Exception as e:
                    retries += 1
                    await manager.broadcast(f"Post {post_id}: LLM2 failed on attempt {retries}. Retrying...")

            if result2 is None:
                await manager.broadcast(f"Post {post_id}: LLM2 failed after {max_retries} retries.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
                posts.pop(0)
                continue

            # Retry logic for Validation (judge_llm)
            retries = 0
            validation_result = None
            while retries < max_retries:
                try:
                    await manager.broadcast(
                        f"Post {post_id}: Validating results with judge LLM (Attempt {retries + 1})..."
                    )
                    validate_prompt = CodePrompts.judge_validate_with_feedback(
                        result1, result2, transcript, request.mainCode, feedback_text
                    )
                    validation_result = judge_llm.invoke(validate_prompt)
                    await manager.broadcast(f"Post {post_id}: Validation completed successfully.")
                    break
                except Exception as e:
                    retries += 1
                    await manager.broadcast(
                        f"Post {post_id}: Validation failed on attempt {retries}. Retrying..."
                    )

            if validation_result is None:
                await manager.broadcast(f"Post {post_id}: Validation failed after {max_retries} retries.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
                posts.pop(0)
                continue

            # Parse validation results
            match = re.search(
                r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                validation_result,
            )

            if not match:
                await manager.broadcast(f"Post {post_id}: Validation result parsing failed.")
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
            else:
                try:
                    unified_codebook = json.loads(match.group(1))
                    recoded_transcript = (
                        json.loads(match.group(2)) if match.group(2) else []
                    )
                    final_results.append(
                        {
                            "unified_codebook": unified_codebook,
                            "recoded_transcript": recoded_transcript,
                        }
                    )
                    await manager.broadcast(f"Post {post_id}: Post processing completed successfully.")
                except json.JSONDecodeError as e:
                    await manager.broadcast(f"Post {post_id}: Error parsing JSON validation results.")

            # Remove processed post from queue
            posts.pop(0)

        await manager.broadcast("All posts processed.")
        return final_results if len(final_results) else []

    except Exception as e:
        print("Inside Exception", e)
        await manager.broadcast("Error encountered during processing.")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.post("/generate-codes-with-feedback")
# async def generate_codes_with_feedback(request: GenerateCodesWithFeedbackRequest):
#     try:
#         llm1 = OllamaLLM(
#             model=request.model,
#             num_ctx=16384,
#             num_predict=16384,
#             temperature=0.9,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )
#         llm2 = OllamaLLM(
#             model=request.model,
#             num_ctx=16384,
#             num_predict=16384,
#             temperature=0.2,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )
#         judge_llm = OllamaLLM(
#             model=request.model,
#             num_ctx=16384,
#             num_predict=16384,
#             temperature=0.5,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )

#         final_results = []

#         posts = request.selectedPosts
#         while len(posts) > 0:
#             # Fetch post and comments
#             post_id = posts[0]
#             # Fetch post and comments
#             post_data = get_post_with_comments(request.datasetId, post_id)
#             transcript = generate_transcript(post_data)
#             context = generate_context(
#                 request.references, 
#                 request.mainCode, 
#                 request.flashcards, 
#                 request.selectedWords
#             )
#             feedback_text = generate_feedback(request.feedback)

#             # Generate code with llm1
#             generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
#             result1 = llm1.invoke(generation_prompt_1)

#             # Generate code with llm2
#             generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
#             result2 = llm2.invoke(generation_prompt_2)

#             # Validate using judge_llm
#             validate_prompt = CodePrompts.judge_validate_with_feedback(
#                 result1, result2, transcript, request.mainCode, feedback_text
#             )
#             validation_result = judge_llm.invoke(validate_prompt)

#             # Parse the validation results
#             match = re.search(
#                 r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
#                 validation_result
#             )

#             if not match:
#                 final_results.append({"unified_codebook": [], "recoded_transcript": []})
#             else:
#                 try:
#                     unified_codebook = json.loads(match.group(1))
#                     recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
#                     final_results.append({
#                         "unified_codebook": unified_codebook,
#                         "recoded_transcript": recoded_transcript
#                     })
#                 except json.JSONDecodeError as e:
#                     print("Inside JSONDecodeError", e)

#                     # raise HTTPException(status_code=500, detail=f"Error parsing JSON: {str(e)}")
#             posts.pop(0)
#         return final_results if len(final_results) else []

#     except Exception as e:
#         print("Inside Exception", e)
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class GenerateCodesWithThemesRequest(BaseModel):
    model: str
    references: dict
    mainCode: str
    codeBook: List[dict]
    selectedPosts: list
    datasetId: str

@router.post("/generate-codes-with-themes")
async def generate_codes_with_themes(request: GenerateCodesWithThemesRequest):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {request.datasetId}: Code generation process started.")
        await asyncio.sleep(0)

        # Initialize LLMs
        llm1 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]  # Only pop after all steps succeed

            # Notify clients about the current post
            await manager.broadcast(f"Dataset {request.datasetId}: Processing post {post_id}...")
            await asyncio.sleep(0)

            try:
                # Fetch post and comments
                post_data = get_post_with_comments(request.datasetId, post_id)
                transcript = generate_transcript(post_data)
                context = generate_context_with_codebook(
                    request.references,
                    request.mainCode,
                    request.codeBook
                )

                # Initialize results for the post
                result1 = None
                result2 = None
                validation_result = None

                # Generate code with LLM1
                retries = 3
                success = False
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request.datasetId}: Generating with LLM1 for post {post_id}...")
                        generation_prompt_1 = CodePrompts.generate(transcript, context)
                        result1 = llm1.invoke(generation_prompt_1)
                        success = True
                        await manager.broadcast(f"Dataset {request.datasetId}: LLM1 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request.datasetId}: Error generating code with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request.datasetId}: Failed to generate code with LLM1 for post {post_id} after multiple attempts."
                            )
                            raise e

                # Generate code with LLM2
                retries = 3
                success = False
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request.datasetId}: Generating with LLM2 for post {post_id}...")
                        generation_prompt_2 = CodePrompts.generate(transcript, context)
                        result2 = llm2.invoke(generation_prompt_2)
                        success = True
                        await manager.broadcast(f"Dataset {request.datasetId}: LLM2 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request.datasetId}: Error generating code with LLM2 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request.datasetId}: Failed to generate code with LLM2 for post {post_id} after multiple attempts."
                            )
                            raise e

                # Validate results using judge LLM
                retries = 3
                success = False
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request.datasetId}: Generating with LLM3 for post {post_id}...")
                        validate_prompt = CodePrompts.judge_validate(result1, result2, transcript, request.mainCode)
                        validation_result = judge_llm.invoke(validate_prompt)
                        success = True
                        await manager.broadcast(f"Dataset {request.datasetId}: Validation completed for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request.datasetId}: Error validating results for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request.datasetId}: Failed to validate results for post {post_id} after multiple attempts."
                            )
                            raise e

                # Parse the validation results
                match = re.search(
                    r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                    validation_result
                )

                if not match:
                    final_results.append({"unified_codebook": [], "recoded_transcript": []})
                    await manager.broadcast(f"WARNING: Dataset {request.datasetId}: No valid results found for post {post_id}.")
                else:
                    try:
                        unified_codebook = json.loads(match.group(1))
                        recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
                        final_results.append({
                            "unified_codebook": unified_codebook,
                            "recoded_transcript": recoded_transcript
                        })
                        await manager.broadcast(f"Dataset {request.datasetId}: Successfully processed post {post_id}.")
                    except json.JSONDecodeError as e:
                        await manager.broadcast(
                            f"ERROR: Dataset {request.datasetId}: Error parsing validation results for post {post_id} - {str(e)}."
                        )
                        raise e

                # Pop the post only after all steps are completed
                posts.pop(0)

            except Exception as e:
                await manager.broadcast(
                    f"ERROR: Dataset {request.datasetId}: Error processing post {post_id} - {str(e)}."
                )
                posts.pop(0)

        # Notify clients that all posts are processed
        await manager.broadcast(f"Parsing success. Dataset {request.datasetId}: All posts processed successfully.")
        await asyncio.sleep(0)

        return final_results if len(final_results) else []

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request.datasetId}: Error encountered - {str(e)}")
        print("Inside Exception", e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class GenerateCodesWithThemesAndFeedbackRequest(GenerateCodesWithThemesRequest):
    feedback : list

@router.post("/generate-codes-with-themes-and-feedback")
async def generate_codes_with_themes_feedback(request: GenerateCodesWithThemesAndFeedbackRequest):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {request.datasetId}: Code generation with feedback process started.")
        await asyncio.sleep(0)

        # Initialize LLMs
        llm1 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request.model,
            num_ctx=16384,
            num_predict=16384,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]

            # Notify clients about the current post
            await manager.broadcast(f"Dataset {request.datasetId}: Processing post {post_id}...")
            await asyncio.sleep(0)

            try:
                # Fetch post and comments
                post_data = get_post_with_comments(request.datasetId, post_id)
                transcript = generate_transcript(post_data)
                context = generate_context_with_codebook(
                    request.references,
                    request.mainCode,
                    request.codeBook
                )
                feedback_text = generate_feedback(request.feedback)

                # Generate code with LLM1
                retries = 3
                success = False
                result1 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request.datasetId}: Generating with LLM1 for post {post_id}...")
                        generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                        result1 = llm1.invoke(generation_prompt_1)
                        success = True
                        await manager.broadcast(f"Dataset {request.datasetId}: LLM1 completed generation for post {post_id}.")
                        await asyncio.sleep(0)
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(f"WARNING: Dataset {request.datasetId}: Error generating code with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)")
                        await asyncio.sleep(0)
                        if retries == 0:
                            await manager.broadcast(f"ERROR: Dataset {request.datasetId}: Failed to generate code with LLM1 for post {post_id} after multiple attempts.")
                            await asyncio.sleep(0)
                            raise e

                # Generate code with LLM2
                retries = 3
                success = False
                result2 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request.datasetId}: Generating with LLM2 for post {post_id}...")
                        await asyncio.sleep(0)
                        generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                        result2 = llm2.invoke(generation_prompt_2)
                        success = True
                        await manager.broadcast(f"Dataset {request.datasetId}: LLM2 completed generation for post {post_id}.")
                        await asyncio.sleep(0)
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(f"WARNING: Dataset {request.datasetId}: Error generating code with LLM2 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)")
                        await asyncio.sleep(0)
                        if retries == 0:
                            await manager.broadcast(f"ERROR: Dataset {request.datasetId}: Failed to generate code with LLM2 for post {post_id} after multiple attempts.")
                            await asyncio.sleep(0)
                            raise e

                # Validate results using judge LLM
                retries = 3
                success = False
                validation_result = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request.datasetId}: Generating with LLM3 for post {post_id}...")
                        await asyncio.sleep(0)
                        validate_prompt = CodePrompts.judge_validate_with_feedback(
                            result1, result2, transcript, request.mainCode, feedback_text
                        )
                        validation_result = judge_llm.invoke(validate_prompt)
                        success = True
                        await manager.broadcast(f"Dataset {request.datasetId}: Validation completed for post {post_id}.")
                        await asyncio.sleep(0)
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(f"WARNING: Dataset {request.datasetId}: Error validating results for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)")
                        await asyncio.sleep(0)
                        if retries == 0:
                            await manager.broadcast(f"ERROR: Dataset {request.datasetId}: Failed to validate results for post {post_id} after multiple attempts.")
                            await asyncio.sleep(0)
                            raise e

                # Parse the validation results
                match = re.search(
                    r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                    validation_result
                )

                if not match:
                    final_results.append({"unified_codebook": [], "recoded_transcript": []})
                    await manager.broadcast(f"WARNING: Dataset {request.datasetId}: No valid results found for post {post_id}.")
                    await asyncio.sleep(0)
                else:
                    try:
                        unified_codebook = json.loads(match.group(1))
                        recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
                        final_results.append({
                            "unified_codebook": unified_codebook,
                            "recoded_transcript": recoded_transcript
                        })
                        await manager.broadcast(f"Parsing success. Dataset {request.datasetId}: Successfully processed post {post_id}.")
                        await asyncio.sleep(0)
                    except json.JSONDecodeError as e:
                        await manager.broadcast(f"ERROR: Dataset {request.datasetId}: Error parsing validation results for post {post_id} - {str(e)}.")
                        await asyncio.sleep(0)
                        raise e

                posts.pop(0)

            except Exception as e:
                await manager.broadcast(f"ERROR: Dataset {request.datasetId}: Error processing post {post_id} - {str(e)}.")
                await asyncio.sleep(0)
                posts.pop(0)

        # Notify clients that all posts are processed
        await manager.broadcast(f"ERROR: Dataset {request.datasetId}: All posts processed successfully.")
        await asyncio.sleep(0)

        return final_results if len(final_results) else []

    except Exception as e:
        await manager.broadcast(f"Dataset {request.datasetId}: Error encountered - {str(e)}")
        await asyncio.sleep(0)
        print("Inside Exception", e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.post("/generate-codes")
# async def generate_codes(request: GenerateCodesRequest):
#     try:
#         main_code = request.mainCode
#         selected_flashcards = request.selectedFlashcards
#         selected_words = request.selectedWords
#         selected_posts = request.selectedPosts
#         dataset_id = request.datasetId
#         # Initialize retriever
#         embeddings = OllamaEmbeddings(model=request.model)
#         vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection")
#         retriever = vector_store.as_retriever()

#         llm1 = OllamaLLM(
#                 model=request.model,
#                 num_ctx=16384,
#                 num_predict=16384,
#                 temperature=0.9,
#                 callbacks=[
#                     StreamingStdOutCallbackHandler()
#                 ]
#             )
        
#         llm2 = OllamaLLM(
#                 model=request.model,
#                 num_ctx=16384,
#                 num_predict=16384,
#                 temperature=0.2,
#                 callbacks=[
#                     StreamingStdOutCallbackHandler()
#                 ]
#             )
        
#         judgeLLM = OllamaLLM(
#                 model=request.model,
#                 num_ctx=16384,
#                 num_predict=16384,
#                 temperature=0.5,
#                 callbacks=[
#                     StreamingStdOutCallbackHandler()
#                 ]
#             )

#         # Generate codes for each post
#         final_results = []

#         print("Selected posts: ", selected_posts)
#         for post_id in selected_posts:

#             post_data = get_post_with_comments(dataset_id,post_id)
#             transcript = generate_transcript(post_data)
#             print("Transcript: ", transcript)
#             context = generate_context(request.references, main_code, selected_flashcards, selected_words)
#             print("Context: ", context)
#             query = f"Generate code for post {post_id} using the context."
#             result = llm1.predict(query + context)
#             print("Result 1: ", result)

#             # Generate additional codes
            

#             # context = f"""
#             # References: {request.references}.
#             # Flashcards: {request.selected_flashcards}.
#             # Words: {request.selected_words}.
#             # """
#             # query = f"Generate code for post {post} using the context."
#             # result = llm.predict(query + context)
#             # final_results.append(result)

#         return {"codes": final_results}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
