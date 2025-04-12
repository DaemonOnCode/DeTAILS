from abc import ABC, abstractmethod
from typing import Any

class LLMProvider(ABC):
    @abstractmethod
    def get_llm(self, model_name: str, num_ctx, num_predict, temperature, random_seed) -> Any:
        pass

    @abstractmethod
    def get_embeddings(self, embedding_name: str) -> Any:
        pass

    @abstractmethod
    def check_model(self, model_name: str):
        return True

    @abstractmethod
    def check_embedding_model(self, embedding_name: str):
        return True