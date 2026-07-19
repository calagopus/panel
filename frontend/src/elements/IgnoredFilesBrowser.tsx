import { faFile, faFolder } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Anchor } from '@mantine/core';
import classNames from 'classnames';
import ignore from 'ignore';
import { join } from 'pathe';
import { useMemo, useState } from 'react';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import Badge from '@/elements/Badge.tsx';
import Breadcrumbs from '@/elements/Breadcrumbs.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function IgnoredFilesBrowser({ serverUuid, patterns }: { serverUuid: string; patterns: string[] }) {
  const { t } = useTranslations();
  const [path, setPath] = useState('/');

  const matcher = useMemo(() => ignore().add(patterns), [patterns]);

  const { data, loading } = useResource({
    queryKey: ['ignored-files-browser', serverUuid, path],
    queryFn: () => loadDirectory(serverUuid, path, 1, 'name_asc'),
  });

  const entries = useMemo(() => {
    if (!data) return [];
    return [...data.entries.data].sort((a, b) => {
      if (a.directory !== b.directory) return a.directory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const isIgnored = (name: string, directory: boolean) => {
    const relative = join(path, name).replace(/^\/+/, '') + (directory ? '/' : '');
    return relative.length > 0 && matcher.ignores(relative);
  };

  const pathSegments = path.split('/').filter(Boolean);
  const shownCount = data?.entries.data.length ?? 0;
  const hasMore = data ? data.entries.total > shownCount : false;

  return (
    <div className='border border-(--mantine-color-default-border) rounded-md overflow-hidden'>
      <div className='px-3 py-2 border-b border-(--mantine-color-default-border) bg-(--mantine-color-body)'>
        <Breadcrumbs separatorMargin='xs'>
          <Anchor component='button' type='button' size='sm' onClick={() => setPath('/')}>
            container
          </Anchor>
          {pathSegments.map((seg, i) => {
            const segPath = '/' + pathSegments.slice(0, i + 1).join('/');
            const isLast = i === pathSegments.length - 1;
            return isLast ? (
              <span key={segPath} className='text-sm'>
                {seg}
              </span>
            ) : (
              <Anchor component='button' type='button' key={segPath} size='sm' onClick={() => setPath(segPath)}>
                {seg}
              </Anchor>
            );
          })}
        </Breadcrumbs>
      </div>

      <div className='overflow-y-auto max-h-52 bg-(--mantine-color-default)'>
        {loading ? (
          <Spinner.Centered size={20} />
        ) : entries.length === 0 ? (
          <p className='text-sm text-(--mantine-color-dimmed) px-3 py-2'>{t('common.label.emptyDirectory', {})}</p>
        ) : (
          entries.map((entry) => {
            const ignored = isIgnored(entry.name, entry.directory);
            const content = (
              <>
                <FontAwesomeIcon icon={entry.directory ? faFolder : faFile} className='text-(--mantine-color-dimmed)' />
                <span className={classNames('truncate', { 'line-through': ignored })}>{entry.name}</span>
                {ignored && (
                  <Badge size='xs' color='red' variant='light' className='ml-auto shrink-0'>
                    {t('common.label.ignored', {})}
                  </Badge>
                )}
              </>
            );

            return entry.directory ? (
              <button
                key={entry.name}
                type='button'
                onClick={() => setPath(join(path, entry.name))}
                className={classNames(
                  'w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left hover:bg-(--mantine-color-default-hover)',
                  { 'opacity-60': ignored },
                )}
              >
                {content}
              </button>
            ) : (
              <div
                key={entry.name}
                className={classNames('w-full flex items-center gap-3 px-3 py-1.5 text-sm', {
                  'opacity-60': ignored,
                })}
              >
                {content}
              </div>
            );
          })
        )}
      </div>

      {hasMore && (
        <div className='px-3 py-1.5 border-t border-(--mantine-color-default-border) bg-(--mantine-color-body)'>
          <p className='text-xs text-(--mantine-color-dimmed)'>
            {t('common.label.showingFirstEntries', { count: shownCount })}
          </p>
        </div>
      )}
    </div>
  );
}
