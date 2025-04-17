from models import PipelineStep
from .base_class import BaseRepository

class PipelineStepsRepository(BaseRepository[PipelineStep]):
    model = PipelineStep

    def __init__(self, *args, **kwargs):
        super().__init__("pipeline_steps", PipelineStep, *args, **kwargs)

    def get_step_progress(self, run_id: str, step_label: str) -> PipelineStep:
        return self.find_one({"run_id": run_id, "step_label": step_label})

    def update_step_progress(self, run_id: str, step_label: str, updates: dict):
        return self.update({"run_id": run_id, "step_label": step_label}, updates)

    def delete_steps_for_run(self, run_id: str):
        return self.delete({"run_id": run_id})
