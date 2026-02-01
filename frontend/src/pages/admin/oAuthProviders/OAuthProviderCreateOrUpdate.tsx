import { faChevronDown, faFileDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import jsYaml from 'js-yaml';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createOAuthProvider from '@/api/admin/oauth-providers/createOAuthProvider.ts';
import deleteOAuthProvider from '@/api/admin/oauth-providers/deleteOAuthProvider.ts';
import updateOAuthProvider from '@/api/admin/oauth-providers/updateOAuthProvider.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default function OAuthProviderCreateOrUpdate({
  contextOAuthProvider,
}: {
  contextOAuthProvider?: AdminOAuthProvider;
}) {
  const { addToast } = useToast();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminOAuthProviderSchema>>({
    initialValues: {
      name: '',
      description: null,
      clientId: '',
      clientSecret: '',
      authUrl: '',
      tokenUrl: '',
      infoUrl: '',
      scopes: [],
      identifierPath: '',
      emailPath: null,
      usernamePath: null,
      nameFirstPath: null,
      nameLastPath: null,
      enabled: true,
      loginOnly: false,
      linkViewable: true,
      userManageable: true,
      basicAuth: false,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminOAuthProviderSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminOAuthProviderSchema>,
    AdminOAuthProvider
  >({
    form,
    createFn: () => createOAuthProvider(form.values),
    updateFn: () => updateOAuthProvider(contextOAuthProvider!.uuid, form.values),
    deleteFn: () => deleteOAuthProvider(contextOAuthProvider!.uuid),
    doUpdate: !!contextOAuthProvider,
    basePath: '/admin/oauth-providers',
    resourceName: 'OAuth Provider',
  });

  useEffect(() => {
    if (contextOAuthProvider) {
      form.setValues({
        name: contextOAuthProvider.name,
        description: contextOAuthProvider.description,
        clientId: contextOAuthProvider.clientId,
        clientSecret: contextOAuthProvider.clientSecret,
        authUrl: contextOAuthProvider.authUrl,
        tokenUrl: contextOAuthProvider.tokenUrl,
        infoUrl: contextOAuthProvider.infoUrl,
        scopes: contextOAuthProvider.scopes,
        identifierPath: contextOAuthProvider.identifierPath,
        emailPath: contextOAuthProvider.emailPath,
        usernamePath: contextOAuthProvider.usernamePath,
        nameFirstPath: contextOAuthProvider.nameFirstPath,
        nameLastPath: contextOAuthProvider.nameLastPath,
        enabled: contextOAuthProvider.enabled,
        loginOnly: contextOAuthProvider.loginOnly,
        linkViewable: contextOAuthProvider.linkViewable,
        userManageable: contextOAuthProvider.userManageable,
        basicAuth: contextOAuthProvider.basicAuth,
      });
    }
  }, [contextOAuthProvider]);

  const doExport = (format: 'json' | 'yaml') => {
    if (!contextOAuthProvider) return;

    addToast('OAuth Provider exported.', 'success');

    let data: Partial<AdminOAuthProvider> & {
      uuid?: string;
      created?: Date;
      clientId?: string;
      clientSecret?: string;
    } = JSON.parse(JSON.stringify(contextOAuthProvider));

    delete data.uuid;
    delete data.created;
    delete data.clientId;
    delete data.clientSecret;
    data.description = data.description || null;
    data.emailPath = data.emailPath || null;
    data.usernamePath = data.usernamePath || null;
    data.nameFirstPath = data.nameFirstPath || null;
    data.nameLastPath = data.nameLastPath || null;
    data = transformKeysToSnakeCase(data);

    if (format === 'json') {
      const jsonData = JSON.stringify(data, undefined, 2);
      const fileURL = URL.createObjectURL(new Blob([jsonData], { type: 'text/plain' }));
      const downloadLink = document.createElement('a');
      downloadLink.href = fileURL;
      downloadLink.download = `oauth-provider-${contextOAuthProvider.uuid}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      URL.revokeObjectURL(fileURL);
      downloadLink.remove();
    } else {
      const yamlData = jsYaml.dump(data, { flowLevel: -1, forceQuotes: true });
      const fileURL = URL.createObjectURL(new Blob([yamlData], { type: 'text/plain' }));
      const downloadLink = document.createElement('a');
      downloadLink.href = fileURL;
      downloadLink.download = `oauth-provider-${contextOAuthProvider.uuid}.yml`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      URL.revokeObjectURL(fileURL);
      downloadLink.remove();
    }
  };

  return (
    <AdminContentContainer title={`${contextOAuthProvider ? 'Update' : 'Create'} OAuth Provider`} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm OAuth Provider Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow align='start'>
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
            <TextArea label='Description' placeholder='Description' rows={3} {...form.getInputProps('description')} />
          </Group>

          <Card className='flex flex-row! items-center justify-between'>
            <Title order={4}>Redirect URL</Title>
            <Code>
              {contextOAuthProvider
                ? `${settings.app.url}/api/auth/oauth/${contextOAuthProvider.uuid}`
                : 'Available after creation'}
            </Code>
          </Card>

          <Group grow>
            <TextInput withAsterisk label='Client Id' placeholder='Client Id' {...form.getInputProps('clientId')} />
            <TextInput
              withAsterisk={!contextOAuthProvider}
              label='Client Secret'
              placeholder='Client Secret'
              type='password'
              {...form.getInputProps('clientSecret')}
            />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='Auth URL' placeholder='Auth URL' {...form.getInputProps('authUrl')} />
            <TextInput withAsterisk label='Token URL' placeholder='Token URL' {...form.getInputProps('tokenUrl')} />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='Info URL' placeholder='Info URL' {...form.getInputProps('infoUrl')} />
            <Switch
              label='Basic Auth'
              description='Uses HTTP Basic Authentication to transmit client id and secret, not common anymore'
              {...form.getInputProps('basicAuth', { type: 'checkbox' })}
            />
          </Group>

          <Group grow>
            <TagsInput
              label='Scopes'
              placeholder='Scopes'
              description='The OAuth2 Scopes to request, make sure to include scopes for email/profile info when needed'
              {...form.getInputProps('scopes')}
            />
            <TextInput
              withAsterisk
              label='Identifier Path'
              placeholder='Identifier Path'
              description='The Path to use to extract the unique user identifier from the Info URL response (https://serdejsonpath.live)'
              {...form.getInputProps('identifierPath')}
            />
          </Group>

          <Group grow>
            <TextInput
              label='Email Path'
              placeholder='Email Path'
              description='The Path to use to extract the email from the Info URL response (https://serdejsonpath.live)'
              {...form.getInputProps('emailPath')}
            />
            <TextInput
              withAsterisk
              label='Username Path'
              placeholder='Username Path'
              description='The Path to use to extract the username from the Info URL response (https://serdejsonpath.live)'
              {...form.getInputProps('usernamePath')}
            />
          </Group>

          <Group grow>
            <TextInput
              label='First Name Path'
              placeholder='First Name URL'
              description='The Path to use to extract the first name from the Info URL response (https://serdejsonpath.live)'
              {...form.getInputProps('nameFirstPath')}
            />
            <TextInput
              label='Last Name Path'
              placeholder='Last Name Path'
              description='The Path to use to extract the last name from the Info URL response (https://serdejsonpath.live)'
              {...form.getInputProps('nameLastPath')}
            />
          </Group>

          <Group grow>
            <Switch label='Enabled' {...form.getInputProps('enabled', { type: 'checkbox' })} />
            <Switch label='Only allow Login' {...form.getInputProps('loginOnly', { type: 'checkbox' })} />
          </Group>

          <Group grow>
            <Switch
              label='Link Viewable to User'
              description='Allows the User to see the Connection and its identifier in the Client UI'
              {...form.getInputProps('linkViewable', { type: 'checkbox' })}
            />
            <Switch
              label='Link Manageable by User'
              description='Allows the User to connect and disconnect with this provider'
              {...form.getInputProps('userManageable', { type: 'checkbox' })}
            />
          </Group>

          <Group>
            <AdminCan action={contextOAuthProvider ? 'oauth-providers.update' : 'oauth-providers.create'} cantSave>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                Save
              </Button>
              {!contextOAuthProvider && (
                <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                  Save & Stay
                </Button>
              )}
              {contextOAuthProvider && (
                <ContextMenuProvider menuProps={{ position: 'top', offset: 40 }}>
                  <ContextMenu
                    items={[
                      {
                        icon: faFileDownload,
                        label: 'as JSON',
                        onClick: () => doExport('json'),
                        color: 'gray',
                      },
                      {
                        icon: faFileDownload,
                        label: 'as YAML',
                        onClick: () => doExport('yaml'),
                        color: 'gray',
                      },
                    ]}
                  >
                    {({ openMenu }) => (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          openMenu(rect.left, rect.bottom);
                        }}
                        loading={loading}
                        variant='outline'
                        rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                      >
                        Export
                      </Button>
                    )}
                  </ContextMenu>
                </ContextMenuProvider>
              )}
            </AdminCan>
            {contextOAuthProvider && (
              <AdminCan action='oauth-provider.delete' cantDelete>
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
