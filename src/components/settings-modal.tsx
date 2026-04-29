import { useState, useCallback, useEffect } from "preact/hooks";
import { CONFIG } from "../lib/config";

interface RangeSetting {
  min: number;
  max: number;
  step: number;
}

interface SettingsData {
  count: RangeSetting;
  speed: RangeSetting;
  cellFillAlpha: RangeSetting;
  edgeWeight: RangeSetting;
  pointSize: RangeSetting;
  vectorFieldScale: RangeSetting;
  smoothing: RangeSetting;
  cellGap: RangeSetting;
  gradientAngle: RangeSetting;
  exportScale: RangeSetting;
}

const DEFAULT_SETTINGS: SettingsData = {
  count: { min: 1, max: 5000, step: 1 },
  speed: { min: 0, max: 20, step: 0.1 },
  cellFillAlpha: { min: 0, max: 1, step: 0.05 },
  edgeWeight: { min: 0.5, max: 20, step: 0.5 },
  pointSize: { min: 1, max: 50, step: 1 },
  vectorFieldScale: { min: 0.001, max: 0.02, step: 0.001 },
  smoothing: { min: 0, max: 1, step: 0.05 },
  cellGap: { min: 0, max: 10, step: 0.5 },
  gradientAngle: { min: 0, max: 360, step: 15 },
  exportScale: { min: 0.5, max: 4, step: 0.5 },
};

const SETTINGS_KEY = "voronoi-gui-settings";

function loadSettings(): SettingsData {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: SettingsData): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: SettingsData) => void;
}

export function SettingsModal({ isOpen, onClose, onApply }: SettingsModalProps) {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<"particles" | "display" | "style" | "export">("particles");

  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
    }
  }, [isOpen]);

  const updateSetting = useCallback(
    (key: keyof SettingsData, field: keyof RangeSetting, value: number) => {
      setSettings((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }));
    },
    [],
  );

  const handleApply = useCallback(() => {
    saveSettings(settings);
    onApply(settings);
    onClose();
  }, [settings, onApply, onClose]);

  const handleReset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const handleSaveAsDefault = useCallback(() => {
    saveSettings(settings);
    onApply(settings);
    // Show brief notification
    const notification = document.createElement("div");
    notification.className = "settings-notification";
    notification.textContent = "Settings saved as default";
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(76, 201, 240, 0.9);
      color: #000;
      padding: 12px 24px;
      border-radius: 6px;
      z-index: 1000;
      font-weight: 500;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 1500);
  }, [settings, onApply]);

  if (!isOpen) return null;

  const tabs = [
    { id: "particles" as const, label: "Particles" },
    { id: "display" as const, label: "Display" },
    { id: "style" as const, label: "Style" },
    { id: "export" as const, label: "Export" },
  ];

  const renderRangeInput = (
    label: string,
    key: keyof SettingsData,
    description?: string,
  ) => {
    const setting = settings[key];
    return (
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">{label}</label>
          {description && <span class="setting-description">{description}</span>}
        </div>
        <div class="range-inputs">
          <div class="input-group">
            <label>Min</label>
            <input
              type="number"
              step="any"
              value={setting.min}
              onInput={(e) =>
                updateSetting(key, "min", parseFloat((e.target as HTMLInputElement).value))
              }
            />
          </div>
          <div class="input-group">
            <label>Max</label>
            <input
              type="number"
              step="any"
              value={setting.max}
              onInput={(e) =>
                updateSetting(key, "max", parseFloat((e.target as HTMLInputElement).value))
              }
            />
          </div>
          <div class="input-group">
            <label>Step</label>
            <input
              type="number"
              step="any"
              value={setting.step}
              onInput={(e) =>
                updateSetting(key, "step", parseFloat((e.target as HTMLInputElement).value))
              }
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div class="settings-overlay" onClick={onClose}>
      <div class="settings-card" onClick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h2>GUI Settings</h2>
          <button class="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div class="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              class={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div class="settings-content">
          {activeTab === "particles" && (
            <>
              {renderRangeInput("Particle Count", "count", "Number of particles in the scene")}
              {renderRangeInput("Motion Speed", "speed", "Speed of particle movement")}
              {renderRangeInput("Noise Scale", "vectorFieldScale", "Vector field noise scale")}
            </>
          )}

          {activeTab === "display" && (
            <>
              {renderRangeInput("Cell Opacity", "cellFillAlpha", "Transparency of cell fills")}
              {renderRangeInput("Smoothing", "smoothing", "Cell boundary smoothing amount")}
              {renderRangeInput("Cell Gap", "cellGap", "Gap between cells for fabrication")}
            </>
          )}

          {activeTab === "style" && (
            <>
              {renderRangeInput("Edge Weight", "edgeWeight", "Thickness of cell edges")}
              {renderRangeInput("Point Size", "pointSize", "Size of point markers")}
              {renderRangeInput("Gradient Angle", "gradientAngle", "Angle for gradient fills")}
            </>
          )}

          {activeTab === "export" && (
            <>
              {renderRangeInput("Export Scale", "exportScale", "Scaling factor for exports")}
            </>
          )}
        </div>

        <div class="settings-footer">
          <button class="footer-btn secondary" onClick={handleReset}>
            Reset to Defaults
          </button>
          <button class="footer-btn secondary" onClick={handleSaveAsDefault}>
            Save as Default
          </button>
          <button class="footer-btn primary" onClick={handleApply}>
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface SettingsButtonProps {
  onApply: (settings: SettingsData) => void;
}

export function SettingsButton({ onApply }: SettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        class="settings-toggle-btn"
        onClick={() => setIsOpen(true)}
        title="GUI Settings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6"></path>
          <path d="m1 12 6 0m6 0 6 0"></path>
        </svg>
        Settings
      </button>
      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} onApply={onApply} />
    </>
  );
}

export type { SettingsData };
