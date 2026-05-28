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

export default function NodesBulkConfigModal({
  selectedNodes,
  setSelectedNodes,
  opened,
  onClose,
}: ModalProps & {
  selectedNodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>;
  setSelectedNodes: (nodes: ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>) => void;
}) {
  const { addToast } = useToast();
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const doApplyRef = useRef<() => void>(() => null);

  const doApply = () => {
    let parsed: object;
    try {
      parsed = jsYaml.load(yaml) as object;
    } catch (err) {
      addToast(`Invalid YAML: ${(err as Error).message}`, 'error');
      return;
    }

    setLoading(true);

    updateNodesConfig(selectedNodes.keys(), parsed)
      .then((applied) => {
        addToast(`Configuration applied to ${applied} Node${applied !== 1 ? 's' : ''}.`, 'success');
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
      title={`Update Configuration - ${selectedNodes.size} Node${selectedNodes.size !== 1 ? 's' : ''}`}
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
            Apply to {selectedNodes.size} Node{selectedNodes.size !== 1 ? 's' : ''}
          </Button>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
