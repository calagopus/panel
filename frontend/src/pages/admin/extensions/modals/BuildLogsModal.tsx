import { ModalProps } from '@mantine/core';
import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import getExtensionBuildLogs from '@/api/admin/extensions/manage/getExtensionBuildLogs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const POLL_INTERVAL_MS = 2000;

const FAILURES_BEFORE_TOAST = 5;

interface BuildLogPollCallbacks {
  onLogs: (chunk: string) => void;
  onError: (error: unknown) => void;
}

function startBuildLogPolling(buildId: number | null, { onLogs, onError }: BuildLogPollCallbacks) {
  let offset = 0;
  let failures = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const drain = async (): Promise<unknown> => {
    let buffered = '';

    try {
      for (;;) {
        const chunk = await getExtensionBuildLogs(buildId, offset);
        if (stopped) return null;

        offset = chunk.offset;
        buffered += chunk.data;
        if (chunk.eof) break;
      }
    } catch (error) {
      if (buffered && !stopped) onLogs(buffered);
      return error;
    }

    if (buffered && !stopped) onLogs(buffered);
    return null;
  };

  const poll = () => {
    drain()
      .then((error) => {
        if (error === null) {
          failures = 0;
          return;
        }

        if (error instanceof AxiosError && error.response?.status === 404) return;

        failures += 1;
        if (failures === FAILURES_BEFORE_TOAST) onError(error);
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
      });
  };

  poll();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

interface Props extends ModalProps {
  buildId: number | null;
}

export default function BuildLogsModal({ buildId, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [logs, setLogs] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    if (!props.opened) return;

    setLogs('');

    return startBuildLogPolling(buildId, {
      onLogs: (chunk) => setLogs((prev) => prev + chunk),
      onError: (error) => addToast(httpErrorToHuman(error), 'error'),
    });
  }, [props.opened, buildId, addToast]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
  };

  return (
    <Modal title={t('pages.admin.extensions.modal.buildLogs.title', {})} size='lg' {...props}>
      <Stack>
        <div ref={scrollRef} onScroll={handleScroll} className='overflow-y-auto max-h-96'>
          <Code block>{logs || t('pages.admin.extensions.modal.buildLogs.empty', {})}</Code>
        </div>

        <ModalFooter>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
