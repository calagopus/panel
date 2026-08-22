import { faInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import { activitySchema } from '@/lib/schemas/activity.ts';
import { serverActivitySchema } from '@/lib/schemas/server/activity.ts';
import { userActivitySchema } from '@/lib/schemas/user/activity.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Button from '../Button.tsx';
import HljsCode from '../HljsCode.tsx';
import { Modal, ModalFooter } from '../modals/Modal.tsx';

const loadJsonLanguage = () => import('highlight.js/lib/languages/json').then((mod) => mod.default);

export default function ActivityInfoButton({
  activity,
}: {
  activity: z.infer<typeof activitySchema> | z.infer<typeof userActivitySchema> | z.infer<typeof serverActivitySchema>;
}) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'view' | null>(null);

  return (
    <>
      <Modal
        title={t('elements.activityInfoButton.modal.info.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'view'}
        size='lg'
      >
        <HljsCode languageName='json' language={loadJsonLanguage}>
          {JSON.stringify(activity.data, null, 2)}
        </HljsCode>

        <ModalFooter>
          <Button variant='default' onClick={() => setOpenModal(null)}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Modal>

      <ActionIcon onClick={() => setOpenModal('view')}>
        <FontAwesomeIcon icon={faInfo} />
      </ActionIcon>
    </>
  );
}
