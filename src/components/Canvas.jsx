import React, { useRef } from 'react';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';

/**
 * Canvas - main canvas container with grid background, pan/zoom, and children rendering
 *
 * Props:
 *   workspaceRef - React ref to the canvas container DOM element (used for dimension calculations)
 *   children     - nodes, groups, connections rendered inside the transformed layer
 */
export default function Canvas({ workspaceRef, children }) {
  const internalRef = useRef(null);
  const ref = workspaceRef || internalRef;

  const {
    transform,
    setTransform,
    isPanning,
    selectionBox,
    isSelecting,
    clearSelectionBox,
    handlers,
  } = useCanvasInteractions(ref);

  // Grid background style scales with zoom
  const gridSize = 20 * transform.scale;
  const gridStyle = {
    backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${transform.x % gridSize}px ${transform.y % gridSize}px`,
  };

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden bg-slate-50 select-none"
      style={{
        ...gridStyle,
        cursor: isPanning ? 'grabbing' : 'default',
      }}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onWheel={handlers.onWheel}
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      {/* Transformed layer */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      {/* Selection box overlay */}
      {isSelecting && selectionBox && selectionBox.width > 0 && selectionBox.height > 0 && (
        <div
          className="absolute border border-blue-400 bg-blue-100/20 pointer-events-none"
          style={{
            left: selectionBox.x * transform.scale + transform.x,
            top: selectionBox.y * transform.scale + transform.y,
            width: selectionBox.width * transform.scale,
            height: selectionBox.height * transform.scale,
          }}
        />
      )}
    </div>
  );
}

// Export sub-parts for advanced usage
export { useCanvasInteractions } from '../hooks/useCanvasInteractions';
