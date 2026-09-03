import classNames from 'classnames';
import { ReactNode } from 'react';
import Code from '@/elements/typography/Code.tsx';
import { toContainerPath } from '@/lib/files/files.ts';

export default function FilePathPreview({ label, path, mt = true }: { label: ReactNode; path: string; mt?: boolean }) {
  return (
    <p className={classNames('text-sm md:text-base break-all', mt && 'mt-2')}>
      <span>{label}</span>
      <Code>
        /home/container/
        <span className='text-cyan-200'>{toContainerPath(path)}</span>
      </Code>
    </p>
  );
}
