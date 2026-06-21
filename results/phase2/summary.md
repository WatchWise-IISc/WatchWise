# WatchWise 2.0 — Evaluation Summary

Dataset **ml-25m**, 101 divergent test groups, K=5. Held-out NDCG/Hit are non-circular ground truth.

## Divergent-taste groups (the headline)

| Method | Relevance | Min-member | Fairness gap | NDCG@5 | Hit@5 | Diversity | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Average baseline (top-K mean) | 0.998 | **1.000** | 0.000 | 0.048 | 0.175 | 0.874 | 0.002 |
| NN candidates + fairness reranker | 0.998 | **0.999** | 0.001 | 0.029 | 0.129 | 0.998 | 0.003 |
| Diffusion candidates + fairness reranker | 0.984 | **0.995** | 0.005 | 0.086 | 0.247 | 0.965 | 0.004 |
| NN candidates + RL slate-builder | 0.987 | **1.000** | 0.000 | 0.072 | 0.243 | 0.972 | 0.003 |
| Diffusion candidates + RL slate-builder | 0.887 | **0.997** | 0.003 | 0.133 | 0.391 | 0.944 | 0.005 |

## Read-out

- **Worst-off member lift:** best method `NN candidates + RL slate-builder` raises min-member satisfaction by **+0.000** (+0%) vs the average baseline, with a relevance change of -0.011.
- **Candidate generation (NN vs diffusion, same reranker):** min-member 0.999 -> 0.995, diversity 0.998 -> 0.965, coverage 0.003 -> 0.004.
- **Reranker (bandit vs RL, diffusion pool):** min-member 0.995 -> 0.997; RL beats greedy on val groups: False, PPO contingency triggered: True.

## w2 sweep (fairness knob)

| w2 | Relevance | Min-member | Fairness gap |
| ---: | ---: | ---: | ---: |
| 0.00 | 0.985 | 0.995 | 0.005 |
| 0.25 | 0.985 | 0.995 | 0.004 |
| 0.50 | 0.985 | 0.995 | 0.004 |
| 0.75 | 0.985 | 0.995 | 0.004 |
| 1.00 | 0.985 | 0.996 | 0.004 |
| 1.50 | 0.985 | 0.996 | 0.004 |
| 2.00 | 0.985 | 0.996 | 0.003 |

Figures: `fig_min_member_by_method.png`, `fig_candidate_generation.png`, `fig_w2_sweep.png`, `fig_min_member_by_kind.png`.
