from typing import Type
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.callbacks import StreamingStdOutCallbackHandler

from config import CustomSettings
from errors.llm_errors import ConfigurationError, EmbeddingsInitializationError, LLMInitializationError
from models.shared import LLMProvider
from utils.llm_logger import AllChainDetails

class OpenAIProvider(LLMProvider):
    def __init__(self, settings: CustomSettings):
        self.settings = settings

    def get_llm(self, model_name, num_ctx, num_predict, temperature, random_seed):
        try:
            if not self.settings.ai.providers["openai"].apiKey:
                raise ConfigurationError("OpenAI API key is not set in settings")
            return ChatOpenAI(
                model=model_name,
                max_tokens=num_predict,
                temperature=temperature,
                seed=random_seed,
                callbacks=[StreamingStdOutCallbackHandler(), AllChainDetails()],
                api_key=self.settings.ai.providers["openai"].apiKey
            )
        except Exception as e:
            raise LLMInitializationError(f"Failed to initialize OpenAI LLM for model '{model_name}': {str(e)}")

    def get_embeddings(self, model_name):
        try:
            if not self.settings.ai.providers["openai"].apiKey:
                raise ConfigurationError("OpenAI API key is not set in settings")
            return OpenAIEmbeddings(
                model=model_name or self.settings.ai.providers["openai"].textEmbedding,
                api_key=self.settings.ai.providers["openai"].apiKey
            )
        except Exception as e:
            raise EmbeddingsInitializationError(f"Failed to initialize OpenAI embeddings for model '{model_name}': {str(e)}")
        
    def check_embedding_model(self, embedding_name: str):
        return super().check_embedding_model(embedding_name)
    
    def check_model(self, model_name: str):
        return super().check_model(model_name)