import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryEggsInstallModal from './modals/EggRepositoryEggsInstallModal.tsx';

export default function EggActionBar({
  eggRepository,
  selectedEggs,
  setSelectedEggs,
}: {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
  selectedEggs: ObjectSet<z.infer<typeof adminEggRepositoryEggSchema>, 'uuid'>;
  setSelectedEggs: (eggs: ObjectSet<z.infer<typeof adminEggRepositoryEggSchema>, 'uuid'>) => void;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'install' | null>(null);

  return (
    <>
      <EggRepositoryEggsInstallModal
        eggRepository={eggRepository}
        selectedEggs={selectedEggs}
        setSelectedEggs={setSelectedEggs}
        opened={openModal === 'install'}
        onClose={() => setOpenModal(null)}
      />

      <ActionBar opened={selectedEggs.size > 0}>
        <Button onClick={() => setOpenModal('install')} className='col-span-full'>
          <FontAwesomeIcon icon={faDownload} className='mr-2' /> {t('common.button.install', {})}
        </Button>
      </ActionBar>
    </>
  );
}
