import React from 'react';
import { THEMES } from '../store';

/**
 * Group - flat group rendering with dashed border and theme tint
 *
 * Props:
 *   group         - { id, name, x, y, width, height, theme }
 *   isSelected    - boolean
 *   onPointerDown - (e) => void, for drag initiation
 *   onDelete      - () => void
 *   onColorChange - (newTheme: string) => void
 *   onNameChange  - (newName: string) => void
 */
export default function Group({
  group,
  isSelected = false,
  onPointerDown,
  onDelete,
  onColorChange,
  onNameChange,
}) {
  const theme = THEMES[group.theme] || THEMES.blue;
  const themeColor = theme.line;

  return (
    <div
      className={`absolute rounded-lg ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        border: `2px dashed ${themeColor}`,
        backgroundColor: `${themeColor}0D`, // ~5% opacity
      }}
      onPointerDown={onPointerDown}
    >
      {/* Group label top-left */}
      <div
        className="absolute -top-0.5 left-3 px-2 py-0.5 text-xs font-semibold rounded-b select-none"
        style={{ color: themeColor }}
      >
        {group.name}
      </div>
    </div>
  );
}
