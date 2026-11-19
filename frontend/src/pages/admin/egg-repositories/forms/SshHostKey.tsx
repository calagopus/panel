import { faCheck, faDownload, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getEggRepositorySshHostKeys from '@/api/admin/egg-repositories/getEggRepositorySshHostKeys.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { adminEggRepositorySshHostKeySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SshHostKey({
  gitRepository,
  originChanged,
  value,
  onChange,
}: {
  gitRepository: string;
  originChanged: boolean;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [hostKeys, setHostKeys] = useState<z.infer<typeof adminEggRepositorySshHostKeySchema>[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const doFetch = () => {
    setLoading(true);

    getEggRepositorySshHostKeys(gitRepository)
      .then((hostKeys) => {
        setSelected(hostKeys.find((hostKey) => hostKey.publicKey === value)?.publicKey ?? null);
        setHostKeys(hostKeys);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Modal
        title={t('pages.admin.eggRepositories.tabs.general.page.modal.sshHostKeys.title', {})}
        size='lg'
        opened={hostKeys !== null}
        onClose={() => setHostKeys(null)}
      >
        <Stack gap='sm'>
          <Text size='sm' c='dimmed'>
            {hostKeys?.length === 0
              ? t('pages.admin.eggRepositories.tabs.general.page.modal.sshHostKeys.empty', {})
              : t('pages.admin.eggRepositories.tabs.general.page.modal.sshHostKeys.description', {})}
          </Text>

          {hostKeys?.map((hostKey) => (
            <Card
              key={hostKey.publicKey}
              p='sm'
              hoverable
              className={selected === hostKey.publicKey ? 'border-(--mantine-primary-color-filled)!' : undefined}
              onClick={() => setSelected(hostKey.publicKey)}
            >
              <Group justify='space-between' wrap='nowrap'>
                <Stack gap={2} className='min-w-0'>
                  <Text size='sm' fw={500}>
                    {hostKey.algorithm}
                  </Text>
                  <Code className='truncate'>{hostKey.fingerprint}</Code>
                </Stack>
                {selected === hostKey.publicKey && (
                  <FontAwesomeIcon icon={faCheck} className='text-(--mantine-primary-color-filled)' />
                )}
              </Group>
            </Card>
          ))}

          <ModalFooter>
            <Button
              disabled={!selected}
              onClick={() => {
                onChange(selected);
                setHostKeys(null);
              }}
            >
              {t('pages.admin.eggRepositories.tabs.general.page.button.useSshHostKey', {})}
            </Button>
            <Button variant='default' onClick={() => setHostKeys(null)}>
              {t('common.button.close', {})}
            </Button>
          </ModalFooter>
        </Stack>
      </Modal>

      <Stack gap='xs'>
        {originChanged && (
          <Alert color='yellow' icon={faExclamationTriangle}>
            {t('pages.admin.eggRepositories.tabs.general.page.alert.sshHostKeyOriginChanged', {})}
          </Alert>
        )}

        <TextInput
          withAsterisk
          label={t('pages.admin.eggRepositories.tabs.general.page.form.sshHostKey', {})}
          description={t('pages.admin.eggRepositories.tabs.general.page.form.sshHostKeyDescription', {})}
          placeholder='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...'
          value={value ?? ''}
          onChange={(e) => onChange(e.currentTarget.value || null)}
          rightSectionWidth={84}
          rightSectionProps={{ style: { justifyContent: 'flex-end', paddingRight: 4 } }}
          rightSection={
            <Button
              size='compact-sm'
              variant='light'
              leftSection={<FontAwesomeIcon icon={faDownload} />}
              loading={loading}
              disabled={!gitRepository}
              onClick={doFetch}
            >
              {t('pages.admin.eggRepositories.tabs.general.page.button.fetchSshHostKeys', {})}
            </Button>
          }
        />
      </Stack>
    </>
  );
}
