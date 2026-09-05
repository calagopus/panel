import { ComboboxData, ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
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
  confirmLabel?: string;
  addedToast?: string;
  disabled?: boolean;
  invalidateKeys?: QueryKey[];
  onAdded?: () => void;
  onConfirm: (value: string) => Promise<unknown>;
  renderSelect?: (props: { value: string | null; onChange: (value: string | null) => void }) => ReactNode;
  children?: ReactNode;
}

export default function ResourceSelectModal({
  title,
  label,
  data = [],
  loading,
  searchValue,
  onSearchChange,
  confirmLabel,
  addedToast,
  disabled = false,
  invalidateKeys = [],
  onAdded,
  onConfirm,
  renderSelect,
  children,
  ...props
}: ResourceSelectModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

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
            loading={loading}
          />
        )}

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
