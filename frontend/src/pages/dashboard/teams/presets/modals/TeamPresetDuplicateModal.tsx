import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import duplicateTeamPreset from '@/api/me/teams/presets/duplicateTeamPreset.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamPresetSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const duplicateTeamPresetSchema = z.object({
  name: z.string().min(1).max(255),
});

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
  preset: z.infer<typeof userTeamPresetSchema>;
};

export default function TeamPresetDuplicateModal({ team, preset, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof duplicateTeamPresetSchema>>(
    {
      initialValues: {
        name: '',
      },
      schema: duplicateTeamPresetSchema,
      onClose: props.onClose,
      onSubmit: async (values) => {
        await duplicateTeamPreset(team.uuid, preset.uuid, values.name);
        addToast(
          t('common.toast.duplicated', { resource: t('pages.account.teams.tabs.presets.resourceName', {}) }),
          'success',
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.presets(team.uuid) });
      },
    },
  );

  useEffect(() => {
    if (props.opened) {
      const values = { name: `${preset.name} (copy)`.slice(0, 255) };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('common.modal.duplicate.title', { resource: t('pages.account.teams.tabs.presets.resourceName', {}) })}
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
