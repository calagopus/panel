import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SettingsReinstallModal from './modals/SettingsReinstallModal.tsx';

export default function ReinstallContainer() {
  const { t } = useTranslations();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <TitleCard
      title={t('pages.server.settings.reinstall.title', {})}
      icon={<FontAwesomeIcon icon={faCog} />}
      className='h-full order-50'
    >
      <SettingsReinstallModal opened={modalOpen} onClose={() => setModalOpen(false)} />

      <Stack h='100%'>
        {t('pages.server.settings.reinstall.content', {}).md()}

        <Group mt='auto'>
          <Button color='red' onClick={() => setModalOpen(true)}>
            {t('pages.server.settings.reinstall.button', {})}
          </Button>
        </Group>
      </Stack>
    </TitleCard>
  );
}
