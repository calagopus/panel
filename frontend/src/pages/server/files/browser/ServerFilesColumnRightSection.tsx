import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { z } from 'zod';
import { serverDirectorySortingModeSchema } from '@/lib/schemas/server/files.ts';
import { useFileManagerStore } from '@/stores/fileManager.ts';

export type ServerFilesColumn = 'name' | 'size' | 'physical_size' | 'modified';

export const columnOnClick = (
  name: ServerFilesColumn,
  sortMode: z.infer<typeof serverDirectorySortingModeSchema>,
  setSortMode: (mode: z.infer<typeof serverDirectorySortingModeSchema>) => void,
) => {
  return () => {
    if (sortMode === `${name}_asc`) {
      setSortMode(`${name}_desc`);
    } else {
      setSortMode(`${name}_asc`);
    }
  };
};

export default function ServerFilesColumnRightSection({ name }: { name: ServerFilesColumn }) {
  const sortMode = useFileManagerStore((state) => state.sortMode);
  const setSortMode = useFileManagerStore((state) => state.setSortMode);

  const isActive = sortMode.startsWith(name);
  const isAsc = sortMode.endsWith('asc');

  return (
    <div
      onClick={columnOnClick(name, sortMode, setSortMode)}
      className='inline-flex flex-col items-center self-center -mt-0.5'
    >
      <FontAwesomeIcon
        icon={faChevronUp}
        size='xs'
        className={classNames(
          '-mb-0.5',
          isActive && isAsc ? 'text-(--mantine-color-text)' : 'text-(--mantine-color-dimmed)',
        )}
      />
      <FontAwesomeIcon
        icon={faChevronDown}
        size='xs'
        className={isActive && !isAsc ? 'text-(--mantine-color-text)' : 'text-(--mantine-color-dimmed)'}
      />
    </div>
  );
}
