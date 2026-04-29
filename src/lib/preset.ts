import { CONFIG, type AppState } from "./config";

const STORAGE_KEY = "voronoi-presets";
const CURRENT_KEY = "voronoi-current-preset";

export interface Preset {
  name: string;
  config: typeof CONFIG;
  particleCount: number;
}

/**
 * Save the current configuration as a preset.
 */
export function savePreset(state: AppState, name: string): void {
  const presets = loadPresets();
  const preset: Preset = {
    name,
    config: { ...CONFIG },
    particleCount: state.particles.length,
  };

  // Check if preset with this name exists and update it
  const existingIndex = presets.findIndex((p) => p.name === name);
  if (existingIndex >= 0) {
    presets[existingIndex] = preset;
  } else {
    presets.push(preset);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Load all saved presets.
 */
export function loadPresets(): Preset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Delete a preset by name.
 */
export function deletePreset(name: string): void {
  const presets = loadPresets();
  const filtered = presets.filter((p) => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Load a preset's configuration into CONFIG.
 */
export function applyPreset(
  preset: Preset,
  state: AppState,
  syncCount: (count: number) => void,
): void {
  // Copy all config values
  Object.assign(CONFIG, preset.config);

  // Update particle count
  syncCount(preset.particleCount);

  // Store as current preset name
  localStorage.setItem(CURRENT_KEY, preset.name);
}

/**
 * Get the name of the last applied preset.
 */
export function getCurrentPresetName(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

/**
 * Save current config as the "current" state (for auto-restore on reload).
 */
export function saveCurrentState(state: AppState): void {
  const preset: Preset = {
    name: "__current__",
    config: { ...CONFIG },
    particleCount: state.particles.length,
  };
  localStorage.setItem(CURRENT_KEY, JSON.stringify(preset));
}

/**
 * Restore the last saved state.
 */
export function restoreCurrentState(
  state: AppState,
  syncCount: (count: number) => void,
): boolean {
  try {
    const data = localStorage.getItem(CURRENT_KEY);
    if (!data) return false;
    const preset: Preset = JSON.parse(data);
    applyPreset(preset, state, syncCount);
    return true;
  } catch {
    return false;
  }
}
