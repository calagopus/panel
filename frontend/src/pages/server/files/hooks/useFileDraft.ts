import { useRef } from 'react';
import { hashContent, removeFileDraft, storeFileDraft } from '@/lib/files/fileDrafts.ts';

export default function useFileDraft(serverUuid: string) {
  const saved = useRef({ content: '', hash: hashContent('') });

  const setSavedContent = (content: string) => {
    saved.current = { content, hash: hashContent(content) };
    return saved.current.hash;
  };

  const hasChanges = (content: string) => content !== saved.current.content;

  const persistDraft = (
    path: string,
    content: string,
    { dirty = hasChanges(content), preserve = false }: { dirty?: boolean; preserve?: boolean } = {},
  ) => {
    if (dirty) storeFileDraft(serverUuid, path, content, saved.current.hash);
    else if (!preserve) removeFileDraft(serverUuid, path);
    return dirty;
  };

  return { setSavedContent, hasChanges, persistDraft };
}
