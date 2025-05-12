import json
from config import CustomSettings
from errors.llm_errors import InvalidModelFormatError, UnsupportedEmbeddingModelError, UnsupportedModelError
from services.llm_providers.llm_provider_factory import LLMProviderFactory 

class LangchainLLMService:
    def __init__(self):
        self.settings = CustomSettings()
        self.provider_factory = LLMProviderFactory(self.settings)

    def _extract_provider_and_model(self, model: str):
        try:
            provider, model_name = model.split("-", 1)
            return provider, model_name
        except ValueError:
            raise InvalidModelFormatError(f"Invalid model format: {model}. Expected format: <provider>-<model_name>")

    def is_model_supported(self, model: str):
        provider, model_name = self._extract_provider_and_model(model)
        if not provider or not model_name:
            return False
        if not self.provider_factory.check_provider(provider):
            return False
        if not self.provider_factory.get_provider(provider).check_model(model_name):
            return False
        return True
    
    def is_embedding_model_supported(self, embedding_model: str):
        if not embedding_model:
            return False
        return True

    def get_llm_and_embeddings(self, model: str, num_ctx=None, num_predict=None, temperature=None, random_seed=None):
        print(f"Initializing LLM and embeddings for model '{model}'")
        if not self.is_model_supported(model):
            raise UnsupportedModelError(f"Model '{model}' is not supported")
        print(f"Initializing LLM and embeddings for model '{model}'")
        provider_name, model_name = self._extract_provider_and_model(model)
        print(f"Provider: {provider_name}, Model: {model_name}")
        if not provider_name == "ollama" and not self.is_embedding_model_supported(self.settings.ai.providers[provider_name].textEmbedding):
            raise UnsupportedEmbeddingModelError(f"Embedding model '{self.settings.ai.providers[provider_name].textEmbedding}' is not supported")

        provider_instance = self.provider_factory.get_provider(provider_name)

        num_ctx = num_ctx or (128_000 if "gemini" not in model else 1_000_000)
        num_predict = num_predict or 8_000
        temperature = temperature if temperature is not None else (self.settings.ai.temperature if self.settings.ai.temperature >= 0 else 0.6)
        random_seed = random_seed if random_seed is not None else (self.settings.ai.randomSeed or 42)

        if num_ctx <= 0:
            raise ValueError("Context length (num_ctx) must be a positive integer")
        if num_predict <= 0:
            raise ValueError("Prediction length (num_predict) must be a positive integer")
        if not (0.0 <= temperature <= 1.0):
            raise ValueError("Temperature must be between 0.0 and 1.0 inclusive")
        if random_seed < 0:
            raise ValueError("Random seed must be a non-negative integer")

        llm = provider_instance.get_llm(model_name, num_ctx, num_predict, temperature, random_seed)
        if provider_name == "ollama":
            embeddings = provider_instance.get_embeddings(model_name)
        else:
            embeddings = provider_instance.get_embeddings(self.settings.ai.providers[provider_name].textEmbedding)
        print(f"Initialized LLM and embeddings for model '{model}'")
        return llm, embeddings
    
def get_llm_service():
    return LangchainLLMService()