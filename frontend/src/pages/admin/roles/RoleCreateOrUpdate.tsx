import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createRole from '@/api/admin/roles/createRole.ts';
import deleteRole from '@/api/admin/roles/deleteRole.ts';
import updateRole from '@/api/admin/roles/updateRole.ts';
import getPermissions from '@/api/getPermissions.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { adminRoleSchema } from '@/lib/schemas/admin/roles.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useGlobalStore } from '@/stores/global.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default function RoleCreateOrUpdate({ contextRole }: { contextRole?: Role }) {
  const { availablePermissions, setAvailablePermissions } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminRoleSchema>>({
    initialValues: {
      name: '',
      description: null,
      requireTwoFactor: false,
      adminPermissions: [],
      serverPermissions: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminRoleSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<z.infer<typeof adminRoleSchema>, Role>({
    form,
    createFn: () => createRole(form.values),
    updateFn: () => updateRole(contextRole!.uuid, form.values),
    deleteFn: () => deleteRole(contextRole!.uuid),
    doUpdate: !!contextRole,
    basePath: '/admin/roles',
    resourceName: 'Role',
  });

  useEffect(() => {
    if (contextRole) {
      form.setValues({
        name: contextRole.name,
        description: contextRole.description,
        adminPermissions: contextRole.adminPermissions,
        serverPermissions: contextRole.serverPermissions,
      });
    }
  }, [contextRole]);

  useEffect(() => {
    setLoading(true);

    getPermissions().then((res) => {
      setAvailablePermissions(res);
      setLoading(false);
    });
  }, []);

  return (
    <AdminContentContainer title={`${contextRole ? 'Update' : 'Create'} Role`} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Role Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow>
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
          </Group>

          <Group grow align='start'>
            <TextArea label='Description' placeholder='Description' rows={3} {...form.getInputProps('description')} />
          </Group>

          <Switch
            label='Require Two Factor'
            description='Require users with this role to use two factor authentication.'
            {...form.getInputProps('requireTwoFactor', { type: 'checkbox' })}
          />

          <Group grow align='normal'>
            {availablePermissions?.serverPermissions && (
              <PermissionSelector
                label='Server Permissions'
                permissionsMapType='serverPermissions'
                permissions={availablePermissions.serverPermissions}
                selectedPermissions={form.values.serverPermissions}
                setSelectedPermissions={(permissions) => form.setFieldValue('serverPermissions', permissions)}
              />
            )}
            {availablePermissions?.adminPermissions && (
              <PermissionSelector
                label='Admin Permissions'
                permissionsMapType='adminPermissions'
                permissions={availablePermissions.adminPermissions}
                selectedPermissions={form.values.adminPermissions}
                setSelectedPermissions={(permissions) => form.setFieldValue('adminPermissions', permissions)}
              />
            )}
          </Group>

          <Group>
            <AdminCan action={contextRole ? 'roles.update' : 'roles.create'} cantSave>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                Save
              </Button>
              {!contextRole && (
                <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                  Save & Stay
                </Button>
              )}
            </AdminCan>
            {contextRole && (
              <AdminCan action='roles.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  Delete
                </Button>
              </AdminCan>
            )}
          </Group>
        </Stack>
      </form>
    </AdminContentContainer>
  );
}
