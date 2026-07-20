import { useEffect, useState } from 'react';
import { z } from 'zod';
import getRoles from '@/api/admin/roles/getRoles.ts';
import createUser from '@/api/admin/users/createUser.ts';
import deleteUser from '@/api/admin/users/deleteUser.ts';
import disableUserTwoFactor from '@/api/admin/users/disableUserTwoFactor.ts';
import sendPasswordResetEmail from '@/api/admin/users/email/sendPasswordResetEmail.ts';
import updateUser from '@/api/admin/users/updateUser.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminFullUserSchema, adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type UserFormValues = z.infer<typeof adminUserUpdateSchema>;

export default function UserCreateOrUpdate({ contextUser }: { contextUser?: z.infer<typeof adminFullUserSchema> }) {
  const { user, doImpersonate } = useAuth();
  const settings = useGlobalStore((state) => state.settings);
  const languages = useGlobalStore((state) => state.languages);
  const { addToast } = useToast();
  const { t } = useTranslations();
  const canReadRoles = useAdminCan('roles.read');

  const [openModal, setOpenModal] = useState<'delete' | 'disable_two_factor' | 'send_password_reset_email' | null>(
    null,
  );

  const form = useFormEngine<UserFormValues>('admin.users.createOrUpdate', {
    schema: adminUserUpdateSchema.unwrap(),
    initialValues: {
      externalId: null,
      username: '',
      email: '',
      nameFirst: '',
      nameLast: '',
      password: null,
      admin: false,
      frozen: false,
      suspended: false,
      language: settings.app.language,
      roleUuid: null,
    },
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<UserFormValues, z.infer<typeof adminFullUserSchema>>({
    form,
    createFn: () => createUser(adminUserUpdateSchema.parse(form.getValues())),
    updateFn: contextUser
      ? () => updateUser(contextUser.uuid, adminUserUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextUser ? () => deleteUser(contextUser.uuid) : undefined,
    doUpdate: !!contextUser,
    basePath: '/admin/users',
    resourceName: t('pages.admin.users.resourceName', {}),
  });

  useEffect(() => {
    if (contextUser) {
      form.setValues({
        externalId: contextUser.externalId,
        username: contextUser.username,
        email: contextUser.email,
        nameFirst: contextUser.nameFirst,
        nameLast: contextUser.nameLast,
        password: null,
        admin: contextUser.admin,
        frozen: contextUser.frozen,
        suspended: contextUser.suspended,
        language: contextUser.language,
        roleUuid: contextUser.role?.uuid ?? null,
      });
    }
  }, [contextUser]);

  const roles = useSearchableResource<z.infer<typeof roleSchema>>({
    queryKey: queryKeys.admin.roles.all(),
    fetcher: (search) => getRoles(1, search),
    defaultSearchValue: contextUser?.role?.name,
    canRequest: canReadRoles,
  });

  const doDisableTwoFactor = async () => {
    if (!contextUser) {
      return;
    }

    await disableUserTwoFactor(contextUser.uuid)
      .then(() => {
        addToast(t('pages.admin.users.tabs.general.page.modal.disableTwoFactor.toast.disabled', {}), 'success');
        contextUser!.totpEnabled = false;

        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doSendPasswordResetEmail = async () => {
    if (!contextUser) {
      return;
    }

    await sendPasswordResetEmail(contextUser.uuid)
      .then(() => {
        addToast(t('pages.admin.users.tabs.general.page.modal.sendPasswordResetEmail.toast.sent', {}), 'success');

        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const fields: FieldDef<UserFormValues>[] = [
    { type: 'text', name: 'username', label: t('common.table.columns.username', {}), required: true },
    { type: 'text', name: 'email', label: t('common.form.email', {}), required: true, props: { type: 'email' } },
    { type: 'text', name: 'nameFirst', label: t('common.form.firstName', {}), required: true },
    { type: 'text', name: 'nameLast', label: t('common.form.lastName', {}), required: true },
    {
      type: 'select',
      name: 'language',
      label: t('common.form.language', {}),
      required: true,
      options: languages.map((language) => ({
        label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
        value: language,
      })),
      props: { searchable: true },
    },
    {
      type: 'select',
      name: 'roleUuid',
      label: t('pages.admin.users.tabs.general.page.form.role', {}),
      options: roles.items.map((role) => ({ label: role.name, value: role.uuid })),
      props: {
        placeholder: t('common.none', {}),
        searchable: true,
        searchValue: roles.search,
        onSearchChange: roles.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadRoles,
        loading: roles.loading,
      },
    },
    { type: 'text', name: 'externalId', label: t('common.form.externalId', {}) },
    {
      type: 'password',
      name: 'password',
      label: t('common.form.password', {}),
      props: { withAsterisk: !contextUser },
    },
    {
      type: 'switch',
      name: 'admin',
      label: t('pages.admin.users.tabs.general.page.form.admin', {}),
      description: t('pages.admin.users.tabs.general.page.form.adminDescription', {}),
    },
    {
      type: 'switch',
      name: 'frozen',
      label: t('pages.admin.users.tabs.general.page.form.frozen', {}),
      description: t('pages.admin.users.tabs.general.page.form.frozenDescription', {}),
    },
    {
      type: 'switch',
      name: 'suspended',
      label: t('pages.admin.users.tabs.general.page.form.suspended', {}),
      description: t('pages.admin.users.tabs.general.page.form.suspendedDescription', {}),
    },
  ];

  return (
    <AdminContentContainer
      title={t(
        contextUser
          ? 'pages.admin.users.tabs.general.page.titleUpdate'
          : 'pages.admin.users.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextUser}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.users.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.users.tabs.general.page.modal.delete.content', { username: form.getValues().username }).md()}
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'disable_two_factor'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.users.tabs.general.page.modal.disableTwoFactor.title', {})}
        confirm={t('common.button.disable', {})}
        onConfirmed={doDisableTwoFactor}
      >
        {t('pages.admin.users.tabs.general.page.modal.disableTwoFactor.content', {
          username: form.getValues().username,
        }).md()}
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'send_password_reset_email'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.users.tabs.general.page.modal.sendPasswordResetEmail.title', {})}
        confirm={t('common.button.send', {})}
        onConfirmed={doSendPasswordResetEmail}
      >
        {t('pages.admin.users.tabs.general.page.modal.sendPasswordResetEmail.content', {
          email: form.getValues().email,
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.users.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextUser ? 'users.update' : 'users.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextUser && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextUser && (
            <>
              <AdminCan action='users.disable-two-factor'>
                <Button
                  color='red'
                  variant='outline'
                  onClick={() => setOpenModal('disable_two_factor')}
                  loading={loading}
                  disabled={!contextUser.totpEnabled}
                >
                  {t('pages.admin.users.tabs.general.page.button.disableTwoFactor', {})}
                </Button>
              </AdminCan>
              <AdminCan action='users.email'>
                <Button
                  color='blue'
                  variant='outline'
                  onClick={() => setOpenModal('send_password_reset_email')}
                  loading={loading}
                >
                  {t('pages.admin.users.tabs.general.page.button.sendPasswordResetEmail', {})}
                </Button>
              </AdminCan>
              <AdminCan action='users.impersonate'>
                <ConditionalTooltip
                  enabled={user?.uuid === contextUser.uuid}
                  label={t('pages.admin.users.tabs.general.page.tooltip.cannotImpersonateSelf', {})}
                >
                  <Button
                    variant='outline'
                    onClick={() => doImpersonate(contextUser)}
                    disabled={user?.uuid === contextUser.uuid}
                    loading={loading}
                  >
                    {t('pages.admin.users.tabs.general.page.button.impersonate', {})}
                  </Button>
                </ConditionalTooltip>
              </AdminCan>
              <AdminCan action='users.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            </>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
