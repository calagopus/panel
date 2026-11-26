import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import updateDatabaseAgentHostsConfig from '@/api/admin/database-agent-hosts/updateDatabaseAgentHostsConfig.ts';
import BulkYamlConfigModal from '@/elements/modals/BulkYamlConfigModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DatabaseAgentHostsBulkConfigModal({
  selectedHosts,
  setSelectedHosts,
  ...props
}: ModalProps & {
  selectedHosts: ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>;
  setSelectedHosts: (hosts: ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>) => void;
}) {
  const { t, tItem } = useTranslations();

  return (
    <BulkYamlConfigModal
      {...props}
      applyFn={(config) => updateDatabaseAgentHostsConfig(selectedHosts.keys(), config)}
      onApplied={() => setSelectedHosts(new ObjectSet('uuid'))}
      labels={{
        title: t('pages.admin.databaseAgentHosts.modal.bulkConfig.title', {
          hosts: tItem('databaseAgentHost', selectedHosts.size),
        }),
        applyButton: t('pages.admin.databaseAgentHosts.modal.bulkConfig.button.apply', {
          hosts: tItem('databaseAgentHost', selectedHosts.size),
        }),
        applied: (applied) =>
          t('pages.admin.databaseAgentHosts.modal.bulkConfig.toast.applied', {
            hosts: tItem('databaseAgentHost', applied),
          }),
      }}
    />
  );
}
