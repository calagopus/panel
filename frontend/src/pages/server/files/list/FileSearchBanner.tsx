import {
  faBan,
  faFileAlt,
  faFileSignature,
  faFilter,
  faFolderOpen,
  faFont,
  faHardDrive,
  faSearch,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Group from '@/elements/layout/Group.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface SearchChip {
  icon: IconLike;
  label?: string;
  value: string;
  tooltip?: string;
}

export default function FileSearchBanner({ resetEntries }: { resetEntries: () => void }) {
  const { t, tItem } = useTranslations();
  const { browsingEntries, searchInfo, setSearchInfo, doOpenModal } = useFileManager(
    useShallow((state) => ({
      browsingEntries: state.browsingEntries,
      searchInfo: state.searchInfo,
      setSearchInfo: state.setSearchInfo,
      doOpenModal: state.doOpenModal,
    })),
  );

  const closeSearch = async () => {
    setSearchInfo(null);
    resetEntries();
  };

  if (!searchInfo) return null;

  const { pathFilter, sizeFilter, contentFilter } = searchInfo.filters;
  const empty = browsingEntries.total === 0;
  const chips: SearchChip[] = [];

  if (searchInfo.root !== '/') {
    chips.push({
      icon: faFolderOpen,
      label: t('pages.server.files.searchBanner.root', {}),
      value: searchInfo.root,
    });
  }

  if (searchInfo.query) {
    chips.push({
      icon: faFileSignature,
      label: t('pages.server.files.searchBanner.query', {}),
      value: searchInfo.query,
    });
  }

  if (pathFilter?.include.length) {
    chips.push({
      icon: faFilter,
      label: t('pages.server.files.searchBanner.included', {}),
      value: pathFilter.include.join(', '),
    });
  }

  if (pathFilter?.exclude.length) {
    chips.push({
      icon: faBan,
      label: t('pages.server.files.searchBanner.excluded', {}),
      value: pathFilter.exclude.join(', '),
    });
  }

  if (contentFilter) {
    chips.push({
      icon: faFileAlt,
      label: t('pages.server.files.searchBanner.content', {}),
      value: contentFilter.query,
      tooltip: t(
        contentFilter.includeUnmatched
          ? 'pages.server.files.searchBanner.oversizedIncluded'
          : 'pages.server.files.searchBanner.maxSearchSize',
        { size: bytesToString(contentFilter.maxSearchSize) },
      ),
    });

    if (!contentFilter.caseInsensitive) {
      chips.push({ icon: faFont, value: t('pages.server.files.searchBanner.caseSensitive', {}) });
    }
  }

  if (sizeFilter && (sizeFilter.min > 0 || sizeFilter.max > 0)) {
    chips.push({
      icon: faHardDrive,
      label: t('pages.server.files.searchBanner.size', {}),
      value: [
        sizeFilter.min > 0 && `≥ ${bytesToString(sizeFilter.min)}`,
        sizeFilter.max > 0 && `≤ ${bytesToString(sizeFilter.max)}`,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

  return (
    <Alert
      icon={empty ? faFilter : faSearch}
      color={empty ? 'yellow' : 'blue'}
      title={
        empty
          ? t('pages.server.files.searchBanner.emptyTitle', {})
          : t('pages.server.files.searchBanner.resultsTitle', { files: tItem('file', browsingEntries.total) })
      }
      onClose={closeSearch}
      withCloseButton
      mb='md'
    >
      <Group gap='xs'>
        {chips.map(({ icon, label, value, tooltip }) => (
          <Tooltip key={`${label ?? ''}${value}`} label={tooltip} disabled={!tooltip}>
            <Badge
              variant='default'
              size='lg'
              radius='sm'
              tt='none'
              className='w-max! max-w-full'
              leftSection={
                <Icon
                  icon={icon}
                  className={empty ? 'text-(--mantine-color-yellow-6)' : 'text-(--mantine-color-blue-6)'}
                />
              }
            >
              {label ? <span className='text-(--mantine-color-dimmed)'>{label} </span> : null}
              {value}
            </Badge>
          </Tooltip>
        ))}

        <Button
          variant='subtle'
          color={empty ? 'yellow' : 'blue'}
          size='compact-sm'
          leftSection={<FontAwesomeIcon icon={faSliders} />}
          onClick={() => doOpenModal('search')}
        >
          {t('pages.server.files.searchBanner.edit', {})}
        </Button>
      </Group>
    </Alert>
  );
}
