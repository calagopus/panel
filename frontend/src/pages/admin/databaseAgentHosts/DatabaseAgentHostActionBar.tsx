import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentHostsBulkConfigModal from './modals/DatabaseAgentHostsBulkConfigModal.tsx';

export default function DatabaseAgentHostActionBar({
  selectedHosts,
  setSelectedHosts,
}: {
  selectedHosts: ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>;
  setSelectedHosts: (hosts: ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>) => void;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'config' | null>(null);

  return (
    <>
      <AdminCan action='database-agent-hosts.update'>
        <DatabaseAgentHostsBulkConfigModal
          selectedHosts={selectedHosts}
          setSelectedHosts={setSelectedHosts}
          opened={openModal === 'config'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <ActionBar opened={selectedHosts.size > 0}>
        <AdminCan action='database-agent-hosts.update'>
          <Button onClick={() => setOpenModal('config')} className='col-span-full'>
            <FontAwesomeIcon icon={faScrewdriverWrench} className='mr-2' />{' '}
            {t('pages.admin.databaseAgentHosts.tabs.general.page.button.updateConfig', {})}
          </Button>
        </AdminCan>
      </ActionBar>
    </>
  );
}
