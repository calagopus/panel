import { ModalProps } from '@mantine/core';
import Button from '@/elements/buttons/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import ResourceLookup, { type ResourceLookupLabels, type ResourceLookupProps } from '@/elements/ResourceLookup.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type { ResourceLookupField } from '@/elements/ResourceLookup.tsx';

interface ResourceLookupModalProps<T>
  extends ModalProps, Pick<ResourceLookupProps<T>, 'resultIcon' | 'lookup' | 'fields' | 'href'> {
  labels: ResourceLookupLabels & { title: string };
}

export default function ResourceLookupModal<T>({
  labels,
  resultIcon,
  lookup,
  fields,
  href,
  ...props
}: ResourceLookupModalProps<T>) {
  const { t } = useTranslations();

  return (
    <Modal title={labels.title} {...props}>
      <ResourceLookup
        labels={labels}
        resultIcon={resultIcon}
        lookup={lookup}
        fields={fields}
        href={href}
        renderActions={(viewButton) => (
          <ModalFooter>
            {viewButton}
            <Button variant='default' onClick={props.onClose}>
              {t('common.button.cancel', {})}
            </Button>
          </ModalFooter>
        )}
      />
    </Modal>
  );
}
