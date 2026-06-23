const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchGroups(kind) {
  const res = await fetch(`${API_BASE}/groups?kind=${kind}`);
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

export async function fetchFamilies() {
  const res = await fetch(`${API_BASE}/mode3/families`);
  return res.json();
}

export async function fetchMode3(familyName) {
  const res = await fetch(`${API_BASE}/mode3/recommend?family=${encodeURIComponent(familyName)}`);
  return res.json();
}
