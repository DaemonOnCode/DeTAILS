class RequestError(Exception):
    def __init__(self, status_code: int = 400, message: str = "Bad Request"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

