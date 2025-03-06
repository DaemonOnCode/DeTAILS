from models import FileStatus
from .base_class import BaseRepository

class FileStatusRepository(BaseRepository[FileStatus]):
    model = FileStatus

    def __init__(self):
        super().__init__("file_status", FileStatus)

    def get_file_progress(self, run_id: str, file_name: str) -> FileStatus:
        return self.find_one({"run_id": run_id, "file_name": file_name})

    def update_file_progress(self, run_id: str, file_name: str, updates: dict):
        return self.update({"run_id": run_id, "file_name": file_name}, updates)

    def delete_files_for_run(self, run_id: str):
        return self.delete({"run_id": run_id})
