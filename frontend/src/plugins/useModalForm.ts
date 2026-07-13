import { UseFormInput, useForm } from '@mantine/form';
import { deepmerge } from 'deepmerge-ts';
import { useMemo, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import type { ExtendableSchema, FormId } from '@/elements/form-engine/index.ts';
import { resolveFormValidation, tagFormId } from '@/elements/form-engine/useFormEngine.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseModalFormOptions<T extends Record<string, unknown>> extends UseFormInput<T> {
  formId?: FormId;
  schema?: ExtendableSchema;
  onClose: () => void;
  onSubmit: (values: T) => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export function useModalForm<T extends Record<string, unknown>>({
  formId,
  schema,
  onClose,
  onSubmit,
  onError,
  validateInputOnBlur = false,
  ...formInput
}: UseModalFormOptions<T>) {
  const { addToast } = useToast();

  const resolved = useMemo(() => (formId ? resolveFormValidation(formId, schema) : undefined), [formId, schema]);

  const form = useForm<T>({
    ...formInput,
    initialValues: formInput.initialValues
      ? (deepmerge(formInput.initialValues, resolved?.initialValues ?? {}) as T)
      : undefined,
    validate: resolved?.validate ?? formInput.validate,
    validateInputOnBlur,
  });
  if (formId) tagFormId(form, formId);
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
