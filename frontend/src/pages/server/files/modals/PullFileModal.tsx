import { ModalProps } from '@mantine/core';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import pullFile from '@/api/server/files/pullFile.ts';
import queryFilePull from '@/api/server/files/queryFilePull.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
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

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<null | z.infer<typeof serverFilesPullQueryResultSchema>>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesPullSchema>>({
    initialValues: {
      url: '',
      name: '',
    },
    validate: zod4Resolver(serverFilesPullSchema),
    onClose,
    onSubmit: async (values) => {
      await pullFile(server.uuid, {
        root: browsingDirectory,
        url: values.url,
        name: values.name,
      });
      addToast(t('pages.server.files.toast.filePullingStarted', {}), 'success');
    },
  });

  useEffect(() => {
    setQueryResult(null);
  }, [form.values.url]);

  const doQueryFilePull = () => {
    setQueryLoading(true);

    queryFilePull(server.uuid, form.values.url)
      .then((data) => {
        addToast(t('pages.server.files.toast.fileInfoRetrieved', {}), 'success');
        setQueryResult(data);
        form.setFieldValue('name', data.fileName ?? form.values.url.split('/').pop() ?? '');
      })
      .catch((msg) => {
        addToast(msg?.message ?? String(msg), 'error');
      })
      .finally(() => setQueryLoading(false));
  };

  return (
    <FormModal
      title={t('pages.server.files.modal.pullFile.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <div className='grid grid-cols-4 gap-2'>
        <TextInput
          withAsterisk
          className='col-span-3'
          label={t('pages.server.files.modal.pullFile.form.fileUrl', {})}
          {...form.getInputProps('url')}
        />
        <Button
          className={classNames('self-end', !!form.errors.url && 'mb-5')}
          onClick={doQueryFilePull}
          loading={queryLoading}
          disabled={!form.isValid('url')}
        >
          {t('pages.server.files.modal.pullFile.form.query', {})}
        </Button>
      </div>

      <TextInput
        withAsterisk
        label={t('common.form.fileName', {})}
        placeholder={queryResult?.fileName ?? t('common.form.fileName', {})}
        className='mt-2'
        {...form.getInputProps('name')}
      />

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.pullFile.createdAs', {})}</span>
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
    </FormModal>
  );
}
