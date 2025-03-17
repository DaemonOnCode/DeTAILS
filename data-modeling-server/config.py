from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

from pathlib import Path
import json

from constants import ACADEMIC_TORRENT_MAGNET, PATHS

class AppSettings:
    def __init__(self, id: str = "", **kwargs):
        self.id = id

class GeneralSettings:
    def __init__(self, theme: str = "light", language: str = "en", 
                 keepSignedIn: bool = False, manualCoding: bool = False, **kwargs):
        self.theme = theme
        self.language = language
        self.keepSignedIn = keepSignedIn
        self.manualCoding = manualCoding

class WorkspaceSettings:
    def __init__(self, layout: str = "grid", **kwargs):
        self.layout = layout

class AISettings:
    def __init__(self, model: str = "gemini-2.0-flash-thinking-exp-01-21", 
                 googleCredentialsPath: str = "", temperature: float = 0.0, 
                 randomSeed: int = 42, modelList: list[str] = [], textEmbedding: str = "text-embedding-005", **kwargs):
        self.model = model
        self.googleCredentialsPath = googleCredentialsPath
        self.temperature = temperature
        self.randomSeed = randomSeed
        self.modelList = modelList
        self.textEmbedding = textEmbedding

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
    def __init__(self, path: str = "", downloadDir: str = "", magnetLink: str = ACADEMIC_TORRENT_MAGNET, **kwargs):
        self.path = path
        self.downloadDir = downloadDir
        self.magnetLink = magnetLink

# Main Settings class that reads the file
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
    model_config = SettingsConfigDict(env_file=".env")

@lru_cache
def get_settings():
    return Settings()