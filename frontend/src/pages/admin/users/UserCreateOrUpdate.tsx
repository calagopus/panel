import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { NIL as uuidNil } from 'uuid';
import { z } from 'zod';
import getRoles from '@/api/admin/roles/getRoles.ts';
import createUser from '@/api/admin/users/createUser.ts';
import deleteUser from '@/api/admin/users/deleteUser.ts';
import disableUserTwoFactor from '@/api/admin/users/disableUserTwoFactor.ts';
import updateUser from '@/api/admin/users/updateUser.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminUserSchema } from '@/lib/schemas/admin/users.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default function UserCreateOrUpdate({ contextUser }: { contextUser?: User }) {
  const { settings, languages } = useGlobalStore();
  const { addToast } = useToast();
  const canReadRoles = useAdminCan('roles.read');

  const [openModal, setOpenModal] = useState<'delete' | 'disable_two_factor' | null>(null);

  const form = useForm<z.infer<typeof adminUserSchema>>({
    initialValues: {
      username: '',
      email: '',
      nameFirst: '',
      nameLast: '',
      password: '',
      admin: false,
      language: settings.app.language,
      roleUuid: uuidNil,
    },
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<z.infer<typeof adminUserSchema>, User>({
    form,
    createFn: () => createUser(form.values),
    updateFn: () => updateUser(contextUser!.uuid, form.values),
    deleteFn: () => deleteUser(contextUser!.uuid),
    doUpdate: !!contextUser,
    basePath: '/admin/users',
    resourceName: 'User',
  });

  useEffect(() => {
    if (contextUser) {
      form.setValues({
        username: contextUser.username,
        email: contextUser.email,
        nameFirst: contextUser.nameFirst,
        nameLast: contextUser.nameLast,
        password: null,
        admin: contextUser.admin,
        language: contextUser.language,
        roleUuid: contextUser.role?.uuid ?? uuidNil,
      });
    }
  }, [contextUser]);

  const roles = useSearchableResource<Role>({
    fetcher: (search) => getRoles(1, search),
    defaultSearchValue: contextUser?.role?.name,
    canRequest: canReadRoles,
  });

  const doDisableTwoFactor = async () => {
    await disableUserTwoFactor(contextUser!.uuid)
      .then(() => {
        addToast('User two factor disabled.', 'success');
        contextUser!.totpEnabled = false;

        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <AdminContentContainer title={`${contextUser ? 'Update' : 'Create'} User`} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm User Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.username}</Code>?
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'disable_two_factor'}
        onClose={() => setOpenModal(null)}
        title='Disable User Two Factor'
        confirm='Disable'
        onConfirmed={doDisableTwoFactor}
      >
        Are you sure you want to remove the two factor of <Code>{form.values.username}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow>
            <TextInput withAsterisk label='Username' placeholder='Username' {...form.getInputProps('username')} />
            <TextInput withAsterisk label='Email' placeholder='Email' type='email' {...form.getInputProps('email')} />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='First Name' placeholder='First Name' {...form.getInputProps('nameFirst')} />
            <TextInput withAsterisk label='Last Name' placeholder='Last Name' {...form.getInputProps('nameLast')} />
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
              {...form.getInputProps('language')}
            />

            <Select
              label='Role'
              placeholder='Role'
              data={roles.items.map((role) => ({
                label: role.name,
                value: role.uuid,
              }))}
              searchable
              searchValue={roles.search}
              onSearchChange={roles.setSearch}
              allowDeselect
              disabled={!canReadRoles}
              {...form.getInputProps('roleUuid')}
              onChange={(value) => form.setFieldValue('roleUuid', value || uuidNil)}
            />
          </Group>

          <TextInput
            withAsterisk={!contextUser}
            label='Password'
            placeholder='Password'
            type='password'
            {...form.getInputProps('password')}
            onChange={(e) => form.setFieldValue('password', e.target.value || null)}
          />

          <Switch label='Admin' {...form.getInputProps('admin', { type: 'checkbox' })} />
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
