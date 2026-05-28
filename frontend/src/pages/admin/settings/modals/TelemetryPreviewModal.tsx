import { ModalProps } from '@mantine/core';
import { useMemo } from 'react';
import Button from '@/elements/Button.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TelemetryPreviewModal({
  telemetry,
  opened,
  onClose,
}: ModalProps & { telemetry: object | null }) {
  const { t } = useTranslations();
  const jsonLanguage = useMemo(() => () => import('highlight.js/lib/languages/json').then((m) => m.default), []);

  return (
    <Modal
      title={t('pages.admin.settings.tabs.application.page.modal.telemetryPreview.title', {})}
      onClose={onClose}
      opened={opened}
      size='lg'
    >
      <HljsCode languageName='json' language={jsonLanguage}>
        {JSON.stringify(telemetry, null, 2)}
      </HljsCode>

      <ModalFooter>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
