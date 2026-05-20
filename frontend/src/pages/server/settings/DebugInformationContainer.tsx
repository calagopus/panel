import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack } from '@mantine/core';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DebugInformationContainer() {
  const { t } = useTranslations();
  const { server } = useServerStore();

  return (
    <TitleCard
      title={t('pages.server.settings.debugInformation.title', {})}
      icon={<FontAwesomeIcon icon={faInfoCircle} />}
      className='h-full order-10'
    >
      <Stack h='100%'>
        <CopyOnClick content={`${server.nodeName} (${server.nodeUuid})`} className='text-left'>
          <TextInput
            label={t('pages.server.settings.debugInformation.form.nodeName', {})}
            placeholder={t('pages.server.settings.debugInformation.form.nodeName', {})}
            value={`${server.nodeName} (${server.nodeUuid})`}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>

        <CopyOnClick content={`${server.locationName} (${server.locationUuid})`} className='text-left'>
          <TextInput
            label={t('pages.server.settings.debugInformation.form.locationName', {})}
            placeholder={t('pages.server.settings.debugInformation.form.locationName', {})}
            value={`${server.locationName} (${server.locationUuid})`}
            className='pointer-events-none'
            leftSection={
              server.locationFlag ? (
                <img
                  src={`/flags/${server.locationFlag}.svg`}
                  alt={server.locationName}
                  className='w-5 h-5 rounded-md shrink-0 my-auto'
                />
              ) : undefined
            }
            readOnly
          />
        </CopyOnClick>

        <CopyOnClick content={server.uuid} className='text-left'>
          <TextInput
            label={t('pages.server.settings.debugInformation.form.serverUuid', {})}
            placeholder={t('pages.server.settings.debugInformation.form.serverUuid', {})}
            value={server.uuid}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>
      </Stack>
    </TitleCard>
  );
}
