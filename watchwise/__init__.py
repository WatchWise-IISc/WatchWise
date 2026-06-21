"""WatchWise 2.0 — fairness-aware group movie recommender.

A Deep Learning course project that compares traditional candidate generation
(nearest-neighbour retrieval) against a conditional diffusion candidate
generator, both feeding an identical fairness-aware reranker (a greedy "bandit"
selector and a REINFORCE slate-builder). Grounded in real MovieLens ratings and
evaluated against held-out ratings, so improvements are measured, not asserted.

See ``WATCHWISE_MASTER_SPEC.md`` for the full specification.
"""

__version__ = "2.0.0"
