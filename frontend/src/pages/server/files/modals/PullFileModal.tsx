import { ModalProps } from '@mantine/core';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import pullFile from '@/api/server/files/pullFile.ts';
import queryFilePull from '@/api/server/files/queryFilePull.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { serverFilesPullQueryResultSchema, serverFilesPullSchema } from '@/lib/schemas/server/files.ts';
import FilePathPreview from '@/pages/server/files/modals/FilePathPreview.tsx';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function PullFileModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<null | z.infer<typeof serverFilesPullQueryResultSchema>>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesPullSchema>>({
    initialValues: {
      url: '',
      name: '',
    },
    validate: zod4Resolver(serverFilesPullSchema),
    onClose: props.onClose,
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
        form.setFieldValue('name', data.fileName || form.values.url.split('/').pop() || '');
      })
      .catch((msg) => {
        addToast(msg?.message ?? String(msg), 'error');
      })
      .finally(() => setQueryLoading(false));
  };

  return (
    <FormModal
      title={t('pages.server.files.modal.pullFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
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

      <FilePathPreview
        label={t('pages.server.files.modal.pullFile.createdAs', {})}
        path={join(browsingDirectory, form.values.name ?? '')}
      />

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
