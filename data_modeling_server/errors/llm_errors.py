class LLMError(Exception):
    pass

class UnsupportedProviderError(LLMError):
    pass

class UnsupportedModelError(LLMError):
    pass

class UnsupportedEmbeddingModelError(LLMError):
    pass

class InvalidModelFormatError(LLMError):
    pass

class InitializationError(LLMError):
    pass

class LLMInitializationError(InitializationError):
    pass

class EmbeddingsInitializationError(InitializationError):
    pass

class ConfigurationError(LLMError):
    pass