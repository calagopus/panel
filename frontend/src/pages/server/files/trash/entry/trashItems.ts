import { join } from 'pathe';
import { z } from 'zod';
import restoreTrashEntryItems from '@/api/server/files/trash/restoreTrashEntryItems.ts';
import { trashItemPath } from '@/lib/files/virtualRoot.ts';
import { serverDirectoryEntrySchema, serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';

export interface TrashItemTarget {
  item: z.infer<typeof serverDirectoryEntrySchema>;
  path: string;
  destination?: string;
}

export interface TrashItemConflict {
  item: z.infer<typeof serverDirectoryEntrySchema>;
  path: string;
  target: string;
  destination: z.infer<typeof serverDirectoryEntrySchema>;
}

export function trashItemTargets(
  directory: string,
  files: z.infer<typeof serverDirectoryEntrySchema>[],
): TrashItemTarget[] {
  return files.flatMap((item) => {
    const path = trashItemPath(directory, item.name);
    return path === null ? [] : [{ item, path }];
  });
}

export function collectItemConflicts(
  entry: z.infer<typeof serverTrashEntrySchema>,
  targets: TrashItemTarget[],
  conflicts: Awaited<ReturnType<typeof restoreTrashEntryItems>>['conflicts'],
): TrashItemConflict[] {
  return conflicts.flatMap(({ from, destination }): TrashItemConflict[] => {
    const match = targets.find((target) => target.path === from);
    if (!match) return [];

    return [{ item: match.item, path: from, target: match.destination ?? join('/', entry.path, from), destination }];
  });
}
