class OllamaError(Exception):
    pass

class PullModelError(OllamaError):
    pass

class DeleteModelError(OllamaError):
    pass

class InvalidModelError(OllamaError):
    pass