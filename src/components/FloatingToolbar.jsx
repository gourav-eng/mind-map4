import React, { useState } from 'react';
import { Circle, ArrowRight, Copy, Link2, X, Layers } from 'lucide-react';
import { THEMES } from '../store';

/**
 * FloatingToolbar - contextual toolbar above selected card(s)
 *
 * Props:
 *   selectedNodes - array of selected node objects
 *   position      - { x, y } screen position for the toolbar (centered above selection)
 *   onAction      - (action: string, payload?: any) => void
 *                   Actions: 'color', 'connect', 'duplicate', 'clone', 'delete', 'group'
 *   visible       - boolean, whether to show the toolbar
 */
export default function FloatingToolbar({
  selectedNodes = [],
  position = { x: 0, y: 0 },
  onAction,
  visible = false,
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (!visible || selectedNodes.length === 0) return null;

  const isMulti = selectedNodes.length > 1;

  const handleAction = (action, payload) => {
    if (action === 'color' && !payload) {
      setShowColorPicker(!showColorPicker);
      return;
    }
    setShowColorPicker(false);
    onAction?.(action, payload);
  };

  const buttonClasses = 'p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900';

  return (
    <div
      className="absolute z-[100] flex flex-col items-center"
      style={{
        left: position.x,
        top: position.y - 8,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Color picker dropdown */}
      {showColorPicker && (
        <div className="flex gap-1.5 mb-2 p-2 bg-white rounded-full shadow-lg border border-slate-200">
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: theme.line }}
              onClick={() => handleAction('color', key)}
              title={theme.name}
            />
          ))}
        </div>
      )}

      {/* Toolbar pill */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-white rounded-full shadow-md border border-slate-200">
        {isMulti ? (
          <>
            {/* Multi-select actions */}
            <button
              className={buttonClasses}
              onClick={() => handleAction('group')}
              title="Group (Ctrl+G)"
            >
              <Layers size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('duplicate')}
              title="Duplicate (Ctrl+D)"
            >
              <Copy size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('delete')}
              title="Delete"
            >
              <X size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('color')}
              title="Color"
            >
              <Circle size={16} />
            </button>
          </>
        ) : (
          <>
            {/* Single card actions */}
            <button
              className={buttonClasses}
              onClick={() => handleAction('color')}
              title="Color"
            >
              <Circle size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('connect')}
              title="Connect"
            >
              <ArrowRight size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('duplicate')}
              title="Duplicate"
            >
              <Copy size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('clone')}
              title="Clone"
            >
              <Link2 size={16} />
            </button>
            <button
              className={buttonClasses}
              onClick={() => handleAction('delete')}
              title="Delete"
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
