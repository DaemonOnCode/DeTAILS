import os
import sys

APP_NAME = "details"



EXECUTABLE_FOLDER = "../executables"

TRANSMISSION_DOWNLOAD_DIR = "../transmission-downloads"
ACADEMIC_TORRENT_MAGNET = "magnet:?xt=urn:btih:ba051999301b109eab37d16f027b3f49ade2de13&tr=https%3A%2F%2Facademictorrents.com%2Fannounce.php&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce"
TRANSMISSION_RPC_URL = "http://localhost:9091/transmission/rpc"


RANDOM_SEED = 42

def get_app_data_path() -> str:
    """
    Returns the platform-specific base directory for application data.
    """
    if os.name == 'nt': 
        return os.getenv("APPDATA") or os.path.expanduser("~\\AppData\\Roaming")
    elif os.name == 'posix':
        if os.uname().sysname.lower() == "darwin":
            return os.path.expanduser("~/Library/Application Support")
        return os.getenv("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    else:
        return os.getcwd()

UPLOAD_DIR = os.path.join(get_app_data_path(), APP_NAME, "executables", "uploaded_jsons")
DATASETS_DIR = os.path.join(get_app_data_path(), APP_NAME, "executables", "datasets")
CONTEXT_FILES_DIR = os.path.join(get_app_data_path(), APP_NAME, "executables", "context_files")
DATABASE_DIR = os.path.join(get_app_data_path(), APP_NAME, "executables", "databases")
DATABASE_PATH = os.path.join(DATABASE_DIR, "main.db")
STUDY_DATABASE_PATH = os.path.join(DATABASE_DIR, "study.db")
LOG_FILE = os.path.join(get_app_data_path(), APP_NAME, "executables", "logs.jsonl")
TEMP_DIR = os.path.join(get_app_data_path(), APP_NAME, "executables", "temp")

exe_ext = ".exe" if os.name == "nt" else ""

PATHS = {
    "settings": os.path.join(get_app_data_path(), APP_NAME, "settings.json"),
    "executables": {
        "ripgrep": os.path.join(get_app_data_path(), APP_NAME, "executables", "ripgrep", f"rg{exe_ext}"),
        "zstd": os.path.join(get_app_data_path(), APP_NAME, "executables", "zstd", f"zstd{exe_ext}"),
    },
    "transmission": os.path.join(get_app_data_path(), APP_NAME, "executables", "transmission_downloads"),
}

def get_default_transmission_cmd():
    """Returns the default transmission command based on the current platform."""
    if sys.platform.startswith("win"):
        # Default for Windows
        transmission_exe = r"C:\Program Files\Transmission\transmission-daemon.exe"
        return [transmission_exe, "--foreground"]
    elif sys.platform.startswith("darwin"):
        # Default for macOS
        return [
            "/opt/homebrew/opt/transmission-cli/bin/transmission-daemon",
            "--foreground",
            # "--config-dir", "/opt/homebrew/var/transmission/"
        ]
    else:
        # Default for Linux/Unix
        return [
            "/usr/bin/transmission-daemon",
            "--foreground",
            # "--config-dir", os.path.expanduser("~/.config/transmission/")
        ]