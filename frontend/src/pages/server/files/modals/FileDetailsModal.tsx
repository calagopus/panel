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
import FileRowIcon from '../browser/FileRowIcon.tsx';

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

        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.path', {})}</span>
          <Code className='break-all'>{join(browsingDirectory, file?.name || '')}</Code>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>{t('pages.server.files.modal.details.mode', {})}</span>
          <Code>{file?.mode}</Code>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.logicalSize', {})}
          </span>
          <Code>
            {bytesToString(file?.size || 0)} ({file?.size} Bytes)
          </Code>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.physicalSize', {})}
          </span>
          <Code>
            {bytesToString(file?.sizePhysical || 0)} ({file?.sizePhysical} Bytes)
          </Code>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.mimeType', {})}
          </span>
          <Code>{file?.mime}</Code>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.lastModifiedAt', {})}
          </span>
          <Code>
            <FormattedTimestamp timestamp={file?.modified ?? 0} />
          </Code>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <span className='text-(--mantine-color-dimmed)! mr-4'>
            {t('pages.server.files.modal.details.createdAt', {})}
          </span>
          <Code>
            <FormattedTimestamp timestamp={file?.created ?? 0} />
          </Code>
        </div>
      </div>

      <ModalFooter>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
