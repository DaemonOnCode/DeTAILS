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
from utils.coding_helpers import generate_context, generate_feedback, generate_transcript

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
    retry: bool = Form(False)  # Retry flag
):
    try:
        # Initialize embeddings and vector store
        print("Model: ", model)
        embeddings = OllamaEmbeddings(model=model)
        chroma_client = HttpClient(host = "localhost",
               port= 8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        # Process uploaded files
        for file in basisFiles:
            print(f"Processing file: {file.filename}")
            # Read the file content
            file_content = await file.read()
            file_name = file.filename

            # Save the file locally (optional)
            temp_file_path = f"./temp_files/{time.time()}_{file_name}"
            os.makedirs("./temp_files", exist_ok=True)
            with open(temp_file_path, "wb") as temp_file:
                temp_file.write(file_content)

            # Load the document using PyPDFLoader (or adjust for other file types)
            loader = PyPDFLoader(temp_file_path)
            docs = loader.load()

            # Split documents into chunks and add them to the vector store
            chunks = text_splitter.split_documents(docs)
            vector_store.add_documents(chunks)

            # Remove the temporary file after processing (optional)
            os.remove(temp_file_path)

        print("Documents added successfully to Chroma vector store.")
        # return {
        #     "message": "Documents added successfully to Chroma vector store.",
        #     "model": model,
        #     "mainCode": mainCode,
        #     "additionalInfo": additionalInfo,
        #     "retry": retry
        # }

        retriever = vector_store.as_retriever()

        print("Retriever created")

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateFlashcards)),
            ("human", "{input}")
        ])

        print("Prompt template created")

        llm = OllamaLLM(
                model=model,
                num_ctx=8192,
                num_predict=8192,
                temperature=0.3,
                callbacks=[
                    StreamingStdOutCallbackHandler()
                ]
            )
        print("Prompt template created")
        # Create the question-answer chain
        question_answer_chain = create_stuff_documents_chain(
            llm=llm,
            prompt=prompt_template,
        )

        print("Question-answer chain created")

        # Create the RAG chain
        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )

        print("RAG chain created")
        # Generate flashcards
        input_text = prompts.flashcardTemplate(mainCode, additionalInfo)

        print("Generating flashcards...")
        results = rag_chain.invoke({"input": input_text})

        print("Flashcards generated")

        print("Results: ", results)

        # Parse the results to extract flashcards
        regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"flashcards\"\s*:\s*\[(?P<flashcards>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\s*\])(?:\n```)?"

        flashcards_match = re.search(regex, results["answer"], re.DOTALL)
        if not flashcards_match:
            return {"flashcards": []}

        if flashcards_match.group("flashcards"):
            flashcards = flashcards_match.group("flashcards")
            parsed_flashcards = json.loads(f'{flashcards}')['flashcards']
        else:
            flashcards = flashcards_match.group("standalone")
            parsed_flashcards = json.loads(f'{{"flashcards": [{flashcards}]}}')["flashcards"]
        return {
            "message": "Documents processed and flashcards generated successfully.",
            "flashcards": parsed_flashcards,
        }

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error processing documents: {str(e)}")

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

@router.post("/generate-additional-flashcards")
async def generate_additional_flashcards(request: GenerateFlashcardsRequest):
    try:
        # Initialize retriever
        embeddings = OllamaEmbeddings(model=request.model)
        chroma_client = HttpClient(host = "localhost", port= 8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        retriever = vector_store.as_retriever()

        print("Retriever created")

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "\n".join(prompts.systemTemplateFlashcards)),
            ("human", "{input}")
        ])

        print("Prompt template created")

        llm = OllamaLLM(
                model=request.model,
                num_ctx=8192,
                num_predict=8192,
                temperature=0.3,
                callbacks=[
                    StreamingStdOutCallbackHandler()
                ]
            )
        print("Prompt template created")
        # Create the question-answer chain
        question_answer_chain = create_stuff_documents_chain(
            llm=llm,
            prompt=prompt_template,
        )

        print("Question-answer chain created")

        # Create the RAG chain
        rag_chain = create_retrieval_chain(
            retriever=retriever, combine_docs_chain=question_answer_chain
        )

        print("RAG chain created")
        # Generate flashcards
        input_text = prompts.flashcardRegenerationTemplate(request.mainCode, request.additionalInfo, request.feedback, request.flashcards)

        print("Generating flashcards...")
        results = rag_chain.invoke({"input": input_text})

        print("Flashcards generated")

        print("Results: ", results)

        # Parse the results to extract flashcards
        regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"flashcards\"\s*:\s*\[(?P<flashcards>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\]\s*\}|\[\s*(?P<standalone>(?:\{\s*\"question\"\s*:\s*\".*?\"\s*,\s*\"answer\"\s*:\s*\".*?\"\s*\},?\s*)+)\s*\])(?:\n```)?"

        flashcards_match = re.search(regex, results["answer"], re.DOTALL)
        if not flashcards_match:
            return {"flashcards": []}

        if flashcards_match.group("flashcards"):
            flashcards = flashcards_match.group("flashcards")
            parsed_flashcards = json.loads(f'{flashcards}')['flashcards']
        else:
            flashcards = flashcards_match.group("standalone")
            parsed_flashcards = json.loads(f'{{"flashcards": [{flashcards}]}}')["flashcards"]
        return {
            "message": "Documents processed and flashcards generated successfully.",
            "flashcards": parsed_flashcards,
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class GenerateWordsRequest(BaseModel):
    model: str
    mainCode: str
    flashcards: List[dict[str, str]] | None = None
    regenerate: bool = False
    selectedWords: List[str] = []
    feedback: str = ""

@router.post("/generate-words")
async def generate_words(request: GenerateWordsRequest):
    try:
        # Initialize retriever
        embeddings = OllamaEmbeddings(model=request.model)
        chroma_client = HttpClient(host = "localhost", port= 8000)
        vector_store = Chroma(embedding_function=embeddings, collection_name="a-test-collection", client=chroma_client)
        retriever = vector_store.as_retriever()

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
        # Generate flashcards
        input_text = prompts.wordCloudTemplate(request.mainCode, request.flashcards) if not request.regenerate else prompts.wordCloudRegenerationTemplate(request.mainCode, request.selectedWords, request.feedback)
        
        print("Generating flashcards...")
        results = rag_chain.invoke({"input": input_text})

        print("Flashcards generated")

        print("Results: ", results)

        # Parse the results to extract flashcards
        regex = r"(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*\"words\"\s*:\s*\[(?P<words>(?:\s*\".*?\"\s*,?)*?)\s*\}|\[\s*(?P<standalone>(?:\s*\".*?\"\s*,?)*?)\s*\])(?:\n```)?"

        words_match = re.search(regex, results["answer"], re.DOTALL)
        if not words_match:
            return {"words": []}

        if words_match.group("words"):
            words = words_match.group("words")
            parsed_words = json.loads(f'{words}')['words']
        else:
            words = words_match.group("standalone")
            parsed_words = json.loads(f'{{"words": [{words}]}}')["words"]
        return {
            "message": "Documents processed and words generated successfully.",
            "words": parsed_words,
        }
    except Exception as e:
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
async def generate_codes(request: GenerateCodesRequest):
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

        for post_id in request.selectedPosts:
            # Fetch post and comments
            post_data = get_post_with_comments(request.datasetId,post_id)
            transcript = generate_transcript(post_data)
            context = generate_context(
                request.references, 
                request.mainCode, 
                request.flashcards, 
                request.selectedWords
            )

            # Generate code with llm1
            generation_prompt_1 = CodePrompts.generate(transcript, context)
            result1 = llm1.invoke(generation_prompt_1)

            # Generate code with llm2
            generation_prompt_2 = CodePrompts.generate(transcript, context)
            result2 = llm2.invoke(generation_prompt_2)

            # Validate using judge_llm
            validate_prompt = CodePrompts.judge_validate(result1, result2, transcript, request.mainCode)
            validation_result = judge_llm.invoke(validate_prompt)

            # Parse the validation results
            match = re.search(
                r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                validation_result
            )

            if not match:
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
            else:
                try:
                    unified_codebook = json.loads(match.group(1))
                    recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
                    final_results.append({
                        "unified_codebook": unified_codebook,
                        "recoded_transcript": recoded_transcript
                    })
                except json.JSONDecodeError as e:
                    print("Inside JSONDecodeError", e)
                    raise HTTPException(status_code=500, detail=f"Error parsing JSON: {str(e)}")

        return final_results

    except Exception as e:
        print("Inside Exception", e)
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

        for post_id in request.selectedPosts:
            # Fetch post and comments
            post_data = get_post_with_comments(request.datasetId, post_id)
            transcript = generate_transcript(post_data)
            context = generate_context(
                request.references, 
                request.mainCode, 
                request.flashcards, 
                request.selectedWords
            )
            feedback_text = generate_feedback(request.feedback)

            # Generate code with llm1
            generation_prompt_1 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
            result1 = llm1.invoke(generation_prompt_1)

            # Generate code with llm2
            generation_prompt_2 = CodePrompts.generate_with_feedback(transcript, context, feedback_text)
            result2 = llm2.invoke(generation_prompt_2)

            # Validate using judge_llm
            validate_prompt = CodePrompts.judge_validate_with_feedback(
                result1, result2, transcript, request.mainCode, feedback_text
            )
            validation_result = judge_llm.invoke(validate_prompt)

            # Parse the validation results
            match = re.search(
                r'(?:```json\s*)?\{\s*"unified_codebook":\s*(\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(\[[\s\S]*?\])?\s*\}?',
                validation_result
            )

            if not match:
                final_results.append({"unified_codebook": [], "recoded_transcript": []})
            else:
                try:
                    unified_codebook = json.loads(match.group(1))
                    recoded_transcript = json.loads(match.group(2)) if match.group(2) else []
                    final_results.append({
                        "unified_codebook": unified_codebook,
                        "recoded_transcript": recoded_transcript
                    })
                except json.JSONDecodeError as e:
                    print("Inside JSONDecodeError", e)
                    raise HTTPException(status_code=500, detail=f"Error parsing JSON: {str(e)}")

        return final_results

    except Exception as e:
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
