from .base_class import BaseRepository
from models import BackgroundJob

class BackgroundJobsRepository(BaseRepository[BackgroundJob]):
    model = BackgroundJob
    def __init__(self, *args, **kwargs):
        super().__init__("background_jobs", BackgroundJob, *args, **kwargs)
    

