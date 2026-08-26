import { faChevronDown, faChevronRight, faFile, faFolder } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { bytesToString } from '@/lib/size.ts';
import FileTreeName from '@/pages/server/files/workspace/FileTreeName.tsx';
import { FileTreeRow as FileTreeRowData } from '@/pages/server/files/workspace/fileTreeData.ts';

type EntryTreeRow = Extract<FileTreeRowData, { type: 'entry' }>;

interface FileTreeScrollingRowProps {
  row: EntryTreeRow;
  rowHeight: number;
  selected: boolean;
  preferPhysicalSize: boolean;
}

export default function FileTreeScrollingRow({
  row,
  rowHeight,
  selected,
  preferPhysicalSize,
}: FileTreeScrollingRowProps) {
  return (
    <div
      role='treeitem'
      aria-level={row.depth + 1}
      aria-expanded={row.entry.directory ? row.expanded : undefined}
      aria-selected={selected}
      data-file-manager-tree-row
      className='pointer-events-none grid w-full grid-cols-(--file-manager-tree-columns) items-center gap-x-2 text-left text-sm [contain:layout_paint]'
      style={{
        height: rowHeight,
        backgroundColor: selected ? 'var(--mantine-color-blue-light)' : undefined,
        boxShadow: selected ? 'inset 3px 0 0 var(--mantine-color-blue-5)' : undefined,
      }}
    >
      <div className='flex min-w-0 items-center gap-2' style={{ paddingLeft: 10 + row.depth * 16 }}>
        <span
          aria-hidden='true'
          className={classNames(
            'h-4 w-4 shrink-0 rounded border',
            selected
              ? 'border-(--mantine-primary-color-filled) bg-(--mantine-primary-color-filled)'
              : 'border-(--mantine-color-default-border)',
          )}
        />
        {row.entry.directory ? (
          <FontAwesomeIcon
            icon={row.expanded ? faChevronDown : faChevronRight}
            className='w-2.5 shrink-0 text-xs text-(--mantine-color-dimmed)'
          />
        ) : (
          <span className='w-2.5 shrink-0' />
        )}
        <FontAwesomeIcon
          icon={row.entry.directory ? faFolder : faFile}
          className={classNames(
            'w-4 shrink-0',
            row.entry.directory ? 'text-(--mantine-color-yellow-5)' : 'text-(--mantine-color-dimmed)',
          )}
        />
        <FileTreeName name={row.entry.name} directory={row.entry.directory} className='flex-1' />
      </div>
      <span className='truncate text-xs text-(--mantine-color-dimmed)'>
        {bytesToString(preferPhysicalSize ? row.entry.sizePhysical : row.entry.size)}
      </span>
      <span aria-hidden='true' className='h-1.5 w-20 max-w-full rounded bg-(--mantine-color-default-border)' />
      <span aria-hidden='true' />
    </div>
  );
}
