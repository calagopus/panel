import { useState } from 'react';
import { z } from 'zod';
import createTeam from '@/api/admin/teams/createTeam.ts';
import deleteTeam from '@/api/admin/teams/deleteTeam.ts';
import updateTeam from '@/api/admin/teams/updateTeam.ts';
import getUsers from '@/api/admin/users/getUsers.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ForceDeleteModal from '@/elements/modals/ForceDeleteModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamCreateSchema, adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { userTeamUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { teamEmptyFormValues, teamToFormValues, useTeamFormFields } from './teamFormValues.tsx';

type TeamFormValues = z.infer<typeof adminTeamCreateSchema>;

export default function TeamCreateOrUpdate({ contextTeam }: { contextTeam?: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();

  const canReadUsers = useAdminCan('users.read');
  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const form = useFormEngine<TeamFormValues>('admin.teams.createOrUpdate', {
    schema: contextTeam ? userTeamUpdateSchema : adminTeamCreateSchema,
    initialValues: teamEmptyFormValues,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<TeamFormValues, z.infer<typeof adminTeamSchema>>({
    form,
    createFn: () => createTeam(form.getTransformedValues()),
    updateFn: contextTeam ? () => updateTeam(contextTeam.uuid, form.getTransformedValues()) : undefined,
    deleteFn: contextTeam ? () => deleteTeam(contextTeam.uuid, { force: deleteDoForce }) : undefined,
    doUpdate: !!contextTeam,
    basePath: '/admin/teams',
    resourceName: t('pages.admin.teams.resourceName', {}),
  });

  useHydrateForm(form, contextTeam, teamToFormValues);

  const users = useInfiniteSearchableResource<z.infer<typeof adminFullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (page, search) => getUsers(page, search),
    canRequest: canReadUsers && !contextTeam,
  });

  const fields = useTeamFormFields(users, canReadUsers, contextTeam);

  return (
    <AdminContentContainer
      title={t(
        contextTeam
          ? 'pages.admin.teams.tabs.general.page.titleUpdate'
          : 'pages.admin.teams.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextTeam}
      titleOrder={2}
    >
      <ForceDeleteModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.teams.tabs.general.page.modal.delete.title', {})}
        name={form.getValues().name}
        force={deleteDoForce}
        onForceChange={setDeleteDoForce}
        forceWarning={t('pages.admin.teams.tabs.general.page.modal.delete.alert.forceWarning', {})}
        onConfirmed={doDelete}
      />

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.teams.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextTeam ? 'teams.update' : 'teams.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextTeam && (
              <Button
                onClick={() => doCreateOrUpdate(true, queryKeys.admin.teams.all())}
                disabled={!form.isValid()}
                loading={loading}
              >
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextTeam && (
            <AdminCan action='teams.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
