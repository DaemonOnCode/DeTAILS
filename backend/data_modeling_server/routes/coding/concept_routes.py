import json
import time
from typing import List
from uuid import uuid4
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile

from controllers.coding_controller import initialize_vector_store, process_llm_task, save_context_files, summarize_codebook_explanations
from database import (
    CodingContextRepository,
    ResearchQuestionsRepository,
    ConceptEntriesRepository,
    ConceptsRepository,
    SelectedConceptsRepository
)
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from ipc import send_ipc_message
from models.coding_models import GenerateConceptDefinitionsRequest, RegenerateConceptsRequest
from models.table_dataclasses import Concept, ConceptEntry, DataClassEncoder, SelectedConcept
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from routes.websocket_routes import manager
from utils.prompts import ConceptOutline, ContextPrompt

router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])


concept_entries_repo = ConceptEntriesRepository()
coding_context_repo = CodingContextRepository()
research_question_repo = ResearchQuestionsRepository()
concepts_repo = ConceptsRepository()
selected_concepts_repo = SelectedConceptsRepository()


@router.post("/build-context-from-topic")
async def build_context_from_interests_endpoint(
    request: Request,
    contextFiles: List[UploadFile],
    model: str = Form(...),
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    workspace_id = request.headers.get("x-workspace-id")
    workspace_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing started.")

    llm, embeddings = llm_service.get_llm_and_embeddings(model)

    print("Initialize vector store")
    vector_store = initialize_vector_store(workspace_id, model, embeddings)
    await save_context_files(app_id, workspace_id, contextFiles, vector_store)

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Creating retriever...")
    retriever = vector_store.as_retriever(search_kwargs={'k': 20})

    input_text = ContextPrompt.context_builder(mainTopic, researchQuestions, additionalInfo)

    parsed_concepts = await process_llm_task(
        app_id=app_id,
        workspace_id=request.headers.get("x-workspace-id"),
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

    if isinstance(parsed_concepts, list):
        parsed_concepts = {"concepts": parsed_concepts}

    concepts_list = parsed_concepts.get("concepts", [])

    concepts_with_ids = [Concept(
        id=str(uuid4()),
        word=word.get("word"),
        coding_context_id=workspace_id,
    ) for word in concepts_list]

    main_topic_id = str(uuid4())
    concepts_with_ids.append(Concept(
        id=main_topic_id,
        word=mainTopic,
        coding_context_id=workspace_id,
    ))
    
    concepts_repo.insert_batch(concepts_with_ids)
    selected_concepts_repo.insert(
        SelectedConcept(
            concept_id=main_topic_id,
            coding_context_id=workspace_id,
        )
    )
    
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing complete.")
    return {
        "message": "Context built successfully!",   
    }

def batch_list(lst, batch_size):
    for i in range(0, len(lst), batch_size):
        yield lst[i:i + batch_size]

@router.post("/generate-definitions")
async def generate_definitions_endpoint(
    request: Request,
    request_body: GenerateConceptDefinitionsRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    workspace_id = request.headers.get("x-workspace-id")
    model = request_body.model
    coding_context = coding_context_repo.find_one({"id": workspace_id})

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    concepts = concepts_repo.find({"coding_context_id": workspace_id})
    selected_concepts = list(map(lambda x: x.concept_id, selected_concepts_repo.find({"coding_context_id": workspace_id})))

    words = set(list(map(lambda x: x.word, filter(lambda x: x.id in selected_concepts, concepts))))


    if not len(words):
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing started.")
    
    llm, embeddings = llm_service.get_llm_and_embeddings(model)
    
    vector_store = initialize_vector_store(workspace_id, model, embeddings)

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Creating retriever...")
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
            parsed_output = {"concepts": parsed_output}

        results.extend(parsed_output.get("concepts", []))
        print("Parsed output:", parsed_output)

        concept_entries = [
            ConceptEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                word=entry.get("word"),
                description=entry.get("description"),
                is_marked=True
            )
            for entry in results
        ]

        try:
            concept_entries_repo.delete({"coding_context_id": workspace_id})
        except Exception as e:
            print(e)

        concept_entries_repo.insert_batch(concept_entries)
    
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing complete.")
    
    return {
        "message": "Definitions generated successfully!",
    }

@router.post("/regenerate-concepts")
async def regenerate_concepts_endpoint(
    request: Request,
    request_body: RegenerateConceptsRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    workspace_id = request.headers.get("x-workspace-id")
    workspace_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    concepts = concepts_repo.find({"coding_context_id": workspace_id})
    selected_concepts = list(map(lambda x: x.concept_id, selected_concepts_repo.find({"coding_context_id": workspace_id})))

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Regenerating concepts with feedback...")

    llm, embeddings = llm_service.get_llm_and_embeddings(request_body.model)

    vector_store = initialize_vector_store(workspace_id, request_body.model, embeddings)
    retriever = vector_store.as_retriever(search_kwargs={'k': 50})

    selected_words = list(map(lambda x: x.word, filter(lambda x: x.id in selected_concepts, concepts)))
    unselected_words = list(map(lambda x: x.word, filter(lambda x: x.id not in selected_concepts, concepts)))


    parsed_concepts = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```", 
        rag_prompt_builder_func=ContextPrompt.regenerationPromptTemplate, 
        retriever=retriever, 
        parent_function_name="regenerate-concepts",
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
        selectedConcepts=selected_words,
        unselectedConcepts=unselected_words,
        extraFeedback=request_body.extraFeedback,
    )

    if isinstance(parsed_concepts, list):
        parsed_concepts = {"concepts": parsed_concepts}

    concepts_repo.delete({"coding_context_id": workspace_id, "word": ("NOT IN", selected_words)})
    concepts_list = parsed_concepts.get("concepts", [])
    concepts_with_ids = [Concept(
        id=str(uuid4()),
        word=word.get("word"),
        coding_context_id=workspace_id,
    ) for word in concepts_list]

    concepts_repo.insert_batch(concepts_with_ids)

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing complete.")

    return {
        "message": "Concepts regenerated successfully!",
    }
