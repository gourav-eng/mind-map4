import React from 'react';
import { Link2 } from 'lucide-react';
import { THEMES } from '../store';

/**
 * Card - Version B card design (280px width)
 *
 * Props:
 *   node            - { id, x, y, title, content, theme, groupId, cloneSourceId, expanded }
 *   isSelected      - boolean, card is primary selection
 *   isMultiSelected - boolean, card is part of multi-selection
 *   isFocused       - boolean, card has keyboard focus
 *   isDragging      - boolean, card is being dragged
 *   isEditing       - boolean, card is in edit mode
 *   onPointerDown   - (e) => void, for drag initiation
 *   onDoubleClick   - (e) => void, enter edit mode
 *   onPortDragStart - (portType: 'input'|'output', e) => void
 *   onTitleChange   - (newTitle: string) => void
 *   onContentChange - (newContent: string) => void
 *   onEditEnd       - () => void
 */
export default function Card({
  node,
  isSelected = false,
  isMultiSelected = false,
  isFocused = false,
  isDragging = false,
  isEditing = false,
  onPointerDown,
  onDoubleClick,
  onPortDragStart,
  onTitleChange,
  onContentChange,
  onEditEnd,
}) {
  const theme = THEMES[node.theme] || THEMES.blue;
  const themeColor = theme.line;

  // Build className for various states
  let wrapperClasses = 'absolute w-[280px] bg-white rounded-lg shadow-sm transition-all duration-150 group';
  let borderStyle = {};

  if (isDragging) {
    wrapperClasses += ' scale-[1.02] shadow-lg z-50';
  }

  if (isSelected) {
    // Accent border all sides when selected
    borderStyle = { border: `2px solid ${themeColor}` };
  } else if (isMultiSelected) {
    wrapperClasses += ' ring-1 ring-blue-400';
    borderStyle = { border: '1px solid #cbd5e1' };
  } else {
    borderStyle = { border: '1px solid #e2e8f0' };
    wrapperClasses += ' hover:border-slate-300';
  }

  if (isFocused) {
    wrapperClasses += ' ring-2 ring-indigo-500 animate-pulse';
  }

  // Left accent border (4px)
  const leftBorderStyle = {
    borderLeft: `4px solid ${themeColor}`,
  };

  return (
    <div
      className={wrapperClasses}
      style={{
        left: node.x,
        top: node.y,
        ...borderStyle,
        ...leftBorderStyle,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {/* Card content */}
      <div className="p-3">
        {/* Title */}
        {isEditing ? (
          <input
            type="text"
            className="w-full text-sm font-semibold text-slate-800 bg-transparent border-b border-slate-300 outline-none focus:border-blue-500 mb-1"
            value={node.title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            onBlur={onEditEnd}
            onKeyDown={(e) => { if (e.key === 'Escape') onEditEnd?.(); }}
            autoFocus
          />
        ) : (
          <h3 className="text-sm font-semibold text-slate-800 truncate mb-1">
            {node.title}
          </h3>
        )}

        {/* Content / Description */}
        {isEditing ? (
          <textarea
            className="w-full text-xs text-slate-600 bg-transparent border border-slate-200 rounded p-1 outline-none focus:border-blue-500 resize-none"
            value={node.content || ''}
            onChange={(e) => onContentChange?.(e.target.value)}
            rows={4}
          />
        ) : (
          node.content && (
            <p className="text-xs text-slate-600 line-clamp-3">
              {node.content}
            </p>
          )
        )}
      </div>

      {/* Clone source indicator */}
      {node.cloneSourceId && (
        <div className="absolute bottom-2 right-2 text-slate-400">
          <Link2 size={12} />
        </div>
      )}

      {/* Connection ports - visible on hover */}
      {/* Input port (left center) */}
      <div
        className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair"
        style={{ backgroundColor: themeColor }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPortDragStart?.('input', e);
        }}
      />

      {/* Output port (right center) */}
      <div
        className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair"
        style={{ backgroundColor: themeColor }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPortDragStart?.('output', e);
        }}
      />
    </div>
  );
}
