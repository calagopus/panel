import { ModalProps } from '@mantine/core';
import Button from '@/elements/Button.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const loadJsonLanguage = () => import('highlight.js/lib/languages/json').then((mod) => mod.default);

export default function TelemetryPreviewModal({ telemetry, ...props }: ModalProps & { telemetry: object | null }) {
  const { t } = useTranslations();

  return (
    <Modal
      title={t('pages.admin.settings.tabs.application.page.modal.telemetryPreview.title', {})}
      size='lg'
      {...props}
    >
      <HljsCode languageName='json' language={loadJsonLanguage}>
        {JSON.stringify(telemetry, null, 2)}
      </HljsCode>

      <ModalFooter>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
