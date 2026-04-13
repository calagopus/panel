import { UseFormInput, useForm } from '@mantine/form';

export function useModalForm<T extends Record<string, unknown>>(input: UseFormInput<T>, onClose: () => void) {
  const form = useForm<T>(input);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return { form, onClose: handleClose };
}
