

import json
from os import PathLike
import requests
import numpy as np
import logging
from sklearn.decomposition import PCA
from typing import Protocol, Union, Literal, cast
from __future__ import annotations

import math
from logging import getLogger
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Iterator, Union

import numpy as np
from tokenizers import Encoding, Tokenizer
from tqdm import tqdm
import safetensors
from safetensors.numpy import save_file

logger = logging.getLogger(__name__)


PCADimType = Union[int, None, Literal["auto"]]


class SafeOpenProtocol(Protocol):
    """Protocol to fix safetensors safe open."""

    def get_tensor(self, key: str) -> np.ndarray:
        """Get a tensor."""
        ...  # pragma: no cover


_MODULE_MAP = (("scikit-learn", "sklearn"),)


def load_local_model(folder: Path) -> tuple[np.ndarray, Tokenizer, dict[str, str]]:
    """Load a local model."""
    embeddings_path = folder / "model.safetensors"
    tokenizer_path = folder / "tokenizer.json"
    config_path = folder / "config.json"

    opened_tensor_file = cast(SafeOpenProtocol, safetensors.safe_open(embeddings_path, framework="numpy"))
    embeddings = opened_tensor_file.get_tensor("embeddings")

    if config_path.exists():
        config = json.load(open(config_path))
    else:
        config = {}

    tokenizer: Tokenizer = Tokenizer.from_file(str(tokenizer_path))

    if len(tokenizer.get_vocab()) != len(embeddings):
        logger.warning(
            f"Number of tokens does not match number of embeddings: `{len(tokenizer.get_vocab())}` vs `{len(embeddings)}`"
        )

    return embeddings, tokenizer, config


def save_pretrained(
    folder_path: Path,
    embeddings: np.ndarray,
    tokenizer: Tokenizer,
    config: dict[str, Any],
    **kwargs: Any,
) -> None:
    """
    Save a model to a folder.

    :param folder_path: The path to the folder.
    :param embeddings: The embeddings.
    :param tokenizer: The tokenizer.
    :param config: A metadata config.
    :param create_model_card: Whether to create a model card.
    :param **kwargs: Any additional arguments.
    """
    folder_path.mkdir(exist_ok=True, parents=True)
    save_file({"embeddings": embeddings}, folder_path / "model.safetensors")
    tokenizer.save(str(folder_path / "tokenizer.json"))
    json.dump(config, open(folder_path / "config.json", "w"))

    logger.info(f"Saved model to {folder_path}")

class StaticModel:
    def __init__(
        self,
        vectors: np.ndarray,
        tokenizer: Tokenizer,
        config: dict[str, Any] | None = None,
        normalize: bool | None = None,
        base_model_name: str | None = None,
        language: list[str] | None = None,
    ) -> None:
        """
        Initialize the StaticModel.

        :param vectors: The vectors to use.
        :param tokenizer: The Transformers tokenizer to use.
        :param config: Any metadata config.
        :param normalize: Whether to normalize.
        :param base_model_name: The used base model name. Used for creating a model card.
        :param language: The language of the model. Used for creating a model card.
        :raises: ValueError if the number of tokens does not match the number of vectors.
        """
        super().__init__()
        tokens, _ = zip(*sorted(tokenizer.get_vocab().items(), key=lambda x: x[1]))
        self.tokens = tokens

        self.embedding = vectors

        if len(tokens) != vectors.shape[0]:
            raise ValueError(f"Number of tokens ({len(tokens)}) does not match number of vectors ({vectors.shape[0]})")

        self.tokenizer = tokenizer
        self.unk_token_id: int | None
        if hasattr(self.tokenizer.model, "unk_token") and self.tokenizer.model.unk_token is not None:
            self.unk_token_id = tokenizer.get_vocab()[self.tokenizer.model.unk_token]
        else:
            self.unk_token_id = None  # pragma: no cover  # Doesn't actually happen, but can happen.

        self.median_token_length = int(np.median([len(token) for token in self.tokens]))
        self.config = config or {}
        self.base_model_name = base_model_name
        self.language = language
        if hasattr(self.tokenizer, "encode_batch_fast"):
            self._can_encode_fast = True
        else:
            self._can_encode_fast = False

        if normalize is not None:
            self.normalize = normalize
        else:
            self.normalize = self.config.get("normalize", False)

    @property
    def dim(self) -> int:
        """Get the dimension of the model."""
        return self.embedding.shape[1]

    @property
    def normalize(self) -> bool:
        """
        Get the normalize value.

        :return: The normalize value.
        """
        return self._normalize

    @normalize.setter
    def normalize(self, value: bool) -> None:
        """Update the config if the value of normalize changes."""
        config_normalize = self.config.get("normalize", False)
        self._normalize = value
        if config_normalize is not None and value != config_normalize:
            logger.warning(
                f"Set normalization to `{value}`, which does not match config value `{config_normalize}`. Updating config."
            )
        self.config["normalize"] = value

    def save_pretrained(self, path: PathLike, model_name: str | None = None) -> None:
        """
        Save the pretrained model.

        :param path: The path to save to.
        :param model_name: The model name to use in the Model Card.
        """

        save_pretrained(
            folder_path=Path(path),
            embeddings=self.embedding,
            tokenizer=self.tokenizer,
            config=self.config,
            base_model_name=self.base_model_name,
            language=self.language,
            model_name=model_name,
        )

    def tokenize(self, sentences: list[str], max_length: int | None = None) -> list[int]:
        """
        Tokenize a sentence.

        :param sentences: The sentence to tokenize.
        :param max_length: The maximum length of the sentence.
        :return: The tokens.
        """
        if max_length is not None:
            m = max_length * self.median_token_length
            sentences = [sentence[:m] for sentence in sentences]

        if self._can_encode_fast:
            encodings: list[Encoding] = self.tokenizer.encode_batch_fast(sentences, add_special_tokens=False)
        else:
            encodings = self.tokenizer.encode_batch(sentences, add_special_tokens=False)

        encodings_ids = [encoding.ids for encoding in encodings]

        if self.unk_token_id is not None:
            # NOTE: Remove the unknown token: necessary for word-level models.
            encodings_ids = [
                [token_id for token_id in token_ids if token_id != self.unk_token_id] for token_ids in encodings_ids
            ]
        if max_length is not None:
            encodings_ids = [token_ids[:max_length] for token_ids in encodings_ids]

        return encodings_ids

    def encode_as_sequence(
        self,
        sentences: list[str] | str,
        max_length: int | None = None,
        batch_size: int = 1024,
        show_progress_bar: bool = False,
    ) -> list[np.ndarray] | np.ndarray:
        """
        Encode a list of sentences as a list of numpy arrays of tokens.

        This is useful if you want to use the tokens for further processing, or if you want to do sequence
        modeling.
        Note that if you just want the mean, you should use the `encode` method.
        This is about twice as slow.
        Sentences that do not contain any tokens will be turned into an empty array.

        :param sentences: The list of sentences to encode.
        :param max_length: The maximum length of the sentences. Any tokens beyond this length will be truncated.
            If this is None, no truncation is done.
        :param batch_size: The batch size to use.
        :param show_progress_bar: Whether to show the progress bar.
        :return: The encoded sentences with an embedding per token.
        """
        was_single = False
        if isinstance(sentences, str):
            sentences = [sentences]
            was_single = True

        out_array: list[np.ndarray] = []
        for batch in tqdm(
            self._batch(sentences, batch_size),
            total=math.ceil(len(sentences) / batch_size),
            disable=not show_progress_bar,
        ):
            out_array.extend(self._encode_batch_as_sequence(batch, max_length))

        if was_single:
            return out_array[0]

        return out_array

    def _encode_batch_as_sequence(self, sentences: list[str], max_length: int | None) -> list[np.ndarray]:
        """Encode a batch of sentences as a sequence."""
        ids = self.tokenize(sentences=sentences, max_length=max_length)
        out: list[np.ndarray] = []
        for id_list in ids:
            if id_list:
                out.append(self.embedding[id_list])
            else:
                out.append(np.zeros((0, self.dim)))

        return out

    def encode(
        self,
        sentences: list[str] | str,
        show_progress_bar: bool = False,
        max_length: int | None = 512,
        batch_size: int = 1024,
        **kwargs: Any,
    ) -> np.ndarray:
        """
        Encode a list of sentences.

        This function encodes a list of sentences by averaging the word embeddings of the tokens in the sentence.
        For ease of use, we don't batch sentences together.

        :param sentences: The list of sentences to encode. You can also pass a single sentence.
        :param show_progress_bar: Whether to show the progress bar.
        :param max_length: The maximum length of the sentences. Any tokens beyond this length will be truncated.
            If this is None, no truncation is done.
        :param batch_size: The batch size to use.
        :param **kwargs: Any additional arguments. These are ignored.
        :return: The encoded sentences. If a single sentence was passed, a vector is returned.
        """
        was_single = False
        if isinstance(sentences, str):
            sentences = [sentences]
            was_single = True

        out_arrays: list[np.ndarray] = []
        for batch in tqdm(
            self._batch(sentences, batch_size),
            total=math.ceil(len(sentences) / batch_size),
            disable=not show_progress_bar,
        ):
            out_arrays.append(self._encode_batch(batch, max_length))

        out_array = np.concatenate(out_arrays, axis=0)

        if was_single:
            return out_array[0]

        return out_array

    def _encode_batch(self, sentences: list[str], max_length: int | None) -> np.ndarray:
        """Encode a batch of sentences."""
        ids = self.tokenize(sentences=sentences, max_length=max_length)
        out: list[np.ndarray] = []
        for id_list in ids:
            if id_list:
                out.append(self.embedding[id_list].mean(0))
            else:
                out.append(np.zeros(self.dim))

        out_array = np.stack(out)
        if self.normalize:
            norm = np.linalg.norm(out_array, axis=1, keepdims=True) + 1e-32
            out_array = out_array / norm

        return out_array

    @staticmethod
    def _batch(sentences: list[str], batch_size: int) -> Iterator[list[str]]:
        """Batch the sentences into equal-sized."""
        return (sentences[i : i + batch_size] for i in range(0, len(sentences), batch_size))

    @classmethod
    def load_local(cls: type[StaticModel], path: PathLike) -> StaticModel:
        """
        Loads a model from a local path.

        You should only use this code path if you are concerned with start-up time.
        Loading via the `from_pretrained` method is safer, and auto-downloads, but
        also means we import a whole bunch of huggingface code that we don't need.

        Additionally, huggingface will check the most recent version of the model,
        which can be slow.

        :param path: The path to load the model from. The path is a directory saved by the
            `save_pretrained` method.
        :return: A StaticModel
        :raises: ValueError if the path is not a directory.
        """
        path = Path(path)
        if not path.is_dir():
            raise ValueError(f"Path {path} is not a directory.")

        embeddings, tokenizer, config = load_local_model(path)

        return StaticModel(embeddings, tokenizer, config)

def fetch_ollama_embeddings(model_name, inputs, host="http://localhost:11434"):
    """
    Fetch embeddings from Ollama API.
    :param model_name: The name of the model in Ollama.
    :param inputs: List of texts or tokens.
    :param host: The API endpoint.
    :return: Embeddings as a numpy array.
    """
    url = f"{host}/api/embed"
    payload = {"model": model_name, "input": inputs, "truncate": True}
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json()["embeddings"]

# Example usage:
embeddings = fetch_ollama_embeddings("all-minilm", ["Why is the sky blue?", "Why is the grass green?"])


def distill_from_ollama(
    model_name: str,
    vocabulary: list[str] | None = None,
    pca_dims: int = 256,
    apply_zipf: bool = True,
) -> StaticModel:
    """
    Distill a static model from Ollama embeddings.
    :param model_name: The model name to use with Ollama.
    :param vocabulary: Vocabulary to use for embedding generation.
    :param pca_dims: Number of PCA dimensions.
    :param apply_zipf: Whether to apply Zipf weighting.
    :return: A StaticModel.
    """
    if vocabulary is None:
        raise ValueError("Vocabulary must be provided when distilling from Ollama.")

    # Fetch embeddings for vocabulary
    embeddings = fetch_ollama_embeddings(model_name, vocabulary)
    embeddings = np.array(embeddings)

    # Post-process embeddings
    embeddings = _post_process_embeddings(embeddings, pca_dims, apply_zipf)

    config = {
        "tokenizer_name": model_name,
        "apply_pca": pca_dims,
        "apply_zipf": apply_zipf,
        "hidden_dim": embeddings.shape[1],
    }

    return StaticModel(vectors=embeddings, tokenizer=None, config=config, base_model_name=model_name)



from sklearn.metrics.pairwise import cosine_similarity

def train_distillation_model(base_model_embeddings, distilled_embeddings, epochs=10):
    """
    Train a distillation model to align with base model embeddings.
    :param base_model_embeddings: Embeddings from the base model.
    :param distilled_embeddings: Initial embeddings from the distilled model.
    :return: Optimized embeddings.
    """
    # Compute cosine similarity
    similarity = cosine_similarity(base_model_embeddings, distilled_embeddings)

    # Define a simple optimization loop to minimize the cosine distance
    for i in range(epochs):
        loss = 1 - similarity.mean()  # Example loss metric
        # Apply optimization steps here (SGD, Adam, etc.)
        print(f"Epoch {i}: Loss {loss}")

    return distilled_embeddings


def _post_process_embeddings(embeddings: np.ndarray, pca_dims: PCADimType, apply_zipf: bool) -> np.ndarray:
    """Post process embeddings by applying PCA and Zipf weighting."""
    if pca_dims is not None:
        if pca_dims == "auto":
            pca_dims = embeddings.shape[1]
        if pca_dims > embeddings.shape[1]:
            logger.warning(
                f"PCA dimension ({pca_dims}) is larger than the number of dimensions in the embeddings ({embeddings.shape[1]}). "
                "Applying PCA, but not reducing dimensionality. Is this is not desired, please set `pca_dims` to None. "
                "Applying PCA will probably improve performance, so consider just leaving it."
            )
            pca_dims = embeddings.shape[1]
        if pca_dims >= embeddings.shape[0]:
            logger.warning(
                f"PCA dimension ({pca_dims}) is larger than the number of tokens in the vocabulary ({embeddings.shape[0]}). Not applying PCA."
            )
        elif pca_dims <= embeddings.shape[1]:
            logger.info(f"Applying PCA with n_components {pca_dims}")

            orig_dims = embeddings.shape[1]
            p = PCA(n_components=pca_dims, whiten=False)
            embeddings = p.fit_transform(embeddings)

            if embeddings.shape[1] < orig_dims:
                explained_variance_ratio = np.sum(p.explained_variance_ratio_)
                explained_variance = np.sum(p.explained_variance_)
                logger.info(f"Reduced dimensionality from {orig_dims} to {embeddings.shape[1]}.")
                logger.info(f"Explained variance ratio: {explained_variance_ratio:.3f}.")
                logger.info(f"Explained variance: {explained_variance:.3f}.")

    if apply_zipf:
        logger.info("Applying Zipf weighting")
        embeddings *= np.log(1 + np.arange(embeddings.shape[0]))[:, None]

    return embeddings



# Fetch embeddings from Ollama API
model_name = "all-minilm"
vocabulary = ["example", "tokens", "for", "testing"]
ollama_embeddings = fetch_ollama_embeddings(model_name, vocabulary)

# Apply PCA and weighting
processed_embeddings = _post_process_embeddings(
    np.array(ollama_embeddings),
    pca_dims=256,
    apply_zipf=True
)




# Initialize StaticModel
static_model = StaticModel(
    vectors=processed_embeddings,
    tokenizer=your_tokenizer,  # Replace with tokenizer compatible with Ollama vocab
    config={"model_name": model_name},
    base_model_name=model_name,
    language=["en"]
)

# Encode sentences
sentences = ["This is a test.", "Another sentence here."]
encoded_vectors = static_model.encode(sentences)
print(encoded_vectors)
