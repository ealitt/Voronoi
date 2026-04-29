import { useRef, useEffect, useState } from "preact/hooks";
import { createVoronoiSketch } from "../sketches/voronoi";
import type { AppState } from "../lib/config";
import { ImageDropzone } from "./image-dropzone";
import { SettingsButton, type SettingsData } from "./settings-modal";

export function VoronoiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [key, setKey] = useState(0); // Force re-render on settings change

  useEffect(() => {
    if (!containerRef.current) return;

    const { state: sketchState, destroy } = createVoronoiSketch(containerRef.current);
    setState(sketchState);

    return () => {
      destroy();
    };
  }, []);

  const handleSettingsApply = (settings: SettingsData) => {
    // Force re-creation of sketch with new settings
    setKey((prev) => prev + 1);
  };

  if (!state) {
    return <div ref={containerRef} class="voronoi-container" />;
  }

  return (
    <>
      <div ref={containerRef} class="voronoi-container" />
      <ImageDropzone state={state} />
      <SettingsButton onApply={handleSettingsApply} />
    </>
  );
}
