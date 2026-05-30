import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useWorkspace, THEMES } from './store';
import Card from './components/Card';
import ConnectionLayer from './components/ConnectionLayer';
import Group from './components/Group';
import FloatingToolbar from './components/FloatingToolbar';
import MiniMap from './components/MiniMap';
import {
  Plus, Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  PanelLeftOpen, PanelLeftClose, Download, Upload, Map
} from 'lucide-react';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 80;

export default function App() {
  const { state, dispatch } = useWorkspace();
  const workspaceRef = useRef(null);

  // Local UI state
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [clipboard, setClipboard] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  // Drag state
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [panning, setPanning] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [renamingTab, setRenamingTab] = useState(null);

  const transform = state.transform;

  // Derived data
  const activeWs = state.workspaces.find(ws => ws.id === state.activeTab) || state.workspaces[0];
  const nodes = activeWs?.nodes || [];
  const edges = activeWs?.edges || [];
  const groups = activeWs?.groups || [];

  const setTransform = useCallback((t) => {
    const next = typeof t === 'function' ? t(state.transform) : t;
    dispatch({ type: 'SET_TRANSFORM', payload: next });
  }, [dispatch, state.transform]);

  // Viewport center in world coordinates
  const getViewportCenter = useCallback(() => {
    const el = workspaceRef.current;
    if (!el) return { x: 400, y: 300 };
    const rect = el.getBoundingClientRect();
    return {
      x: (rect.width / 2 - transform.x) / transform.scale,
      y: (rect.height / 2 - transform.y) / transform.scale,
    };
  }, [transform]);

  // Screen position from world position
  const worldToScreen = useCallback((wx, wy) => ({
    x: wx * transform.scale + transform.x,
    y: wy * transform.scale + transform.y,
  }), [transform]);

  // World position from screen position
  const screenToWorld = useCallback((sx, sy) => ({
    x: (sx - transform.x) / transform.scale,
    y: (sy - transform.y) / transform.scale,
  }), [transform]);

  // --- Card creation ---
  const createCard = useCallback((x, y, opts = {}) => {
    dispatch({ type: 'ADD_NODE', payload: { x, y, ...opts } });
    const newId = String(state.nextId);
    setSelectedIds([newId]);
    setEditingId(null);
    return newId;
  }, [dispatch, state.nextId]);

  const createConnectedCard = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const srcNode = nodes.find(n => n.id === selectedIds[0]);
    if (!srcNode) return;
    const x = srcNode.x + NODE_WIDTH + 40;
    const y = srcNode.y;
    dispatch({ type: 'ADD_NODE', payload: { x, y, theme: srcNode.theme } });
    const newId = String(state.nextId);
    dispatch({ type: 'ADD_EDGE', payload: { source: srcNode.id, target: newId } });
    setSelectedIds([newId]);
  }, [selectedIds, nodes, dispatch, state.nextId]);

  // --- Delete selected ---
  const deleteSelected = useCallback(() => {
    selectedIds.forEach(id => dispatch({ type: 'DELETE_NODE', payload: { id } }));
    setSelectedIds([]);
    setEditingId(null);
  }, [selectedIds, dispatch]);

  // --- Duplicate selected ---
  const duplicateSelected = useCallback(() => {
    const newIds = [];
    selectedIds.forEach(id => {
      const n = nodes.find(nd => nd.id === id);
      if (n) {
        dispatch({ type: 'ADD_NODE', payload: { x: n.x + 40, y: n.y + 40, title: n.title, content: n.content, theme: n.theme } });
        newIds.push(String(state.nextId + newIds.length));
      }
    });
    setSelectedIds(newIds);
  }, [selectedIds, nodes, dispatch, state.nextId]);

  // --- Group selected ---
  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
    if (selectedNodes.length < 2) return;
    const minX = Math.min(...selectedNodes.map(n => n.x)) - 20;
    const minY = Math.min(...selectedNodes.map(n => n.y)) - 30;
    const maxX = Math.max(...selectedNodes.map(n => n.x + NODE_WIDTH)) + 20;
    const maxY = Math.max(...selectedNodes.map(n => n.y + NODE_HEIGHT)) + 20;
    // Generate groupId upfront and pass it in the payload so we don't rely on predicting the reducer's ID
    const groupId = `g-${state.nextId}`;
    dispatch({ type: 'ADD_GROUP', payload: { id: groupId, x: minX, y: minY, width: maxX - minX, height: maxY - minY } });
    selectedNodes.forEach(n => {
      dispatch({ type: 'UPDATE_NODE', payload: { id: n.id, updates: { groupId } } });
    });
  }, [selectedIds, nodes, dispatch, state.nextId]);

  // --- Toolbar action handler ---
  const handleToolbarAction = useCallback((action, payload) => {
    switch (action) {
      case 'delete': deleteSelected(); break;
      case 'duplicate': duplicateSelected(); break;
      case 'clone': {
        if (selectedIds.length === 1) {
          const src = nodes.find(n => n.id === selectedIds[0]);
          if (src) {
            dispatch({ type: 'ADD_NODE', payload: { x: src.x + 40, y: src.y + 40, title: src.title, content: src.content, theme: src.theme, cloneSourceId: src.id } });
          }
        }
        break;
      }
      case 'color': {
        if (payload) {
          selectedIds.forEach(id => dispatch({ type: 'UPDATE_NODE', payload: { id, updates: { theme: payload } } }));
        }
        break;
      }
      case 'group': groupSelected(); break;
      case 'connect': break;
      default: break;
    }
  }, [deleteSelected, duplicateSelected, groupSelected, selectedIds, nodes, dispatch]);

  // --- Canvas pointer handlers ---
  const handleCanvasPointerDown = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    setContextMenu(null);
    const isMiddle = e.button === 1;
    const isAlt = e.altKey;
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isMiddle || isAlt) {
      setPanning({ startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (isCtrlOrCmd && e.button === 0) {
      // Start box selection
      const rect = workspaceRef.current.getBoundingClientRect();
      setSelectionBox({ startX: e.clientX - rect.left, startY: e.clientY - rect.top, endX: e.clientX - rect.left, endY: e.clientY - rect.top });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button === 0) {
      setSelectedIds([]);
      setEditingId(null);
      setFocusedId(null);
      setPanning({ startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [transform]);

  const handleCanvasPointerMove = useCallback((e) => {
    if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setTransform({ x: panning.tx + dx, y: panning.ty + dy, scale: transform.scale });
    }
    if (selectionBox) {
      const rect = workspaceRef.current.getBoundingClientRect();
      setSelectionBox(prev => ({ ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top }));
    }
    if (connecting) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      setConnecting(prev => ({ ...prev, currentX: world.x, currentY: world.y }));
    }
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / transform.scale;
      const dy = (e.clientY - dragging.startY) / transform.scale;
      const node = nodes.find(n => n.id === dragging.nodeId);
      if (node) {
        dispatch({ type: 'UPDATE_NODE_SILENT', payload: { id: dragging.nodeId, updates: { x: dragging.origX + dx, y: dragging.origY + dy } } });
        // If node is in a group, move together
        if (node.groupId) {
          const groupNodes = nodes.filter(n => n.groupId === node.groupId && n.id !== node.id);
          // Only move if dragging the group header (handled separately)
        }
      }
    }
  }, [panning, selectionBox, connecting, dragging, transform, screenToWorld, nodes, dispatch, setTransform]);

  const handleCanvasPointerUp = useCallback((e) => {
    if (selectionBox) {
      // Compute selected nodes within the box
      const rect = workspaceRef.current.getBoundingClientRect();
      const x1 = Math.min(selectionBox.startX, selectionBox.endX);
      const y1 = Math.min(selectionBox.startY, selectionBox.endY);
      const x2 = Math.max(selectionBox.startX, selectionBox.endX);
      const y2 = Math.max(selectionBox.startY, selectionBox.endY);
      const selected = nodes.filter(n => {
        const sp = worldToScreen(n.x, n.y);
        const ep = worldToScreen(n.x + NODE_WIDTH, n.y + NODE_HEIGHT);
        return sp.x < x2 && ep.x > x1 && sp.y < y2 && ep.y > y1;
      });
      setSelectedIds(selected.map(n => n.id));
      setSelectionBox(null);
    }
    if (connecting) {
      // Check if pointer is over a card
      const rect = workspaceRef.current.getBoundingClientRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const target = nodes.find(n =>
        n.id !== connecting.sourceId &&
        world.x >= n.x && world.x <= n.x + NODE_WIDTH &&
        world.y >= n.y && world.y <= n.y + NODE_HEIGHT
      );
      if (target) {
        dispatch({ type: 'ADD_EDGE', payload: { source: connecting.sourceId, target: target.id } });
      }
      setConnecting(null);
    }
    setPanning(null);
    setDragging(null);
  }, [selectionBox, connecting, nodes, worldToScreen, screenToWorld, dispatch]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = workspaceRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, transform.scale * delta));
    const ratio = newScale / transform.scale;
    setTransform({
      scale: newScale,
      x: mx - (mx - transform.x) * ratio,
      y: my - (my - transform.y) * ratio,
    });
  }, [transform, setTransform]);

  const handleCanvasDoubleClick = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    createCard(world.x - NODE_WIDTH / 2, world.y - NODE_HEIGHT / 2);
  }, [screenToWorld, createCard]);

  const handleCanvasContextMenu = useCallback((e) => {
    e.preventDefault();
    const rect = workspaceRef.current.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'canvas' });
  }, []);

  // --- Card event handlers ---
  const handleCardPointerDown = useCallback((nodeId, e) => {
    e.stopPropagation();
    setContextMenu(null);
    if (e.button !== 0) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
    } else {
      if (!selectedIds.includes(nodeId)) setSelectedIds([nodeId]);
    }
    dispatch({ type: 'TAKE_SNAPSHOT' });
    setDragging({ nodeId, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y });
  }, [nodes, selectedIds, dispatch]);

  const handleCardDoubleClick = useCallback((nodeId, e) => {
    e.stopPropagation();
    setEditingId(nodeId);
    setSelectedIds([nodeId]);
  }, []);

  const handleCardContextMenu = useCallback((nodeId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds([nodeId]);
    const rect = workspaceRef.current.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'card', nodeId });
  }, []);

  const handlePortDragStart = useCallback((nodeId, portType, e) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const startX = portType === 'output' ? node.x + NODE_WIDTH : node.x;
    const startY = node.y + 40;
    setConnecting({ sourceId: nodeId, startX, startY, currentX: startX, currentY: startY });
  }, [nodes]);

  // --- Group drag ---
  const handleGroupPointerDown = useCallback((groupId, e) => {
    e.stopPropagation();
    setSelectedIds([]);
    // For groups, initiate a group drag (move all nodes in group)
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    // Capture original node positions at pointer-down time to avoid in-place mutation
    const nodePositions = {};
    nodes.filter(n => n.groupId === groupId).forEach(n => {
      nodePositions[n.id] = { x: n.x, y: n.y };
    });
    dispatch({ type: 'TAKE_SNAPSHOT' });
    setDragging({ groupId, startX: e.clientX, startY: e.clientY, origX: group.x, origY: group.y, nodePositions });
  }, [groups, nodes, dispatch]);

  // Override drag for groups
  const handleCanvasPointerMoveWithGroups = useCallback((e) => {
    if (dragging && dragging.groupId) {
      const dx = (e.clientX - dragging.startX) / transform.scale;
      const dy = (e.clientY - dragging.startY) / transform.scale;
      dispatch({ type: 'UPDATE_GROUP_SILENT', payload: { id: dragging.groupId, updates: { x: dragging.origX + dx, y: dragging.origY + dy } } });
      // Move all nodes in this group using positions captured at pointer-down
      const groupNodes = nodes.filter(n => n.groupId === dragging.groupId);
      groupNodes.forEach(n => {
        const orig = dragging.nodePositions[n.id];
        if (orig) {
          dispatch({ type: 'UPDATE_NODE_SILENT', payload: { id: n.id, updates: { x: orig.x + dx, y: orig.y + dy } } });
        }
      });
      return;
    }
    handleCanvasPointerMove(e);
  }, [dragging, transform, nodes, dispatch, handleCanvasPointerMove]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (isInput) return;

      if (e.key === 'Escape') {
        setEditingId(null);
        setSelectedIds([]);
        setContextMenu(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) { deleteSelected(); e.preventDefault(); }
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey) {
          const center = getViewportCenter();
          createCard(center.x - NODE_WIDTH / 2, center.y - NODE_HEIGHT / 2);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        if (!e.ctrlKey && !e.metaKey) { setShowMiniMap(v => !v); e.preventDefault(); }
        return;
      }
      if (e.key === 'Tab') {
        if (selectedIds.length === 1) { createConnectedCard(); e.preventDefault(); }
        return;
      }
      if (e.key === 'Enter') {
        if (selectedIds.length === 1 && !editingId) { setEditingId(selectedIds[0]); e.preventDefault(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) dispatch({ type: 'REDO' });
        else dispatch({ type: 'UNDO' });
        e.preventDefault(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        dispatch({ type: 'REDO' }); e.preventDefault(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        setClipboard(nodes.filter(n => selectedIds.includes(n.id))); e.preventDefault(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard.length > 0) {
          clipboard.forEach(n => {
            dispatch({ type: 'ADD_NODE', payload: { x: n.x + 40, y: n.y + 40, title: n.title, content: n.content, theme: n.theme } });
          });
          e.preventDefault();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        duplicateSelected(); e.preventDefault(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        groupSelected(); e.preventDefault(); return;
      }
      // Arrow key nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
        const dx = e.key === 'ArrowLeft' ? -20 : e.key === 'ArrowRight' ? 20 : 0;
        const dy = e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0;
        selectedIds.forEach(id => {
          const n = nodes.find(nd => nd.id === id);
          if (n) dispatch({ type: 'UPDATE_NODE', payload: { id, updates: { x: n.x + dx, y: n.y + dy } } });
        });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingId, nodes, clipboard, dispatch, deleteSelected, duplicateSelected, groupSelected, createCard, createConnectedCard, getViewportCenter]);

  // --- Import / Export ---
  const handleExport = useCallback(() => {
    const data = { workspaces: state.workspaces, activeTab: state.activeTab, nextId: state.nextId };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'workspace-export.json'; a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.workspaces) dispatch({ type: 'IMPORT_DATA', payload: data });
        } catch (err) { /* ignore */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [dispatch]);

  // --- Context menu actions ---
  const handleContextAction = useCallback((action) => {
    if (!contextMenu) return;
    const world = screenToWorld(contextMenu.x, contextMenu.y);
    switch (action) {
      case 'addCard': createCard(world.x - NODE_WIDTH / 2, world.y - NODE_HEIGHT / 2); break;
      case 'paste':
        if (clipboard.length > 0) {
          clipboard.forEach(n => {
            dispatch({ type: 'ADD_NODE', payload: { x: world.x, y: world.y, title: n.title, content: n.content, theme: n.theme } });
          });
        }
        break;
      case 'edit': if (contextMenu.nodeId) setEditingId(contextMenu.nodeId); break;
      case 'duplicate':
        if (contextMenu.nodeId) {
          const n = nodes.find(nd => nd.id === contextMenu.nodeId);
          if (n) dispatch({ type: 'ADD_NODE', payload: { x: n.x + 40, y: n.y + 40, title: n.title, content: n.content, theme: n.theme } });
        }
        break;
      case 'clone':
        if (contextMenu.nodeId) {
          const n = nodes.find(nd => nd.id === contextMenu.nodeId);
          if (n) dispatch({ type: 'ADD_NODE', payload: { x: n.x + 40, y: n.y + 40, title: n.title, content: n.content, theme: n.theme, cloneSourceId: n.id } });
        }
        break;
      case 'delete':
        if (contextMenu.nodeId) dispatch({ type: 'DELETE_NODE', payload: { id: contextMenu.nodeId } });
        break;
      default: break;
    }
    setContextMenu(null);
  }, [contextMenu, screenToWorld, createCard, clipboard, nodes, dispatch]);

  // --- Zoom helpers ---
  const zoomIn = () => {
    const el = workspaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newScale = Math.min(3, transform.scale * 1.2);
    const ratio = newScale / transform.scale;
    setTransform({ scale: newScale, x: cx - (cx - transform.x) * ratio, y: cy - (cy - transform.y) * ratio });
  };
  const zoomOut = () => {
    const el = workspaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newScale = Math.max(0.1, transform.scale * 0.8);
    const ratio = newScale / transform.scale;
    setTransform({ scale: newScale, x: cx - (cx - transform.x) * ratio, y: cy - (cy - transform.y) * ratio });
  };
  const fitView = () => {
    if (nodes.length === 0) { setTransform({ x: 0, y: 0, scale: 1 }); return; }
    const el = workspaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minX = Math.min(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxX = Math.max(...nodes.map(n => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map(n => n.y + NODE_HEIGHT));
    const padding = 60;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scale = Math.min(rect.width / contentW, rect.height / contentH, 1.5);
    const x = (rect.width - contentW * scale) / 2 - (minX - padding) * scale;
    const y = (rect.height - contentH * scale) / 2 - (minY - padding) * scale;
    setTransform({ x, y, scale });
  };

  // --- Floating toolbar position ---
  const toolbarPosition = (() => {
    if (selectedIds.length === 0) return { x: 0, y: 0 };
    const selected = nodes.filter(n => selectedIds.includes(n.id));
    if (selected.length === 0) return { x: 0, y: 0 };
    const centerX = selected.reduce((s, n) => s + n.x + NODE_WIDTH / 2, 0) / selected.length;
    const minY = Math.min(...selected.map(n => n.y));
    const sp = worldToScreen(centerX, minY);
    return { x: sp.x, y: sp.y };
  })();

  // --- Compute group sizes dynamically ---
  const computedGroups = groups.map(g => {
    const groupNodes = nodes.filter(n => n.groupId === g.id);
    if (groupNodes.length === 0) return { ...g, width: 200, height: 100 };
    const minX = Math.min(...groupNodes.map(n => n.x)) - 20;
    const minY = Math.min(...groupNodes.map(n => n.y)) - 30;
    const maxX = Math.max(...groupNodes.map(n => n.x + NODE_WIDTH)) + 20;
    const maxY = Math.max(...groupNodes.map(n => n.y + NODE_HEIGHT)) + 20;
    return { ...g, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });

  // --- Workspace tab handlers ---
  const addWorkspace = () => dispatch({ type: 'ADD_WORKSPACE', payload: { name: 'New Workspace' } });
  const deleteWorkspace = (id) => dispatch({ type: 'DELETE_WORKSPACE', payload: { id } });
  const switchTab = (id) => { dispatch({ type: 'SET_ACTIVE_TAB', payload: id }); setSelectedIds([]); setEditingId(null); };
  const renameWorkspace = (id, name) => { dispatch({ type: 'RENAME_WORKSPACE', payload: { id, name } }); setRenamingTab(null); };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // --- RENDER ---
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 truncate">{activeWs?.name || 'Workspace'}</h2>
            <button onClick={() => setShowSidebar(false)} className="text-slate-400 hover:text-slate-600">
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs text-slate-500 uppercase font-semibold mb-2 px-1">Cards ({nodes.length})</div>
            {nodes.map(n => {
              const theme = THEMES[n.theme] || THEMES.blue;
              return (
                <button
                  key={n.id}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-slate-100 ${selectedIds.includes(n.id) ? 'bg-slate-100' : ''}`}
                  onClick={() => {
                    setSelectedIds([n.id]);
                    setFocusedId(n.id);
                    // Pan to node
                    const el = workspaceRef.current;
                    if (el) {
                      const rect = el.getBoundingClientRect();
                      setTransform({ ...transform, x: rect.width / 2 - (n.x + NODE_WIDTH / 2) * transform.scale, y: rect.height / 2 - (n.y + NODE_HEIGHT / 2) * transform.scale });
                    }
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: theme.line }} />
                  <span className="truncate text-slate-700">{n.title || 'Untitled'}</span>
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-200 flex gap-1">
            <button onClick={handleExport} className="flex-1 text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 flex items-center gap-1 justify-center text-slate-600">
              <Download size={12} /> Export
            </button>
            <button onClick={handleImport} className="flex-1 text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 flex items-center gap-1 justify-center text-slate-600">
              <Upload size={12} /> Import
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs bar */}
        <div className="h-9 flex items-center bg-white border-b border-slate-200 px-2 gap-1 flex-shrink-0">
          {!showSidebar && (
            <button onClick={() => setShowSidebar(true)} className="p-1 text-slate-400 hover:text-slate-600 mr-1">
              <PanelLeftOpen size={16} />
            </button>
          )}
          {state.workspaces.map(ws => (
            <div
              key={ws.id}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer select-none ${ws.id === state.activeTab ? 'bg-slate-100 text-slate-800 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
              onClick={() => switchTab(ws.id)}
              onDoubleClick={() => setRenamingTab(ws.id)}
            >
              {renamingTab === ws.id ? (
                <input
                  className="w-20 text-xs bg-transparent border-b border-slate-400 outline-none"
                  defaultValue={ws.name}
                  autoFocus
                  onBlur={(e) => renameWorkspace(ws.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameWorkspace(ws.id, e.target.value); if (e.key === 'Escape') setRenamingTab(null); }}
                />
              ) : (
                <span>{ws.name}</span>
              )}
              {state.workspaces.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }} className="text-slate-400 hover:text-red-500 ml-1">
                  &times;
                </button>
              )}
            </div>
          ))}
          <button onClick={addWorkspace} className="p-1 text-slate-400 hover:text-slate-600 ml-1" title="New workspace">
            <Plus size={14} />
          </button>
        </div>

        {/* Canvas area */}
        <div
          ref={workspaceRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMoveWithGroups}
          onPointerUp={handleCanvasPointerUp}
          onWheel={handleWheel}
          onDoubleClick={handleCanvasDoubleClick}
          onContextMenu={handleCanvasContextMenu}
          style={{ touchAction: 'none' }}
        >
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
            backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
            backgroundPosition: `${transform.x}px ${transform.y}px`,
          }} />

          {/* Transform layer */}
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
          >
            {/* Groups */}
            {computedGroups.map(g => (
              <Group
                key={g.id}
                group={g}
                isSelected={false}
                onPointerDown={(e) => handleGroupPointerDown(g.id, e)}
                onDelete={() => dispatch({ type: 'DELETE_GROUP', payload: { id: g.id } })}
                onColorChange={(theme) => dispatch({ type: 'UPDATE_GROUP', payload: { id: g.id, updates: { theme } } })}
                onNameChange={(name) => dispatch({ type: 'UPDATE_GROUP', payload: { id: g.id, updates: { name } } })}
              />
            ))}

            {/* Connections */}
            <ConnectionLayer
              edges={edges}
              nodes={nodes}
              connecting={connecting}
              onEdgeDelete={(id) => dispatch({ type: 'REMOVE_EDGE', payload: { id } })}
            />

            {/* Cards */}
            {nodes.map(n => (
              <Card
                key={n.id}
                node={n}
                isSelected={selectedIds.length === 1 && selectedIds[0] === n.id}
                isMultiSelected={selectedIds.length > 1 && selectedIds.includes(n.id)}
                isFocused={focusedId === n.id}
                isDragging={dragging?.nodeId === n.id}
                isEditing={editingId === n.id}
                onPointerDown={(e) => handleCardPointerDown(n.id, e)}
                onDoubleClick={(e) => handleCardDoubleClick(n.id, e)}
                onPortDragStart={(type, e) => handlePortDragStart(n.id, type, e)}
                onTitleChange={(title) => dispatch({ type: 'UPDATE_NODE_SILENT', payload: { id: n.id, updates: { title } } })}
                onContentChange={(content) => dispatch({ type: 'UPDATE_NODE_SILENT', payload: { id: n.id, updates: { content } } })}
                onEditEnd={() => setEditingId(null)}
              />
            ))}
          </div>

          {/* Selection box */}
          {selectionBox && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-400/10 rounded pointer-events-none"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY),
              }}
            />
          )}

          {/* Floating Toolbar */}
          <FloatingToolbar
            selectedNodes={nodes.filter(n => selectedIds.includes(n.id))}
            position={toolbarPosition}
            onAction={handleToolbarAction}
            visible={selectedIds.length > 0 && !editingId && !dragging}
          />

          {/* Context menu */}
          {contextMenu && (
            <div
              className="absolute z-[200] bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'canvas' && (
                <>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 text-slate-700" onClick={() => handleContextAction('addCard')}>Add Card</button>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 text-slate-700" onClick={() => handleContextAction('paste')} disabled={clipboard.length === 0}>Paste</button>
                </>
              )}
              {contextMenu.type === 'card' && (
                <>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 text-slate-700" onClick={() => handleContextAction('edit')}>Edit</button>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 text-slate-700" onClick={() => handleContextAction('duplicate')}>Duplicate</button>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 text-slate-700" onClick={() => handleContextAction('clone')}>Clone</button>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 text-red-500" onClick={() => handleContextAction('delete')}>Delete</button>
                </>
              )}
            </div>
          )}

          {/* MiniMap */}
          <MiniMap
            nodes={nodes}
            groups={computedGroups}
            transform={transform}
            setTransform={setTransform}
            workspaceRef={workspaceRef}
            visible={showMiniMap}
            openedViaShortcut={true}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 bg-white rounded-full shadow-md border border-slate-200 z-50">
          <button onClick={() => { const c = getViewportCenter(); createCard(c.x - NODE_WIDTH / 2, c.y - NODE_HEIGHT / 2); }} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Add Card (N)">
            <Plus size={16} />
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={() => dispatch({ type: 'UNDO' })} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button onClick={() => dispatch({ type: 'REDO' })} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Redo (Ctrl+Y)">
            <Redo2 size={16} />
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={zoomOut} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <button onClick={zoomIn} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button onClick={fitView} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Fit View">
            <Maximize size={16} />
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={() => setShowMiniMap(v => !v)} className={`p-1.5 rounded-full hover:bg-slate-100 ${showMiniMap ? 'text-blue-600' : 'text-slate-600'}`} title="MiniMap (M)">
            <Map size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
