import { faCircleCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import testBackupConfiguration from '@/api/admin/backup-configurations/testBackupConfiguration.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Select from '@/elements/input/Select.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminBackupConfigurationTestResultSchema,
  adminBackupConfigurationTestSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function BackupConfigurationTestModal({
  buildTest,
  ...props
}: ModalProps & {
  buildTest: () => Omit<z.infer<typeof adminBackupConfigurationTestSchema>, 'nodeUuid'>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [nodeUuid, setNodeUuid] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<z.infer<typeof adminBackupConfigurationTestResultSchema> | null>(null);

  const nodes = useInfiniteSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (page, search) => getNodes(page, search),
  });

  useEffect(() => {
    if (!props.opened) {
      setResult(null);
      nodes.setSearch('');
    }
  }, [props.opened]);

  const doTest = () => {
    if (!nodeUuid) {
      return;
    }

    setTesting(true);
    setResult(null);

    testBackupConfiguration({ ...buildTest(), nodeUuid })
      .then(setResult)
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setTesting(false));
  };

  return (
    <Modal title={t('pages.admin.backupConfigurations.tabs.general.page.modal.test.title', {})} {...props}>
      <Stack>
        {t('pages.admin.backupConfigurations.tabs.general.page.modal.test.content', {}).md()}

        <Select
          withAsterisk
          label={t('common.form.node', {})}
          value={nodeUuid}
          onChange={(value) => {
            setNodeUuid(value);
            setResult(null);
          }}
          data={nodes.items.map((node) => ({ label: node.name, value: node.uuid }))}
          searchable
          searchValue={nodes.search}
          onSearchChange={nodes.setSearch}
          infiniteScroll={nodes.infiniteScroll}
          filter={({ options }) => options}
          loading={nodes.loading}
        />

        {result &&
          (result.successful ? (
            <Alert color='green' icon={<FontAwesomeIcon icon={faCircleCheck} />}>
              {t('pages.admin.backupConfigurations.tabs.general.page.modal.test.successful', {
                duration: `${result.durationMs}ms`,
              })}
            </Alert>
          ) : (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              <Stack gap='xs'>
                {t('pages.admin.backupConfigurations.tabs.general.page.modal.test.failed', {
                  duration: `${result.durationMs}ms`,
                })}
                {result.error && (
                  <Code block className='whitespace-pre-wrap break-all'>
                    {result.error}
                  </Code>
                )}
              </Stack>
            </Alert>
          ))}

        <ModalFooter>
          <Button onClick={doTest} loading={testing} disabled={!nodeUuid}>
            {t('pages.admin.backupConfigurations.tabs.general.page.modal.test.run', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
