export interface Member {
  id: string;
  name: string;
  avatarColor: string;
  topGenres: string[];
  anchoredFavorite: string;
  satisfactionTraditional: number;
  satisfactionWatchWise: number;
}

export interface Recommendation {
  rank: number;
  title: string;
  genres: string[];
  year: number;
  traditionalMatch: number;
  watchwiseMatch: number;
  traditionalVeto?: boolean;
}

export interface CohortSet {
  id: string;
  name: string;
  difficulty: string;
  difficultyClass: 'error' | 'success' | 'warning';
  description: string;
  members: Member[];
}

export interface AblationMethod {
  name: string;
  tag: string;
  relevance: number;
  minSat: number;
  fairnessGap: number;
  heldOutNdcg: number;
  heldOutHit: number;
  diversity: number;
  isOptimal: boolean;
}