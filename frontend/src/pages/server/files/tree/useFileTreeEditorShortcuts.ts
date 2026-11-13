import { useEffect } from 'react';
import { getRelativeFileTreeTabId } from '@/pages/server/files/tree/fileTreeEditor.ts';
import { matchesShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';

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
  const { id: windowId } = useCurrentWindow();

  useEffect(() => {
    const isFocusedWindow = () => {
      const owner = document.activeElement?.closest('[id^="window_"][id$="_inner"]');
      return owner ? owner.id === `window_${windowId}_inner` : windowId === null;
    };

    const selectRelative = (offset: number) => {
      const tabId = getRelativeFileTreeTabId(tabIds, activeTabId, offset);
      if (tabId) onSelect(tabId);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFocusedWindow()) return;

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
  }, [activeTabId, onClose, onSelect, tabIds, windowId]);
}
