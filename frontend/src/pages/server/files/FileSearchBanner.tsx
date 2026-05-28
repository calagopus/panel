import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert } from '@mantine/core';
import { bytesToString } from '@/lib/size.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function FileSearchBanner({ resetEntries }: { resetEntries: () => void }) {
  const { t, tItem } = useTranslations();
  const { browsingEntries, searchInfo, setSearchInfo } = useFileManager();

  const closeSearch = async () => {
    setSearchInfo(null);
    resetEntries();
  };

  if (!searchInfo) return null;

  return (
    <Alert
      icon={<FontAwesomeIcon icon={faSearch} />}
      color='blue'
      title={t('pages.server.files.searchBanner.resultsTitle', { files: tItem('file', browsingEntries.total) })}
      onClose={closeSearch}
      withCloseButton
      mb='md'
    >
      {(searchInfo.query ||
        searchInfo.filters.contentFilter ||
        searchInfo.filters.sizeFilter ||
        (searchInfo.filters.pathFilter?.exclude && searchInfo.filters.pathFilter.exclude.length > 0)) && (
        <div className='flex flex-col gap-1 text-sm'>
          {searchInfo.query && (
            <div>
              <span className='font-medium'>{t('pages.server.files.searchBanner.query', {})}</span>{' '}
              <span className='text-(--mantine-color-dimmed)'>&quot;{searchInfo.query}&quot;</span>
            </div>
          )}
          {searchInfo.filters.pathFilter?.exclude && searchInfo.filters.pathFilter.exclude.length > 0 && (
            <div>
              <span className='font-medium'>{t('pages.server.files.searchBanner.excluded', {})}</span>{' '}
              <span className='text-(--mantine-color-dimmed)'>{searchInfo.filters.pathFilter.exclude.join(', ')}</span>
            </div>
          )}
          {searchInfo.filters.contentFilter && (
            <div>
              <span className='font-medium'>{t('pages.server.files.searchBanner.content', {})}</span>{' '}
              <span className='text-(--mantine-color-dimmed)'>
                {searchInfo.filters.contentFilter.query || '(empty)'}
              </span>
            </div>
          )}
          {searchInfo.filters.sizeFilter && (
            <div>
              <span className='font-medium'>{t('pages.server.files.searchBanner.size', {})}</span>{' '}
              <span className='text-(--mantine-color-dimmed)'>
                {searchInfo.filters.sizeFilter.min > 0 && (
                  <span>
                    {t('pages.server.files.searchBanner.min', {})} {bytesToString(searchInfo.filters.sizeFilter.min)}
                  </span>
                )}
                {searchInfo.filters.sizeFilter.min > 0 && searchInfo.filters.sizeFilter.max > 0 && ', '}
                {searchInfo.filters.sizeFilter.max > 0 && (
                  <span>
                    {t('pages.server.files.searchBanner.max', {})} {bytesToString(searchInfo.filters.sizeFilter.max)}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </Alert>
  );
}
