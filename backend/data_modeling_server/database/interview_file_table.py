from models import InterviewFile
from .base_class import BaseRepository

class InterviewFilesRepository(BaseRepository[InterviewFile]):
    model = InterviewFile
    def __init__(self, *args, **kwargs):
        super().__init__("interview_files", InterviewFile, *args, **kwargs)

