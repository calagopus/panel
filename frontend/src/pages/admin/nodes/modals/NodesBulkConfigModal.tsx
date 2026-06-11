import { ModalProps, Stack } from '@mantine/core';
import jsYaml from 'js-yaml';
import { useRef, useState } from 'react';
import { z } from 'zod';
import updateNodesConfig from '@/api/admin/nodes/updateNodesConfig.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodesBulkConfigModal({
  selectedNodes,
  setSelectedNodes,
  opened,
  onClose,
}: ModalProps & {
  selectedNodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>;
  setSelectedNodes: (nodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>) => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const doApplyRef = useRef<() => void>(() => null);

  const doApply = () => {
    let parsed: object;
    try {
      parsed = jsYaml.load(yaml) as object;
    } catch (err) {
      addToast(t('pages.admin.nodes.modal.bulkConfig.error.invalidYaml', { error: (err as Error).message }), 'error');
      return;
    }

    setLoading(true);

    updateNodesConfig(selectedNodes.keys(), parsed)
      .then((applied) => {
        addToast(
          t('pages.admin.nodes.modal.bulkConfig.toast.applied', {
            nodes: tItem('node', applied),
          }),
          'success',
        );
        setSelectedNodes(new ObjectSet('uuid'));
        onClose();
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setLoading(false));
  };

  doApplyRef.current = doApply;

  return (
    <Modal
      title={t('pages.admin.nodes.modal.bulkConfig.title', {
        nodes: tItem('node', selectedNodes.size),
      })}
      onClose={onClose}
      opened={opened}
      size='xl'
    >
      <Stack>
        <div className='rounded-md overflow-hidden'>
          <MonacoEditor
            height='50vh'
            theme='vs-dark'
            language='yaml'
            value={yaml}
            onChange={(value) => setYaml(value ?? '')}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                doApplyRef.current();
              });
              editor.focus();
            }}
            options={{
              stickyScroll: { enabled: false },
              minimap: { enabled: false },
              codeLens: false,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              // @ts-expect-error this is valid
              touchScrollEnabled: true,
            }}
          />
        </div>

        <ModalFooter>
          <Button onClick={doApply} loading={loading} disabled={!yaml.trim()}>
            {t('pages.admin.nodes.modal.bulkConfig.button.apply', {
              nodes: tItem('node', selectedNodes.size),
            })}
          </Button>
          <Button variant='default' onClick={onClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
