import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateTunnelPorts from '@/api/server/tunnel/updateTunnelPorts.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { networkProtocolLabelMapping } from '@/lib/enums.ts';
import { serverTunnelPortsEditSchema } from '@/lib/schemas/server/tunnel.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

type Port = z.infer<typeof serverTunnelPortsEditSchema>['ports'][number];

const DEFAULT_PORT = 25565;

type Props = ModalProps & {
  ports: Port[];
  allocationPorts: number[];
  onSaved: () => void;
};

export default function TunnelPortsModal({ ports, allocationPorts, onSaved, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const maxPorts = useGlobalStore((state) => state.settings.server.maxTunnelPortCount);

  const [draft, setDraft] = useState<Port[]>(ports);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) return;

    setDraft(ports);
  }, [props.opened]);

  const used = new Set(draft.map((port) => port.port));
  const full = draft.length >= maxPorts;
  const suggestions = full ? [] : allocationPorts.filter((port) => !used.has(port));
  const duplicate = used.size !== draft.length;

  const doSave = async () => {
    setLoading(true);

    try {
      await updateTunnelPorts(server.uuid, { ports: draft });
      addToast(t('pages.server.tunnel.toast.portsSaved', {}), 'success');
      onSaved();
      props.onClose();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setLoading(false);
  };

  return (
    <Modal title={t('pages.server.tunnel.modal.ports.title', {})} {...props}>
      <Stack gap='sm'>
        <Text c='dimmed' size='sm'>
          {t('pages.server.tunnel.modal.ports.description', {})}
        </Text>

        {draft.length === 0 ? (
          <Text size='sm' c='dimmed'>
            {t('pages.server.tunnel.ports.empty', {})}
          </Text>
        ) : (
          <Stack gap='xs'>
            {draft.map((port, index) => (
              <Group key={index} gap='xs' align='center' wrap='nowrap'>
                <NumberInput
                  min={1}
                  max={65535}
                  className='w-28'
                  placeholder={t('pages.server.tunnel.form.port', {})}
                  value={port.port}
                  onChange={(value) =>
                    setDraft(draft.map((item, at) => (at === index ? { ...item, port: Number(value) } : item)))
                  }
                />
                <MultiSelect
                  className='flex-1'
                  placeholder={port.protocols.length === 0 ? t('pages.server.tunnel.form.protocols', {}) : undefined}
                  data={Object.entries(networkProtocolLabelMapping).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={port.protocols}
                  onChange={(value) =>
                    setDraft(
                      draft.map((item, at) =>
                        at === index ? { ...item, protocols: value as Port['protocols'] } : item,
                      ),
                    )
                  }
                />
                <ActionIcon
                  size='input-sm'
                  variant='subtle'
                  color='red'
                  aria-label={t('common.button.remove', {})}
                  onClick={() => setDraft(draft.filter((_, at) => at !== index))}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}

        <Group justify='space-between' gap='xs'>
          <Group gap={4}>
            <Button
              size='xs'
              variant='default'
              disabled={full}
              leftSection={<FontAwesomeIcon icon={faPlus} />}
              onClick={() => setDraft([...draft, { port: DEFAULT_PORT, protocols: ['tcp'] }])}
            >
              {t('pages.server.tunnel.button.addPort', {})}
            </Button>
            {suggestions.map((port) => (
              <Tooltip key={port} label={t('pages.server.tunnel.modal.ports.fromAllocations', {})}>
                <button
                  type='button'
                  className='cursor-pointer'
                  onClick={() => setDraft([...draft, { port, protocols: ['tcp'] }])}
                >
                  <Badge variant='default' tt='none' leftSection={<FontAwesomeIcon icon={faPlus} size='xs' />}>
                    {port}
                  </Badge>
                </button>
              </Tooltip>
            ))}
          </Group>
          <Text size='xs' c='dimmed'>
            {t('pages.server.tunnel.modal.ports.count', {
              count: draft.length,
              max: maxPorts,
            })}
          </Text>
        </Group>

        {duplicate && (
          <Text size='sm' c='red'>
            {t('pages.server.tunnel.modal.ports.duplicate', {})}
          </Text>
        )}
      </Stack>

      <ModalFooter>
        <Button
          loading={loading}
          disabled={duplicate || draft.some((port) => port.protocols.length === 0)}
          onClick={doSave}
        >
          {t('common.button.save', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
