import { basename, dirname } from 'pathe';
import loadDirectory from '@/api/server/files/loadDirectory.ts';

export interface FileRename {
  from: string;
  to: string;
}

export interface FileRenameResult {
  files: FileRename[];
  renamed: number;
}

interface FileRenameListener {
  before: (files: FileRename[]) => void;
  after: (result: FileRenameResult) => Promise<void>;
}
const listeners = new Map<string, Set<FileRenameListener>>();

export const registerFileRenameListener = (uuid: string, listener: FileRenameListener) => {
  let registered = listeners.get(uuid);
  if (!registered) {
    registered = new Set();
    listeners.set(uuid, registered);
  }
  registered.add(listener);

  return () => {
    registered.delete(listener);
    if (registered.size === 0) listeners.delete(uuid);
  };
};

export const validateFileRenames = (uuid: string, files: FileRename[]) => {
  for (const listener of listeners.get(uuid) ?? []) listener.before(files);
};

export const notifyFileRenames = async (uuid: string, result: FileRenameResult) => {
  await Promise.allSettled(Array.from(listeners.get(uuid) ?? [], (listener) => listener.after(result)));
};

export const isWithinRenamedPath = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`);

export const renameFilePath = (path: string, files: FileRename[]) =>
  files.reduce(
    (current, file) => (isWithinRenamedPath(current, file.from) ? file.to + current.slice(file.from.length) : current),
    path,
  );

export const resolveFileRenames = async (
  uuid: string,
  result: FileRenameResult,
  paths: string[],
): Promise<FileRename[]> => {
  if (result.renamed === 0) return [];
  if (result.renamed === result.files.length) return result.files;

  const listings = new Map<string, Promise<Set<string>>>();
  const list = (directory: string) => {
    let listing = listings.get(directory);
    if (!listing) {
      listing = (async () => {
        const names = new Set<string>();
        let page = 1;
        while (true) {
          const response = await loadDirectory(uuid, directory, page, 'name_asc');
          for (const entry of response.entries.data) names.add(entry.name);
          if (page * response.entries.perPage >= response.entries.total || response.entries.data.length === 0)
            return names;
          page += 1;
        }
      })();
      listings.set(directory, listing);
    }
    return listing;
  };

  const resolved = await Promise.all(
    result.files.map(async (file) => {
      if (!paths.some((path) => isWithinRenamedPath(path, file.from))) return null;

      try {
        const [source, destination] = await Promise.all([list(dirname(file.from)), list(dirname(file.to))]);
        return !source.has(basename(file.from)) && destination.has(basename(file.to)) ? file : null;
      } catch {
        return null;
      }
    }),
  );
  return resolved.filter((file): file is FileRename => file !== null);
};

export const hasOverlappingFileRenames = (files: FileRename[]) =>
  files.some((file, index) =>
    files
      .slice(index + 1)
      .some((other) =>
        [other.from, other.to].some((path) =>
          [file.from, file.to].some(
            (candidate) => isWithinRenamedPath(path, candidate) || isWithinRenamedPath(candidate, path),
          ),
        ),
      ),
  );
