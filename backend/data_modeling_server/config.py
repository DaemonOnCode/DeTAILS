from functools import lru_cache
from typing import List, TypedDict, Union, Dict
from pydantic_settings import BaseSettings, SettingsConfigDict

from pathlib import Path
import json

from constants import PATHS

class AppSettings:
    def __init__(self, id: str = "", **kwargs):
        self.id = id

class GeneralSettings:
    def __init__(self, theme: str = "light", language: str = "en", 
                 keepSignedIn: bool = False, **kwargs):
        self.theme = theme
        self.language = language
        self.keepSignedIn = keepSignedIn

class WorkspaceSettings:
    def __init__(self, layout: str = "grid", **kwargs):
        self.layout = layout

class GoogleProviderSettings:
    def __init__(self, name: str = "Google", apiKey: str = "", modelList: list[str] = None, textEmbedding: str = "text-embedding-005", **kwargs):
        self.name = name
        self.apiKey = apiKey
        self.modelList = modelList if modelList is not None else []
        self.textEmbedding = textEmbedding

class OpenAIProviderSettings:
    def __init__(self, name: str = "OpenAI", apiKey: str = "", modelList: list[str] = None, textEmbedding: str = "", **kwargs):
        self.name = name
        self.apiKey = apiKey
        self.modelList = modelList if modelList is not None else []
        self.textEmbedding = textEmbedding

class VertexAIProviderSettings:
    def __init__(self, name: str = "Google Vertex AI", credentialsPath: str = "", modelList: list[str] = None, textEmbedding: str = "text-embedding-005", **kwargs):
        self.name = name
        self.credentialsPath = credentialsPath
        self.modelList = modelList if modelList is not None else []
        self.textEmbedding = textEmbedding

class OllamaProviderSettings:
    def __init__(self, name: str = "Ollama", modelList: list[str] = None, textEmbedding: str = "", **kwargs):
        self.name = name
        self.modelList = modelList if modelList is not None else []
        self.textEmbedding: str = textEmbedding

class APIKeyProviderDict(TypedDict):
    apiKey: str
    modelList: List[str]
    textEmbedding: str

class CredentialsProviderDict(TypedDict):
    credentialsPath: str
    modelList: List[str]
    textEmbedding: str

class OllamaProviderDict(TypedDict, total=False):
    modelList: List[str]
    textEmbedding: str

ProviderValue = Union[APIKeyProviderDict, CredentialsProviderDict, OllamaProviderDict]

class AISettings:
    def __init__(self, model: str = "", providers: Dict[str, ProviderValue] = None, temperature: float = 0.0, randomSeed: int = 42, cutoff: int = 300, **kwargs):
        self.model = model
        self.providers = {}
        if providers is not None:
            if "google" in providers:
                self.providers["google"] = GoogleProviderSettings(**providers["google"])
            if "openai" in providers:
                self.providers["openai"] = OpenAIProviderSettings(**providers["openai"])
            if "vertexai" in providers:
                self.providers["vertexai"] = VertexAIProviderSettings(**providers["vertexai"])
            if "ollama" in providers:
                self.providers["ollama"] = OllamaProviderSettings(**providers["ollama"])
        self.temperature = temperature
        self.randomSeed = randomSeed
        self.cutoff = cutoff

class DevtoolsSettings:
    def __init__(self, showConsole: bool = False, enableRemoteDebugging: bool = False, **kwargs):
        self.showConsole = showConsole
        self.enableRemoteDebugging = enableRemoteDebugging

class TutorialsSettings:
    def __init__(self, showGlobal: bool = True, skipPages: list = None, 
                 hasRun: bool = False, **kwargs):
        self.showGlobal = showGlobal
        self.skipPages = skipPages if skipPages is not None else []
        self.hasRun = hasRun

class TransmissionSettings:
    def __init__(self, path: str = "", downloadDir: str = "", magnetLink: str = "", fallbackMagnetLink: str = "", **kwargs):
        self.path = path
        self.downloadDir = downloadDir
        self.magnetLink = magnetLink
        self.fallbackMagnetLink = fallbackMagnetLink


class CustomSettings:
    def __init__(self):
        json_path = Path(PATHS["settings"])
        if not json_path.exists():
            raise FileNotFoundError(f"Settings file {json_path} not found")

        try:
            with json_path.open("r") as f:
                settings_dict = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in settings file: {e}")

        self.app = AppSettings(**settings_dict.get("app", {}))
        self.general = GeneralSettings(**settings_dict.get("general", {}))
        self.workspace = WorkspaceSettings(**settings_dict.get("workspace", {}))
        self.ai = AISettings(**settings_dict.get("ai", {}))
        self.devtools = DevtoolsSettings(**settings_dict.get("devtools", {}))
        self.tutorials = TutorialsSettings(**settings_dict.get("tutorials", {}))
        self.transmission = TransmissionSettings(**settings_dict.get("transmission", {}))


class Settings(BaseSettings):
    google_application_credentials: str
    model_config = SettingsConfigDict(env_file=".env", extra = "allow")

@lru_cache
def get_settings():
    return Settings()