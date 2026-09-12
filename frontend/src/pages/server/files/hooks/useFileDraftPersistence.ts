import { useEffect } from 'react';
import { flushFileDraft } from '@/lib/files/fileDrafts.ts';

export default function useFileDraftPersistence(serverUuid: string, filePath: string, dirty: boolean) {
  useEffect(() => {
    const flush = () => flushFileDraft(serverUuid, filePath);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [serverUuid, filePath, dirty]);
}
