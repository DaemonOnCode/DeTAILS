import asyncio
import time
from typing import Dict, List
from fastapi import APIRouter, HTTPException, UploadFile, Form, Request
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
import ctypes
import threading
import os
import re
import json
from chromadb import HttpClient
from utils.prompts import CodePrompts, ThemePrompts, FlashcardPrompts, WordCloudPrompts, CodebookPrompts
from utils.db_helpers import get_post_with_comments
from utils.coding_helpers import generate_context, generate_feedback, generate_transcript, generate_context_with_codebook
from routes.websocket_routes import manager

router = APIRouter()

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Callable, Any, Optional
import asyncio

# Create a thread pool executor for offloading blocking tasks
executor = ThreadPoolExecutor()

async def run_in_threadpool(func: Callable, *args: Any, timeout: Optional[float] = None, **kwargs: Any) -> Any:
    """
    Run a function in a thread pool with optional timeout.

    Args:
        func (Callable): The function to execute in the thread pool.
        *args (Any): Positional arguments for the function.
        timeout (Optional[float]): Maximum time to wait for the function to complete (in seconds).
        **kwargs (Any): Keyword arguments for the function.

    Returns:
        Any: The result of the function.

    Raises:
        asyncio.TimeoutError: If the function execution exceeds the specified timeout.
        Exception: If the function raises an exception during execution.
    """
    loop = asyncio.get_event_loop()

    try:
        return await asyncio.wait_for(
            loop.run_in_executor(executor, func, *args, **kwargs),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        raise asyncio.TimeoutError(f"Function '{func.__name__}' timed out after {timeout} seconds.")

# Example of wrapping Chroma and Ollama calls
def add_documents_to_vector_store(vector_store: Chroma, chunks):
    vector_store.add_documents(chunks)

def run_llm_chain(rag_chain, input_text):
    return rag_chain.invoke({"input": input_text})


# Create a task to monitor disconnection
async def monitor_disconnection(request:Request , cancel_event: asyncio.Event):
    try:
        while True:
            if await request.is_disconnected():
                cancel_event.set()  # Trigger cancellation
                break
            await asyncio.sleep(0.1)  # Poll at regular intervals
    except Exception as e:
        print(f"Disconnection monitoring error: {e}")
        raise e


# class ForcibleThreadPoolExecutor:
#     """
#     A thread pool executor that can forcibly terminate long-running blocking functions.
#     """
#     def __init__(self, threadpoolExecutor: ThreadPoolExecutor):
#         self._executor = threadpoolExecutor
    
#     def _async_raise(self, thread_id: int, exception_type: type):
#         """
#         Raise an exception in the thread with the given ID.
        
#         Args:
#             thread_id (int): ID of the thread to raise an exception in
#             exception_type (type): Exception type to raise
#         """
#         # Get a reference to the thread
#         thread_id = ctypes.c_long(thread_id)
        
#         # Use ctypes to call the Windows/POSIX thread-specific exception raising
#         if hasattr(ctypes.pythonapi, 'PyThreadState_SetAsyncExc'):
#             # Python's internal C API to raise exceptions in threads
#             res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
#                 thread_id, 
#                 ctypes.py_object(exception_type)
#             )
            
#             if res == 0:
#                 raise ValueError("Nonexistent thread ID")
#             elif res > 1:
#                 # If more than one thread is affected, reset the exception
#                 ctypes.pythonapi.PyThreadState_SetAsyncExc(thread_id, None)
#                 raise SystemError("PyThreadState_SetAsyncExc failed")

#     def submit_with_timeout(
#         self, 
#         func: Callable, 
#         *args: Any, 
#         timeout: Optional[float] = None, 
#         **kwargs: Any
#     ) -> Any:
#         """
#         Submit a function to the thread pool with the ability to forcibly terminate it.
        
#         Args:
#             func (Callable): Function to execute
#             *args: Positional arguments for the function
#             timeout (Optional[float]): Maximum execution time in seconds
#             **kwargs: Keyword arguments for the function
        
#         Returns:
#             Result of the function or raises an exception
        
#         Raises:
#             concurrent.futures.TimeoutError: If function exceeds timeout
#         """
#         # Future to track the function execution
#         future = self._executor.submit(func, *args, **kwargs)
        
#         # Thread used for monitoring
#         monitor_thread = None
        
#         try:
#             # If timeout is specified, monitor and potentially terminate
#             if timeout is not None:
#                 # Get the internal thread ID of the submitted task
#                 thread_id = future._thread.ident if hasattr(future, '_thread') else None
                
#                 def timeout_handler():
#                     if not future.done():
#                         # Attempt to forcibly raise an exception in the thread
#                         if thread_id:
#                             try:
#                                 self._async_raise(thread_id, SystemExit)
#                             except Exception as e:
#                                 print(f"Failed to terminate thread: {e}")
                        
#                         # Cancel the future
#                         future.cancel()
                
#                 # Create a monitoring thread
#                 monitor_thread = threading.Thread(
#                     target=lambda: 
#                     (time.sleep(timeout), timeout_handler()),
#                     daemon=True
#                 )
#                 monitor_thread.start()
            
#             # Wait for the future to complete
#             return future.result(timeout=timeout)
        
#         finally:
#             # Ensure the monitor thread is cleaned up
#             if monitor_thread:
#                 monitor_thread.join(timeout=1)


# forcibleExecutor = ForcibleThreadPoolExecutor(executor)


# # Async wrapper to use in FastAPI
# async def run_blocking_function(
#     executor: ForcibleThreadPoolExecutor,
#     func: Callable, 
#     *args: Any, 
#     timeout: Optional[float] = None,
#     **kwargs: Any
# ) -> Any:
#     """
#     Async wrapper to run a blocking function with forcible termination.
    
#     Args:
#         executor (ForcibleThreadPoolExecutor): The executor to use
#         func (Callable): Blocking function to execute
#         *args: Positional arguments for the function
#         timeout (Optional[float]): Maximum execution time
#         **kwargs: Keyword arguments for the function
    
#     Returns:
#         Result of the function
    
#     Raises:
#         concurrent.futures.TimeoutError: If function exceeds timeout
#     """
#     loop = asyncio.get_event_loop()
    
#     try:
#         return await loop.run_in_executor(
#             None, 
#             executor.submit_with_timeout, 
#             func, *args, timeout=timeout, **kwargs
#         )
#     except SystemExit:
#         # Handle forced termination
#         raise TimeoutError("Function was forcibly terminated")
    

class ForcibleThreadPoolExecutor:
    """
    A thread pool executor that can forcibly terminate long-running blocking functions
    and monitor for request disconnection.
    """
    def __init__(self, executor: ThreadPoolExecutor):
        self._executor = executor
        self._active_tasks = {}  # Track active tasks
        self._task_lock = threading.Lock()

    def _async_raise(self, thread_id: int, exception_type: type):
        """
        Raise an exception in the thread with the given ID.
        
        Args:
            thread_id (int): ID of the thread to raise an exception in
            exception_type (type): Exception type to raise
        """
        print("Raising exception in thread")
        thread_id = ctypes.c_long(thread_id)
        
        if hasattr(ctypes.pythonapi, 'PyThreadState_SetAsyncExc'):
            res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
                thread_id, 
                ctypes.py_object(exception_type)
            )
            
            if res == 0:
                raise ValueError("Nonexistent thread ID")
            elif res > 1:
                ctypes.pythonapi.PyThreadState_SetAsyncExc(thread_id, None)
                raise SystemError("PyThreadState_SetAsyncExc failed")

    async def _monitor_disconnection(self, request: Request, task_id: str):
        """
        Monitor request disconnection and terminate the associated task.
        
        Args:
            request (Request): FastAPI request to monitor
            task_id (str): Unique identifier for the task
        """
        print("Monitoring disconnection")
        try:
            while True:
                # Check for disconnection
                if await request.is_disconnected():
                    # Terminate the associated task
                    self.terminate_task(task_id)
                    break
                
                # Poll at regular intervals
                await asyncio.sleep(0.1)
        except Exception as e:
            print(f"Disconnection monitoring error: {e}")

    def submit_with_timeout_and_disconnection(
        self, 
        func: Callable, 
        request: Request,
        *args: Any, 
        timeout: Optional[float] = None, 
        **kwargs: Any
    ) -> Any:
        """
        Submit a function to the thread pool with timeout and disconnection monitoring.
        
        Args:
            func (Callable): Function to execute
            request (Request): FastAPI request for disconnection monitoring
            *args: Positional arguments for the function
            timeout (Optional[float]): Maximum execution time in seconds
            **kwargs: Keyword arguments for the function
        
        Returns:
            Result of the function or raises an exception
        
        Raises:
            concurrent.futures.TimeoutError: If function exceeds timeout
        """
        print("Submitting task with timeout and disconnection monitoring")
        # Generate a unique task ID
        task_id = f"task_{id(func)}_{time.time()}"
        
        # Future to track the function execution
        future = self._executor.submit(func, *args, **kwargs)
        
        # Track the active task
        with self._task_lock:
            self._active_tasks[task_id] = {
                'future': future,
                'thread_id': future._thread.ident if hasattr(future, '_thread') else None
            }
        
        monitor_thread = None
        disconnection_task = None
        
        try:
            # Start disconnection monitoring
            loop = asyncio.get_event_loop()
            disconnection_task = loop.create_task(
                self._monitor_disconnection(request, task_id)
            )
            
            # If timeout is specified, monitor and potentially terminate
            if timeout is not None:
                def timeout_handler():
                    if not future.done():
                        self.terminate_task(task_id)
                
                # Create a monitoring thread
                monitor_thread = threading.Thread(
                    target=lambda: 
                    (time.sleep(timeout), timeout_handler()),
                    daemon=True
                )
                monitor_thread.start()
            
            # Wait for the future to complete
            return future.result(timeout=timeout)
        
        finally:
            # Cleanup tasks and monitoring threads
            if disconnection_task:
                disconnection_task.cancel()
            
            if monitor_thread:
                monitor_thread.join(timeout=1)
            
            # Remove the task from active tasks
            with self._task_lock:
                self._active_tasks.pop(task_id, None)

    def terminate_task(self, task_id: str):
        """
        Forcibly terminate a specific task.
        
        Args:
            task_id (str): Unique identifier of the task to terminate
        """
        with self._task_lock:
            task_info = self._active_tasks.get(task_id)
            
            if task_info:
                future = task_info['future']
                thread_id = task_info['thread_id']
                
                try:
                    # Attempt to raise an exception in the thread
                    if thread_id:
                        self._async_raise(thread_id, SystemExit)
                    
                    # Cancel the future
                    future.cancel()
                except Exception as e:
                    print(f"Error terminating task {task_id}: {e}")


forcibleExecutor = ForcibleThreadPoolExecutor(executor)

async def run_blocking_function_with_disconnection(
    executor: ForcibleThreadPoolExecutor,
    request: Request,
    func: Callable,
    *args: Any,
    timeout: Optional[float] = None,
    **kwargs: Any
) -> Any:
    """
    Async wrapper to run a blocking function with disconnection monitoring.
    
    Args:
        executor (ForcibleThreadPoolExecutor): The executor to use
        request (Request): FastAPI request for disconnection monitoring
        func (Callable): Blocking function to execute
        *args: Positional arguments for the function
        timeout (Optional[float]): Maximum execution time
        **kwargs: Keyword arguments for the function
    
    Returns:
        Result of the function
    
    Raises:
        concurrent.futures.TimeoutError: If function exceeds timeout
    """
    loop = asyncio.get_event_loop()

    def run_with_event_loop():
        # Set an event loop for the thread
        try:
            asyncio.set_event_loop(asyncio.new_event_loop())
            return executor.submit_with_timeout_and_disconnection(
                func, request, *args, timeout=timeout, **kwargs
            )
        except Exception as e:
            print(f"Error in run_with_event_loop: {e}")
            raise

    try:
        print("Running blocking function with disconnection monitoring")
        return await loop.run_in_executor(None, run_with_event_loop)
    except SystemExit:
        # Handle forced termination
        raise TimeoutError("Function was forcibly terminated due to disconnection")
    except Exception as e:
        print(f"Error in run_blocking_function_with_disconnection: {e}")
        raise

# Request model
class AddDocumentsRequest(BaseModel):
    documents: dict  # {file_path: content}
    model: str
    regenerate: bool = False

@router.post("/add-documents-langchain")
async def add_documents_langchain(
    request: Request,
    basisFiles: List[UploadFile],
    model: str = Form(...),
    mainCode: str = Form(...),
    additionalInfo: str = Form(""),
    retry: bool = Form(False),
    dataset_id: str = Form(...)
):
    try:
        await manager.broadcast(f"Dataset {dataset_id}: Processing started.")

        # Initialize embeddings and vector store
        embeddings = OllamaEmbeddings(model=model)
        chroma_client = HttpClient(host="localhost", port=8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        await manager.broadcast(f"Dataset {dataset_id}: Uploading files...")

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

                    # Offload Chroma vector store operation to thread pool
                    await run_blocking_function_with_disconnection(forcibleExecutor, request, add_documents_to_vector_store, vector_store, chunks)

                    os.remove(temp_file_path)
                    success = True
                    await manager.broadcast(f"Dataset {dataset_id}: Successfully processed file {file_name}.")
                except Exception as e:
                    retries -= 1
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)")
                    if retries == 0:
                        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts.")
                        raise e

        await manager.broadcast(f"Dataset {dataset_id}: Files uploaded successfully.")

        # Notify clients that retriever creation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")
        retriever = vector_store.as_retriever()

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(FlashcardPrompts.systemTemplateFlashcards)),
            ("human", "{input}")
        ])

        await manager.broadcast(f"Dataset {dataset_id}: Generating flashcards...")

        # Generate flashcards with retry logic
        retries = 3
        success = False
        parsed_flashcards = []
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

                input_text = FlashcardPrompts.flashcardTemplate(mainCode, additionalInfo)

                # Offload LLM chain invocation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, run_llm_chain, rag_chain, input_text, timeout=180)

                await manager.broadcast(f"Dataset {dataset_id}: Parsing generated flashcards...")

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

        await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")

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
    request: Request,
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

        # Initialize embeddings and vector store
        embeddings = OllamaEmbeddings(model=model)
        chroma_client = HttpClient(host="localhost", port=8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        await manager.broadcast(f"Dataset {dataset_id}: Uploading files...")

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

                    # Offload Chroma vector store operation to thread pool
                    await run_blocking_function_with_disconnection(forcibleExecutor, request, vector_store.add_documents, chunks)

                    os.remove(temp_file_path)
                    success = True
                    await manager.broadcast(f"Dataset {dataset_id}: Successfully processed file {file_name}.")
                except Exception as e:
                    retries -= 1
                    await manager.broadcast(f"WARNING: Dataset {dataset_id}: Error processing file {file.filename} - {str(e)}. Retrying... ({3 - retries}/3)")
                    if retries == 0:
                        await manager.broadcast(f"ERROR: Dataset {dataset_id}: Failed to process file {file.filename} after multiple attempts.")
                        raise e

        await manager.broadcast(f"Dataset {dataset_id}: Files uploaded successfully.")

        # Notify clients that retriever creation is starting
        await manager.broadcast(f"Dataset {dataset_id}: Creating retriever...")

        retriever = vector_store.as_retriever()

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(ThemePrompts.systemTemplateThemes)),
            ("human", "{input}")
        ])

        await manager.broadcast(f"Dataset {dataset_id}: Generating Themes...")

        # Generate themes with retry logic
        retries = 3
        success = False
        parsed_themes = []
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

                input_text = ThemePrompts.themesTemplate(mainCode, additionalInfo)

                # Offload LLM chain invocation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, rag_chain.invoke, {"input": input_text}, timeout=180)

                await manager.broadcast(f"Dataset {dataset_id}: Parsing generated themes...")

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

        await manager.broadcast(f"Dataset {dataset_id}: Processing complete.")

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
async def generate_additional_flashcards(
    request: Request,
    request_body: GenerateFlashcardsRequest
):
    try:
        # Notify clients that flashcard generation has started
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Additional flashcard generation started.")

        # Initialize retriever with retry logic
        retries = 3
        success = False
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request_body.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)

                # Offload retriever creation to thread pool
                retriever = await run_blocking_function_with_disconnection(forcibleExecutor, request, vector_store.as_retriever)
                success = True
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create prompt template and LLM chain
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(FlashcardPrompts.systemTemplateFlashcards)),
            ("human", "{input}")
        ])
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Prompt template created.")

        llm = OllamaLLM(
            model=request_body.model,
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
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Question-answer chain created.")

        # Create the RAG chain
        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )
        await manager.broadcast(f"Dataset {request_body.dataset_id}: RAG chain created.")

        # Generate flashcards with retry logic
        retries = 3
        success = False
        parsed_flashcards = []
        while retries > 0 and not success:
            try:
                input_text = FlashcardPrompts.flashcardRegenerationTemplate(
                    request_body.mainCode, request_body.additionalInfo, request_body.feedback, request_body.flashcards
                )
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Generating additional flashcards...")

                # Offload flashcard generation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, rag_chain.invoke, {"input": input_text}, timeout=180)

                await manager.broadcast(f"Dataset {request_body.dataset_id}: Flashcards generated successfully.")

                # Parse the results to extract flashcards
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"flashcards\"\s*:\s*\[(?P<flashcards>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\s*\])(?:\n```)?"

                flashcards_match = re.search(regex, results["answer"], re.DOTALL)
                if not flashcards_match:
                    await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: No additional flashcards found.")
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
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error generating flashcards - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to generate flashcards after multiple attempts.")
                    raise e

        # Notify clients that the process is complete
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Additional flashcard generation process complete.")

        return {
            "message": "Additional flashcards generated successfully.",
            "flashcards": parsed_flashcards,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Error encountered - {str(e)}")
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
async def generate_themes(request: Request, request_body: GenerateThemesRequest):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Theme generation started.")
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Generating Themes...")

        # Initialize retriever with retry logic
        retries = 3
        success = False
        retriever = None
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request_body.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)

                # Offload retriever creation to thread pool
                retriever = await run_blocking_function_with_disconnection(forcibleExecutor, request, vector_store.as_retriever)
                success = True
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(ThemePrompts.systemTemplateThemes)),
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
        await manager.broadcast(f"Dataset {request_body.dataset_id}: RAG chain created successfully.")

        # Generate themes with retry logic
        retries = 3
        success = False
        parsed_themes = []
        while retries > 0 and not success:
            try:
                input_text = ThemePrompts.themesRegenerationTemplate(
                    request_body.mainCode, request_body.additionalInfo, request_body.selectedThemes, request_body.feedback
                )

                print("Regenerating themes...")
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Regenerating themes...")

                # Offload theme generation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, rag_chain.invoke, {"input": input_text}, timeout=180)

                print("Themes regenerated")
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Themes regenerated successfully.")

                # Parse the results to extract themes
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"themes\"\s*:\s*\[(?P<themes>(?:\s*\".*?\"\s*,?)*?)\s*\}|\[\s*(?P<standalone>(?:\s*\".*?\"\s*,?)*?)\s*\])(?:\n```)?"
                themes_match = re.search(regex, results["answer"], re.DOTALL)

                if not themes_match:
                    await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: No themes found.")
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
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error encountered while generating themes - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to generate themes after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Processing complete.")

        return {
            "message": "Themes generated successfully.",
            "themes": parsed_themes,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Error encountered - {str(e)}")
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
async def generate_codebook(request: Request, request_body: GenerateCodeBookRequest):
    try:
        # Notify clients that the codebook generation process has started
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Codebook generation started.")

        # Initialize retriever with retry logic
        retries = 3
        success = False
        retriever = None
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request_body.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)

                # Offload retriever creation to thread pool
                retriever = await run_blocking_function_with_disconnection(forcibleExecutor, request, vector_store.as_retriever)
                success = True
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(CodebookPrompts.systemTemplateCodebook)),
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
        await manager.broadcast(f"Dataset {request_body.dataset_id}: RAG chain created successfully.")

        # Generate codebook with retry logic
        retries = 3
        success = False
        parsed_codebook = []
        while retries > 0 and not success:
            try:
                input_text = CodebookPrompts.codebookTemplate(request_body.mainCode, request_body.additionalInfo, request_body.selectedThemes)

                print("Generating codebook...")
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Generating codebook...")

                # Offload codebook generation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, rag_chain.invoke, {"input": input_text}, timeout=180)

                print("Codebook generated")
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Codebook generated successfully.")

                # Parse the results to extract the codebook
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"codebook\"\s*:\s*\[(?P<codebook>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\s*\])(?:\n```)?"

                codebook_match = re.search(regex, results["answer"], re.DOTALL | re.VERBOSE)

                if not codebook_match:
                    await manager.broadcast(f"Dataset {request_body.dataset_id}: No valid codebook found.")
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
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error generating codebook - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to generate codebook after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Codebook generation process complete.")

        return {
            "message": "Codebook generated successfully.",
            "codebook": parsed_codebook,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Error encountered - {str(e)}")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class GenerateAdditionalCodesRequest(GenerateCodeBookRequest):
    currentCodebook: list

@router.post("/generate-additional-codes-for-codebook")
async def generate_codes_for_codebook(request: Request, request_body: GenerateAdditionalCodesRequest):
    try:
        # Notify clients that the codebook generation process has started
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Codebook generation started.")

        # Initialize retriever with retry logic
        retries = 3
        success = False
        retriever = None
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request_body.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)

                # Offload retriever creation to thread pool
                retriever = await run_blocking_function_with_disconnection(forcibleExecutor, request, vector_store.as_retriever)
                success = True
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(CodebookPrompts.systemTemplateCodebook)),
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
        await manager.broadcast(f"Dataset {request_body.dataset_id}: RAG chain created successfully.")

        # Generate codebook with retry logic
        retries = 3
        success = False
        parsed_codebook = []
        while retries > 0 and not success:
            try:
                input_text = CodebookPrompts.codebookRegenerationTemplate(request_body.mainCode, request_body.additionalInfo, request_body.selectedThemes, request_body.currentCodebook)

                print("Generating codebook...")
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Generating codebook...")

                # Offload codebook generation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, rag_chain.invoke, {"input": input_text}, timeout=180)

                print("Codebook generated")
                await manager.broadcast(f"Dataset {request_body.dataset_id}: Codebook generated successfully.")

                # Parse the results to extract the codebook
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"codebook\"\s*:\s*\[(?P<codebook>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"word\"\s*:\s*\".*?\"\s*,\s*\"description\"\s*:\s*\".*?\"\s*(?:,\s*\"codes\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*)?,\s*\"inclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*,\s*\"exclusion_criteria\"\s*:\s*\[\s*(?:\"[^\"]*\",?\s*)*\s*\]\s*\},?\s*)+)\s*\])(?:\n```)?"

                codebook_match = re.search(regex, results["answer"], re.DOTALL | re.VERBOSE)

                if not codebook_match:
                    await manager.broadcast(f"Dataset {request_body.dataset_id}: No valid codebook found.")
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
                await manager.broadcast(f"WARNING: Dataset {request_body.dataset_id}: Error generating codebook - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Failed to generate codebook after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request_body.dataset_id}: Codebook generation process complete.")

        return {
            "message": "Codebook generated successfully.",
            "codebook": parsed_codebook,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.dataset_id}: Error encountered - {str(e)}")
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
async def generate_words(request: Request, request_body: GenerateWordsRequest):
    try:
        # Notify clients that the word generation process has started
        await manager.broadcast(f"Dataset {request_body.datasetId}: Word generation process started.")

        # Initialize retriever with retry logic
        retries = 3
        success = False
        retriever = None
        while retries > 0 and not success:
            try:
                embeddings = OllamaEmbeddings(model=request_body.model)
                chroma_client = HttpClient(host="localhost", port=8000)
                vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)

                # Offload retriever creation to thread pool
                retriever = await run_blocking_function_with_disconnection(forcibleExecutor, request, vector_store.as_retriever)
                success = True
                await manager.broadcast(f"Dataset {request_body.datasetId}: Retriever created successfully.")
            except Exception as e:
                retries -= 1
                await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Error creating retriever - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Failed to create retriever after multiple attempts.")
                    raise e

        # Create LLM chain
        llm = OllamaLLM(
            model=request_body.model,
            num_ctx=8192,
            num_predict=8192,
            temperature=0.3,
            callbacks=[
                StreamingStdOutCallbackHandler()
            ]
        )
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", WordCloudPrompts.systemTemplateWordCloud(request_body.mainCode)),
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
        await manager.broadcast(f"Dataset {request_body.datasetId}: RAG chain created successfully.")

        # Generate words with retry logic
        retries = 3
        success = False
        parsed_words = []
        while retries > 0 and not success:
            try:
                input_text = WordCloudPrompts.wordCloudTemplate(
                    request_body.mainCode, request_body.flashcards
                ) if not request_body.regenerate else WordCloudPrompts.wordCloudRegenerationTemplate(
                    request_body.mainCode, request_body.selectedWords, request_body.feedback
                )

                print("Generating words...")
                await manager.broadcast(f"Dataset {request_body.datasetId}: Generating words...")

                # Offload word generation to thread pool
                results = await run_blocking_function_with_disconnection(forcibleExecutor, request, rag_chain.invoke, {"input": input_text}, timeout=180)

                print("Words generated")
                await manager.broadcast(f"Dataset {request_body.datasetId}: Words generated successfully.")

                # Parse the results to extract words
                regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"words\"\s*:\s*\[(?P<words>(?:\s*\".*?\"\s*,?)*?)\s*\}|\[\s*(?P<standalone>(?:\s*\".*?\"\s*,?)*?)\s*\])(?:\n```)?"
                words_match = re.search(regex, results["answer"], re.DOTALL)

                if not words_match:
                    await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: No words found.")
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
                await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Error generating words - {str(e)}. Retrying... ({3 - retries}/3)")
                if retries == 0:
                    await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Failed to generate words after multiple attempts.")
                    raise e

        # Notify clients that processing is complete
        await manager.broadcast(f"Dataset {request_body.datasetId}: Word generation process complete.")

        return {
            "message": "Words generated successfully.",
            "words": parsed_words,
        }

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error encountered - {str(e)}")
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
async def generate_codes_with_feedback(request: Request, request_body: GenerateCodesRequest):
    try:
        # Notify clients that the code generation process has started
        await manager.broadcast(f"Dataset {request_body.datasetId}: Code generation process started.")

        # Initialize LLMs
        llm1 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request_body.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]
            await manager.broadcast(f"Dataset {request_body.datasetId}: Processing post {post_id}...")

            try:
                # Fetch post and comments
                await manager.broadcast(f"Dataset {request_body.datasetId}: Fetching data for post {post_id}...")
                post_data = await run_blocking_function_with_disconnection(forcibleExecutor, request, get_post_with_comments, request_body.datasetId, post_id)

                # Generate transcript and context
                await manager.broadcast(f"Dataset {request_body.datasetId}: Generating transcript for post {post_id}...")
                transcript = await run_blocking_function_with_disconnection(forcibleExecutor, request, generate_transcript, post_data)
                context = await run_blocking_function_with_disconnection(forcibleExecutor, request, 
                    generate_context,
                    request_body.references,
                    request_body.mainCode,
                    request_body.flashcards,
                    request_body.selectedWords,
                )

                # Retry logic for LLM1
                retries = 3
                success = False
                result1 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM1 for post {post_id}...")
                        generation_prompt_1 = CodePrompts.generate(transcript, context)
                        result1 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm1.invoke, generation_prompt_1, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM1 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error generating with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: LLM1 failed for post {post_id} after multiple attempts."
                            )
                            raise e

                # Retry logic for LLM2
                retries = 3
                success = False
                result2 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM2 for post {post_id}...")
                        generation_prompt_2 = CodePrompts.generate(transcript, context)
                        result2 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm2.invoke, generation_prompt_2, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM2 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error generating with LLM2 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: LLM2 failed for post {post_id} after multiple attempts."
                            )
                            raise e

                # Retry logic for Validation (judge_llm)
                retries = 3
                success = False
                validation_result = None
                while retries > 0 and not success:
                    if retries != 3:
                        # await manager.broadcast(f"Dataset {request_body.datasetId}: Validating failed for post {post_id}. Retrying... ({3 - retries}/3)")
                        await asyncio.sleep(1)
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validating results with judge LLM for post {post_id}...")
                        validate_prompt = CodePrompts.judge_validate(
                            result1, result2, transcript, request_body.mainCode
                        )
                        validation_result = await run_blocking_function_with_disconnection(forcibleExecutor, request, judge_llm.invoke, validate_prompt, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validation completed for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Validation failed for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Validation failed for post {post_id} after multiple attempts."
                            )
                            raise e
                        continue

                    await asyncio.sleep(1)
                    # Parse validation results
                    match = re.search(
                        r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                        validation_result,
                    )

                    if not match:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Validation result parsing failed for post {post_id}."
                        )
                        # final_results.append({"unified_codebook": [], "recoded_transcript": []})
                        continue
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
                            await manager.broadcast(
                                f"Dataset {request_body.datasetId}: Post {post_id} processed successfully."
                            )
                        except json.JSONDecodeError as e:
                            retries -= 1
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Error parsing JSON validation results for post {post_id}."
                            )
                            continue
                            # raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

                    await asyncio.sleep(1)
                    # Remove processed post from the queue
                posts.pop(0)

            except Exception as e:
                await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error processing post {post_id} - {str(e)}.")
                posts.pop(0)

        # Notify clients that all posts have been processed
        await manager.broadcast(f"Dataset {request_body.datasetId}: All posts processed successfully.")
        return final_results if len(final_results) else []

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Unexpected error encountered - {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

class GenerateCodesWithFeedbackRequest(GenerateCodesRequest):
    feedback : list

@router.post("/generate-codes-with-feedback")
async def generate_codes_with_feedback(request: Request, request_body: GenerateCodesWithFeedbackRequest):
    try:
        # Notify clients that the process has started
        await manager.broadcast(f"Dataset {request_body.datasetId}: Code generation with feedback process started.")

        # Initialize LLMs
        llm1 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request_body.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]
            await manager.broadcast(f"Dataset {request_body.datasetId}: Processing post {post_id}...")

            try:
                # Fetch post and comments
                await manager.broadcast(f"Dataset {request_body.datasetId}: Fetching data for post {post_id}...")
                post_data = await run_blocking_function_with_disconnection(forcibleExecutor, request, get_post_with_comments, request_body.datasetId, post_id)

                # Generate transcript and context
                await manager.broadcast(f"Dataset {request_body.datasetId}: Generating transcript for post {post_id}...")
                transcript = await run_blocking_function_with_disconnection(forcibleExecutor, request, generate_transcript, post_data)
                context = await run_blocking_function_with_disconnection(forcibleExecutor, request, 
                    generate_context,
                    request_body.references,
                    request_body.mainCode,
                    request_body.flashcards,
                    request_body.selectedWords,
                )
                feedback_text = await run_blocking_function_with_disconnection(forcibleExecutor, request, generate_feedback, request_body.feedback)

                # Retry logic for LLM1
                retries = 3
                success = False
                result1 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM1 for post {post_id}...")
                        generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                        result1 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm1.invoke, generation_prompt_1, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM1 completed successfully for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error generating with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: LLM1 failed for post {post_id} after multiple attempts."
                            )
                            raise e

                # Retry logic for LLM2
                retries = 3
                success = False
                result2 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM2 for post {post_id}...")
                        generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                        result2 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm2.invoke, generation_prompt_2, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM2 completed successfully for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error generating with LLM2 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: LLM2 failed for post {post_id} after multiple attempts."
                            )
                            raise e

                # Retry logic for Validation (judge_llm)
                retries = 3
                success = False
                validation_result = None
                while retries > 0 and not success:
                    if retries != 3:
                        # await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Validation failed for post {post_id}. Retrying... ({3 - retries}/3)")
                        await asyncio.sleep(1)
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validating results for post {post_id}...")
                        validate_prompt = CodePrompts.judge_validate_with_feedback(
                            result1, result2, transcript, request_body.mainCode, feedback_text
                        )
                        validation_result = await run_blocking_function_with_disconnection(forcibleExecutor, request, judge_llm.invoke, validate_prompt, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validation completed for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Validation failed for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Validation failed for post {post_id} after multiple attempts."
                            )
                            raise e
                        continue

                    await asyncio.sleep(1)
                    # Parse validation results
                    match = re.search(
                        r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                        validation_result,
                    )

                    if not match:
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Validation result parsing failed for post {post_id}."
                        )
                        # final_results.append({"unified_codebook": [], "recoded_transcript": []})
                        retries -= 1
                        continue
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
                            await manager.broadcast(
                                f"Dataset {request_body.datasetId}: Post {post_id} processed successfully."
                            )
                        except json.JSONDecodeError as e:
                            retries -= 1
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Error parsing JSON validation results for post {post_id}."
                            )
                            continue
                            # raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
                    await asyncio.sleep(1)
                    # Remove processed post from the queue
                posts.pop(0)

            except Exception as e:
                await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error processing post {post_id} - {str(e)}.")
                posts.pop(0)

        # Notify clients that all posts have been processed
        await manager.broadcast(f"Dataset {request_body.datasetId}: All posts processed successfully.")
        return final_results if len(final_results) else []

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Unexpected error encountered - {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
# @router.post("/generate-codes-with-feedback")
# async def generate_codes_with_feedback(request: GenerateCodesWithFeedbackRequest):
#     try:
#         llm1 = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.9,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )
#         llm2 = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.2,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )
#         judge_llm = OllamaLLM(
#             model=request_body.model,
#             num_ctx=30000,
#             num_predict=30000,
#             temperature=0.5,
#             callbacks=[StreamingStdOutCallbackHandler()]
#         )

#         final_results = []

#         posts = request_body.selectedPosts
#         while len(posts) > 0:
#             # Fetch post and comments
#             post_id = posts[0]
#             # Fetch post and comments
#             post_data = get_post_with_comments(request_body.datasetId, post_id)
#             transcript = generate_transcript(post_data)
#             context = generate_context(
#                 request_body.references, 
#                 request_body.mainCode, 
#                 request_body.flashcards, 
#                 request_body.selectedWords
#             )
#             feedback_text = generate_feedback(request_body.feedback)

#             # Generate code with llm1
#             generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
#             result1 = llm1.invoke(generation_prompt_1)

#             # Generate code with llm2
#             generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
#             result2 = llm2.invoke(generation_prompt_2)

#             # Validate using judge_llm
#             validate_prompt = CodePrompts.judge_validate_with_feedback(
#                 result1, result2, transcript, request_body.mainCode, feedback_text
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
async def generate_codes_with_themes(request: Request, request_body: GenerateCodesWithThemesRequest):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {request_body.datasetId}: Code generation process started.")

        # Initialize LLMs
        llm1 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request_body.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]  # Only pop after all steps succeed

            # Notify clients about the current post
            await manager.broadcast(f"Dataset {request_body.datasetId}: Processing post {post_id}...")

            try:
                # Fetch post and comments
                await manager.broadcast(f"Dataset {request_body.datasetId}: Fetching data for post {post_id}...")
                post_data = await run_blocking_function_with_disconnection(forcibleExecutor, request, get_post_with_comments, request_body.datasetId, post_id)

                # Generate transcript and context
                await manager.broadcast(f"Dataset {request_body.datasetId}: Generating transcript for post {post_id}...")
                transcript = await run_blocking_function_with_disconnection(forcibleExecutor, request, generate_transcript, post_data)
                context = await run_blocking_function_with_disconnection(forcibleExecutor, request, 
                    generate_context_with_codebook,
                    request_body.references,
                    request_body.mainCode,
                    request_body.codeBook
                )

                # Initialize results for the post
                result1 = None
                result2 = None
                validation_result = None

                # Retry logic for LLM1
                retries = 3
                success = False
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM1 for post {post_id}...")
                        generation_prompt_1 = CodePrompts.generate(transcript, context)
                        result1 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm1.invoke, generation_prompt_1, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM1 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error generating code with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Failed to generate code with LLM1 for post {post_id} after multiple attempts."
                            )
                            raise e

                # Retry logic for LLM2
                retries = 3
                success = False
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM2 for post {post_id}...")
                        generation_prompt_2 = CodePrompts.generate(transcript, context)
                        result2 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm2.invoke, generation_prompt_2, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM2 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error generating code with LLM2 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Failed to generate code with LLM2 for post {post_id} after multiple attempts."
                            )
                            raise e

                # Retry logic for Validation (judge_llm)
                retries = 3
                success = False
                while retries > 0 and not success:
                    if retries != 3:
                        # await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Retrying validation for post {post_id}...")
                        await asyncio.sleep(1)
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validating results with judge LLM for post {post_id}...")
                        validate_prompt = CodePrompts.judge_validate(result1, result2, transcript, request_body.mainCode)
                        validation_result = await run_blocking_function_with_disconnection(forcibleExecutor, request, judge_llm.invoke, validate_prompt, timeout=180)

                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validation completed for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(
                            f"WARNING: Dataset {request_body.datasetId}: Error validating results for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)"
                        )
                        if retries == 0:
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Failed to validate results for post {post_id} after multiple attempts."
                            )
                            raise e
                        continue

                    await asyncio.sleep(1)
                    # Parse the validation results
                    match = re.search(
                        r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                        validation_result
                    )

                    if not match:
                        retries -= 1
                        # final_results.append({"unified_codebook": [], "recoded_transcript": []})
                        await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: No valid results found for post {post_id}.")
                        continue
                    else:
                        try:
                            unified_codebook = json.loads(match.group(1))
                            recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
                            final_results.append({
                                "unified_codebook": unified_codebook,
                                "recoded_transcript": recoded_transcript
                            })
                            success = True
                            await manager.broadcast(f"Dataset {request_body.datasetId}: Successfully processed post {post_id}.")
                        except json.JSONDecodeError as e:
                            retries -= 1
                            await manager.broadcast(
                                f"ERROR: Dataset {request_body.datasetId}: Error parsing validation results for post {post_id} - {str(e)}."
                            )
                            continue
                            # raise e

                    await asyncio.sleep(1)
                    # Pop the post only after all steps are completed
                posts.pop(0)

            except Exception as e:
                await manager.broadcast(
                    f"ERROR: Dataset {request_body.datasetId}: Error processing post {post_id} - {str(e)}."
                )
                posts.pop(0)
        
        # Notify clients that all posts are processed
        await manager.broadcast(f"Dataset {request_body.datasetId}: All posts processed successfully.")
        return final_results if len(final_results) else []

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error encountered - {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

class GenerateCodesWithThemesAndFeedbackRequest(GenerateCodesWithThemesRequest):
    feedback : list

@router.post("/generate-codes-with-themes-and-feedback")
async def generate_codes_with_themes_feedback(request: Request, request_body: GenerateCodesWithThemesAndFeedbackRequest):
    try:
        # Notify clients that processing has started
        await manager.broadcast(f"Dataset {request_body.datasetId}: Code generation with feedback process started.")

        # Initialize LLMs
        llm1 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.9,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        llm2 = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.2,
            callbacks=[StreamingStdOutCallbackHandler()]
        )
        judge_llm = OllamaLLM(
            model=request_body.model,
            num_ctx=30000,
            num_predict=30000,
            temperature=0.5,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        final_results = []
        posts = request_body.selectedPosts

        while len(posts) > 0:
            post_id = posts[0]

            # Notify clients about the current post
            await manager.broadcast(f"Dataset {request_body.datasetId}: Processing post {post_id}...")

            try:
                # Fetch post and comments
                await manager.broadcast(f"Dataset {request_body.datasetId}: Fetching data for post {post_id}...")
                post_data = await run_blocking_function_with_disconnection(forcibleExecutor, request, get_post_with_comments, request_body.datasetId, post_id)

                # Generate transcript, context, and feedback
                await manager.broadcast(f"Dataset {request_body.datasetId}: Generating transcript for post {post_id}...")
                transcript = await run_blocking_function_with_disconnection(forcibleExecutor, request, generate_transcript, post_data)

                context = await run_blocking_function_with_disconnection(forcibleExecutor, request, 
                    generate_context_with_codebook,
                    request_body.references,
                    request_body.mainCode,
                    request_body.codeBook
                )

                feedback_text = await run_blocking_function_with_disconnection(forcibleExecutor, request, generate_feedback, request_body.feedback)

                # Generate code with LLM1
                retries = 3
                success = False
                result1 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM1 for post {post_id}...")
                        generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                        result1 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm1.invoke, generation_prompt_1, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM1 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Error generating code with LLM1 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)")
                        if retries == 0:
                            await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Failed to generate code with LLM1 for post {post_id} after multiple attempts.")
                            raise e

                # Generate code with LLM2
                retries = 3
                success = False
                result2 = None
                while retries > 0 and not success:
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Generating with LLM2 for post {post_id}...")
                        generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
                        result2 = await run_blocking_function_with_disconnection(forcibleExecutor, request, llm2.invoke, generation_prompt_2, timeout=180)
                        success = True
                        await manager.broadcast(f"Dataset {request_body.datasetId}: LLM2 completed generation for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Error generating code with LLM2 for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)")
                        if retries == 0:
                            await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Failed to generate code with LLM2 for post {post_id} after multiple attempts.")
                            raise e

                # Validate results using judge LLM
                retries = 3
                success = False
                validation_result = None
                while retries > 0 and not success:
                    if retries != 3:
                        # await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Retrying validation for post {post_id}...")
                        await asyncio.sleep(1)
                    try:
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validating results with judge LLM for post {post_id}...")
                        validate_prompt = CodePrompts.judge_validate_with_feedback(
                            result1, result2, transcript, request_body.mainCode, feedback_text
                        )
                        validation_result = await run_blocking_function_with_disconnection(forcibleExecutor, request, judge_llm.invoke, validate_prompt, timeout=180)
                        await manager.broadcast(f"Dataset {request_body.datasetId}: Validation completed for post {post_id}.")
                    except Exception as e:
                        retries -= 1
                        await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: Error validating results for post {post_id} - {str(e)}. Retrying... ({3 - retries}/3)")
                        if retries == 0:
                            await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Failed to validate results for post {post_id} after multiple attempts.")
                            raise e
                        continue

                    await asyncio.sleep(1)
                    # Parse the validation results
                    match = re.search(
                        r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                        validation_result
                    )

                    if not match:
                        retries -= 1
                        # final_results.append({"unified_codebook": [], "recoded_transcript": []})
                        await manager.broadcast(f"WARNING: Dataset {request_body.datasetId}: No valid results found for post {post_id}.")
                        continue
                    else:
                        try:
                            unified_codebook = json.loads(match.group(1))
                            recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
                            final_results.append({
                                "unified_codebook": unified_codebook,
                                "recoded_transcript": recoded_transcript
                            })
                            success = True
                            await manager.broadcast(f"Dataset {request_body.datasetId}: Successfully processed post {post_id}.")
                        except json.JSONDecodeError as e:
                            retries -= 1
                            await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error parsing validation results for post {post_id} - {str(e)}.")
                            continue
                            # raise e
                    await asyncio.sleep(1)
                posts.pop(0)

            except Exception as e:
                await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error processing post {post_id} - {str(e)}.")
                posts.pop(0)

        # Notify clients that all posts are processed
        await manager.broadcast(f"Dataset {request_body.datasetId}: All posts processed successfully.")
        return final_results if len(final_results) else []

    except Exception as e:
        await manager.broadcast(f"ERROR: Dataset {request_body.datasetId}: Error encountered - {str(e)}")
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
#                 num_ctx=30000,
#                 num_predict=30000,
#                 temperature=0.9,
#                 callbacks=[
#                     StreamingStdOutCallbackHandler()
#                 ]
#             )
        
#         llm2 = OllamaLLM(
#                 model=request.model,
#                 num_ctx=30000,
#                 num_predict=30000,
#                 temperature=0.2,
#                 callbacks=[
#                     StreamingStdOutCallbackHandler()
#                 ]
#             )
        
#         judgeLLM = OllamaLLM(
#                 model=request.model,
#                 num_ctx=30000,
#                 num_predict=30000,
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
