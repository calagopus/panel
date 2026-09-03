import { faChevronDown, faFileDownload, faLink, faRefresh, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChangeEvent, useRef } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function EggUpdateFromMenu({
  hasEggRepositoryEgg,
  loading,
  onFromUrl,
  onFromRepository,
  onFileUpload,
}: {
  hasEggRepositoryEgg: boolean;
  loading: boolean;
  onFromUrl: () => void;
  onFromRepository: () => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const { t } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <ContextMenu
        menuProps={{ position: 'top', offset: 40 }}
        items={[
          {
            type: 'action',
            icon: faUpload,
            label: t('pages.admin.nests.tabs.eggs.page.button.fromFile', {}),
            onClick: () => fileInputRef.current?.click(),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faLink,
            label: t('pages.admin.nests.tabs.eggs.page.button.fromUrl', {}),
            onClick: onFromUrl,
            color: 'gray',
          },
          {
            type: 'action',
            icon: faRefresh,
            label: t('pages.admin.nests.tabs.eggs.page.button.fromRepository', {}),
            disabled: !hasEggRepositoryEgg,
            onClick: onFromRepository,
            color: 'gray',
          },
        ]}
      >
        {({ openMenu }) => (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              openMenu(rect.left, rect.bottom);
            }}
            loading={loading}
            variant='outline'
            rightSection={<FontAwesomeIcon icon={faChevronDown} />}
          >
            {t('common.button.update', {})}
          </Button>
        )}
      </ContextMenu>
      <input type='file' accept='.json,.yml,.yaml' ref={fileInputRef} className='hidden' onChange={onFileUpload} />
    </>
  );
}

export function EggExportMenu({
  loading,
  onExport,
}: {
  loading: boolean;
  onExport: (format: 'calagopus' | 'pterodactyl', fileType: 'json' | 'yaml') => void;
}) {
  const { t } = useTranslations();

  return (
    <ContextMenu
      menuProps={{ position: 'top', offset: 40 }}
      items={[
        {
          type: 'action',
          icon: faFileDownload,
          label: t('common.button.exportAs', { format: 'JSON' }),
          onClick: () => onExport('calagopus', 'json'),
          color: 'gray',
        },
        {
          type: 'action',
          icon: faFileDownload,
          label: t('common.button.exportAs', { format: 'YAML' }),
          onClick: () => onExport('calagopus', 'yaml'),
          color: 'gray',
        },
        {
          type: 'action',
          icon: faFileDownload,
          label: t('common.button.exportAs', { format: 'Pterodactyl' }),
          onClick: () => onExport('pterodactyl', 'json'),
          color: 'gray',
        },
      ]}
    >
      {({ openMenu }) => (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openMenu(rect.left, rect.bottom);
          }}
          loading={loading}
          variant='outline'
          rightSection={<FontAwesomeIcon icon={faChevronDown} />}
        >
          {t('common.button.export', {})}
        </Button>
      )}
    </ContextMenu>
  );
}
