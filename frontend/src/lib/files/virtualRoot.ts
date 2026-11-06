import { join, relative } from 'pathe';

export type VirtualRoot =
  | { type: 'backup'; uuid: string; directory: string }
  | { type: 'trash'; uuid: string; name: string | null; directory: string };

/**
 * The read-only root a directory lives under, if any. Inside a trash entry the
 * root is the deleted directory itself, `/.trash/<uuid>/<name>`, and only a file
 * entry is browsed from `/.trash/<uuid>`, where it is the sole item.
 */
export function virtualRootOf(directory: string): VirtualRoot | null {
  const [prefix, uuid, name] = join('/', directory).split('/').filter(Boolean);
  if (!uuid) return null;

  if (prefix === '.backups') {
    return { type: 'backup', uuid, directory: `/.backups/${uuid}` };
  }
  if (prefix === '.trash') {
    return { type: 'trash', uuid, name: name ?? null, directory: name ? `/.trash/${uuid}/${name}` : `/.trash/${uuid}` };
  }

  return null;
}

export function isVirtualRoot(directory: string): boolean {
  return join('/', directory) === virtualRootOf(directory)?.directory;
}

export function isInsideTrashPayload(directory: string): boolean {
  const root = virtualRootOf(directory);
  return root?.type === 'trash' && root.directory !== `/.trash/${root.uuid}`;
}

/** The path of `name` in `directory` relative to its trash entry's payload, or `null` outside one. */
export function trashItemPath(directory: string, name: string): string | null {
  const root = virtualRootOf(directory);
  if (!root || !isInsideTrashPayload(directory)) return null;

  return relative(root.directory, join('/', directory, name));
}
