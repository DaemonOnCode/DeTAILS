from errors.llm_errors import UnsupportedProviderError
from models.shared import LLMProvider
from services.llm_providers.google_provider import GoogleProvider
from services.llm_providers.ollama_provider import OllamaProvider
from services.llm_providers.openai_provider import OpenAIProvider
from services.llm_providers.vertexai_provider import VertexAIProvider


class LLMProviderFactory:
    def __init__(self, settings):
        self.settings = settings
        self.providers = {
            "vertexai": VertexAIProvider(settings),
            "google": GoogleProvider(settings),
            "openai": OpenAIProvider(settings),
            "ollama": OllamaProvider(settings),
        }

    def get_provider(self, provider_name: str) -> LLMProvider:
        if provider_name not in self.providers:
            raise UnsupportedProviderError(f"Unsupported provider: {provider_name}")
        return self.providers[provider_name]
    
    def check_provider(self, provider_name: str) -> bool:
        return provider_name in self.providers