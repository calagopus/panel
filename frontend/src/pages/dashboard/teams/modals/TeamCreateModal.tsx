import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import createTeam from '@/api/me/teams/createTeam.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof userTeamUpdateSchema>>({
    initialValues: {
      name: '',
      description: '',
    },
    schema: userTeamUpdateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      const team = await createTeam(userTeamUpdateSchema.parse(values));
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      addToast(t('pages.account.teams.modal.createTeam.toast.created', {}), 'success');
      navigate(`/account/teams/${team.uuid}/presets`);
    },
  });

  return (
    <FormModal
      title={t('pages.account.teams.modal.createTeam.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <TextArea label={t('common.form.description', {})} rows={3} {...form.getInputProps('description')} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
