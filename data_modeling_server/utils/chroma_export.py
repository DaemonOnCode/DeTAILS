import codecs
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from enum import Enum
import os
from queue import Queue
import sys
import uuid
from chromadb.api.models import Collection
import orjson as json
from typing import IO, Optional, List, Dict, Any, Generator, TextIO
from chromadb import GetResult, HttpClient, Where, WhereDocument, EmbeddingFunction
from typing import (
    Optional,
    Sequence,
    Any,
    Dict,
    Union,
    Generator,
    TypeVar,
    Generic,
)
import numpy as np
from chromadb.api.types import Embedding, validate_where, validate_where_document
from pydantic import BaseModel, Field, ConfigDict
from chromadb.utils.embedding_functions import (
    ONNXMiniLM_L6_V2,
)
from chromadb.utils.embedding_functions.ollama_embedding_function import (
    OllamaEmbeddingFunction,
)

C = TypeVar("C")


class ResourceFeature(BaseModel, Generic[C]):
    feature_name: str
    feature_type: C


Metadata = Dict[str, Union[str, int, float, bool]]

EmbeddingWrapper = Union[Embedding, np.ndarray]


class EmbeddableResource(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[str] = Field(None, description="Document ID")
    metadata: Optional[Metadata] = Field(None, description="Document metadata")
    embedding: Optional[EmbeddingWrapper] = Field(
        None, description="Document embedding"
    )

    @staticmethod
    def resource_features() -> Sequence[ResourceFeature]:
        return [
            ResourceFeature[EmbeddingWrapper](
                feature_name="embedding", feature_type=EmbeddingWrapper
            ),
            ResourceFeature[Metadata](feature_name="metadata", eature_type=Metadata),
            ResourceFeature[str](feature_name="id", feature_type=str),
        ]


class EmbeddableTextResource(EmbeddableResource):
    text_chunk: Optional[str] = Field(None, description="Document text chunk")

    @staticmethod
    def resource_features() -> Sequence[ResourceFeature]:
        return [
            ResourceFeature[str](feature_name="text_chunk", feature_type=str),
            *EmbeddableResource().resource_features(),
        ]

    def model_dump(self, **kwargs):
        # Convert NumPy arrays to lists before dumping
        data = super().model_dump(**kwargs)
        if isinstance(data["embedding"], np.ndarray):
            data["embedding"] = data["embedding"].tolist()
        return data


D = TypeVar("D", bound=EmbeddableResource, contravariant=True)

def _get_result_to_chroma_doc_list(result: GetResult) -> List[EmbeddableTextResource]:
    """Converts a GetResult to a list of ChromaDocuments."""
    docs = []
    for idx, _ in enumerate(result["ids"]):
        docs.append(
            EmbeddableTextResource(
                text_chunk=result["documents"][idx],
                embedding=result["embeddings"][idx],
                metadata=result["metadatas"][idx],
                id=result["ids"][idx],
            )
        )
    return docs


def remap_features(
    doc: EmbeddableTextResource,
    doc_feature: Optional[str] = "text_chunk",
    embed_feature: Optional[str] = "embedding",
    id_feature: str = "id",
    meta_features: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Remaps EmbeddableTextResource features to a dictionary."""
    metadata_dict = doc.metadata.model_dump() if isinstance(doc.metadata, LineMetadata) else doc.metadata
    _metas = (
        metadata_dict
        if meta_features is None or len(meta_features) == 0
        else {
            k: metadata_dict[k]
            for k in meta_features
            if metadata_dict is not None and k in metadata_dict
        }
    )
    # _metas = (
    #     doc.metadata
    #     if meta_features is None or len(meta_features) == 0
    #     else {
    #         k: doc.metadata[k]
    #         for k in meta_features
    #         if doc.metadata is not None and k in doc.metadata
    #     }
    # )
    return {
        f"{doc_feature}": doc.text_chunk,
        f"{embed_feature}": doc.embedding,
        f"{id_feature}": doc.id,
        **(_metas if _metas is not None else {}),
    }


def read_large_data_in_chunks(
    collection: Collection,
    queue: Queue,
    offset: Optional[int] = None,
    limit: Optional[int] = None,
    where: Where = None,
    where_document: WhereDocument = None,
):
    """Reads large data in chunks from ChromaDB."""
    result = collection.get(
        where=where,
        where_document=where_document,
        limit=limit,
        offset=offset,
        include=["embeddings", "documents", "metadatas"],
    )
    try:
        queue.put(result)
    except Exception as e:
        queue.put(e)


def chroma_export(
    collection: Optional[str] = None,
    limit: Optional[int] = -1,
    offset: Optional[int] = 0,
    batch_size: Optional[int] = 100,
    embed_feature: Optional[str] = "embedding",
    meta_features: Optional[List[str]] = None,
    id_feature: Optional[str] = "id",
    doc_feature: Optional[str] = "text_chunk",
    where: Optional[str] = None,
    where_document: Optional[str] = None,
    format_output: Optional[str] = "record",
    max_threads: Optional[int] = os.cpu_count() - 2,
) -> Generator[Dict[str, Any], None, None]:
    """Exports data from ChromaDB."""
    client = HttpClient(host="localhost", port=8000)
    _collection = collection
    _batch_size = batch_size
    _offset = offset
    _limit = limit
    _start = _offset if _offset > 0 else 0
    chroma_collection = client.get_collection(_collection)
    col_count = chroma_collection.count()
    # precondition the DB for fetching data
    chroma_collection.get(limit=1, include=["embeddings"])  # noqa
    total_results_to_fetch = min(col_count, _limit) if _limit > 0 else col_count
    _where = None
    if where:
        _where = validate_where(json.loads(where))
    _where_document = None
    if where_document:
        _where_document = validate_where_document(json.loads(where_document))

    queue = Queue()
    num_batches = (total_results_to_fetch - _start + _batch_size - 1) // _batch_size
    fetched_results = 0
    with ThreadPoolExecutor(max_workers=max_threads) as executor:
        for batch in range(num_batches):
            offset = _start + batch * _batch_size
            batch_limit = min(total_results_to_fetch - offset, _batch_size)
            executor.submit(
                read_large_data_in_chunks,
                collection=chroma_collection,
                queue=queue,
                offset=offset,
                limit=batch_limit,
                where=_where,
                where_document=_where_document,
            )

        while fetched_results < total_results_to_fetch:
            _results = queue.get()
            if _results is None:
                break
            if isinstance(_results, Exception):
                raise _results
            _results = _get_result_to_chroma_doc_list(_results)
            fetched_results += len(_results)
            if format_output == "record":
                _final_results = [r.model_dump() for r in _results]
            elif format_output == "jsonl":
                _final_results = [
                    remap_features(
                        doc,
                        doc_feature=doc_feature,
                        embed_feature=embed_feature,
                        id_feature=id_feature,
                        meta_features=meta_features,
                    )
                    for doc in _results
                ]
            else:
                raise ValueError(f"Unsupported format: {format_output}")
            for _doc in _final_results:
                yield _doc

def chroma_export_cli(
        collection: str,
        export_file: Optional[str] = None,
        append: bool = False,
) -> None:
    if not export_file:
        os.makedirs("export", exist_ok=True)
        export_file = f"export/chroma_export.jsonl"
    if export_file and not append:
        with open(export_file, "w") as f:
            f.write("")
    if export_file:
        with open(export_file, "a") as f:
            for _doc in chroma_export(
                collection=collection,
            ):
                f.write(str(json.dumps(_doc)) + "\n")
    else:
        for _doc in chroma_export(
            collection=collection,
        ):
            json.dumps(_doc)



@contextmanager
def smart_open(
    filename: Optional[str] = None,
    stdin: TextIO = sys.stdin,
    mode: str = "rb",
) -> Generator[Union[IO[Any], TextIO], None, None]:
    fh: Union[IO[Any], TextIO] = stdin
    if filename:
        fh = open(filename, mode)
    try:
        yield fh
    finally:
        if filename and isinstance(fh, IO):
            fh.close()

class DistanceFunction(str, Enum):
    l2 = "l2"
    ip = "ip"
    cosine = "cosine"

class SupportedEmbeddingFunctions(str, Enum):
    default = "default"
    openai = "openai"
    cohere = "cohere"
    hf = "hf"
    st = "st"
    gemini = "gemini"
    ollama = "ollama"


def get_embedding_function_for_name(
    name: Optional[SupportedEmbeddingFunctions], **kwargs: Any
) -> EmbeddingFunction:
    if name == SupportedEmbeddingFunctions.default:
        return ONNXMiniLM_L6_V2()
    # elif name == SupportedEmbeddingFunctions.hf:
    #     model = (
    #         kwargs.get("model")
    #         if kwargs.get("model")
    #         else os.environ.get(
    #             "HF_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
    #         )
    #     )
    #     return HuggingFaceEmbeddingFunction(
    #         api_key=os.environ.get("HF_TOKEN"), model_name=model
    #     )
    # elif name == SupportedEmbeddingFunctions.st:
    #     model = (
    #         kwargs.get("model")
    #         if kwargs.get("model")
    #         else os.environ.get("ST_MODEL_NAME", "all-MiniLM-L6-v2")
    #     )
    #     return SentenceTransformerEmbeddingFunction(
    #         model_name=model,
    #         device=os.environ.get("ST_DEVICE", "cpu"),
    #         normalize_embeddings=os.environ.get("ST_NORMALIZE", "True") == "True",
    #     )
    elif name == SupportedEmbeddingFunctions.ollama:
        model = (
            kwargs.get("model")
            if kwargs.get("model")
            else os.environ.get("OLLAMA_MODEL_NAME", "chroma/all-minilm-l6-v2-f32")
        )
        print(model, "model kwargs")
        url = os.environ.get(
            "OLLAMA_EMBED_URL", "http://localhost:11434/api/embeddings"
        )
        return OllamaEmbeddingFunction(
            model_name=model,
            url=url,
        )
    else:
        raise ValueError("Please provide a valid embedding function.")

def add_to_col(
    col: Collection,
    batch: Dict[str, Any],
    upsert: bool = False,
    ef: EmbeddingFunction = None,
) -> None:
    try:
        print(col, batch.keys(), upsert, ef, len(batch["documents"]), "adding to col")
        if "embeddings" in batch and len(batch["embeddings"]) > 0:
            batch["embeddings"] = [
                e.tolist() if isinstance(e, np.ndarray) else e
                for e in batch["embeddings"]
            ]
        if ef:
            # print("embedding", batch["documents"])
            batch["embeddings"] = ef(batch["documents"])
            # print(batch["embeddings"], "batch embeddings")
        if upsert:
            print("upserting to col")
            col.upsert(**batch)
        else:
            print("adding to col")
            col.add(**batch)
    except Exception as e:
        print(e)
        raise e


class LineMetadata(BaseModel):
    page: int
    source: str

class ParsedLine(BaseModel):
    id: str
    metadata: LineMetadata
    embedding: List[float]
    text_chunk: Optional[str]

def chroma_import(
    collection: str,
    import_file: str = "chroma_export.jsonl",
    model: Optional[str] = None,
    limit: Optional[int] = -1,
    offset: Optional[int] = 0,
    batch_size: Optional[int] = 100,
    embed_feature: Optional[str] = "embedding",
    meta_features: Optional[List[str]] = None,
    id_feature: Optional[str] = "id",
    doc_feature: Optional[str] = "text_chunk",
    max_threads: Optional[int] = os.cpu_count() - 2,
    distance_function: Optional[DistanceFunction] = None,
    upsert: bool = True,
    create: bool = True,
    inf = sys.stdin,
    embedding_function: Optional[SupportedEmbeddingFunctions] = None,
) -> None:
    _embedding_function = SupportedEmbeddingFunctions.ollama
    if embedding_function is not None:
        _embedding_function = get_embedding_function_for_name(embedding_function, model=model)
    client = HttpClient(host="localhost", port=8000)
    _collection = collection
    _batch_size = batch_size
    _offset = offset
    _limit = limit
    _upsert = upsert
    _create = create
    _batch: Dict[str, Any] = {
        "documents": [],
        "embeddings": [],
        "metadatas": [],
        "ids": [],
    }
    _distance_function = (
        distance_function or DistanceFunction.l2
    )
    if _create:
        chroma_collection = client.get_or_create_collection(
            _collection, metadata={"hnsw:space": _distance_function.value}
        )
    else:
        chroma_collection = client.get_collection(_collection)
    lc_count = 0
    with smart_open(import_file, inf) as file_or_stdin:
        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            for line in file_or_stdin:
                if lc_count < _offset:
                    continue
                if _limit != -1 and lc_count >= _limit:
                    break
                cleaned_line = line.strip()
                
                # If the line starts with b' or ends with ', remove these
                if cleaned_line.startswith(b"b'") and cleaned_line.endswith(b"'"):
                    cleaned_line = cleaned_line[2:-1]

                # Decode to string
                decoded_line = cleaned_line.decode('utf-8')
                
                # Unescape the string (e.g., turn \\n into \n)
                _line = codecs.decode(decoded_line, 'unicode_escape')
                doc = ParsedLine(**json.loads(_line))
                _batch["documents"].append(doc.text_chunk)
                _batch["embeddings"].append(
                    doc.embedding if _embedding_function is None else None
                )  # call EF?
                _batch["metadatas"].append(doc.metadata.model_dump())
                _batch["ids"].append(doc.id if doc.id else uuid.uuid4())
                if len(_batch["documents"]) >= _batch_size:
                    executor.submit(
                        add_to_col,
                        chroma_collection,
                        _batch,
                        _upsert,
                        _embedding_function,
                    )
                    _batch = {
                        "documents": [],
                        "embeddings": [],
                        "metadatas": [],
                        "ids": [],
                    }
                lc_count += 1
            if len(_batch["documents"]) > 0:
                executor.submit(
                    add_to_col, chroma_collection, _batch, _upsert, _embedding_function
                )