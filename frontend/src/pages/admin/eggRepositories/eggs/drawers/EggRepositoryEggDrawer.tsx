import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DrawerProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Drawer from '@/elements/Drawer.tsx';
import ScrollArea from '@/elements/ScrollArea.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryEggInstallModal from '../modals/EggRepositoryEggInstallModal.tsx';

export default function EggRepositoryEggDrawer({
  eggRepository,
  egg,
  opened,
  onClose,
  ...props
}: DrawerProps & {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
  egg: z.infer<typeof adminEggRepositoryEggSchema> | null;
}) {
  const { t } = useTranslations();
  const [installOpen, setInstallOpen] = useState(false);

  // Retain the last egg so its contents stay visible while the drawer animates closed.
  const [displayEgg, setDisplayEgg] = useState(egg);
  useEffect(() => {
    if (egg) {
      setDisplayEgg(egg);
    }
  }, [egg]);

  return (
    <Drawer
      position='right'
      offset={8}
      radius='md'
      opened={opened}
      onClose={onClose}
      title={displayEgg?.exportedEgg.name}
      size='lg'
      {...props}
    >
      {displayEgg && (
        <>
          <AdminCan action='nests.read'>
            <EggRepositoryEggInstallModal
              eggRepository={eggRepository}
              egg={displayEgg}
              opened={installOpen}
              onClose={() => setInstallOpen(false)}
            />
          </AdminCan>

          <Stack gap='md' className='h-full'>
            <AdminCan action='nests.read'>
              <Button leftSection={<FontAwesomeIcon icon={faDownload} />} onClick={() => setInstallOpen(true)}>
                {t('common.button.install', {})}
              </Button>
            </AdminCan>

            <ScrollArea className='flex-1' offsetScrollbars>
              {displayEgg.readme ? (
                <div className='text-sm wrap-break-word'>{displayEgg.readme.md({ html: true })}</div>
              ) : (
                <div className='flex items-center justify-center py-12 text-(--mantine-color-dimmed)'>
                  {t('pages.admin.eggRepositories.tabs.eggs.page.drawer.noReadme', {})}
                </div>
              )}
            </ScrollArea>
          </Stack>
        </>
      )}
    </Drawer>
  );
}
