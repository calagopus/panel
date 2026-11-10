import { UseFormInput, useForm } from '@mantine/form';
import { deepmerge } from 'deepmerge-ts';
import { useEffect, useMemo, useState } from 'react';
import type { ExtendableSchema, FormId } from '@/elements/form-engine/index.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import { resolveFormValidation, schemaFormOptions, tagFormId } from '@/elements/form-engine/useFormEngine.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseModalFormOptions<T extends Record<string, unknown>> extends UseFormInput<T> {
  formId?: FormId;
  schema?: ExtendableSchema;
  onClose: () => void;
  onSubmit: (values: T) => Promise<void> | void;
  onError?: (error: unknown) => void;
  opened?: boolean;
  hydrate?: () => T | undefined;
}

export function useModalForm<T extends Record<string, unknown>>({
  formId,
  schema,
  onClose,
  onSubmit,
  onError,
  opened,
  hydrate,
  ...formInput
}: UseModalFormOptions<T>) {
  const { addToast } = useToast();

  const resolved = useMemo(
    () => (formId ? resolveFormValidation<T>(formId, schema) : { initialValues: {}, ...schemaFormOptions<T>(schema) }),
    [formId, schema],
  );

  const form = useForm<T>({
    ...liveValidation,
    ...formInput,
    initialValues: formInput.initialValues
      ? (deepmerge(formInput.initialValues, resolved.initialValues) as T)
      : undefined,
    validate: resolved.validate ?? formInput.validate,
    transformValues: resolved.transformValues ?? formInput.transformValues,
  });
  if (formId) tagFormId(form, formId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;

    const hydrated = hydrate?.();
    if (hydrated) {
      form.setValues(hydrated);
      form.resetDirty(hydrated);
    } else {
      form.reset();
    }
  }, [opened]);

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
    }
    setLoading(false);
  });

  return { form, handleClose, handleSubmit, loading, isDirty: form.isDirty() };
}
