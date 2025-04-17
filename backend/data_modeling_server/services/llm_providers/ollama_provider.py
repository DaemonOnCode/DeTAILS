from typing import Type
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.callbacks import StreamingStdOutCallbackHandler

from config import CustomSettings
from errors.llm_errors import EmbeddingsInitializationError, LLMInitializationError
from models.shared import LLMProvider
from utils.llm_logger import AllChainDetails

class OllamaProvider(LLMProvider):
    def __init__(self, settings: CustomSettings):
        self.settings = settings

    def get_llm(self, model_name, num_ctx, num_predict, temperature, random_seed):
        try:
            return ChatOllama(
                model=model_name,
                num_ctx=num_ctx,
                num_predict=num_predict,
                temperature=temperature,
                seed=random_seed,
                callbacks=[StreamingStdOutCallbackHandler(), AllChainDetails()]
            )
        except Exception as e:
            raise LLMInitializationError(f"Failed to initialize Ollama LLM for model '{model_name}': {str(e)}")

    def get_embeddings(self, model_name):
        try:
            return OllamaEmbeddings(model=model_name)
        except Exception as e:
            raise EmbeddingsInitializationError(f"Failed to initialize Ollama embeddings for model '{model_name}': {str(e)}")
        
    def check_embedding_model(self, embedding_name: str):
        return super().check_embedding_model(embedding_name)
    
    def check_model(self, model_name: str):
        return super().check_model(model_name)