from models import InterviewTurn
from .base_class import BaseRepository

class InterviewTurnsRepository(BaseRepository[InterviewTurn]):
    model = InterviewTurn
    def __init__(self, *args, **kwargs):
        super().__init__("interview_turns", InterviewTurn, *args, **kwargs)
    

