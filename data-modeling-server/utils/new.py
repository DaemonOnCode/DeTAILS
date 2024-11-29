from __future__ import annotations

import json
import logging
import math
from typing import Any, Iterator, Literal, Union
import torch
import numpy as np
from tokenizers import Encoding, Tokenizer
from huggingface_hub import model_info
from sklearn.decomposition import PCA
from tokenizers.models import BPE, Unigram
from transformers import AutoModel, AutoTokenizer, PreTrainedModel, PreTrainedTokenizerFast, PreTrainedTokenizer
import tqdm
import inspect
from transformers.modeling_outputs import BaseModelOutputWithPoolingAndCrossAttentions

logger = logging.getLogger(__name__)

_DEFAULT_BATCH_SIZE = 1024
PCADimType = Union[int, None, Literal["auto"]]

def select_optimal_device(device: str | None) -> str:
    """
    Guess what your optimal device should be based on backend availability.

    If you pass a device, we just pass it through.

    :param device: The device to use. If this is not None you get back what you passed.
    :return: The selected device.
    """
    if device is None:
        if torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"
        logger.info(f"Automatically selected device: {device}")

    return device


def remove_tokens(tokenizer: Tokenizer, tokens_to_remove: list[str]) -> Tokenizer:
    """
    Remove tokens from a tokenizer.

    :param tokenizer: The tokenizer to remove tokens from.
    :param tokens_to_remove: The tokens to remove.
    :return: The modified tokenizer.
    :raises ValueError: If the tokenizer model type is not supported.
    """
    model_vocab = set(tokenizer.get_vocab())
    # This triggers when tokens_to_remove is empty or when there is no overlap
    # between the tokens to remove and the model vocabulary.
    if not set(tokens_to_remove).intersection(model_vocab):
        # NOTE: return a copy.
        if tokens_to_remove:
            logger.info("No tokens to remove, none of the tokens were in the vocabulary.")
        else:
            logger.info("No tokens to remove.")
        return Tokenizer.from_str(tokenizer.to_str())

    tokenizer_data: dict[str, Any] = json.loads(tokenizer.to_str())

    # Find all added tokens
    added_tokens: list[dict[str, Any]] = tokenizer_data.get("added_tokens", [])
    added_tokens_str: set[str] = {token["content"] for token in added_tokens}

    # Remove all added tokens from the list of tokens to remove.
    # Things will go bad if we keep them.
    tokens_to_remove = [token for token in tokens_to_remove if token not in added_tokens_str]

    # Load the vocabulary.
    model_type = tokenizer_data["model"]["type"]

    if model_type == "WordPiece":
        # Vocab is a dictionary.
        vocab: dict[str, int] = tokenizer_data["model"]["vocab"]
        n_tokens = len(vocab)

        # Remove the tokens.
        for token in tokens_to_remove:
            if vocab.pop(token, None) is None:
                logger.warning(f"Token {token} was not in the vocabulary.")

        n_removed = n_tokens - len(vocab)
        logger.info(f"Removed {n_removed} tokens from the vocabulary.")

        # Reindex the vocabulary so that it is contiguous.
        reindexed = {token: idx for idx, (token, _) in enumerate(sorted(vocab.items(), key=lambda x: x[1]))}
        tokenizer_data["model"]["vocab"] = reindexed

    elif model_type == "Unigram":
        raise ValueError("Removing tokens from a unigram tokenizer is not supported.")

    elif model_type == "BPE":
        raise ValueError("Removing tokens from a BPE tokenizer is not supported.")

    else:
        raise ValueError(f"Unknown model type {model_type}")

    # Reindex the special tokens (i.e., CLS and SEP for BertTokenizers.)
    added_tokens = tokenizer_data.get("added_tokens", [])
    for token_data in added_tokens:
        token_data["id"] = reindexed[token_data["content"]]

    # Reinitialize the tokenizer from the json.
    tokenizer = Tokenizer.from_str(json.dumps(tokenizer_data))

    return tokenizer


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


def create_output_embeddings_from_model_name(
    model: PreTrainedModel,
    tokenizer: PreTrainedTokenizer,
    device: str,
) -> tuple[list[str], np.ndarray]:
    """
    Create output embeddings for a bunch of tokens from a model name.

    It does a forward pass for all ids in the tokenizer.

    :param model: The model name to use.
    :param tokenizer: The tokenizer to use.
    :param device: The torch device to use.
    :return: The tokens and output embeddings.
    """
    model = model.to(device)

    # Quick check to see if the tokenizer is consistent.
    vocab_length = len(tokenizer.get_vocab())
    if vocab_length != tokenizer.vocab_size:
        logger.warning(
            f"Reported vocab size {tokenizer.vocab_size} is inconsistent with the vocab size {vocab_length}."
        )

    ids = torch.arange(vocab_length)

    # Work-around to get the eos and bos token ids without having to go into tokenizer internals.
    dummy_encoding = tokenizer.encode("A")
    bos_token_id, eos_token_id = dummy_encoding[0], dummy_encoding[-1]

    bos = torch.full([len(ids)], fill_value=bos_token_id)
    eos = torch.full([len(ids)], fill_value=eos_token_id)

    # NOTE: reversing the bos and eos tokens works better on our benchmarks.
    stacked = torch.stack([eos, ids, bos], dim=1)

    intermediate_weights: list[np.ndarray] = []
    for batch_idx in tqdm(range(0, len(stacked), _DEFAULT_BATCH_SIZE)):
        batch = stacked[batch_idx : batch_idx + _DEFAULT_BATCH_SIZE].to(model.device)
        with torch.no_grad():
            attention_mask = torch.ones_like(batch)
            # Prepare model inputs
            model_inputs = {"input_ids": batch.to(device), "attention_mask": attention_mask}

            # Add token_type_ids only if the model supports it
            if "token_type_ids" in inspect.getfullargspec(model.forward).args:
                model_inputs["token_type_ids"] = torch.zeros_like(batch)

            # Perform the forward pass
            encoded_output: BaseModelOutputWithPoolingAndCrossAttentions = model(**model_inputs)
            out: torch.Tensor = encoded_output.last_hidden_state
            # NOTE: If the dtype is bfloat 16, we convert to float32,
            # because numpy does not suport bfloat16
            # See here: https://github.com/numpy/numpy/issues/19808
            if out.dtype == torch.bfloat16:
                out = out.float()

        # Add the output to the intermediate weights
        intermediate_weights.append(out[:, 1].detach().cpu().numpy())

    # Concatenate the intermediate weights
    out_weights = np.concatenate(intermediate_weights)

    return tokenizer.convert_ids_to_tokens(ids), out_weights



def distill_from_model(
    model: PreTrainedModel,
    tokenizer: PreTrainedTokenizerFast,
    vocabulary: list[str] | None = None,
    device: str | None = None,
    pca_dims: PCADimType = 256,
    apply_zipf: bool = True,
    use_subword: bool = True,
) -> StaticModel:
    """
    Distill a staticmodel from a sentence transformer.

    This function creates a set of embeddings from a sentence transformer. It does this by doing either
    a forward pass for all subword tokens in the tokenizer, or by doing a forward pass for all tokens in a passed vocabulary.

    If you pass through a vocabulary, we create a custom word tokenizer for that vocabulary.
    If you don't pass a vocabulary, we use the model's tokenizer directly.

    :param model: The model to use.
    :param tokenizer: The tokenizer to use.
    :param vocabulary: The vocabulary to use. If this is None, we use the model's vocabulary.
    :param device: The device to use.
    :param pca_dims: The number of components to use for PCA.
        If this is None, we don't apply PCA.
        If this is 'auto', we don't reduce dimensionality, but still apply PCA.
    :param apply_zipf: Whether to apply Zipf weighting to the embeddings.
    :param use_subword: Whether to keep subword tokens in the vocabulary. If this is False, you must pass a vocabulary, and the returned tokenizer will only detect full words.
    :raises: ValueError if the PCA dimension is larger than the number of dimensions in the embeddings.
    :raises: ValueError if the vocabulary contains duplicate tokens.
    :return: A StaticModel

    """
    device = select_optimal_device(device)
    if not use_subword and vocabulary is None:
        raise ValueError(
            "You must pass a vocabulary if you don't use subword tokens. Either pass a vocabulary, or set use_subword to True."
        )

    if vocabulary and isinstance(tokenizer.backend_tokenizer.model, (BPE, Unigram)):
        raise ValueError(
            "You passed a vocabulary, but the model you are using does not use a WordPiece tokenizer. "
            "This is not supported yet."
            "Feel free to open an issue if this is a blocker: https://github.com/MinishLab/model2vec/issues"
        )

    # Make a base list of tokens.
    tokens: list[str] = []
    if use_subword:
        # Create the subword embeddings.
        tokens, embeddings = create_output_embeddings_from_model_name(model=model, tokenizer=tokenizer, device=device)

        # Remove any unused tokens from the tokenizer and embeddings.
        wrong_tokens = [x for x in tokens if x.startswith("[unused")]
        vocab = tokenizer.get_vocab()
        # Get the ids of the unused token.
        wrong_token_ids = [vocab[token] for token in wrong_tokens]
        # Remove the unused tokens from the tokenizer.
        new_tokenizer = remove_tokens(tokenizer.backend_tokenizer, wrong_tokens)
        # Remove the embeddings of the unused tokens.
        embeddings = np.delete(embeddings, wrong_token_ids, axis=0)
        logger.info(f"Removed {len(wrong_tokens)} unused tokens from the tokenizer and embeddings.")

        
    # Post process the embeddings by applying PCA and Zipf weighting.
    embeddings = _post_process_embeddings(np.asarray(embeddings), pca_dims, apply_zipf)

    model_name = getattr(model, "name_or_path", "")

    config = {
        "model_type": "model2vec",
        "architectures": ["StaticModel"],
        "tokenizer_name": model_name,
        "apply_pca": pca_dims,
        "apply_zipf": apply_zipf,
        "hidden_dim": embeddings.shape[1],
        "seq_length": 1000000,  # Set this to a high value since we don't have a sequence length limit.
    }

    return StaticModel(
        vectors=embeddings, tokenizer=new_tokenizer, config=config, base_model_name=model_name, language=None
    )


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
    