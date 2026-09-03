import { faChevronDown, faFileDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/elements/buttons/Button.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import type { ResourceExportFormat } from '@/lib/download/export.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ResourceExportMenuProps {
  loading?: boolean;
  onExport: (format: ResourceExportFormat) => void;
}

export default function ResourceExportMenu({ loading, onExport }: ResourceExportMenuProps) {
  const { t } = useTranslations();

  return (
    <ContextMenu
      menuProps={{ position: 'top', offset: 40 }}
      items={[
        {
          type: 'action',
          icon: faFileDownload,
          label: t('common.button.exportAs', { format: 'JSON' }),
          onClick: () => onExport('json'),
          color: 'gray',
        },
        {
          type: 'action',
          icon: faFileDownload,
          label: t('common.button.exportAs', { format: 'YAML' }),
          onClick: () => onExport('yaml'),
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
