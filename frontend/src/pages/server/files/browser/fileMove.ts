import { join } from 'pathe';
import { z } from 'zod';
import renameFiles from '@/api/server/files/renameFiles.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';

export type FileMoveEntry = z.infer<typeof serverDirectoryEntrySchema>;

const normalizeDirectory = (directory: string) => join('/', directory);

export function canMoveFilesToDirectory(
  files: FileMoveEntry[],
  sourceDirectory: string | null,
  targetDirectory: string,
) {
  if (!sourceDirectory || files.length === 0) return false;

  const normalizedSource = normalizeDirectory(sourceDirectory);
  const normalizedTarget = normalizeDirectory(targetDirectory);

  if (normalizedSource === normalizedTarget) return false;

  return files.every((file) => {
    if (!file.directory) return true;

    const sourcePath = normalizeDirectory(join(sourceDirectory, file.name));
    return normalizedTarget !== sourcePath && !normalizedTarget.startsWith(`${sourcePath}/`);
  });
}

export async function moveFilesToDirectory(
  uuid: string,
  files: FileMoveEntry[],
  sourceDirectory: string,
  targetDirectory: string,
) {
  return renameFiles({
    uuid,
    root: '/',
    files: files.map((file) => ({
      from: join(sourceDirectory, file.name),
      to: join(targetDirectory, file.name),
    })),
  });
}
