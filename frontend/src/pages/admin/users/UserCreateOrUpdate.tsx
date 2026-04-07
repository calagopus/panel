import { Group, Stack } from '@mantine/core';
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
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminFullUserSchema, adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function UserCreateOrUpdate({ contextUser }: { contextUser?: z.infer<typeof adminFullUserSchema> }) {
  const { doImpersonate } = useAuth();
  const { settings, languages } = useGlobalStore();
  const { addToast } = useToast();
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
    resourceName: 'User',
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
        language: contextUser.language,
        roleUuid: contextUser.role?.uuid ?? null,
      });
    }
  }, [contextUser]);

  const roles = useSearchableResource<z.infer<typeof roleSchema>>({
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
        addToast('User two factor disabled.', 'success');
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
        addToast('Password reset email sent.', 'success');

        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <AdminContentContainer
      title={`${contextUser ? 'Update' : 'Create'} User`}
      fullscreen={!!contextUser}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm User Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().username}</Code>?
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'disable_two_factor'}
        onClose={() => setOpenModal(null)}
        title='Disable User Two Factor'
        confirm='Disable'
        onConfirmed={doDisableTwoFactor}
      >
        Are you sure you want to remove the two factor of <Code>{form.getValues().username}</Code>?
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'send_password_reset_email'}
        onClose={() => setOpenModal(null)}
        title='Send Password Reset Email'
        confirm='Send'
        onConfirmed={doSendPasswordResetEmail}
      >
        Are you sure you want to send a password reset email to <Code>{form.getValues().email}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'users']))}>
        <Stack mt='xs'>
          <Group grow>
            <TextInput
              withAsterisk
              label='Username'
              placeholder='Username'
              key={form.key('username')}
              {...form.getInputProps('username')}
            />
            <TextInput
              withAsterisk
              label='Email'
              placeholder='Email'
              type='email'
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
          </Group>

          <Group grow>
            <TextInput
              withAsterisk
              label='First Name'
              placeholder='First Name'
              key={form.key('nameFirst')}
              {...form.getInputProps('nameFirst')}
            />
            <TextInput
              withAsterisk
              label='Last Name'
              placeholder='Last Name'
              key={form.key('nameLast')}
              {...form.getInputProps('nameLast')}
            />
          </Group>

          <Group grow>
            <Select
              withAsterisk
              label='Language'
              placeholder='Language'
              data={languages.map((language) => ({
                label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                value: language,
              }))}
              searchable
              key={form.key('language')}
              {...form.getInputProps('language')}
            />

            <Select
              label='Role'
              placeholder='None'
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
          </Group>

          <Group grow>
            <TextInput
              label='External ID'
              placeholder='External ID'
              key={form.key('externalId')}
              {...form.getInputProps('externalId')}
            />
            <TextInput
              withAsterisk={!contextUser}
              label='Password'
              placeholder='Password'
              type='password'
              key={form.key('password')}
              {...form.getInputProps('password')}
            />
          </Group>

          <Switch label='Admin' key={form.key('admin')} {...form.getInputProps('admin', { type: 'checkbox' })} />
        </Stack>

        <Group mt='md'>
          <AdminCan action={contextUser ? 'users.update' : 'users.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
            {!contextUser && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                Save & Stay
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
                  Disable Two Factor
                </Button>
              </AdminCan>
              <AdminCan action='users.email'>
                <Button
                  color='blue'
                  variant='outline'
                  onClick={() => setOpenModal('send_password_reset_email')}
                  loading={loading}
                >
                  Send Password Reset Email
                </Button>
              </AdminCan>
              <AdminCan action='users.impersonate'>
                <Button variant='outline' onClick={() => doImpersonate(contextUser)}>
                  Impersonate
                </Button>
              </AdminCan>
              <AdminCan action='users.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  Delete
                </Button>
              </AdminCan>
            </>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
