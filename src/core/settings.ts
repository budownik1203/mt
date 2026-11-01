// Player options (Warband-style options screen), kept in browser storage.
export interface Settings {
  battleSize: number;      // fighters per side on the field at once
  quality: 0 | 1 | 2;      // internal resolution: 240 / 360 / 480 lines
  gore: 0 | 1;             // 1 = full (severing, gibs), 0 = less blood, no severing
  autoBlock: boolean;
  hints: boolean;
  sens: number;            // mouse sensitivity multiplier
  volume: number;          // 0..1
  invertY: boolean;
  difficulty: 0 | 1 | 2;   // damage taken: 0.6 / 1 / 1.3
}
export const DEFAULTS: Settings = { battleSize: 18, quality: 1, gore: 1, autoBlock: false, hints: true, sens: 1, volume: 0.6, invertY: false, difficulty: 1 };
const KEY = "mb2.settings";
export const settings: Settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* storage blocked */ }
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } }
export const RES = [240, 360, 480];
