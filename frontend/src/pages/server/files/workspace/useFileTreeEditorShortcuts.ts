import { useEffect } from 'react';

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
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'w' && activeTabId) {
        event.preventDefault();
        onClose(activeTabId);
        return;
      }

      if (key === 'tab' || key === 'pagedown' || key === 'pageup') {
        const backwards = event.shiftKey || key === 'pageup';
        if (tabIds.length > 0) event.preventDefault();
        selectRelative(backwards ? -1 : 1);
        return;
      }

      if (!event.shiftKey && /^[1-9]$/.test(key) && tabIds.length > 0) {
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
