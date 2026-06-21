# WatchWise 2.0 — Evaluation Summary

Dataset **ml-latest-small**, 30 divergent test groups, K=5. Held-out NDCG/Hit are non-circular ground truth.

## Divergent-taste groups (the headline)

| Method | Relevance | Min-member | Fairness gap | NDCG@5 | Hit@5 | Diversity | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Average baseline (top-K mean) | 0.905 | **0.877** | 0.122 | 0.174 | 0.453 | 0.918 | 0.012 |
| NN candidates + fairness reranker | 0.969 | **0.980** | 0.016 | 0.100 | 0.298 | 0.974 | 0.016 |
| Diffusion candidates + fairness reranker | 0.909 | **0.972** | 0.025 | 0.159 | 0.436 | 0.957 | 0.016 |
| NN candidates + RL slate-builder | 0.927 | **0.981** | 0.016 | 0.109 | 0.336 | 0.906 | 0.018 |
| Diffusion candidates + RL slate-builder | 0.782 | **0.990** | 0.008 | 0.161 | 0.464 | 0.927 | 0.016 |

## Read-out

- **Worst-off member lift:** best method `Diffusion candidates + RL slate-builder` raises min-member satisfaction by **+0.113** (+13%) vs the average baseline, with a relevance change of -0.124.
- **Candidate generation (NN vs diffusion, same reranker):** min-member 0.980 -> 0.972, diversity 0.974 -> 0.957, coverage 0.016 -> 0.016.
- **Reranker (bandit vs RL, diffusion pool):** min-member 0.972 -> 0.990; RL beats greedy on val groups: False, PPO contingency triggered: True.

## w2 sweep (fairness knob)

| w2 | Relevance | Min-member | Fairness gap |
| ---: | ---: | ---: | ---: |
| 0.00 | 0.921 | 0.943 | 0.052 |
| 0.25 | 0.919 | 0.959 | 0.037 |
| 0.50 | 0.916 | 0.966 | 0.029 |
| 0.75 | 0.913 | 0.971 | 0.024 |
| 1.00 | 0.910 | 0.975 | 0.021 |
| 1.50 | 0.908 | 0.977 | 0.019 |
| 2.00 | 0.906 | 0.977 | 0.019 |

Figures: `fig_min_member_by_method.png`, `fig_candidate_generation.png`, `fig_w2_sweep.png`, `fig_min_member_by_kind.png`.
