import { useCallback, useEffect, useState } from 'react';

export function useCommandHistory(serverUuid: string) {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const HISTORY_STORAGE_KEY = `terminal_command_history_${serverUuid}`;

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) {
        console.error('Failed to parse terminal history:', e);
      }
    }
  }, [HISTORY_STORAGE_KEY]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history, HISTORY_STORAGE_KEY]);

  const navigatePrevious = useCallback(() => {
    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);
    return history[newIndex] || '';
  }, [history, historyIndex]);

  const navigateNext = useCallback(() => {
    const newIndex = Math.max(historyIndex - 1, -1);
    setHistoryIndex(newIndex);
    return history[newIndex] || '';
  }, [history, historyIndex]);

  const recordCommand = useCallback(
    (command: string) => {
      if (history[0] !== command) {
        setHistory((prev) => [command, ...prev].slice(0, 32));
      }
      setHistoryIndex(-1);
    },
    [history],
  );

  return { history, historyIndex, navigatePrevious, navigateNext, recordCommand };
}
