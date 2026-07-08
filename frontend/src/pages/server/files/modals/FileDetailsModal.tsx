import { ModalProps } from '@mantine/core';
import { join } from 'pathe';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Divider from '@/elements/Divider.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Title from '@/elements/Title.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { bytesToString } from '@/lib/size.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import FileRowIcon from '../FileRowIcon.tsx';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileDetailsModal({ file, ...props }: Props) {
  const { t } = useTranslations();
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);

  return (
    <Modal title={t('pages.server.files.modal.details.title', {})} size='sm' {...props}>
      <div className='flex flex-col space-y-1'>
        <Title order={3} className='break-all'>
          <FileRowIcon className='mr-2' file={file} />
          {file?.name}
        </Title>

        <Divider className='my-2' />

        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.path', {})}</p>
          <Code className='break-all'>{join(browsingDirectory, file?.name || '')}</Code>
        </span>
        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.mode', {})}</p>
          <Code>{file?.mode}</Code>
        </span>
        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.logicalSize', {})}</p>
          <Code>
            {bytesToString(file?.size || 0)} ({file?.size} Bytes)
          </Code>
        </span>
        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.physicalSize', {})}
          </p>
          <Code>
            {bytesToString(file?.sizePhysical || 0)} ({file?.sizePhysical} Bytes)
          </Code>
        </span>
        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.mimeType', {})}</p>
          <Code>{file?.mime}</Code>
        </span>
        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.lastModifiedAt', {})}
          </p>
          <Code>
            <FormattedTimestamp timestamp={file?.modified ?? 0} />
          </Code>
        </span>
        <span className='flex flex-row items-center justify-between'>
          <p className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.createdAt', {})}</p>
          <Code>
            <FormattedTimestamp timestamp={file?.created ?? 0} />
          </Code>
        </span>
      </div>

      <ModalFooter>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
