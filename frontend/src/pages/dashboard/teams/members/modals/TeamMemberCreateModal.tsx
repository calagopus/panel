import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createTeamMember from '@/api/me/teams/members/createTeamMember.ts';
import Button from '@/elements/buttons/Button.tsx';
import Captcha, { useCaptcha } from '@/elements/captcha/Captcha.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import TeamPresetSelect from '@/elements/input/TeamPresetSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { grantableTeamManagement } from '@/lib/domain/teams.ts';
import { teamMemberManagementLabelMapping } from '@/lib/enums.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamMemberCreateSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
};

export default function TeamMemberCreateModal({ team, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const passwordLoginEnabled = useGlobalStore((state) => state.settings.app.passwordLoginEnabled);
  const queryClient = useQueryClient();

  const captcha = useCaptcha();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userTeamMemberCreateSchema>
  >({
    initialValues: {
      email: '',
      presetUuid: '',
      management: [],
    },
    schema: userTeamMemberCreateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      const captchaToken = await captcha.getToken();
      await createTeamMember(team.uuid, { ...values, captcha: captchaToken });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      addToast(t('pages.account.teams.tabs.members.modal.createMember.toast.invited', {}), 'success');
    },
    onError: (err) => {
      const message = httpErrorToHuman(err);

      if (isAxiosError(err) && err.response?.status === 404) {
        if (message === 'user not found, they must sign in before being added') {
          addToast(t('pages.server.subusers.modal.createSubuser.toast.userMustSignIn', {}), 'error');
          return;
        }
        if (message === 'user not found, an administrator must create their account') {
          addToast(t('pages.server.subusers.modal.createSubuser.toast.userMustBeCreatedByAdmin', {}), 'error');
          return;
        }
      }

      addToast(message, 'error');
    },
  });

  return (
    <FormModal
      title={t('pages.account.teams.tabs.members.modal.createMember.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        {!passwordLoginEnabled && (
          <Alert color='blue' icon={faCircleInfo}>
            {t('pages.server.subusers.modal.createSubuser.alert.existingAccountRequired', {})}
          </Alert>
        )}

        <TextInput
          withAsterisk
          label={t('common.form.email', {})}
          description={t('pages.account.teams.tabs.members.modal.createMember.form.emailDescription', {})}
          {...ignorePasswordManagerProps}
          {...form.getInputProps('email')}
        />

        <TeamPresetSelect
          withAsterisk
          label={t('pages.account.teams.tabs.members.form.preset', {})}
          description={t('pages.account.teams.tabs.members.form.presetDescription', {})}
          team={team}
          value={form.values.presetUuid || null}
          onChange={(uuid) => form.setFieldValue('presetUuid', uuid ?? '')}
          error={form.errors.presetUuid}
        />

        <MultiSelect
          label={t('pages.account.teams.tabs.members.form.management', {})}
          description={t('pages.account.teams.tabs.members.form.managementDescription', {})}
          data={grantableTeamManagement(team).map((management) => ({
            value: management,
            label: teamMemberManagementLabelMapping[management](),
          }))}
          {...form.getInputProps('management')}
        />

        <ModalFooter>
          <div className='mr-auto w-full sm:w-auto'>
            <Captcha {...captcha.props} />
          </div>

          <Button type='submit' loading={loading} disabled={!form.isValid() || !captcha.isValid}>
            {t('pages.account.teams.tabs.members.button.invite', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
