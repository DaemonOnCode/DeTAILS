from fastapi import APIRouter, HTTPException

from schemas import TextData
from utils.topic_modeling import lda_topic_modeling, biterm_topic_modeling, nnmf_topic_modeling, bert_topic_modeling, llm_topic_modeling

router = APIRouter()

@router.post("/lda/")
def lda_topic_model(data: TextData):
    try:
        topics = lda_topic_modeling(data.documents, data.num_topics)
        return {"method": "LDA", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/biterm/")
def biterm_topic_model(data: TextData):
    try:
        topics = biterm_topic_modeling(data.documents, data.num_topics)
        return {"method": "Biterm", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nnmf/")
def nnmf_topic_model(data: TextData):
    try:
        topics = nnmf_topic_modeling(data.documents, data.num_topics)
        return {"method": "NNMF", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bertopic/")
def bert_topic_model(data: TextData):
    try:
        topics = bert_topic_modeling(data.documents, data.num_topics)
        return {"method": "BERTopic", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llm/")
def llm_topic_model(data: TextData):
    try:
        topics = llm_topic_modeling(data.documents, data.num_topics)
        return {"method": "LLM", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
