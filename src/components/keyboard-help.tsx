import { useState, useEffect } from "preact/hooks";

export function KeyboardHelp() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && visible) {
        setVisible(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  if (!visible) {
    return (
      <button
        class="help-toggle"
        onClick={() => setVisible(true)}
        title="Show keyboard shortcuts"
      >
        ?
      </button>
    );
  }

  const closeHelp = () => {
    setVisible(false);
  };

  return (
    <div class="help-overlay" onClick={closeHelp}>
      <div class="help-card" onClick={(e) => e.stopPropagation()}>
        <div class="help-header">
          <h2>Voronoi Viewer</h2>
          <button class="close-btn" onClick={closeHelp}>
            ×
          </button>
        </div>

        <div class="help-section">
          <h3>Keyboard Shortcuts</h3>
          <div class="shortcut-list">
            <div class="shortcut">
              <span class="key">Space</span>
              <span>Pause / Resume</span>
            </div>
            <div class="shortcut">
              <span class="key">A</span>
              <span>Previous palette</span>
            </div>
            <div class="shortcut">
              <span class="key">S</span>
              <span>Next palette</span>
            </div>
            <div class="shortcut">
              <span class="key">R</span>
              <span>Randomize particles</span>
            </div>
            <div class="shortcut">
              <span class="key">V</span>
              <span>Toggle HUD (GUI + controls)</span>
            </div>
            <div class="shortcut">
              <span class="key">F</span>
              <span>Toggle fullscreen</span>
            </div>
            <div class="shortcut">
              <span class="key">E</span>
              <span>Export SVG</span>
            </div>
            <div class="shortcut">
              <span class="key">Enter</span>
              <span>Close this help</span>
            </div>
          </div>
        </div>

        <div class="help-section">
          <h3>Mouse Interactions</h3>
          <div class="shortcut-list">
            <div class="shortcut">
              <span class="key">Click + Drag</span>
              <span>Move particles</span>
            </div>
            <div class="shortcut">
              <span class="key">Double Click</span>
              <span>Add point</span>
            </div>
            <div class="shortcut">
              <span class="key">Alt + Click</span>
              <span>Remove nearest particle</span>
            </div>
          </div>
        </div>

        <div class="help-section">
          <h3>Attractors & Repellers</h3>
          <div class="shortcut-list">
            <div class="shortcut">
              <span class="key">Click</span>
              <span>Place attractor (when motion active)</span>
            </div>
            <div class="shortcut">
              <span class="key">Shift + Click</span>
              <span>Place repeller (when motion active)</span>
            </div>
          </div>
          <p class="note">Enable "Attractors" in the GUI first</p>
        </div>

        <div class="help-section">
          <h3>Tips</h3>
          <ul class="tips">
            <li>Use the <strong>Lloyd Relax</strong> button to evenly distribute particles</li>
            <li>Try different <strong>Motion</strong> modes for varied animations</li>
            <li>Enable <strong>Smooth Cells</strong> for organic curved shapes</li>
            <li>Save your favorite configurations as <strong>Presets</strong></li>
          </ul>
        </div>

        <div class="help-footer">
          <button class="dismiss-btn" onClick={closeHelp}>
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
