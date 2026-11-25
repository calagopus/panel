import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import { userTeamPresetSchema } from '@/lib/schemas/user/teams.ts';

export default function AdminTeamPresetRow({ preset }: { preset: z.infer<typeof userTeamPresetSchema> }) {
  return (
    <TableRow>
      <TableData>{preset.name}</TableData>

      <TableData>{preset.weight}</TableData>

      <TableData>{preset.permissions.length}</TableData>

      <TableData>{preset.ignoredFiles.length}</TableData>
    </TableRow>
  );
}
