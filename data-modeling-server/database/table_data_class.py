from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Generic, List, Optional, Type, TypeVar


@dataclass
class Workspace:
    id: str = field(metadata={"not_null": True})
    name: str = field(metadata={"not_null": True})
    user_email: str = field(metadata={"not_null": True})
    description: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class WorkspaceState:
    user_email: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"primary_key": True})
    
    # Collection Context
    dataset_id: Optional[str] = None
    mode_input: Optional[str] = None
    subreddit: Optional[str] = None
    selected_posts: Optional[str] = None  # JSON string for list

    # Modeling Context
    models: Optional[str] = None  # JSON string for list

    # Coding Context
    main_code: Optional[str] = None
    additional_info: Optional[str] = None
    context_files: Optional[str] = None  # JSON string for dict
    keywords: Optional[str] = None  # JSON string for list
    selected_keywords: Optional[str] = None  # JSON string for list
    keyword_table: Optional[str] = None  # JSON string for list
    references_data: Optional[str] = None  # JSON string for dict
    themes: Optional[str] = None  # JSON string for list
    research_questions: Optional[str] = None  # JSON string for list
    sampled_post_responses: Optional[str] = None  # JSON string for list
    sampled_post_with_themes_responses: Optional[str] = None  # JSON string for list
    unseen_post_response: Optional[str] = None  # JSON string for list
    unplaced_codes: Optional[str] = None  # JSON string for list
    sampled_post_ids: Optional[list] = None  # JSON string for list
    unseen_post_ids: Optional[list] = None  # JSON string for list

    # Metadata
    updated_at: Optional[datetime] = field(default_factory=datetime.now)

@dataclass
class Rule:
    dataset_id: str = field(metadata={"not_null": True})
    step: int = field(metadata={"not_null": True})
    fields: str = field(metadata={"not_null": True})
    words: str = field(metadata={"not_null": True})
    action: str = field(metadata={"not_null": True})
    id: Optional[int] = field(metadata={"primary_key": True})
    pos: Optional[str] = None


@dataclass
class TokenStat:
    dataset_id: str = field(metadata={"primary_key": True})
    removed_tokens: Optional[str] = None
    included_tokens: Optional[str] = None


@dataclass
class TokenStatDetailed:
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    token: str = field(metadata={"primary_key": True})
    status: str = field(metadata={"primary_key": True})
    pos: Optional[str] = None
    count_words: Optional[int] = None
    count_docs: Optional[int] = None
    tfidf_min: Optional[float] = None
    tfidf_max: Optional[float] = None


@dataclass
class Model:
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
class Dataset:
    id: str = field(metadata={"primary_key": True})
    name: str = field(metadata={"not_null": True})
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    description: Optional[str] = None
    file_path: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class Post:
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)", "not_null": True})
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
class Comment:
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)", "not_null": True})
    post_id: str = field(metadata={"foreign_key": "posts(id)", "not_null": True})
    body: Optional[str] = None
    author: Optional[str] = None
    created_utc: Optional[int] = None
    parent_id: Optional[str] = None
    controversiality: Optional[int] = None
    score_hidden: Optional[int] = None
    score: Optional[int] = None
    subreddit_id: Optional[str] = None
    retrieved_on: Optional[int] = None
    gilded: Optional[int] = None


@dataclass
class TokenizedPost:
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    post_id: str = field(metadata={"primary_key": True, "foreign_key": "posts(id)"})
    title: Optional[str] = None
    selftext: Optional[str] = None


@dataclass
class TokenizedComment:
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    comment_id: str = field(metadata={"primary_key": True, "foreign_key": "comments(id)"})
    body: Optional[str] = None


@dataclass
class LlmResponse:
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)"})
    model: str = field(metadata={"not_null": True})
    post_id: str = field(metadata={"foreign_key": "posts(id)"})
    response: str = field(metadata={"not_null": True})
    function_id: str = field(metadata={"not_null": True})
    additional_info: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)




T = TypeVar("T")  # Generic type for any dataclass


@dataclass
class BasePlural(Generic[T]):
    items: List[T]  # Stores multiple instances of a dataclass

    def __init__(self, *args: T):
        """Allow passing multiple objects directly without wrapping in a list."""
        self.items = list(args)  # Convert args to list

    def to_list(self) -> List[dict]:
        """Convert list of dataclass objects to a list of dictionaries"""
        return [asdict(item) for item in self.items]

    @classmethod
    def from_list(cls, data_list: List[dict]) -> "BasePlural[T]":
        """Convert a list of dictionaries to a list of dataclass instances"""
        return cls(*(cls.item_type(**data) for data in data_list))

    @classmethod
    def item_type(cls) -> Type[T]:
        """Must be overridden in subclasses to specify the model type"""
        raise NotImplementedError("Subclasses must define item_type()")
    

@dataclass
class Workspaces(BasePlural[Workspace]):
    @classmethod
    def item_type(cls) -> Type[Workspace]:
        return Workspace
    
@dataclass
class WorkspaceStates(BasePlural[WorkspaceState]):
    @classmethod
    def item_type(cls) -> Type[WorkspaceState]:
        return WorkspaceState
    
@dataclass
class Rules(BasePlural[Rule]):
    @classmethod
    def item_type(cls) -> Type[Rule]:
        return Rule
    
@dataclass
class TokenStats(BasePlural[TokenStat]):
    @classmethod
    def item_type(cls) -> Type[TokenStat]:
        return TokenStat

@dataclass
class TokenStatsDetailed(BasePlural[TokenStatDetailed]):
    @classmethod
    def item_type(cls) -> Type[TokenStatDetailed]:
        return TokenStatDetailed

@dataclass
class Models(BasePlural[Model]):
    @classmethod
    def item_type(cls) -> Type[Model]:
        return Model
    
@dataclass
class Datasets(BasePlural[Dataset]):
    @classmethod
    def item_type(cls) -> Type[Dataset]:
        return Dataset
    
@dataclass
class Posts(BasePlural[Post]):
    @classmethod
    def item_type(cls) -> Type[Post]:
        return Post
    
@dataclass
class Comments(BasePlural[Comment]):
    @classmethod
    def item_type(cls) -> Type[Comment]:
        return Comment
    
@dataclass
class TokenizedPosts(BasePlural[TokenizedPost]):
    @classmethod
    def item_type(cls) -> Type[TokenizedPost]:
        return TokenizedPost
    
@dataclass
class TokenizedComments(BasePlural[TokenizedComment]):
    @classmethod
    def item_type(cls) -> Type[TokenizedComment]:
        return TokenizedComment
    
@dataclass
class LlmResponses(BasePlural[LlmResponse]):
    @classmethod
    def item_type(cls) -> Type[LlmResponse]:
        return LlmResponse
    
