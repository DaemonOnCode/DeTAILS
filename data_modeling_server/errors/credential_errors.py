class CredentialError(Exception):
    pass

class MissingCredentialError(CredentialError):
    pass

class InvalidCredentialError(CredentialError):
    pass