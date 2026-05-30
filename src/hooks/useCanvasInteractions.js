import { useState, useRef, useCallback } from 'react';

/**
 * useCanvasInteractions - manages pan, zoom, drag, and selection box logic
 *
 * Parameters:
 *   workspaceRef - React ref to the canvas container DOM element
 *
 * Returns:
 *   transform       - { x, y, scale }
 *   setTransform    - state setter for transform
 *   isPanning       - boolean
 *   selectionBox    - { startX, startY, x, y, width, height } | null
 *   isSelecting     - boolean
 *   handlers        - { onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd }
 */
export function useCanvasInteractions(workspaceRef) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const panStartRef = useRef(null);
  const touchRef = useRef({ initialDistance: null, initialScale: 1 });

  // --- Pointer handlers (pan + selection) ---
  const onPointerDown = useCallback((e) => {
    // Middle mouse button or space+left click triggers pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      return;
    }

    // Left click on canvas background starts selection box
    if (e.button === 0 && e.target === e.currentTarget) {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - transform.x) / transform.scale;
      const worldY = (e.clientY - rect.top - transform.y) / transform.scale;
      setIsSelecting(true);
      setSelectionBox({ startX: worldX, startY: worldY, x: worldX, y: worldY, width: 0, height: 0 });
    }
  }, [transform, workspaceRef]);

  const onPointerMove = useCallback((e) => {
    if (isPanning && panStartRef.current) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }));
      return;
    }

    if (isSelecting && selectionBox) {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - transform.x) / transform.scale;
      const worldY = (e.clientY - rect.top - transform.y) / transform.scale;
      const x = Math.min(selectionBox.startX, worldX);
      const y = Math.min(selectionBox.startY, worldY);
      const width = Math.abs(worldX - selectionBox.startX);
      const height = Math.abs(worldY - selectionBox.startY);
      setSelectionBox(prev => ({ ...prev, x, y, width, height }));
    }
  }, [isPanning, isSelecting, selectionBox, transform, workspaceRef]);

  const onPointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
    if (isSelecting) {
      setIsSelecting(false);
      // selectionBox remains set for the consumer to read, then clear
    }
  }, [isSelecting]);

  // --- Wheel handler (zoom with focal point) ---
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * delta, 0.1), 5);
      const scaleRatio = newScale / prev.scale;
      return {
        x: mouseX - (mouseX - prev.x) * scaleRatio,
        y: mouseY - (mouseY - prev.y) * scaleRatio,
        scale: newScale,
      };
    });
  }, [workspaceRef]);

  // --- Touch handlers (pinch-to-zoom) ---
  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      touchRef.current = { initialDistance: dist, initialScale: transform.scale };
    }
  }, [transform.scale]);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchRef.current.initialDistance) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const scaleRatio = dist / touchRef.current.initialDistance;
      const newScale = Math.min(Math.max(touchRef.current.initialScale * scaleRatio, 0.1), 5);

      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      setTransform(prev => {
        const ratio = newScale / prev.scale;
        return {
          x: midX - (midX - prev.x) * ratio,
          y: midY - (midY - prev.y) * ratio,
          scale: newScale,
        };
      });
    }
  }, [workspaceRef]);

  const onTouchEnd = useCallback(() => {
    touchRef.current = { initialDistance: null, initialScale: 1 };
  }, []);

  // Clear selection box (consumer calls this after reading)
  const clearSelectionBox = useCallback(() => {
    setSelectionBox(null);
  }, []);

  return {
    transform,
    setTransform,
    isPanning,
    selectionBox,
    isSelecting,
    clearSelectionBox,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
