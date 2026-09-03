import { ModalProps } from '@mantine/core';
import { load } from 'js-yaml';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import YamlEditor from '@/elements/editors/YamlEditor.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface BulkYamlConfigLabels {
  title: string;
  applyButton: string;
  invalidYaml: (error: string) => string;
  applied: (count: number) => string;
}

export default function BulkYamlConfigModal({
  applyFn,
  onApplied,
  labels,
  ...props
}: Omit<ModalProps, 'children'> & {
  applyFn: (config: object) => Promise<number>;
  onApplied: () => void;
  labels: BulkYamlConfigLabels;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);

  const doApply = () => {
    let parsed: object;
    try {
      parsed = load(yaml) as object;
    } catch (err) {
      addToast(labels.invalidYaml((err as Error).message), 'error');
      return;
    }

    setLoading(true);
    applyFn(parsed)
      .then((applied) => {
        addToast(labels.applied(applied), 'success');
        onApplied();
        props.onClose();
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={labels.title} size='xl' {...props}>
      <Stack>
        <div className='rounded-md overflow-hidden'>
          <YamlEditor
            height='50vh'
            value={yaml}
            onChange={(value) => setYaml(value ?? '')}
            onSave={doApply}
            onMount={(editor) => editor.focus()}
          />
        </div>

        <ModalFooter>
          <Button onClick={doApply} loading={loading} disabled={!yaml.trim()}>
            {labels.applyButton}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
