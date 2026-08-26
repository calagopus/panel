export interface FileDraft {
  content: string;
  originalHash: string;
  savedAt: number;
}

const DRAFT_KEY_PREFIX = 'panel:file-draft:';
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function hashContent(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function draftKey(serverUuid: string, filePath: string): string {
  return `${DRAFT_KEY_PREFIX}${serverUuid}:${filePath}`;
}

export function purgeExpiredDrafts(): void {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DRAFT_KEY_PREFIX)) continue;
    try {
      const draft: FileDraft = JSON.parse(localStorage.getItem(key)!);
      if (now - draft.savedAt > DRAFT_TTL_MS) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}
