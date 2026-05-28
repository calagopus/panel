import { UseFormInput, useForm } from '@mantine/form';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseModalFormOptions<T extends Record<string, unknown>> extends UseFormInput<T> {
  onClose: () => void;
  onSubmit: (values: T) => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export function useModalForm<T extends Record<string, unknown>>({
  onClose,
  onSubmit,
  onError,
  validateInputOnBlur = false,
  ...formInput
}: UseModalFormOptions<T>) {
  const { addToast } = useToast();
  const form = useForm<T>({ ...formInput, validateInputOnBlur });
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (loading) return;
    form.reset();
    onClose();
  };

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await onSubmit(values);
      handleClose();
    } catch (e) {
      if (onError) {
        onError(e);
      } else {
        addToast(httpErrorToHuman(e), 'error');
      }
    } finally {
      setLoading(false);
    }
  });

  return { form, handleClose, handleSubmit, loading, isDirty: form.isDirty() };
}
