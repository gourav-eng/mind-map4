import React from 'react';
import { THEMES } from '../store';

/**
 * ConnectionLayer - SVG edge rendering with cubic bezier curves
 *
 * Props:
 *   edges      - array of { id, source, target }
 *   nodes      - array of node objects (used to compute positions)
 *   connecting - active connection state: { sourceId, startX, startY, currentX, currentY } | null
 *   onEdgeDelete - (edgeId: string) => void
 *   themes     - THEMES object (optional, defaults to imported THEMES)
 */

const NODE_WIDTH = 280;

// Cubic bezier curve path generator
function drawCurve(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const offset = Math.max(dx * 0.5, 80);
  return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
}

// Get connection points for a node (output = right center, input = left center)
function getNodeOutputPos(node) {
  return { x: node.x + NODE_WIDTH, y: node.y + 40 };
}

function getNodeInputPos(node) {
  return { x: node.x, y: node.y + 40 };
}

export default function ConnectionLayer({
  edges = [],
  nodes = [],
  connecting = null,
  onEdgeDelete,
  themes = THEMES,
}) {
  // Create a lookup map for nodes by id
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible"
      style={{ zIndex: 0 }}
    >
      {/* Arrow markers for each theme */}
      <defs>
        {Object.entries(themes).map(([key, theme]) => (
          <marker
            key={key}
            id={`arrow-${key}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.line} />
          </marker>
        ))}
      </defs>

      {/* Render edges */}
      {edges.map(edge => {
        const sourceNode = nodeMap[edge.source];
        const targetNode = nodeMap[edge.target];
        if (!sourceNode || !targetNode) return null;

        const startPos = getNodeOutputPos(sourceNode);
        const endPos = getNodeInputPos(targetNode);
        const sourceTheme = themes[sourceNode.theme] || themes.blue;
        const path = drawCurve(startPos.x, startPos.y, endPos.x, endPos.y);

        return (
          <g
            key={edge.id}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              onEdgeDelete?.(edge.id);
            }}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Invisible wide path for easier click target */}
            <path
              d={path}
              stroke="transparent"
              strokeWidth={20}
              fill="none"
            />
            {/* Visible path */}
            <path
              d={path}
              stroke={sourceTheme.line}
              strokeWidth={2.5}
              fill="none"
              markerEnd={`url(#arrow-${sourceNode.theme || 'blue'})`}
              className="transition-all duration-200 group-hover:stroke-red-500 group-hover:[stroke-width:4]"
            />
          </g>
        );
      })}

      {/* Active connecting line (dashed, animated) */}
      {connecting && (
        <path
          d={drawCurve(connecting.startX, connecting.startY, connecting.currentX, connecting.currentY)}
          stroke={(themes[nodeMap[connecting.sourceId]?.theme] || themes.blue).line}
          strokeWidth={2.5}
          strokeDasharray="8,6"
          fill="none"
          className="animate-[dash_1s_linear_infinite]"
        />
      )}
    </svg>
  );
}
