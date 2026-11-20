import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { ModalProps } from '@mantine/core';
import { join } from 'pathe';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesProgressString } from '@/lib/format/size.ts';
import useIncompleteUploads from '@/pages/server/files/hooks/useIncompleteUploads.ts';
import FileRowIcon from '@/pages/server/files/list/FileRowIcon.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function IncompleteUploadsModal({ ...props }: ModalProps) {
  const { t, tItem } = useTranslations();
  const uploads = useIncompleteUploads();

  return (
    <Modal title={t('pages.server.files.modal.incompleteUploads.title', {})} {...props}>
      {uploads.length === 0 ? (
        <Text size='sm' c='dimmed'>
          {t('pages.server.files.modal.incompleteUploads.empty', {})}
        </Text>
      ) : (
        <>
          <Alert color='yellow' icon={faTriangleExclamation}>
            {t('pages.server.files.modal.incompleteUploads.content', {
              files: tItem('file', uploads.length),
            })}
          </Alert>

          <ItemPreviewList
            className='mt-3'
            items={uploads}
            getKey={(upload) => join(upload.directory, upload.name)}
            renderItem={(upload) => (
              <ItemPreviewRow
                icon={<FileRowIcon />}
                name={upload.name}
                description={upload.directory}
                meta={bytesProgressString(upload.uploaded, upload.total ?? 0)}
              />
            )}
          />

          <Text size='xs' c='dimmed' mt='sm'>
            {t('pages.server.files.modal.incompleteUploads.hint', {})}
          </Text>
        </>
      )}

      <ModalFooter>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
