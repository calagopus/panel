import { useEffect } from 'react';
import { matchesShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';

interface FileTreeEditorShortcutsOptions {
  tabIds: string[];
  activeTabId: string | null;
  onClose: (tabId: string) => void;
  onSelect: (tabId: string) => void;
}

export default function useFileTreeEditorShortcuts({
  tabIds,
  activeTabId,
  onClose,
  onSelect,
}: FileTreeEditorShortcutsOptions) {
  useEffect(() => {
    const selectRelative = (offset: number) => {
      if (tabIds.length < 2) return false;

      const activeIndex = Math.max(0, tabIds.indexOf(activeTabId ?? ''));
      onSelect(tabIds[(activeIndex + offset + tabIds.length) % tabIds.length]);
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, 'files.closeEditorTab')) {
        if (!activeTabId) return;

        event.preventDefault();
        onClose(activeTabId);
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const pageJump = modifier && !event.altKey && (key === 'pageup' || key === 'pagedown');
      const previous = matchesShortcut(event, 'files.previousEditorTab');

      if (previous || pageJump || matchesShortcut(event, 'files.nextEditorTab')) {
        if (tabIds.length > 0) event.preventDefault();
        selectRelative(previous || key === 'pageup' ? -1 : 1);
        return;
      }

      if (modifier && !event.altKey && !event.shiftKey && /^[1-9]$/.test(key) && tabIds.length > 0) {
        const requestedIndex = Number(key) - 1;
        const index = requestedIndex === 8 ? tabIds.length - 1 : Math.min(requestedIndex, tabIds.length - 1);
        event.preventDefault();
        onSelect(tabIds[index]);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [activeTabId, onClose, onSelect, tabIds]);
}
