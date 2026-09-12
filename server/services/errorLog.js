// In-memory error telemetry. Every silent catch across the worker/services
// reports here so operators can see a feed failing via /api/health instead of
// a black box with dozens of swallowed `catch (e) {}` blocks.
const MAX_ENTRIES = 100;
const log = [];

export function recordError(source, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    source,
    message: String(message || 'unknown error').slice(0, 300)
  };
  if (meta != null) entry.meta = meta;
  log.push(entry);
  if (log.length > MAX_ENTRIES) log.shift();
  if (process.env.AUREUS_SILENT_LOGS !== '1') {
    console.error(`[ERR:${source}] ${entry.message}`);
  }
}

export function getRecentErrors(limit = 25) {
  return log.slice(-limit).reverse();
}

export function clearErrors() {
  log.length = 0;
}