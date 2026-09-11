const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json,text/csv,*/*'
};

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) }
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function fetchText(url, options = {}, timeoutMs = 8000) {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function lastNumericFromFredCsv(csv) {
  if (!csv) return null;
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 1; i--) {
    const parts = lines[i].split(',');
    const value = Number(parts[1]);
    if (Number.isFinite(value)) {
      return { date: parts[0], value };
    }
  }
  return null;
}
