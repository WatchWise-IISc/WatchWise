const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchGroups(kind, mode = 'mode1') {
  const params = new URLSearchParams({ kind, mode });
  const res = await fetch(`${API_BASE}/groups?${params.toString()}`);
  return res.json();
}

export async function fetchMode1(gid) {
  const res = await fetch(`${API_BASE}/mode1/recommend?gid=${gid}`);
  return res.json();
}

export async function fetchMode2(gid, allowTeen, providers = []) {
  const params = new URLSearchParams({
    gid,
    allow_teen: allowTeen,
  });
  if (providers.length > 0) {
    params.set('providers', providers.join(','));
  }
  const res = await fetch(
    `${API_BASE}/mode2/recommend?${params.toString()}`
  );
  return res.json();
}

// Throw on non-2xx so callers' catch branches fire instead of silently
// rendering an error body (e.g. a 404 `{detail:"Not Found"}`) as a result.
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMovieGenres() {
  return getJson(`${API_BASE}/movies/genres`);
}

export async function fetchMovieSuggestions(genres = [], limit = 6) {
  const params = new URLSearchParams({ limit });
  if (genres.length > 0) {
    params.set('genres', genres.join(','));
  }
  return getJson(`${API_BASE}/movies/suggestions?${params.toString()}`);
}

export async function searchMovies(query, genres = [], limit = 8) {
  const params = new URLSearchParams({ q: query, limit });
  if (genres.length > 0) {
    params.set('genres', genres.join(','));
  }
  return getJson(`${API_BASE}/movies/search?${params.toString()}`);
}

export async function fetchMode1Custom(members) {
  const res = await fetch(`${API_BASE}/mode1/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(members),
  });
  if (!res.ok) {
    throw new Error(`Backend error: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchMode2Custom(members, allowTeen, providers = []) {
  const params = new URLSearchParams({ allow_teen: allowTeen });
  if (providers.length > 0) {
    params.set('providers', providers.join(','));
  }
  const res = await fetch(`${API_BASE}/mode2/custom?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(members),
  });
  if (!res.ok) {
    throw new Error(`Backend error: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchFamilies() {
  const res = await fetch(`${API_BASE}/mode3/families`);
  return res.json();
}

export async function fetchMode3(familyName) {
  const res = await fetch(`${API_BASE}/mode3/recommend?family=${encodeURIComponent(familyName)}`);
  return res.json();
}

// New: fully customizable cold-start. Pass array of { name: string, genres: string[] }
export async function fetchMode3Custom(members) {
  let res;
  try {
    res = await fetch(`${API_BASE}/mode3/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(members),
    });
  } catch (networkErr) {
    // Network error (no connection, CORS, proxy not working)
    throw new Error('Network error contacting backend. Is the FastAPI server running and is the Vite proxy active?');
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson.detail || JSON.stringify(errJson);
    } catch {
      try {
        detail = await res.text();
      } catch {}
    }
    throw new Error(`Backend error: ${detail}`);
  }
  return res.json();
}
