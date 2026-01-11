from typing import Type
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
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
            creds, project_id = load_credentials_from_file(creds_path)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path

            if not project_id:
                project_id = os.getenv("VERTEX_PROJECT_ID")
                if not project_id:
                    raise ValueError("Vertex AI requires a PROJECT_ID in credentials file or .env")

            return ChatGoogleGenerativeAI(
                model=model_name,
                max_output_tokens=num_predict,
                temperature=temperature,
                callbacks=[StreamingStdOutCallbackHandler(), AllChainDetails()],
                project=project_id,
                convert_system_message_to_human=True
            )
        except Exception as e:
            raise LLMInitializationError(f"Failed to initialize VertexAI LLM for model '{model_name}': {str(e)}")

    def get_embeddings(self, model_name):
        try:
            creds_path = self.settings.ai.providers["vertexai"].credentialsPath
            if not creds_path or not os.path.exists(creds_path):
                raise ConfigurationError("Google application credentials not found or invalid")
            creds, project_id = load_credentials_from_file(creds_path)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path

            if not project_id:
                project_id = os.getenv("VERTEX_PROJECT_ID")
                if not project_id:
                    raise ValueError("Vertex AI requires a PROJECT_ID in credentials file or .env")

            print(model_name or self.settings.ai.providers["vertexai"].textEmbedding, "model_name")
            return GoogleGenerativeAIEmbeddings(
                model=model_name or self.settings.ai.providers["vertexai"].textEmbedding,
                project=project_id
            )
        except Exception as e:
            raise EmbeddingsInitializationError(f"Failed to initialize VertexAI embeddings for model '{model_name}': {str(e)}")
        
    def check_embedding_model(self, embedding_name: str):
        return super().check_embedding_model(embedding_name)
    
    def check_model(self, model_name: str):
        return super().check_model(model_name)