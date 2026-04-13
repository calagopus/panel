import { ModalProps } from '@mantine/core';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import pullFile from '@/api/server/files/pullFile.ts';
import queryFilePull from '@/api/server/files/queryFilePull.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesPullQueryResultSchema, serverFilesPullSchema } from '@/lib/schemas/server/files.ts';
import { bytesToString } from '@/lib/size.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function PullFileModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory } = useFileManager();

  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<null | z.infer<typeof serverFilesPullQueryResultSchema>>(null);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesPullSchema>>(
    {
      initialValues: {
        url: '',
        name: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesPullSchema),
    },
    onClose,
  );

  useEffect(() => {
    setQueryResult(null);
  }, [form.values.url]);

  const doQueryFilePull = () => {
    setLoading(true);

    queryFilePull(server.uuid, form.values.url)
      .then((data) => {
        addToast(t('pages.server.files.toast.fileInfoRetrieved', {}), 'success');
        setQueryResult(data);
        form.setFieldValue('name', data.fileName ?? form.values.url.split('/').pop() ?? '');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doPullFile = () => {
    setLoading(true);

    pullFile(server.uuid, {
      root: browsingDirectory,
      url: form.values.url,
      name: form.values.name,
    })
      .then(() => {
        addToast(t('pages.server.files.toast.filePullingStarted', {}), 'success');
        handleClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.pullFile.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doPullFile())}>
        <div className='grid grid-cols-4 gap-2'>
          <TextInput
            withAsterisk
            className='col-span-3'
            label={t('pages.server.files.modal.pullFile.form.fileUrl', {})}
            placeholder={t('pages.server.files.modal.pullFile.form.fileUrl', {})}
            {...form.getInputProps('url')}
          />
          <Button
            className={classNames('self-end', !!form.errors.url && 'mb-5')}
            onClick={doQueryFilePull}
            loading={loading}
            disabled={!form.isValid('url')}
          >
            {t('pages.server.files.modal.pullFile.form.query', {})}
          </Button>
        </div>

        <TextInput
          withAsterisk
          label={t('pages.server.files.modal.pullFile.form.fileName', {})}
          placeholder={queryResult?.fileName ?? t('pages.server.files.modal.pullFile.form.fileName', {})}
          className='mt-2'
          {...form.getInputProps('name')}
        />

        <p className='mt-2 text-sm md:text-base break-all'>
          <span className='text-neutral-200'>{t('pages.server.files.modal.pullFile.createdAs', {})}</span>
          <Code>
            /home/container/
            <span className='text-cyan-200'>
              {join(browsingDirectory, form.values.name ?? '').replace(/^(\.\.\/|\/)+/, '')}
            </span>
          </Code>
        </p>

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('pages.server.files.modal.pullFile.pull', {})}
            {queryResult?.fileSize ? ` (${bytesToString(queryResult.fileSize)})` : ''}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
