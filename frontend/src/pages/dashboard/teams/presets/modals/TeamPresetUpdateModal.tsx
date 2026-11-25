import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import updateTeamPreset from '@/api/me/teams/presets/updateTeamPreset.ts';
import Button from '@/elements/buttons/Button.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { appendInheritedIgnoredFiles, stripInheritedIgnoredFiles } from '@/lib/domain/subusers.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamPresetSchema, userTeamPresetUpdateSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamPresetFields from '../TeamPresetFields.tsx';

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
  preset: z.infer<typeof userTeamPresetSchema>;
};

export default function TeamPresetUpdateModal({ team, preset, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const inheritedIgnoredFiles = team.membership?.preset.ignoredFiles ?? [];

  const presetValues = () => ({
    name: preset.name,
    description: preset.description ?? '',
    weight: preset.weight,
    permissions: preset.permissions,
    ignoredFiles: stripInheritedIgnoredFiles(preset.ignoredFiles, inheritedIgnoredFiles),
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userTeamPresetUpdateSchema>
  >({
    initialValues: presetValues(),
    schema: userTeamPresetUpdateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateTeamPreset(team.uuid, preset.uuid, {
        ...userTeamPresetUpdateSchema.parse(values),
        permissions: Array.from(values.permissions),
        ignoredFiles: appendInheritedIgnoredFiles(values.ignoredFiles, inheritedIgnoredFiles),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      addToast(t('pages.account.teams.tabs.presets.modal.updatePreset.toast.updated', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = presetValues();

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.account.teams.tabs.presets.modal.updatePreset.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='95%'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TeamPresetFields team={team} form={form} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
