from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Workspaces:
    id: str = field(metadata={"not_null": True})
    name: str = field(metadata={"not_null": True})
    description: Optional[str] = None
    user_email: str = field(metadata={"not_null": True})
    created_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class WorkspaceStates:
    user_email: str = field(metadata={"primary_key": True})
    workspace_id: str = field(metadata={"primary_key": True})
    dataset_id: Optional[str] = None
    mode_input: Optional[str] = None
    subreddit: Optional[str] = None
    selected_posts: Optional[str] = None
    models: Optional[str] = None
    main_code: Optional[str] = None
    additional_info: Optional[str] = None
    context_files: Optional[str] = None
    keywords: Optional[str] = None
    selected_keywords: Optional[str] = None
    codebook: Optional[str] = None
    references_data: Optional[str] = None
    code_responses: Optional[str] = None
    final_code_responses: Optional[str] = None
    updated_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class Rules:
    id: Optional[int] = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"not_null": True})
    step: int = field(metadata={"not_null": True})
    fields: str = field(metadata={"not_null": True})
    words: str = field(metadata={"not_null": True})
    pos: Optional[str] = None
    action: str = field(metadata={"not_null": True})


@dataclass
class TokenStats:
    dataset_id: str = field(metadata={"primary_key": True})
    removed_tokens: Optional[str] = None
    included_tokens: Optional[str] = None


@dataclass
class TokenStatsDetailed:
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    token: str = field(metadata={"primary_key": True})
    pos: Optional[str] = None
    count_words: Optional[int] = None
    count_docs: Optional[int] = None
    tfidf_min: Optional[float] = None
    tfidf_max: Optional[float] = None
    status: str = field(metadata={"primary_key": True})


@dataclass
class Models:
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
class Datasets:
    id: str = field(metadata={"primary_key": True})
    name: str = field(metadata={"not_null": True})
    description: Optional[str] = None
    file_path: Optional[str] = None
    workspace_id: str = field(metadata={"foreign_key": "workspaces(id)"})
    created_at: Optional[datetime] = field(default_factory=datetime.now)


@dataclass
class Posts:
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)", "not_null": True})
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
    title: str = field(metadata={"not_null": True})
    selftext: Optional[str] = None
    author: Optional[str] = None
    hide_score: Optional[int] = None
    subreddit_id: Optional[str] = None


@dataclass
class Comments:
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)", "not_null": True})
    body: Optional[str] = None
    author: Optional[str] = None
    created_utc: Optional[int] = None
    post_id: str = field(metadata={"foreign_key": "posts(id)", "not_null": True})
    parent_id: Optional[str] = None
    controversiality: Optional[int] = None
    score_hidden: Optional[int] = None
    score: Optional[int] = None
    subreddit_id: Optional[str] = None
    retrieved_on: Optional[int] = None
    gilded: Optional[int] = None


@dataclass
class TokenizedPosts:
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    post_id: str = field(metadata={"primary_key": True, "foreign_key": "posts(id)"})
    title: Optional[str] = None
    selftext: Optional[str] = None


@dataclass
class TokenizedComments:
    dataset_id: str = field(metadata={"primary_key": True, "foreign_key": "datasets(id)"})
    comment_id: str = field(metadata={"primary_key": True, "foreign_key": "comments(id)"})
    body: Optional[str] = None


@dataclass
class LLMResponses:
    id: str = field(metadata={"primary_key": True})
    dataset_id: str = field(metadata={"foreign_key": "datasets(id)"})
    model: str = field(metadata={"not_null": True})
    post_id: str = field(metadata={"foreign_key": "posts(id)"})
    response: str = field(metadata={"not_null": True})
    function_id: str = field(metadata={"not_null": True})
    additional_info: Optional[str] = None
    created_at: Optional[datetime] = field(default_factory=datetime.now)