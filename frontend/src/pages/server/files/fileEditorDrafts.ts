export interface FileDraft {
  content: string;
  originalHash: string;
  savedAt: number;
}

const DRAFT_KEY_PREFIX = 'panel:file-draft:';
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function hashFileContent(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index++) {
    hash = ((hash << 5) + hash + content.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16);
}

export function fileDraftKey(serverUuid: string, filePath: string): string {
  return `${DRAFT_KEY_PREFIX}${serverUuid}:${filePath}`;
}

export function purgeExpiredFileDrafts(): void {
  const now = Date.now();
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (!key?.startsWith(DRAFT_KEY_PREFIX)) continue;

    try {
      const draft: FileDraft = JSON.parse(localStorage.getItem(key)!);
      if (now - draft.savedAt > DRAFT_TTL_MS) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}
