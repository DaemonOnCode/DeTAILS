from models import ResearchQuestion
from .base_class import BaseRepository

class ResearchQuestionsRepository(BaseRepository[ResearchQuestion]):
    model = ResearchQuestion
    def __init__(self, *args, **kwargs):
        super().__init__("research_questions", ResearchQuestion, *args, **kwargs)
    

