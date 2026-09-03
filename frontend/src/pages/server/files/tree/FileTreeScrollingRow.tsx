import { faCheck, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { bytesToString } from '@/lib/format/size.ts';
import FileRowIcon from '@/pages/server/files/list/FileRowIcon.tsx';
import FileTreeName from '@/pages/server/files/tree/FileTreeName.tsx';
import { FileTreeRow as FileTreeRowData } from '@/pages/server/files/tree/fileTreeData.ts';

type EntryTreeRow = Extract<FileTreeRowData, { type: 'entry' }>;

interface FileTreeScrollingRowProps {
  row: EntryTreeRow;
  rowHeight: number;
  active: boolean;
  selected: boolean;
  preferPhysicalSize: boolean;
}

export default function FileTreeScrollingRow({
  row,
  rowHeight,
  active,
  selected,
  preferPhysicalSize,
}: FileTreeScrollingRowProps) {
  return (
    <div
      role='treeitem'
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-current={active ? 'true' : undefined}
      aria-selected={selected}
      data-active-file={active || undefined}
      data-file-manager-tree-row
      className='pointer-events-none grid w-full grid-cols-(--file-manager-tree-columns) items-center gap-x-2 text-left text-sm [contain:layout_paint]'
      style={{
        height: rowHeight,
        backgroundColor: active
          ? 'var(--mantine-color-default-hover)'
          : selected
            ? 'var(--mantine-color-blue-light)'
            : undefined,
        boxShadow: active
          ? 'inset 3px 0 0 var(--mantine-primary-color-filled)'
          : selected
            ? 'inset 3px 0 0 var(--mantine-color-blue-5)'
            : undefined,
      }}
    >
      <div className='flex min-w-0 items-center gap-2' style={{ paddingLeft: 10 + row.depth * 16 }}>
        <span
          aria-hidden='true'
          className={classNames(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
            selected
              ? 'border-(--mantine-primary-color-filled) bg-(--mantine-primary-color-filled)'
              : 'border-(--mantine-color-default-border)',
          )}
        >
          {selected && <FontAwesomeIcon icon={faCheck} className='text-[0.5rem] text-white' />}
        </span>
        {row.expandable ? (
          <FontAwesomeIcon
            icon={row.expanded ? faChevronDown : faChevronRight}
            className='w-2.5 shrink-0 text-xs text-(--mantine-color-dimmed)'
          />
        ) : (
          <span className='w-2.5 shrink-0' />
        )}
        <FileRowIcon file={row.entry} archive={row.expandable && !row.entry.directory} className='w-4 shrink-0' />
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
