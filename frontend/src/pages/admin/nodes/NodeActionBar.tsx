import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodesBulkConfigModal from './modals/NodesBulkConfigModal.tsx';

export default function NodeActionBar({
  selectedNodes,
  setSelectedNodes,
}: {
  selectedNodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>;
  setSelectedNodes: (nodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>) => void;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'config' | null>(null);

  return (
    <>
      <AdminCan action='nodes.update'>
        <NodesBulkConfigModal
          selectedNodes={selectedNodes}
          setSelectedNodes={setSelectedNodes}
          opened={openModal === 'config'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <ActionBar opened={selectedNodes.size > 0}>
        <AdminCan action='nodes.update'>
          <Button onClick={() => setOpenModal('config')} className='col-span-full'>
            <FontAwesomeIcon icon={faScrewdriverWrench} className='mr-2' />{' '}
            {t('pages.admin.nodes.tabs.general.page.button.updateConfig', {})}
          </Button>
        </AdminCan>
      </ActionBar>
    </>
  );
}
