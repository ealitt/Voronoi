import { useCallback, useState, useEffect } from "preact/hooks";
import { CONFIG, type AppState } from "../lib/config";
import { loadImageFromFile, clearImage, hasImage as checkHasImage } from "../lib/image-processor";

interface ImageDropzoneProps {
  state: AppState;
}

export function ImageDropzone({ state }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hasImageLocal, setHasImageLocal] = useState(false);

  // Check for image state changes
  useEffect(() => {
    setHasImageLocal(checkHasImage(state));
  }, [state]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the window
    if (e.target === window || e.target === document.documentElement) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith("image/")) {
        alert("Please drop an image file (PNG, JPG, or HEIC).");
        return;
      }

      try {
        await loadImageFromFile(file, state);
        setHasImageLocal(true);
        if (state.gui) {
          state.gui.updateDisplay();
        }
      } catch (error) {
        alert(`Error loading image: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    [state],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up window-level event listeners for drag and drop
  useEffect(() => {
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", handleDragEnd);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", handleDragEnd);
    };
  }, [handleDragOver, handleDragLeave, handleDrop, handleDragEnd]);

  const handleFileInput = useCallback(
    async (e: Event) => {
      const input = e.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      try {
        await loadImageFromFile(file, state);
        setHasImageLocal(true);
        if (state.gui) {
          state.gui.updateDisplay();
        }
        // Reset input
        input.value = "";
      } catch (error) {
        alert(`Error loading image: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    [state],
  );

  const handleClearImage = useCallback(() => {
    clearImage(state);
    setHasImageLocal(false);
    if (state.gui) {
      state.gui.updateDisplay();
    }
  }, [state]);

  return (
    <>
      {/* Drag overlay - shown when dragging */}
      {isDragging && (
        <div class="drag-overlay">
          <div class="drag-message">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <h2>Drop an image to create Voronoi</h2>
            <p>Supports PNG, JPG, HEIC</p>
          </div>
        </div>
      )}

      {/* Image mode indicator */}
      {hasImageLocal && (
        <div class="image-mode-indicator">
          <span class="indicator-dot"></span>
          <span class="indicator-text">Image Mode</span>
          <button class="clear-image-btn" onClick={handleClearImage} title="Clear image">
            ✕
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        id="image-upload"
        class="hidden-file-input"
        accept="image/png,image/jpeg,image/jpg,image/heic,image/heif"
        onChange={handleFileInput}
      />

      {/* Upload hint button (only show when no image) */}
      {!hasImageLocal && (
        <button
          class="upload-hint-btn"
          onClick={() => document.getElementById("image-upload")?.click()}
          title="Click or drag & drop an image"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          Image
        </button>
      )}
    </>
  );
}
