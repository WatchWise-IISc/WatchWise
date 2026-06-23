import { CohortSet, Recommendation, AblationMethod } from './types';

export const COHORT_PRESETS: CohortSet[] = [
  {
    id: 'divergent-1800',
    name: 'Group Profile #1800 (Divergent Taste)',
    difficulty: 'Divergent (Hardest - Conflicting tastes)',
    difficultyClass: 'error',
    description: 'This cohort consists of co-viewers with highly negative taste correlations (~ -0.45). Grouping them is the ultimate stress test of a cooperative system because traditional average rankers will cause severe dissatisfaction (vetos) for at least one member.',
    members: [
      {
        id: 'm1',
        name: 'Member 1 (Primary)',
        avatarColor: '#5856D6',
        topGenres: ['Thriller', 'Drama', 'Action'],
        anchoredFavorite: 'Usual Suspects, The (1995)',
        satisfactionTraditional: 0.99,
        satisfactionWatchWise: 0.88,
      },
      {
        id: 'm2',
        name: 'Member 2',
        avatarColor: '#007AFF',
        topGenres: ['Drama', 'Comedy', 'Romance'],
        anchoredFavorite: 'Toy Story (1995)',
        satisfactionTraditional: 0.35,
        satisfactionWatchWise: 0.82,
      },
      {
        id: 'm3',
        name: 'Member 3',
        avatarColor: '#D83B01',
        topGenres: ['Drama', 'Comedy', 'Thriller'],
        anchoredFavorite: 'Back to the Future (1985)',
        satisfactionTraditional: 0.82,
        satisfactionWatchWise: 0.85,
      },
      {
        id: 'm4',
        name: 'Member 4',
        avatarColor: '#34C759',
        topGenres: ['Adventure', 'Action', 'Comedy'],
        anchoredFavorite: 'Seven (a.k.a. Se7en) (1995)',
        satisfactionTraditional: 0.12,
        satisfactionWatchWise: 0.80,
      },
    ],
  },
];

export const RECOMMENDATIONS: Recommendation[] = [
  { rank: 1, title: "Singin' in the Rain", genres: ['Comedy', 'Musical', 'Romance'], year: 1952, traditionalMatch: 85, watchwiseMatch: 95 },
  { rank: 2, title: 'X2: X-Men United', genres: ['Action', 'Adventure', 'Sci-Fi'], year: 2003, traditionalMatch: 30, watchwiseMatch: 89 },
  { rank: 3, title: 'Wallace & Gromit: A Close Shave', genres: ['Animation', 'Children', 'Comedy'], year: 1995, traditionalMatch: 68, watchwiseMatch: 88 },
  { rank: 4, title: 'Streetcar Named Desire, A', genres: ['Drama'], year: 1951, traditionalMatch: 45, watchwiseMatch: 84 },
  { rank: 5, title: "There's Something About Mary", genres: ['Comedy', 'Romance'], year: 1998, traditionalMatch: 55, watchwiseMatch: 81 },
];

export const TRADITIONAL_BASELINES: string[] = [
  'Planet Earth II (2016) [Genre: Documentary]',
  'Planet Earth (2006) [Genre: Documentary]',
  'Band of Brothers (2001) [Genre: Action, Drama]',
  'To Kill a Mockingbird (1962) [Genre: Drama]',
  'Good Will Hunting (1997) [Genre: Drama]',
];

export const ABLATION_STUDIES: AblationMethod[] = [
  { name: 'Average baseline (top-K mean)', tag: 'TRADITIONAL STATUS QUO', relevance: 0.99, minSat: 0.12, fairnessGap: 0.87, heldOutNdcg: 0.046, heldOutHit: 0.25, diversity: 0.912, isOptimal: false },
  { name: 'NN candidates + fairness reranker', tag: 'RERANKED RETRIEVAL', relevance: 0.991, minSat: 0.45, fairnessGap: 0.54, heldOutNdcg: 0.021, heldOutHit: 0.15, diversity: 0.996, isOptimal: false },
  { name: 'Diffusion candidates + RL slate-builder', tag: 'WATCHWISE OPTIMAL STACK', relevance: 0.823, minSat: 0.997, fairnessGap: 0.003, heldOutNdcg: 0.127, heldOutHit: 0.50, diversity: 0.975, isOptimal: true },
];

export const LATENT_EMBEDDING_SAMPLES = [
  { seed: '0x3F8A', movie: 'Harry Potter and the Deathly Hallows: Part 1 (2010)', similarity: '84% match' },
  { seed: '0x7F5D', movie: 'X2: X-Men United (2003)', similarity: '92% match' },
  { seed: '0x1A6B', movie: 'X-Men: Days of Future Past (2014)', similarity: '88% match' },
];