import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Group from '@/elements/layout/Group.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeAllocationsCreateModal from './modals/NodeAllocationsCreateModal.tsx';

export default function NoAvailableAllocationsAlert({ nodeUuid, className }: { nodeUuid: string; className?: string }) {
  const { t } = useTranslations();
  const canCreate = useAdminCan('nodes.allocations');

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Alert color='yellow' className={className}>
      <Group justify='space-between' wrap='nowrap'>
        <span>
          {canCreate
            ? t('pages.admin.nodes.tabs.allocations.page.alert.noneAvailableCreate', {})
            : t('pages.admin.nodes.tabs.allocations.page.alert.noneAvailable', {})}
        </span>
        {canCreate && (
          <Button size='xs' leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={() => setCreateOpen(true)}>
            {t('pages.admin.nodes.tabs.allocations.page.button.createAllocations', {})}
          </Button>
        )}
      </Group>

      {canCreate && (
        <NodeAllocationsCreateModal
          node={{ uuid: nodeUuid }}
          opened={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </Alert>
  );
}
