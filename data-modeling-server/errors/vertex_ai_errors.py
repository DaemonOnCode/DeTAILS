class VertexAIError(Exception):
    pass

class InvalidTextEmbeddingError(VertexAIError):
    pass

class InvalidGenAIModelError(VertexAIError):
    pass