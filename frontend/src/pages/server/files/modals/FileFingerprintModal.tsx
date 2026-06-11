import { ModalProps } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileFingerprint from '@/api/server/files/getFileFingerprint.ts';
import Button from '@/elements/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { fingerprintAlgorithmLabelMapping } from '@/lib/enums.ts';
import { serverDirectoryEntrySchema, serverFilesFingerprintSchema } from '@/lib/schemas/server/files.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileFingerprintsModal({ file, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { browsingDirectory } = useFileManager();
  const { server } = useServerStore();
  const { addToast } = useToast();

  const [fingerprint, setFingerprint] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof serverFilesFingerprintSchema>>({
    initialValues: {
      algorithm: 'sha256',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverFilesFingerprintSchema),
  });

  const doGetFingerprint = () => {
    if (!file) return;

    setLoading(true);

    getFileFingerprint(server.uuid, join(browsingDirectory, file.name), form.values.algorithm)
      .then((fingerprint) => {
        setFingerprint(fingerprint);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.fileFingerprints.title', {})} onClose={onClose} opened={opened} size='sm'>
      <form onSubmit={form.onSubmit(() => doGetFingerprint())}>
        <div className='grid grid-cols-3 gap-2'>
          <Select
            withAsterisk
            label={t('pages.server.files.modal.fileFingerprints.form.algorithm', {})}
            data={Object.entries(fingerprintAlgorithmLabelMapping).map(([value, label]) => ({
              label,
              value,
            }))}
            {...form.getInputProps('algorithm')}
          />

          <CopyOnClick content={fingerprint} className='text-left col-span-2'>
            <TextInput
              label={t('pages.server.files.modal.fileFingerprints.form.fingerprint', {})}
              value={fingerprint || '-'}
              className='pointer-events-none'
              readOnly
            />
          </CopyOnClick>
        </div>

        <ModalFooter>
          <Button type='submit' loading={loading}>
            {t('pages.server.files.modal.fileFingerprints.button.calculate', {})}
          </Button>
          <Button variant='default' onClick={onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
