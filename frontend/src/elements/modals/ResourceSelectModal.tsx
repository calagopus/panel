import { faCircleInfo, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComboboxData, ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { InfiniteScroll } from '@/elements/input/infiniteScrollOptions.tsx';
import Select from '@/elements/input/Select.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { QueryKey } from '@/lib/queryKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ResourceSelectModalProps extends ModalProps {
  title: string;
  label?: string;
  data?: ComboboxData;
  loading?: boolean;
  searchValue?: string;
  onSearchChange?: (search: string) => void;
  infiniteScroll?: InfiniteScroll;
  confirmLabel?: string;
  addedToast?: string;
  disabled?: boolean;
  invalidateKeys?: QueryKey[];
  onAdded?: () => void;
  onConfirm: (value: string) => Promise<unknown>;
  renderSelect?: (props: { value: string | null; onChange: (value: string | null) => void }) => ReactNode;
  renderBelowSelect?: (value: string | null) => ReactNode;
  nothingFoundMessage?: ReactNode;
  createAction?: { to: string; permission: string; label?: string };
  children?: ReactNode;
}

export default function ResourceSelectModal({
  title,
  label,
  data = [],
  loading,
  searchValue,
  onSearchChange,
  infiniteScroll,
  confirmLabel,
  addedToast,
  disabled = false,
  invalidateKeys = [],
  onAdded,
  onConfirm,
  renderSelect,
  renderBelowSelect,
  nothingFoundMessage,
  createAction,
  children,
  ...props
}: ResourceSelectModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const showEmptyState = !!nothingFoundMessage && !loading && !searchValue && data.length === 0;

  const [submitting, setSubmitting] = useState(false);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!props.opened) {
      setValue(null);
      onSearchChange?.('');
    }
  }, [props.opened]);

  const doAdd = () => {
    if (!value || disabled) {
      return;
    }

    setSubmitting(true);

    onConfirm(value)
      .then(() => {
        if (addedToast) {
          addToast(addedToast, 'success');
        }

        props.onClose();

        for (const queryKey of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey });
        }

        onAdded?.();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setSubmitting(false));
  };

  return (
    <Modal title={title} {...props}>
      <Stack>
        {renderSelect ? (
          renderSelect({ value, onChange: setValue })
        ) : (
          <Select
            withAsterisk
            label={label}
            value={value}
            onChange={(next) => setValue(next)}
            data={data}
            searchable
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            infiniteScroll={infiniteScroll}
            loading={loading}
            nothingFoundMessage={searchValue ? undefined : nothingFoundMessage}
          />
        )}

        {showEmptyState && (
          <Alert icon={<FontAwesomeIcon icon={faCircleInfo} />}>
            <Stack gap='xs' align='flex-start'>
              {nothingFoundMessage}
              {createAction && (
                <AdminCan action={createAction.permission}>
                  <Button
                    size='xs'
                    variant='light'
                    leftSection={<FontAwesomeIcon icon={faPlus} />}
                    onClick={() => {
                      props.onClose();
                      navigate(createAction.to);
                    }}
                  >
                    {createAction.label ?? t('common.button.create', {})}
                  </Button>
                </AdminCan>
              )}
            </Stack>
          </Alert>
        )}

        {renderBelowSelect?.(value)}

        {children}

        <ModalFooter>
          <Button onClick={doAdd} loading={submitting} disabled={!value || disabled}>
            {confirmLabel ?? t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
