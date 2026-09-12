// Realtime state persistence: serializes the 5m series + sirens to disk so an
// accidental server restart doesn't blank the pulse or forget active reversals.
// Called once at boot (load) and on a debounce from cronWorker (save).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordError } from './errorLog.js';
import * as seriesEngine from './seriesEngine.js';
import * as confluenceSirens from './confluenceSirens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../data/realtime_state.json');

export function loadStateFromDisk() {
  try {
    if (!fs.existsSync(FILE)) return;
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    if (!data || typeof data !== 'object') return;
    seriesEngine.loadFromDisk(data.series);
    confluenceSirens.loadFromDisk(data.sirens);
    console.log('[Aureus State] Realtime state restored from disk.');
  } catch (err) {
    recordError('stateLoad', err?.message);
  }
}

export function persistStateToDisk() {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      series: seriesEngine.serializeForDisk(),
      sirens: confluenceSirens.serializeForDisk()
    };
    fs.writeFileSync(FILE, JSON.stringify(payload), 'utf-8');
  } catch (err) {
    recordError('statePersist', err?.message);
  }
}