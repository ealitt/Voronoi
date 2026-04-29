export const PALETTES: Record<string, string[]> = {
  Sunset: ["#ff6b6b", "#feca57", "#ff9ff3", "#54a0ff", "#5f27cd"],
  Ocean: ["#0fb9b1", "#2bcbba", "#45aaf2", "#4b7bec", "#3867d6"],
  Forest: ["#26de81", "#20bf6b", "#0fb9b1", "#2d98da", "#4b6584"],
  Mono: ["#222222", "#444444", "#666666", "#888888", "#aaaaaa", "#cccccc"],
  Candy: ["#ffafcc", "#ffc8dd", "#cdb4db", "#bde0fe", "#a2d2ff"],
  Neon: ["#f72585", "#7209b7", "#3a0ca3", "#4361ee", "#4cc9f0"],
  Aurora: ["#00d4ff", "#00ff9f", "#ffeb3b", "#ff6b6b", "#c56cf0"],
  Ember: ["#ff9f43", "#ff6b6b", "#ee5a6f", "#c44569", "#6c5ce7"],
  Oceanic: ["#0077b6", "#00b4d8", "#90e0ef", "#caf0f8", "#03045e"],
  Desert: ["#e07a5f", "#3d405b", "#81b29a", "#f2cc8f", "#f4f1de"],
  Grape: ["#7b2cbf", "#9d4edd", "#c77dff", "#e0aaff", "#f0e6ff"],
  Berry: ["#880d1e", "#c9184a", "#ff4d6d", "#ff758f", "#ff8fa3"],
  ForestDark: ["#1b4332", "#2d6a4f", "#40916c", "#52b788", "#74c69d"],
  Sunset2: ["#ff595e", "#ff924c", "#ffca3a", "#c5ca30", "#8ac926"],
  Cool: ["#0081a7", "#00afb9", "#00cdc2", "#a8ebf0", "#f0f3bd"],
  Heatmap: ["#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000"],
  Plasma: ["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636"],
  Viridis: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e"],
  Solar: ["#5e3c58", "#874c77", "#b86786", "#e891a3", "#fbc4a6"],
  Magma: ["#000004", "#1c1144", "#641c75", "#c33f55", "#feaf2d"],
};

export function getRandomPaletteName(): string {
  const names = Object.keys(PALETTES);
  return names[Math.floor(Math.random() * names.length)];
}

export function shufflePalette(paletteName: string): string[] {
  const palette = PALETTES[paletteName];
  if (!palette) return [];
  const shuffled = [...palette];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
