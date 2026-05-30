import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';

// --- Simplified 4-color theme palette ---
export const THEMES = {
  blue: {
    name: 'Blue',
    line: '#3b82f6',
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    port: 'bg-blue-500',
    groupBorder: 'border-blue-400',
    groupBg: 'bg-blue-500/5',
  },
  amber: {
    name: 'Amber',
    line: '#f59e0b',
    border: 'border-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    port: 'bg-amber-500',
    groupBorder: 'border-amber-400',
    groupBg: 'bg-amber-500/5',
  },
  green: {
    name: 'Green',
    line: '#10b981',
    border: 'border-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    port: 'bg-green-500',
    groupBorder: 'border-green-400',
    groupBg: 'bg-green-500/5',
  },
  purple: {
    name: 'Purple',
    line: '#8b5cf6',
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    port: 'bg-purple-500',
    groupBorder: 'border-purple-400',
    groupBg: 'bg-purple-500/5',
  },
};

// --- Default workspace data ---
const defaultWorkspaces = [
  {
    id: 'ws-1',
    name: 'My Workspace',
    nodes: [
      { id: '1', x: 200, y: 150, title: 'First Idea', content: 'Start brainstorming here.', theme: 'blue', groupId: null, cloneSourceId: null, expanded: true },
      { id: '2', x: 550, y: 150, title: 'Second Thought', content: 'Expand on the first idea.', theme: 'amber', groupId: null, cloneSourceId: null, expanded: true },
      { id: '3', x: 200, y: 350, title: 'Supporting Detail', content: 'Add context and references.', theme: 'green', groupId: null, cloneSourceId: null, expanded: true },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '1', target: '3' },
    ],
    groups: [],
  },
];

// --- localStorage persistence helpers ---
const STORAGE_KEY = 'whiteboard-workspaces';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore parse errors
  }
  return null;
}

function saveToStorage(workspaces) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch (e) {
    // ignore quota errors
  }
}

// --- Initial state ---
function getInitialState() {
  const saved = loadFromStorage();
  const workspaces = saved || defaultWorkspaces;
  return {
    workspaces,
    activeTab: workspaces[0]?.id || '',
    nextId: 10,
    transform: { x: 0, y: 0, scale: 1 },
    past: [],
    future: [],
  };
}

// --- Helpers ---
function getActiveWorkspace(state) {
  return state.workspaces.find(ws => ws.id === state.activeTab) || state.workspaces[0];
}

function updateActiveWorkspace(state, updater) {
  return {
    ...state,
    workspaces: state.workspaces.map(ws =>
      ws.id === state.activeTab ? { ...ws, ...updater(ws) } : ws
    ),
  };
}

function takeSnapshot(state) {
  const ws = getActiveWorkspace(state);
  if (!ws) return state;
  const snapshot = { nodes: ws.nodes, edges: ws.edges, groups: ws.groups };
  return {
    ...state,
    past: [...state.past.slice(-49), snapshot],
    future: [],
  };
}

// --- Reducer ---
function workspaceReducer(state, action) {
  switch (action.type) {
    case 'TAKE_SNAPSHOT':
      return takeSnapshot(state);

    case 'ADD_NODE': {
      const snapped = takeSnapshot(state);
      const node = {
        id: String(snapped.nextId),
        x: action.payload.x || 100,
        y: action.payload.y || 100,
        title: action.payload.title || 'New Card',
        content: action.payload.content || '',
        theme: action.payload.theme || 'blue',
        groupId: action.payload.groupId || null,
        cloneSourceId: action.payload.cloneSourceId || null,
        expanded: true,
      };
      return {
        ...updateActiveWorkspace(snapped, ws => ({
          nodes: [...ws.nodes, node],
        })),
        nextId: snapped.nextId + 1,
      };
    }

    case 'UPDATE_NODE': {
      const snapped = takeSnapshot(state);
      return updateActiveWorkspace(snapped, ws => ({
        nodes: ws.nodes.map(n =>
          n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
        ),
      }));
    }

    case 'DELETE_NODE': {
      const snapped = takeSnapshot(state);
      const nodeId = action.payload.id;
      return updateActiveWorkspace(snapped, ws => ({
        nodes: ws.nodes.filter(n => n.id !== nodeId),
        edges: ws.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      }));
    }

    case 'ADD_EDGE': {
      const snapped = takeSnapshot(state);
      const edge = {
        id: `e-${Date.now()}`,
        source: action.payload.source,
        target: action.payload.target,
      };
      return updateActiveWorkspace(snapped, ws => ({
        edges: [...ws.edges, edge],
      }));
    }

    case 'REMOVE_EDGE': {
      const snapped = takeSnapshot(state);
      return updateActiveWorkspace(snapped, ws => ({
        edges: ws.edges.filter(e => e.id !== action.payload.id),
      }));
    }

    case 'ADD_GROUP': {
      const snapped = takeSnapshot(state);
      const group = {
        id: `g-${snapped.nextId}`,
        name: action.payload.name || 'New Group',
        x: action.payload.x || 100,
        y: action.payload.y || 100,
        width: action.payload.width || 400,
        height: action.payload.height || 300,
        theme: action.payload.theme || 'blue',
      };
      return {
        ...updateActiveWorkspace(snapped, ws => ({
          groups: [...ws.groups, group],
        })),
        nextId: snapped.nextId + 1,
      };
    }

    case 'UPDATE_GROUP': {
      const snapped = takeSnapshot(state);
      return updateActiveWorkspace(snapped, ws => ({
        groups: ws.groups.map(g =>
          g.id === action.payload.id ? { ...g, ...action.payload.updates } : g
        ),
      }));
    }

    case 'DELETE_GROUP': {
      const snapped = takeSnapshot(state);
      const groupId = action.payload.id;
      return updateActiveWorkspace(snapped, ws => ({
        groups: ws.groups.filter(g => g.id !== groupId),
        nodes: ws.nodes.map(n =>
          n.groupId === groupId ? { ...n, groupId: null } : n
        ),
      }));
    }

    case 'SET_TRANSFORM':
      return { ...state, transform: action.payload };

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const ws = getActiveWorkspace(state);
      if (!ws) return state;
      const currentSnapshot = { nodes: ws.nodes, edges: ws.edges, groups: ws.groups };
      const previous = state.past[state.past.length - 1];
      return {
        ...updateActiveWorkspace(
          { ...state, past: state.past.slice(0, -1) },
          () => previous
        ),
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future.slice(0, 49)],
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const ws = getActiveWorkspace(state);
      if (!ws) return state;
      const currentSnapshot = { nodes: ws.nodes, edges: ws.edges, groups: ws.groups };
      const next = state.future[0];
      return {
        ...updateActiveWorkspace(
          { ...state, future: state.future.slice(1) },
          () => next
        ),
        past: [...state.past, currentSnapshot],
        future: state.future.slice(1),
      };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload, past: [], future: [] };

    case 'ADD_WORKSPACE': {
      const newWs = {
        id: `ws-${Date.now()}`,
        name: action.payload.name || 'New Workspace',
        nodes: [],
        edges: [],
        groups: [],
      };
      return {
        ...state,
        workspaces: [...state.workspaces, newWs],
        activeTab: newWs.id,
        past: [],
        future: [],
      };
    }

    case 'DELETE_WORKSPACE': {
      const remaining = state.workspaces.filter(ws => ws.id !== action.payload.id);
      if (remaining.length === 0) return state;
      return {
        ...state,
        workspaces: remaining,
        activeTab: state.activeTab === action.payload.id
          ? remaining[0].id
          : state.activeTab,
        past: [],
        future: [],
      };
    }

    case 'RENAME_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map(ws =>
          ws.id === action.payload.id ? { ...ws, name: action.payload.name } : ws
        ),
      };

    case 'IMPORT_DATA': {
      const imported = action.payload.workspaces;
      if (!Array.isArray(imported) || imported.length === 0) return state;
      return {
        ...state,
        workspaces: imported,
        activeTab: imported[0].id,
        past: [],
        future: [],
      };
    }

    case 'SET_WORKSPACES':
      return {
        ...state,
        workspaces: action.payload,
        activeTab: action.payload[0]?.id || state.activeTab,
        past: [],
        future: [],
      };

    default:
      return state;
  }
}

// --- Context ---
const WorkspaceContext = createContext(null);

// --- Provider ---
export function WorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, getInitialState);
  const saveTimeoutRef = useRef(null);

  // Debounced localStorage save on workspace changes
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(state.workspaces);
    }, 500);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.workspaces]);

  const value = React.useMemo(() => ({ state, dispatch }), [state]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// --- Hook ---
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
