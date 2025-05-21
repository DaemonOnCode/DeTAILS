import json
from multiprocessing import Process
import multiprocessing
import os
import signal
import sys
import uvicorn


from constants import DATASETS_DIR, PATHS
from database import (
    initialize_database, WorkspacesRepository,
    WorkspaceStatesRepository, DatasetsRepository,
    PostsRepository, CommentsRepository,
    LlmResponsesRepository, FileStatusRepository,
    PipelineStepsRepository, TorrentDownloadProgressRepository,
    QectRepository, FunctionProgressRepository,
    LlmPendingTaskRepository, LlmFunctionArgsRepository,
    SelectedPostIdsRepository, CodingContextRepository,
    ContextFilesRepository, ResearchQuestionsRepository,
)
from constants import PATHS, get_default_transmission_cmd


def set_initial_settings():
    try:
        with open(PATHS["settings"], "r") as f:
            content = f.read().strip()
            settings = json.loads(content) if content else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return
    transmission = settings.get("transmission", {})
    if not transmission.get("downloadDir"):
        transmission["downloadDir"] = PATHS["transmission"]
    if not transmission.get("path"):
        transmission["path"] = get_default_transmission_cmd()[0]
    settings["transmission"] = transmission
    with open(PATHS["settings"], "w") as f:
        json.dump(settings, f, indent=4)


set_initial_settings()


initialize_database([
    WorkspacesRepository, WorkspaceStatesRepository,
    DatasetsRepository, PostsRepository, CommentsRepository,
    LlmResponsesRepository, TorrentDownloadProgressRepository,
    FileStatusRepository, PipelineStepsRepository,
    FunctionProgressRepository, QectRepository,
    LlmPendingTaskRepository, LlmFunctionArgsRepository,
    SelectedPostIdsRepository, CodingContextRepository,
    ContextFilesRepository, ResearchQuestionsRepository,
])
FunctionProgressRepository().delete({}, all=True)
TorrentDownloadProgressRepository().delete({}, all=True)

def run_http():
    uvicorn.run(
        "app_http:app", 
        port=8080,
        # reload=True,
        reload=False,
        workers=3,  
    )

def run_ws():
    uvicorn.run(
        "app_ws:app", 
        port=8081,
        reload=False
    )

if __name__ == "__main__":
    os.makedirs(DATASETS_DIR, exist_ok=True)
    os.makedirs(PATHS["transmission"], exist_ok=True)

    # if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    multiprocessing.freeze_support()
    if sys.platform.startswith("win"):
        multiprocessing.set_start_method("spawn")
    else:
        multiprocessing.set_start_method("fork")

    

    p_http = Process(target=run_http, name="http-server")
    p_http.start()

    p_ws = Process(target=run_ws, name="ws-server")
    p_ws.start()

    def shutdown(signum, frame):
        print("Shutting down child processes…")
        for p in (p_http, p_ws):
            if p.is_alive():
                p.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    if sys.platform.startswith("win"):
        signal.signal(signal.SIGBREAK, shutdown)
    else:
        signal.signal(signal.SIGQUIT, shutdown)
        signal.signal(signal.SIGHUP,  shutdown)

    try:
        while True:
            p_http.join(timeout=1)
            p_ws.join(timeout=1)
            if not p_http.is_alive() and not p_ws.is_alive():
                break
    except KeyboardInterrupt:
        shutdown(None, None)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(0)
