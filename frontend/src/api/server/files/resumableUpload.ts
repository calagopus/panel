import { AxiosProgressEvent } from 'axios';
import { axiosInstance } from '@/api/axios.ts';

const UPLOAD_OFFSET_HEADER = 'upload-offset';

/**
 * Appends the resumable `file` query parameter to a base upload URL (which already carries
 * the panel-signed `token` and `directory`). The daemon joins `directory` + `file` to form
 * the destination path, so folder uploads pass their sub-path here.
 */
export function withFileParam(baseUrl: string, remotePath: string): string {
  return `${baseUrl}&file=${encodeURIComponent(remotePath)}`;
}

/**
 * Reads a possibly-`?1`/`?0`-prefixed integer offset header. Returns `fallback` when the
 * header is missing or unparseable.
 */
function parseOffset(value: unknown, fallback: number): number {
  const offset = Number(value);
  return Number.isFinite(offset) ? offset : fallback;
}

/**
 * Offset retrieval (HEAD): the current on-disk length of the partial file, i.e. the byte at
 * which appending must continue. `0` if the daemon has no partial yet (fresh or moved node).
 */
export async function headUploadOffset(uploadUrl: string, signal: AbortSignal): Promise<number> {
  const res = await axiosInstance.head(uploadUrl, { signal });
  return parseOffset(res.headers[UPLOAD_OFFSET_HEADER], 0);
}

/**
 * The offset the daemon reports alongside a 409, so the client can re-sync to the real
 * on-disk length after a torn write. Returns `null` if the response carried no offset.
 */
export function conflictOffset(headers: Record<string, unknown> | undefined): number | null {
  if (!headers) return null;
  const offset = Number(headers[UPLOAD_OFFSET_HEADER]);
  return Number.isFinite(offset) ? offset : null;
}

/**
 * Append (PATCH) one chunk at `offset`. The daemon rejects with 409 if `offset` does not
 * match the partial's length. `isLast` sets `Upload-Complete: ?1` so the daemon finalizes
 * (and verifies the total against `Upload-Length`). Returns the new offset.
 */
export async function patchUploadChunk(
  uploadUrl: string,
  body: Blob,
  offset: number,
  totalSize: number,
  isLast: boolean,
  signal: AbortSignal,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
): Promise<number> {
  const res = await axiosInstance.patch(uploadUrl, body, {
    signal,
    onUploadProgress,
    headers: {
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': String(offset),
      'Upload-Length': String(totalSize),
      ...(isLast ? { 'Upload-Complete': '?1' } : {}),
    },
  });

  return parseOffset(res.headers[UPLOAD_OFFSET_HEADER], offset + body.size);
}
