import { useCallback, useEffect, useRef } from 'react';

const INPUT_TAGS = ['INPUT', 'SELECT', 'TEXTAREA'];

function isInputFocused() {
  const el = document.activeElement;
  return el && INPUT_TAGS.includes(el.tagName);
}

/**
 * Keyboard shortcuts hook with input conflict prevention.
 * Single-letter shortcuts (h, w, i, a, r) are blocked when an input/select/textarea is focused.
 */
export function useKeyboardShortcuts({
  onRefresh,
  onClearFilters,
  onLevelFilter,
  onSearchFocus,
  onSettingsOpen,
  onEscape,
  onArrowUp,
  onArrowDown,
  onEnter,
  enabled = true,
}) {
  const handlersRef = useRef({
    onRefresh, onClearFilters, onLevelFilter, onSearchFocus, onSettingsOpen,
    onEscape, onArrowUp, onArrowDown, onEnter,
  });
  handlersRef.current = {
    onRefresh, onClearFilters, onLevelFilter, onSearchFocus, onSettingsOpen,
    onEscape, onArrowUp, onArrowDown, onEnter,
  };

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      const h = handlersRef.current;

      // Ctrl/Cmd shortcuts — always active regardless of input focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        h.onSearchFocus?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        h.onSettingsOpen?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        h.onClearFilters?.();
        return;
      }

      // Escape — always active
      if (e.key === 'Escape') {
        h.onEscape?.();
        return;
      }

      // Arrow keys — always active (for row navigation)
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        h.onArrowDown?.();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        h.onArrowUp?.();
        return;
      }

      // Enter — active if focusedIndex is set
      if (e.key === 'Enter') {
        h.onEnter?.();
        return;
      }

      // Single-letter shortcuts — BLOCKED when input is focused
      if (isInputFocused()) return;

      if (e.key === 'h') { h.onLevelFilter?.('hot'); return; }
      if (e.key === 'w') { h.onLevelFilter?.('warm'); return; }
      if (e.key === 'i') { h.onLevelFilter?.('idle'); return; }
      if (e.key === 'a') { h.onLevelFilter?.('all'); return; }
      if (e.key === 'r') { h.onRefresh?.(); return; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

export default useKeyboardShortcuts;