"""Frozen text features for movies (spec §16, decision D6).

Primary path: a *frozen* sentence encoder (``all-mpnet-base-v2``, 768-dim) — never
trained, embedded once and cached. Fallback path: a deterministic TF-IDF + Truncated
SVD embedding that needs no model download, so the pipeline always completes (Kaggle
with internet off, flaky HF Hub, etc.). The fallback is reproducible given the seed.

Movie text = title + genres + most-frequent human tags (all real MovieLens data).
"""
from __future__ import annotations

import signal
from contextlib import contextmanager
from typing import List, Tuple

import numpy as np
import pandas as pd

from ..config import WatchWiseConfig
from .loader import MovieLens


@contextmanager
def _time_limit(seconds: int):
    """Abort a stalled call (e.g. a hung HF Hub download) so we can fall back.

    Uses SIGALRM (Unix: Mac/Linux/Kaggle). Where unavailable (Windows) it is a
    no-op and we rely on the surrounding try/except for non-hang failures.
    """
    if not hasattr(signal, "SIGALRM"):
        yield
        return

    def _raise(signum, frame):
        raise TimeoutError(f"text encoder exceeded {seconds}s")

    old = signal.signal(signal.SIGALRM, _raise)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)


def build_movie_texts(ml: MovieLens) -> List[str]:
    """One short descriptive string per movie (ordered by ``m_idx``)."""
    # Aggregate the most common tags per movie (real user-supplied tags).
    tag_map = {}
    if len(ml.tags):
        grouped = (ml.tags.assign(tag=ml.tags["tag"].astype(str))
                   .groupby("movieId")["tag"]
                   .agg(lambda s: ", ".join(s.value_counts().index[:8])))
        tag_map = grouped.to_dict()

    texts: List[str] = []
    for row in ml.movies.itertuples(index=False):
        title = str(row.title)
        genres = str(row.genres).replace("|", ", ")
        if genres == "(no genres listed)":
            genres = ""
        tags = tag_map.get(row.movieId, "")
        parts = [title]
        if genres:
            parts.append(f"Genres: {genres}.")
        if tags:
            parts.append(f"Themes: {tags}.")
        texts.append(" ".join(parts))
    return texts


def _encode_sentence_transformer(texts: List[str], cfg: WatchWiseConfig
                                 ) -> Tuple[np.ndarray, str]:
    from sentence_transformers import SentenceTransformer  # may raise if missing

    # Force CPU: mpnet has ops that stall on the MPS backend, and a frozen encoder
    # over a few thousand short strings is fast on CPU anyway. (On a CUDA box the
    # encoder will still use the GPU if you set device="cuda" here.)
    model = SentenceTransformer(cfg.text_encoder, device="cpu")
    emb = model.encode(
        texts, batch_size=64, show_progress_bar=False,
        convert_to_numpy=True, normalize_embeddings=True,
    )
    return emb.astype(np.float32), f"frozen:{cfg.text_encoder}"


def _encode_tfidf_svd(texts: List[str], cfg: WatchWiseConfig) -> Tuple[np.ndarray, str]:
    """Deterministic offline fallback: TF-IDF -> Truncated SVD -> L2 normalise."""
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize

    tfidf = TfidfVectorizer(
        max_features=20000, ngram_range=(1, 2),
        stop_words="english", min_df=2,
    )
    X = tfidf.fit_transform(texts)
    dim = int(min(cfg.text_embed_dim, X.shape[1] - 1, X.shape[0] - 1))
    svd = TruncatedSVD(n_components=dim, random_state=cfg.seed)
    emb = svd.fit_transform(X).astype(np.float32)
    emb = normalize(emb)
    # Pad to the configured dim so downstream shapes are stable across runs.
    if emb.shape[1] < cfg.text_embed_dim:
        pad = np.zeros((emb.shape[0], cfg.text_embed_dim - emb.shape[1]), dtype=np.float32)
        emb = np.concatenate([emb, pad], axis=1)
    return emb, "fallback:tfidf+svd"


def compute_text_embeddings(ml: MovieLens, cfg: WatchWiseConfig
                            ) -> Tuple[np.ndarray, str]:
    """Return (embeddings [n_movies, text_embed_dim], method-tag)."""
    texts = build_movie_texts(ml)
    if cfg.use_text_encoder:
        try:
            with _time_limit(cfg.text_encoder_timeout_s):
                emb, method = _encode_sentence_transformer(texts, cfg)
            print(f"[text] encoded {len(texts):,} movies via {method} (dim={emb.shape[1]})")
            return emb, method
        except (Exception, TimeoutError) as e:  # any failure/hang -> deterministic fallback
            print(f"[text] sentence encoder unavailable ({type(e).__name__}: {e}); "
                  f"using deterministic TF-IDF+SVD fallback.")
    emb, method = _encode_tfidf_svd(texts, cfg)
    print(f"[text] encoded {len(texts):,} movies via {method} (dim={emb.shape[1]})")
    return emb, method
