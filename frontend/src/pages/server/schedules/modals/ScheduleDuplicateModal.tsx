import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import duplicateSchedule from '@/api/server/schedules/duplicateSchedule.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const duplicateScheduleSchema = z.object({
  name: z.string().min(1).max(255),
});

type Props = ModalProps & {
  schedule: z.infer<typeof serverScheduleSchema>;
};

export default function ScheduleDuplicateModal({ schedule, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, addSchedule } = useServerStore();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof duplicateScheduleSchema>>({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(duplicateScheduleSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const duplicated = await duplicateSchedule(server.uuid, schedule.uuid, values.name);
      addToast(t('pages.server.schedules.toast.duplicated', {}), 'success');
      addSchedule(duplicated);
    },
  });

  useEffect(() => {
    form.setValues({ name: `${schedule.name} (copy)` });
  }, [props.opened, schedule]);

  return (
    <FormModal
      title={t('pages.server.schedules.modal.duplicateSchedule.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.newName', {})} {...form.getInputProps('name')} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
