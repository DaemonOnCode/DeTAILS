from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
import json
from typing import Any, Dict, Optional, get_type_hints

@dataclass
class BaseDataclass:
    """Base class for all dataclasses."""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default) if key in self.keys() else default

    def keys(self):
        return get_type_hints(self.__class__).keys()

    def values(self):
        return {key: getattr(self, key) for key in self.keys()}.values()

    def items(self):
        return {key: getattr(self, key) for key in self.keys()}.items()
    
    def __iter__(self):
        return iter(self.keys())

    def __len__(self):
        return len(self.keys())

    def __repr__(self):
        return f"{self.__class__.__name__}({self.to_dict()})"

    def __getitem__(self, key: str) -> Any:
        if key in self.keys():
            return getattr(self, key)
        raise KeyError(f"{key} not found in {self.__class__.__name__}")

    def __setitem__(self, key: str, value: Any):
        if key in self.keys():
            expected_type = get_type_hints(self.__class__).get(key, None)
            if expected_type and not isinstance(value, expected_type):
                raise TypeError(f"Expected type {expected_type} for {key}, but got {type(value)}")
            setattr(self, key, value)
        else:
            raise KeyError(f"{key} not found in {self.__class__.__name__}")

    def __delitem__(self, key: str):
        if key in self.keys():
            setattr(self, key, None)
        else:
            raise KeyError(f"{key} not found in {self.__class__.__name__}")

    def update(self, updates: Dict[str, Any]):
        for key, value in updates.items():
            if key in self.keys():
                expected_type = get_type_hints(self.__class__).get(key, None)
                if expected_type and not isinstance(value, expected_type):
                    raise TypeError(f"Expected type {expected_type} for {key}, but got {type(value)}")
                setattr(self, key, value)
            else:
                raise KeyError(f"{key} not found in {self.__class__.__name__}")

    def setdefault(self, key: str, default: Any):
        if key in self.keys():
            if getattr(self, key) is None:
                self[key] = default
            return self[key]
        raise KeyError(f"{key} not found in {self.__class__.__name__}")

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, self.__class__):
            return False
        for key in self.keys():
            if self[key] != other[key]:
                return False
        return True

    def __ne__(self, other: Any) -> bool:
        return not self.__eq__(other)

class DataClassEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, BaseDataclass):
            return obj.to_dict()
        return super().default(obj)

@dataclass
class Workspace(BaseDataclass):
    id: str = field(metadata={"not_null": True})
    name: str = field(metadata={"not_null": True})
    user_email: str = field(metadata={"not_null": True})
    description: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class WorkspaceState(BaseDataclass):
    user_email: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"primary_key": True, "foreign_key": "workspaces(id)"})
    # Loading Context
    page_state: Optional[str] = None
    # Metadata
    updated_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class SelectedPostId(BaseDataclass):
    workspace_id: str = field(metadata={"primary_key": True, "foreign_key": "workspaces(id)"})
    post_id: str = field(metadata={"primary_key": True, "foreign_key": "posts(id)"})
    type: Optional[str] = field(metadata={"not_null": True}, default="ungrouped")  # "sampled" or "unseen" corresponding to sampledPostReponse, unseenPostResponse Responses or "ungrouped"

@dataclass
class Dataset(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    name: str = field(metadata={"not_null": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    description: Optional[str] = None
    file_path: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class Post(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"primary_key": True,"foreign_key": "workspaces(id)", "not_null": True})
    title: str = field(metadata={"not_null": True})
    over_18: Optional[int] = None
    subreddit: Optional[str] = None
    score: Optional[int] = field(default=0)
    thumbnail: Optional[str] = None
    permalink: Optional[str] = None
    is_self: Optional[int] = None
    domain: Optional[str] = None
    created_utc: Optional[int] = None
    url: Optional[str] = None
    num_comments: Optional[int] = None
    selftext: Optional[str] = None
    author: Optional[str] = None
    hide_score: Optional[int] = None
    subreddit_id: Optional[str] = None


@dataclass
class Comment(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"primary_key": True,"foreign_key": "workspaces(id)", "not_null": True})
    post_id: str = field(metadata={"primary_key": True, "foreign_key": "posts(id)", "not_null": True})
    parent_id: Optional[str] = field(metadata={"primary_key": True})
    body: Optional[str] = None
    author: Optional[str] = None
    created_utc: Optional[int] = None
    link_id: Optional[str] = None
    controversiality: Optional[int] = None
    score_hidden: Optional[int] = None
    score: Optional[int] = None
    subreddit_id: Optional[str] = None
    retrieved_on: Optional[int] = None
    gilded: Optional[int] = None


@dataclass
class LlmResponse(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    model: str = field(metadata={"not_null": True})
    post_id: str = field(metadata={"foreign_key": "posts(id)"})
    response: str = field(metadata={"not_null": True})
    function_id: str = field(metadata={"not_null": True})
    additional_info: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class TorrentDownloadProgress(BaseDataclass):
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)", "primary_key": True})
    run_id: str = field(metadata={"not_null": True})
    subreddit: str = field(metadata={"not_null": True})
    start_month: str = field(metadata={"not_null": True})
    end_month: str = field(metadata={"not_null": True})
    files_already_downloaded: Optional[str] = field(default="[]") 
    status: str = field(metadata={"not_null": True}, default="idle")  # idle, in-progress, complete, error
    progress: Optional[float] = field(default=0.0)  
    completed_files: Optional[int] = field(default=0)  
    total_files: Optional[int] = field(default=0)  
    messages: Optional[str] = field(default="[]")  
    created_at: Optional[datetime] = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class PipelineStep(BaseDataclass):
    run_id: str = field(metadata={"not_null": True, "primary_key": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    step_label: str = field(metadata={"primary_key": True})  # e.g., Metadata, Downloading, Parsing
    status: str = field(default="idle")  # idle, in-progress, complete, error
    progress: Optional[float] = field(default=0.0)
    messages: Optional[str] = field(default="[]")  
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class FileStatus(BaseDataclass):
    run_id: str = field(metadata={"not_null": True, "primary_key": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    file_name: str = field(metadata={"primary_key": True})  
    status: str = field(default="in-progress") 
    progress: Optional[float] = field(default=0.0)  
    completed_bytes: Optional[int] = field(default=0)  
    total_bytes: Optional[int] = field(default=0)  
    messages: Optional[str] = field(default="[]") 
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class FunctionProgress(BaseDataclass):
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    name: Optional[str] = field(metadata={"not_null": True, "primary_key": True})
    function_id: str = field(metadata={"not_null": True})
    status: str = field(default="idle")
    current: Optional[int] = field(default=0)
    total: Optional[int] = field(default=0)

class GenerationType(Enum):
    INITIAL = "initial"
    LATEST = "latest"

class ResponseCreatorType(Enum):
    HUMAN = "Human"
    LLM = "LLM"

class CodebookType(Enum):
    INITIAL = "initial"
    FINAL = "final"
    INITIAL_COPY = "initial_copy"

@dataclass
class QectResponse(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    model: str = field(metadata={"not_null": True})
    quote: str = field(metadata={"not_null": True})
    code: str = field(metadata={"foreign_key": "subcodes(id)", "not_null": True})
    explanation: str = field(metadata={"not_null": True})
    post_id: str = field(metadata={"foreign_key": "posts(id)"})
    codebook_type: str = field(metadata={"not_null": True})
    response_type: str = field(metadata={"not_null": True})
    theme_id: Optional[str] = field(metadata={"foreign_key": "themes(id)"}, default=None)
    grouped_code_id: Optional[str] = field(metadata={"foreign_key": "grouped_codes(id)"}, default=None)
    chat_history: Optional[str] = field(default="[]")
    created_at: Optional[datetime] = field(default_factory=datetime.now)
    is_marked: Optional[bool] = field(default=True)
    range_marker: Optional[str] = None
    source: Optional[str] = None

    
@dataclass
class LlmPendingTask(BaseDataclass):
    task_id: str = field(metadata={"primary_key": True})  
    status: str = field(metadata={"not_null": True})      # Status: 'pending', 'in-progress', 'completed', 'failed'
    function_key: str = field(metadata={"not_null": True})  
    args_json: str = field(metadata={"not_null": True})     
    kwargs_json: str = field(metadata={"not_null": True})   
    result_json: Optional[str] = None                      
    error: Optional[str] = None                            
    created_at: datetime = field(default_factory=datetime.now)  
    started_at: Optional[datetime] = None                      
    completed_at: Optional[datetime] = None

@dataclass
class LlmFunctionArgs(BaseDataclass):
    function_key: str = field(metadata={"primary_key": True, "not_null": True})
    args_json: Optional[str] = None
    kwargs_json: Optional[str] = None


@dataclass
class ErrorLog(BaseDataclass):
    type: str = field(metadata={"not_null": True})
    message: str = field(metadata={"not_null": True})
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})
    traceback: Optional[str] = None
    context: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class StateDump(BaseDataclass):
    state: str = field(metadata={"not_null": True})
    context: Optional[str] = None
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})
    created_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class BackgroundJob(BaseDataclass):
    job_id: int = field(metadata={"primary_key": True, "auto_increment": True})
    status: str = field(metadata={"not_null": True})
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class CodingContext(BaseDataclass):
    id: str = field(metadata={"foreign_key": "workspaces(id)", "not_null": True, "primary_key": True})
    main_topic: Optional[str] = None
    additional_info: Optional[str] = None
    

@dataclass
class ContextFile(BaseDataclass):
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    file_path: str = field(metadata={"not_null": True})
    file_name: str = field(metadata={"not_null": True})
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})

@dataclass
class ResearchQuestion(BaseDataclass):
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    question: str = field(metadata={"not_null": True})
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})

@dataclass
class Concept(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    word: str = field(metadata={"not_null": True})

@dataclass
class SelectedConcept(BaseDataclass):
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    concept_id: str = field(metadata={"primary_key": True, "foreign_key": "concepts(id)"})
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})


@dataclass
class ConceptEntry(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    word: str = field(metadata={"not_null": True})
    description: Optional[str] = None
    is_marked: Optional[bool] = field(default=True)


@dataclass
class InitialCodebookEntry(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    code: str = field(metadata={"not_null": True})
    definition: Optional[str] = None

@dataclass
class GroupedCodeEntry(BaseDataclass):
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    code: Optional[str] = None
    higher_level_code: Optional[str] = None
    higher_level_code_id: Optional[str] = None
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})

@dataclass
class ThemeEntry(BaseDataclass):
    coding_context_id: str = field(metadata={"foreign_key": "coding_context(id)", "not_null": True})
    higher_level_code: Optional[str] = None
    theme: Optional[str] = None
    theme_id: Optional[str] = None
    id: Optional[int] = field(default=None, metadata={"primary_key": True, "auto_increment": True})

@dataclass
class CollectionContext(BaseDataclass):
    id: str = field(metadata={"foreign_key": "workspaces(id)", "not_null": True, "primary_key": True})
    type: Optional[str] = None
    metadata: Optional[str] = None
    mode_input: Optional[str] = None
    data_filters: Optional[str] = None
    is_locked: bool = False