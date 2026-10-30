import { faBook, faDownload, faEgg } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Card as MantineCard } from '@mantine/core';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import PreviewCard from '@/elements/data-display/PreviewCard.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import { isInstalledEggUpdateAvailable } from '@/lib/domain/egg.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { adminEggRepositoryCatalogEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggCardDockerImages from './EggCardDockerImages.tsx';

export default function AvailableEggCard({
  item,
  onInstall,
  onReadme,
}: {
  item: z.infer<typeof adminEggRepositoryCatalogEggSchema>;
  onInstall: () => void;
  onReadme: () => void;
}) {
  const { t } = useTranslations();

  const banner = item.egg.banner && (
    <MantineCard.Section mb='md'>
      <img
        src={item.egg.banner}
        alt={item.egg.exportedEgg.name}
        loading='lazy'
        className='aspect-2/1 w-full object-cover'
      />
    </MantineCard.Section>
  );

  const header = (
    <div className='mb-3 flex items-start gap-3'>
      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--mantine-color-default-hover) text-(--mantine-color-dimmed)'>
        <FontAwesomeIcon icon={faEgg} className='text-sm' />
      </div>
      <div className='min-w-0 flex-1'>
        <h3 className='text-md font-medium leading-tight'>
          <ScrollingText>{item.egg.exportedEgg.name}</ScrollingText>
        </h3>
        <p className='mt-0.5 text-xs text-(--mantine-color-dimmed)'>
          <ScrollingText>{item.egg.exportedEgg.author}</ScrollingText>
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className='mt-auto flex items-center justify-between gap-2'>
      <div className='flex flex-wrap items-center gap-1.5 min-w-0'>
        <Badge color='blue' variant='light' size='sm' radius='sm'>
          {item.egg.eggRepository.name}
        </Badge>
        {item.installedEggs.map((installed) => (
          <Badge
            key={installed.uuid}
            color={isInstalledEggUpdateAvailable(item.egg.hash, installed) ? 'yellow' : 'green'}
            variant='light'
            size='sm'
            radius='sm'
          >
            {t('pages.admin.eggLibrary.card.installedIn', {})} {installed.nest.name}
          </Badge>
        ))}
      </div>

      <div className='flex items-center gap-2'>
        <Tooltip label={t('pages.admin.eggLibrary.button.readme', {})}>
          <ActionIcon variant='default' size='input-sm' onClick={onReadme}>
            <FontAwesomeIcon icon={faBook} />
          </ActionIcon>
        </Tooltip>
        <AdminCan action={['eggs.create', 'nests.read']}>
          <Button leftSection={<FontAwesomeIcon icon={faDownload} />} onClick={onInstall}>
            {t('common.button.install', {})}
          </Button>
        </AdminCan>
      </div>
    </div>
  );

  return (
    <PreviewCard
      preview={
        <>
          {banner}
          {header}
          <div className='mb-1 flex items-center justify-between gap-2 min-w-0'>
            <span className='text-xs text-(--mantine-color-dimmed) shrink-0'>
              {t('pages.admin.eggLibrary.card.path', {})}
            </span>
            <span className='text-xs text-(--mantine-color-text) min-w-0'>
              <ScrollingText>{item.egg.path}</ScrollingText>
            </span>
          </div>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <span className='text-xs text-(--mantine-color-dimmed)'>{t('common.table.columns.updated', {})}</span>
            <span className='text-xs text-(--mantine-color-text)'>{formatDateTime(item.egg.updated)}</span>
          </div>
          {item.egg.exportedEgg.description && (
            <p className='mb-3 text-xs leading-relaxed text-(--mantine-color-dimmed)'>
              {item.egg.exportedEgg.description}
            </p>
          )}
          <EggCardDockerImages dockerImages={item.egg.exportedEgg.dockerImages} />
          <Divider className='mb-3 mt-1' />
          {footer}
        </>
      }
    >
      {banner}
      {header}

      {item.egg.exportedEgg.description && (
        <p className='mb-3 flex-1 line-clamp-3 text-xs leading-relaxed text-(--mantine-color-dimmed)'>
          {item.egg.exportedEgg.description}
        </p>
      )}

      <Divider className='mb-3 mt-1' />

      {footer}
    </PreviewCard>
  );
}
