from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Dict, Optional, get_type_hints


# T = TypeVar("T", bound="BaseDataclass")

@dataclass
class BaseDataclass:
    """Base class for all dataclasses with dictionary-like behavior."""

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
        """Check if two dataclass instances are equal based on string values."""
        if not isinstance(other, self.__class__):
            return False
        for key in self.keys():
            if self[key] != other[key]:
                return False
        return True

    def __ne__(self, other: Any) -> bool:
        """Check if two dataclass instances are not equal."""
        return not self.__eq__(other)

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
    workspace_id: str = field(metadata={"primary_key": True})
    
    # Collection Context
    dataset_id: Optional[str] = None
    mode_input: Optional[str] = None
    selected_data : Optional[str] = None
    metadata: Optional[str] = None
    type: Optional[str] = None
    data_filters: Optional[str] = None

    # Modeling Context
    models: Optional[str] = None  # JSON string for list

    # Coding Context
    main_topic: Optional[str] = None
    additional_info: Optional[str] = None
    context_files: Optional[str] = None  # JSON string for dict
    keywords: Optional[str] = None  # JSON string for list
    selected_keywords: Optional[str] = None  # JSON string for list
    keyword_table: Optional[str] = None  # JSON string for list
    references_data: Optional[str] = None  # JSON string for dict
    themes: Optional[str] = None  # JSON string for list
    grouped_codes: Optional[str] = None  # JSON string for list
    research_questions: Optional[str] = None  # JSON string for list
    sampled_post_responses: Optional[str] = None  # JSON string for list
    sampled_post_with_themes_responses: Optional[str] = None  # JSON string for list
    unseen_post_response: Optional[str] = None  # JSON string for list
    unplaced_codes: Optional[str] = None  # JSON string for list
    unplaced_subcodes: Optional[str] = None  # JSON string for list
    sampled_post_ids: Optional[str] = None  # JSON string for list
    unseen_post_ids: Optional[str] = None  # JSON string for list
    conflicting_responses: Optional[str] = None  # JSON string for list

    # Metadata
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class Rule(BaseDataclass):
    dataset_id: str = field(metadata={"not_null": True})
    step: int = field(metadata={"not_null": True})
    fields: str = field(metadata={"not_null": True})
    words: str = field(metadata={"not_null": True})
    action: str = field(metadata={"not_null": True})
    id: str = field(metadata={"primary_key": True})
    pos: Optional[str] = None


@dataclass
class TokenStat(BaseDataclass):
    dataset_id: str = field(metadata={"primary_key": True})
    removed_tokens: Optional[str] = None
    included_tokens: Optional[str] = None


@dataclass
class TokenStatDetailed(BaseDataclass):
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    token: str = field(metadata={"primary_key": True})
    status: str = field(metadata={"primary_key": True})
    pos: Optional[str] = None
    count_words: Optional[int] = None
    count_docs: Optional[int] = None
    tfidf_min: Optional[float] = None
    tfidf_max: Optional[float] = None


@dataclass
class Model(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)"})
    model_name: Optional[str] = None
    method: Optional[str] = None
    topics: Optional[str] = None
    started_at: Optional[datetime] = field(default_factory=datetime.now)
    finished_at: Optional[datetime] = None
    num_topics: Optional[int] = None
    stage: Optional[str] = None


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
    dataset_id: str = field(metadata={"primary_key": True,"foreign_key": "datasets(id)", "not_null": True})
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
    dataset_id: str = field(metadata={"primary_key": True,"foreign_key": "datasets(id)", "not_null": True})
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
class TokenizedPost(BaseDataclass):
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    post_id: str = field(metadata={"primary_key": True, "foreign_key": "posts(id)"})
    title: Optional[str] = None
    selftext: Optional[str] = None


@dataclass
class TokenizedComment(BaseDataclass):
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    comment_id: str = field(metadata={"primary_key": True, "foreign_key": "comments(id)"})
    body: Optional[str] = None


@dataclass
class LlmResponse(BaseDataclass):
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)"})
    model: str = field(metadata={"not_null": True})
    post_id: str = field(metadata={"foreign_key": "posts(id)"})
    response: str = field(metadata={"not_null": True})
    function_id: str = field(metadata={"not_null": True})
    additional_info: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class Token(BaseDataclass):
    count: int
    doc_id: str = field(metadata={"primary_key": True}),
    token: str = field(metadata={"primary_key": True}),
    pos: str = field(metadata={"primary_key": True}),

@dataclass
class Tfidf(BaseDataclass):
    tfidf_min: float
    tfidf_max: float
    token: str = field(metadata={"primary_key": True})

@dataclass
class TempTokenStat(BaseDataclass):
    status: str = field(metadata={"primary_key": True})
    count_words: int
    count_docs: int
    tfidf_min: float
    tfidf_max: float
    dataset_id: str = field(metadata={"primary_key": True}),
    token: str = field(metadata={"primary_key": True}),
    pos: str = field(metadata={"primary_key": True}),

@dataclass
class TorrentDownloadProgress(BaseDataclass):
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)", "primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)", "primary_key": True})
    run_id: str = field(metadata={"not_null": True})
    status: str = field(metadata={"not_null": True}, default="idle")  # idle, in-progress, complete, error
    progress: Optional[float] = field(default=0.0)  # Overall percentage
    completed_files: Optional[int] = field(default=0)  # Number of completed files
    total_files: Optional[int] = field(default=0)  # Total files to process
    messages: Optional[str] = field(default="[]")  # JSON-encoded list of messages
    created_at: Optional[datetime] = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class PipelineStep(BaseDataclass):
    run_id: str = field(metadata={"not_null": True, "primary_key": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)"})
    step_label: str = field(metadata={"primary_key": True})  # e.g., Metadata, Downloading, Parsing
    status: str = field(default="idle")  # idle, in-progress, complete, error
    progress: Optional[float] = field(default=0.0)  # 0 to 100
    messages: Optional[str] = field(default="[]")  # JSON list of messages
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class FileStatus(BaseDataclass):
    run_id: str = field(metadata={"not_null": True, "primary_key": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)"})
    file_name: str = field(metadata={"primary_key": True})  # Unique per run
    status: str = field(default="in-progress")  # in-progress, extracting, complete, error
    progress: Optional[float] = field(default=0.0)  # Percentage completed
    completed_bytes: Optional[int] = field(default=0)  # Downloaded bytes
    total_bytes: Optional[int] = field(default=0)  # Total file size
    messages: Optional[str] = field(default="[]")  # JSON-encoded list of messages
    updated_at: Optional[datetime] = field(default_factory=datetime.now)
