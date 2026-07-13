import { ModalProps } from '@mantine/core';
import { load } from 'js-yaml';
import { useRef, useState } from 'react';
import { z } from 'zod';
import updateDatabaseAgentHostsConfig from '@/api/admin/database-agent-hosts/updateDatabaseAgentHostsConfig.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DatabaseAgentHostsBulkConfigModal({
  selectedHosts,
  setSelectedHosts,
  ...props
}: ModalProps & {
  selectedHosts: ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>;
  setSelectedHosts: (hosts: ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>) => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const doApplyRef = useRef<() => void>(() => null);

  const doApply = () => {
    let parsed: object;
    try {
      parsed = load(yaml) as object;
    } catch (err) {
      addToast(
        t('pages.admin.databaseAgentHosts.modal.bulkConfig.error.invalidYaml', { error: (err as Error).message }),
        'error',
      );
      return;
    }

    setLoading(true);

    updateDatabaseAgentHostsConfig(selectedHosts.keys(), parsed)
      .then((applied) => {
        addToast(
          t('pages.admin.databaseAgentHosts.modal.bulkConfig.toast.applied', {
            hosts: tItem('databaseAgentHost', applied),
          }),
          'success',
        );
        setSelectedHosts(new ObjectSet('uuid'));
        props.onClose();
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setLoading(false));
  };

  doApplyRef.current = doApply;

  return (
    <Modal
      title={t('pages.admin.databaseAgentHosts.modal.bulkConfig.title', {
        hosts: tItem('databaseAgentHost', selectedHosts.size),
      })}
      size='xl'
      {...props}
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
              smoothScrolling: false,
              // @ts-expect-error this is valid
              touchScrollEnabled: true,
            }}
          />
        </div>

        <ModalFooter>
          <Button onClick={doApply} loading={loading} disabled={!yaml.trim()}>
            {t('pages.admin.databaseAgentHosts.modal.bulkConfig.button.apply', {
              hosts: tItem('databaseAgentHost', selectedHosts.size),
            })}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
