import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import updateNodesConfig from '@/api/admin/nodes/updateNodesConfig.ts';
import BulkYamlConfigModal from '@/elements/modals/BulkYamlConfigModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodesBulkConfigModal({
  selectedNodes,
  setSelectedNodes,
  ...props
}: ModalProps & {
  selectedNodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>;
  setSelectedNodes: (nodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>) => void;
}) {
  const { t, tItem } = useTranslations();

  return (
    <BulkYamlConfigModal
      {...props}
      applyFn={(config) => updateNodesConfig(selectedNodes.keys(), config)}
      onApplied={() => setSelectedNodes(new ObjectSet('uuid'))}
      labels={{
        title: t('pages.admin.nodes.modal.bulkConfig.title', { nodes: tItem('node', selectedNodes.size) }),
        applyButton: t('pages.admin.nodes.modal.bulkConfig.button.apply', {
          nodes: tItem('node', selectedNodes.size),
        }),
        applied: (applied) => t('pages.admin.nodes.modal.bulkConfig.toast.applied', { nodes: tItem('node', applied) }),
      }}
    />
  );
}
