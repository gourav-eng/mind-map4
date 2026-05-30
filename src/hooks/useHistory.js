import { useCallback } from 'react';
import { useWorkspace } from '../store';

/**
 * useHistory - thin wrapper around store dispatch for undo/redo
 *
 * Returns:
 *   undo()    - dispatches UNDO action
 *   redo()    - dispatches REDO action
 *   canUndo   - boolean, true if past has entries
 *   canRedo   - boolean, true if future has entries
 */
export function useHistory() {
  const { state, dispatch } = useWorkspace();

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, [dispatch]);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, [dispatch]);

  return {
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
