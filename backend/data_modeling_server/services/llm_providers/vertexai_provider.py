from typing import Type
from langchain_google_vertexai import ChatVertexAI, VertexAIEmbeddings
from langchain_core.callbacks import StreamingStdOutCallbackHandler
from google.auth import load_credentials_from_file
import os

from config import CustomSettings
from errors.llm_errors import ConfigurationError, EmbeddingsInitializationError, LLMInitializationError
from models.shared import LLMProvider
from utils.llm_logger import AllChainDetails

from langchain_core.globals import set_debug
set_debug(True)

class VertexAIProvider(LLMProvider):
    def __init__(self, settings: CustomSettings):
        self.settings = settings

    def get_llm(self, model_name, num_ctx, num_predict, temperature, random_seed):
        try:
            creds_path = self.settings.ai.providers["vertexai"].credentialsPath
            if not creds_path or not os.path.exists(creds_path):
                raise ValueError("Google application credentials not found or invalid")
            self.creds, self.project_id = load_credentials_from_file(creds_path)
            return ChatVertexAI(
                model_name=model_name,
                num_ctx=num_ctx,
                num_predict=num_predict,
                temperature=temperature,
                seed=random_seed,
                callbacks=[StreamingStdOutCallbackHandler(), AllChainDetails()],
                credentials=self.creds,
                project=self.project_id
            )
        except Exception as e:
            raise LLMInitializationError(f"Failed to initialize VertexAI LLM for model '{model_name}': {str(e)}")

    def get_embeddings(self, model_name):
        try:
            creds_path = self.settings.ai.providers["vertexai"].credentialsPath
            if not creds_path or not os.path.exists(creds_path):
                raise ConfigurationError("Google application credentials not found or invalid")
            self.creds, self.project_id = load_credentials_from_file(creds_path)

            print(model_name or self.settings.ai.providers["vertexai"].textEmbedding, "model_name")
            return VertexAIEmbeddings(
                model=model_name or self.settings.ai.providers["vertexai"].textEmbedding,
                credentials=self.creds,
                project=self.project_id
            )
        except Exception as e:
            raise EmbeddingsInitializationError(f"Failed to initialize VertexAI embeddings for model '{model_name}': {str(e)}")
        
    def check_embedding_model(self, embedding_name: str):
        return super().check_embedding_model(embedding_name)
    
    def check_model(self, model_name: str):
        return super().check_model(model_name)