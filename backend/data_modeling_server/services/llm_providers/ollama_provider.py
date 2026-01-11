import re
from typing import Any, List, Optional
from langchain_core.callbacks import CallbackManagerForLLMRun, AsyncCallbackManagerForLLMRun
from langchain_core.outputs import LLMResult, Generation
from langchain_ollama import ChatOllama, OllamaEmbeddings, OllamaLLM
from langchain_core.callbacks import StreamingStdOutCallbackHandler

from config import CustomSettings
from errors.llm_errors import EmbeddingsInitializationError, LLMInitializationError
from models.shared import LLMProvider
from utils.llm_logger import AllChainDetails

class CleanOllamaLLM(OllamaLLM):
    def _clean_content(self, content: str) -> str:
        return re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

    def _generate(
        self,
        prompts: List[str],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> LLMResult:
        result = super()._generate(prompts, stop, run_manager, **kwargs)
        for i, gens in enumerate(result.generations):
            for j, gen in enumerate(gens):
                result.generations[i][j].text = self._clean_content(result.generations[i][j].text)
        return result

    async def _agenerate(
        self,
        prompts: List[str],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> LLMResult:
        result = await super()._agenerate(prompts, stop, run_manager, **kwargs)
        for i, gens in enumerate(result.generations):
            for j, gen in enumerate(gens):
                result.generations[i][j].text = self._clean_content(result.generations[i][j].text)
        return result

class OllamaProvider(LLMProvider):
    def __init__(self, settings: CustomSettings):
        self.settings = settings

    def get_llm(self, model_name, num_ctx, num_predict, temperature, random_seed):
        try:
            return CleanOllamaLLM(
                model=model_name,
                num_ctx=min(num_ctx, 8192),
                num_predict=min(num_predict, 8192),
                temperature=temperature,
                callbacks=[StreamingStdOutCallbackHandler(), AllChainDetails()]
            )
        except Exception as e:
            raise LLMInitializationError(f"Failed to initialize Ollama LLM for model '{model_name}': {str(e)}")

    def get_embeddings(self, model_name):
        try:
            print(model_name or self.settings.ai.providers["ollama"].textEmbedding, "model_name")
            return OllamaEmbeddings(model=self.settings.ai.providers['ollama'].textEmbedding or model_name)
        except Exception as e:
            raise EmbeddingsInitializationError(f"Failed to initialize Ollama embeddings for model '{model_name}': {str(e)}")
        
    def check_embedding_model(self, embedding_name: str):
        return super().check_embedding_model(embedding_name)
    
    def check_model(self, model_name: str):
        return super().check_model(model_name)