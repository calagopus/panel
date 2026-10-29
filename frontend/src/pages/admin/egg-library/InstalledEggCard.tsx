import { faArrowUpRightFromSquare, faEgg, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import updateEggUsingRepository from '@/api/admin/nests/eggs/updateEggUsingRepository.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import PreviewCard from '@/elements/data-display/PreviewCard.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import { isEggUpdateAvailable } from '@/lib/domain/egg.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggCardDockerImages from './EggCardDockerImages.tsx';

export default function InstalledEggCard({
  egg,
  nest,
  onUpdated,
}: {
  egg: z.infer<typeof adminEggSchema>;
  nest: z.infer<typeof adminNestSchema>;
  onUpdated: () => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const updateAvailable = isEggUpdateAvailable(egg);

  const doUpdate = () => {
    setLoading(true);

    updateEggUsingRepository(nest.uuid, egg.uuid)
      .then(() => {
        addToast(t('pages.admin.eggLibrary.tabs.installed.page.toast.updated', { egg: egg.name }), 'success');
        onUpdated();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const header = (
    <div className='mb-3 flex items-start gap-3'>
      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--mantine-color-default-hover) text-(--mantine-color-dimmed)'>
        <FontAwesomeIcon icon={faEgg} className='text-sm' />
      </div>
      <div className='min-w-0 flex-1'>
        <h3 className='text-md font-medium leading-tight'>
          <ScrollingText>{egg.name}</ScrollingText>
        </h3>
        <p className='mt-0.5 text-[11px] text-(--mantine-color-dimmed)'>
          <ScrollingText>{egg.author}</ScrollingText>
        </p>
      </div>
    </div>
  );

  const badges = (
    <div className='mb-2.5 flex flex-wrap gap-1.5'>
      <Badge color='blue' variant='light' size='sm'>
        {nest.name}
      </Badge>
      {updateAvailable && (
        <Badge color='yellow' variant='light' size='sm'>
          {t('common.badge.updateAvailable', {})}
        </Badge>
      )}
      {!egg.eggRepositoryEgg && (
        <Badge color='gray' variant='light' size='sm'>
          {t('pages.admin.eggLibrary.badge.manual', {})}
        </Badge>
      )}
    </div>
  );

  const repository = egg.eggRepositoryEgg && (
    <div className='mb-3 flex items-center justify-between gap-2 min-w-0'>
      <span className='text-xs text-(--mantine-color-dimmed) shrink-0'>
        {t('pages.admin.eggLibrary.card.repository', {})}
      </span>
      <span className='text-xs text-(--mantine-color-text) min-w-0'>
        <ScrollingText>{egg.eggRepositoryEgg.eggRepository.name}</ScrollingText>
      </span>
    </div>
  );

  const actions = (
    <div className='mt-auto flex items-center gap-2'>
      <Link to={`/admin/nests/${nest.uuid}/eggs/${egg.uuid}`} className='block flex-1'>
        <Button variant='default' leftSection={<FontAwesomeIcon icon={faArrowUpRightFromSquare} />} className='w-full!'>
          {t('pages.admin.eggLibrary.button.open', {})}
        </Button>
      </Link>
      {updateAvailable && (
        <AdminCan action='eggs.update'>
          <Button leftSection={<FontAwesomeIcon icon={faRefresh} />} onClick={doUpdate} loading={loading}>
            {t('common.button.update', {})}
          </Button>
        </AdminCan>
      )}
    </div>
  );

  return (
    <PreviewCard
      preview={
        <>
          {header}
          {badges}
          {repository}
          <div className='mb-3 flex items-center justify-between gap-2'>
            <span className='text-xs text-(--mantine-color-dimmed)'>{t('common.table.columns.created', {})}</span>
            <span className='text-xs text-(--mantine-color-text)'>{formatDateTime(egg.created)}</span>
          </div>
          {egg.description && (
            <p className='mb-3 text-xs leading-relaxed text-(--mantine-color-dimmed)'>{egg.description}</p>
          )}
          {egg.features.length > 0 && (
            <div className='mb-3'>
              <p className='mb-1.5 text-xs text-(--mantine-color-dimmed)'>
                {t('pages.admin.eggLibrary.card.features', {})}
              </p>
              <div className='flex flex-wrap gap-1.5'>
                {egg.features.map((feature) => (
                  <Badge key={feature} color='gray' variant='light' size='sm'>
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <EggCardDockerImages dockerImages={egg.dockerImages} />
          <Divider className='mb-3 mt-1' />
          {actions}
        </>
      }
    >
      {header}
      {badges}
      {repository}

      {egg.description && (
        <p className='flex-1 line-clamp-3 text-xs leading-relaxed text-(--mantine-color-dimmed)'>{egg.description}</p>
      )}

      <Divider className='mb-3 mt-1' />

      {actions}
    </PreviewCard>
  );
}
