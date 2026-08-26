import classNames from 'classnames';
import { truncateFileTreeName } from './fileTreeData.ts';

interface FileTreeNameProps {
  name: string;
  directory?: boolean;
  className?: string;
}

export default function FileTreeName({ name, directory = false, className }: FileTreeNameProps) {
  const displayName = truncateFileTreeName(name, directory);
  const extensionStart = directory ? -1 : displayName.lastIndexOf('.');
  const base = extensionStart > 0 ? displayName.slice(0, extensionStart) : displayName;
  const extension = extensionStart > 0 ? displayName.slice(extensionStart) : '';

  return (
    <span data-file-manager-file-name className={classNames('flex min-w-0', className)} title={name}>
      <span className='min-w-0 truncate'>{base}</span>
      {extension && <span className='shrink-0'>{extension}</span>}
    </span>
  );
}
