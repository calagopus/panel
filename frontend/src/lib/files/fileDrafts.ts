export interface FileDraft {
  content: string;
  originalHash: string;
  savedAt: number;
}

const DRAFT_KEY_PREFIX = 'panel:file-draft:';
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const pendingWrites = new Map<string, { draft: FileDraft; timer: ReturnType<typeof setTimeout> }>();

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

export function readFileDraft(serverUuid: string, filePath: string): FileDraft | null {
  const key = draftKey(serverUuid, filePath);
  const pending = pendingWrites.get(key);
  if (pending) return pending.draft;
  try {
    purgeExpiredDrafts();
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const draft: FileDraft = JSON.parse(stored);
    if (
      typeof draft.content === 'string' &&
      typeof draft.originalHash === 'string' &&
      Number.isFinite(draft.savedAt) &&
      Date.now() - draft.savedAt <= DRAFT_TTL_MS
    )
      return draft;
  } catch {
    return null;
  }
  return null;
}

export function flushFileDraft(serverUuid: string, filePath: string): void {
  const key = draftKey(serverUuid, filePath);
  const pending = pendingWrites.get(key);
  if (!pending) return;
  clearTimeout(pending.timer);
  try {
    localStorage.setItem(key, JSON.stringify(pending.draft));
    pendingWrites.delete(key);
  } catch {
    return;
  }
}

export function storeFileDraft(serverUuid: string, filePath: string, content: string, originalHash: string): void {
  const key = draftKey(serverUuid, filePath);
  const pending = pendingWrites.get(key);
  if (pending) clearTimeout(pending.timer);
  pendingWrites.set(key, {
    draft: { content, originalHash, savedAt: Date.now() },
    timer: setTimeout(() => flushFileDraft(serverUuid, filePath), 500),
  });
}

export function removeFileDraft(serverUuid: string, filePath: string): void {
  const key = draftKey(serverUuid, filePath);
  const pending = pendingWrites.get(key);
  if (pending) clearTimeout(pending.timer);
  pendingWrites.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
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
