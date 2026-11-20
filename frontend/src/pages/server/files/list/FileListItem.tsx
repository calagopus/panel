import { z } from 'zod';
import { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import FileRowIcon from '@/pages/server/files/list/FileRowIcon.tsx';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';

export default function FileListItem({ file }: { file: z.infer<typeof serverDirectoryEntrySchema> }) {
  const preferPhysicalSize = useFileManager((state) => state.preferPhysicalSize);

  return (
    <ItemPreviewRow
      icon={<FileRowIcon file={file} />}
      name={file.name}
      meta={bytesToString(preferPhysicalSize ? file.sizePhysical : file.size)}
    />
  );
}
