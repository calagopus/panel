import { join } from 'pathe';
import { z } from 'zod';
import renameFiles from '@/api/server/files/renameFiles.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';

export type FileMoveEntry = z.infer<typeof serverDirectoryEntrySchema>;

export interface FileMoveGroup {
  sourceDirectory: string;
  files: FileMoveEntry[];
}

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

const movableGroups = (groups: FileMoveGroup[], targetDirectory: string) => {
  const normalizedTarget = normalizeDirectory(targetDirectory);

  return groups.flatMap((group): FileMoveGroup[] => {
    if (normalizeDirectory(group.sourceDirectory) === normalizedTarget) return [];

    const files = group.files.filter(
      (file) => !file.directory || normalizeDirectory(join(group.sourceDirectory, file.name)) !== normalizedTarget,
    );

    return files.length > 0 ? [{ ...group, files }] : [];
  });
};

export function canMoveFileGroupsToDirectory(groups: FileMoveGroup[], targetDirectory: string) {
  const groupsToMove = movableGroups(groups, targetDirectory);
  if (groupsToMove.length === 0) return false;

  const destinationNames = new Set<string>();

  return groupsToMove.every(
    (group) =>
      canMoveFilesToDirectory(group.files, group.sourceDirectory, targetDirectory) &&
      group.files.every((file) => {
        if (destinationNames.has(file.name)) return false;

        destinationNames.add(file.name);
        return true;
      }),
  );
}

const renameFileGroups = (uuid: string, groups: FileMoveGroup[], targetDirectory: string, restore: boolean) =>
  renameFiles({
    uuid,
    root: '/',
    files: movableGroups(groups, targetDirectory).flatMap((group) =>
      group.files.map((file) => ({
        from: join(restore ? targetDirectory : group.sourceDirectory, file.name),
        to: join(restore ? group.sourceDirectory : targetDirectory, file.name),
      })),
    ),
  });

export const moveFileGroupsToDirectory = (uuid: string, groups: FileMoveGroup[], targetDirectory: string) =>
  renameFileGroups(uuid, groups, targetDirectory, false);

export const restoreFileGroupsFromDirectory = (uuid: string, groups: FileMoveGroup[], targetDirectory: string) =>
  renameFileGroups(uuid, groups, targetDirectory, true);
