import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
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
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
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

export default function UserCreateOrUpdate({ contextUser }: { contextUser?: z.infer<typeof adminFullUserSchema> }) {
  const { user, doImpersonate } = useAuth();
  const { settings, languages } = useGlobalStore();
  const { addToast } = useToast();
  const { t } = useTranslations();
  const canReadRoles = useAdminCan('roles.read');

  const [openModal, setOpenModal] = useState<'delete' | 'disable_two_factor' | 'send_password_reset_email' | null>(
    null,
  );

  const form = useForm<z.infer<typeof adminUserUpdateSchema>>({
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

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminUserUpdateSchema>,
    z.infer<typeof adminFullUserSchema>
  >({
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
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label={t('common.table.columns.username', {})}
            key={form.key('username')}
            {...form.getInputProps('username')}
          />
          <TextInput
            withAsterisk
            label={t('common.form.email', {})}
            type='email'
            key={form.key('email')}
            {...form.getInputProps('email')}
          />

          <TextInput
            withAsterisk
            label={t('common.form.firstName', {})}
            key={form.key('nameFirst')}
            {...form.getInputProps('nameFirst')}
          />
          <TextInput
            withAsterisk
            label={t('common.form.lastName', {})}
            key={form.key('nameLast')}
            {...form.getInputProps('nameLast')}
          />

          <Select
            withAsterisk
            label={t('common.form.language', {})}
            data={languages.map((language) => ({
              label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
              value: language,
            }))}
            searchable
            key={form.key('language')}
            {...form.getInputProps('language')}
          />

          <Select
            label={t('pages.admin.users.tabs.general.page.form.role', {})}
            data={roles.items.map((role) => ({
              label: role.name,
              value: role.uuid,
            }))}
            searchable
            searchValue={roles.search}
            onSearchChange={roles.setSearch}
            allowDeselect
            clearable
            disabled={!canReadRoles}
            loading={roles.loading}
            key={form.key('roleUuid')}
            {...form.getInputProps('roleUuid')}
          />

          <TextInput
            label={t('common.form.externalId', {})}
            key={form.key('externalId')}
            {...form.getInputProps('externalId')}
          />
          <TextInput
            withAsterisk={!contextUser}
            label={t('common.form.password', {})}
            type='password'
            key={form.key('password')}
            {...form.getInputProps('password')}
          />

          <Switch
            label={t('pages.admin.users.tabs.general.page.form.admin', {})}
            description={t('pages.admin.users.tabs.general.page.form.adminDescription', {})}
            key={form.key('admin')}
            {...form.getInputProps('admin', { type: 'checkbox' })}
          />

          <Switch
            label={t('pages.admin.users.tabs.general.page.form.frozen', {})}
            description={t('pages.admin.users.tabs.general.page.form.frozenDescription', {})}
            key={form.key('frozen')}
            {...form.getInputProps('frozen', { type: 'checkbox' })}
          />

          <Switch
            label={t('pages.admin.users.tabs.general.page.form.suspended', {})}
            description={t('pages.admin.users.tabs.general.page.form.suspendedDescription', {})}
            key={form.key('suspended')}
            {...form.getInputProps('suspended', { type: 'checkbox' })}
          />
        </div>

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
