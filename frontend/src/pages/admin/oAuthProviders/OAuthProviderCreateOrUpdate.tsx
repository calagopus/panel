import { faChevronDown, faExternalLink, faFileDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Title } from '@mantine/core';
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
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function OAuthProviderCreateOrUpdate({
  contextOAuthProvider,
}: {
  contextOAuthProvider?: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { addToast } = useToast();
  const { settings } = useGlobalStore();

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminOAuthProviderUpdateSchema>>({
    mode: 'uncontrolled',
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
      loginBypass2fa: false,
      linkViewable: true,
      userManageable: true,
      basicAuth: false,
    },
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(adminOAuthProviderUpdateSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminOAuthProviderUpdateSchema>,
    z.infer<typeof adminOAuthProviderSchema>
  >({
    form,
    createFn: () => createOAuthProvider(adminOAuthProviderUpdateSchema.parse(form.getValues())),
    updateFn: contextOAuthProvider
      ? () => updateOAuthProvider(contextOAuthProvider.uuid, adminOAuthProviderUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextOAuthProvider ? () => deleteOAuthProvider(contextOAuthProvider.uuid) : undefined,
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
        loginBypass2fa: contextOAuthProvider.loginBypass2fa,
        linkViewable: contextOAuthProvider.linkViewable,
        userManageable: contextOAuthProvider.userManageable,
        basicAuth: contextOAuthProvider.basicAuth,
      });
    }
  }, [contextOAuthProvider]);

  const doExport = (format: 'json' | 'yaml') => {
    if (!contextOAuthProvider) return;

    addToast('OAuth Provider exported.', 'success');

    let data: Partial<z.infer<typeof adminOAuthProviderSchema>> & {
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
    <AdminContentContainer
      title={`${contextOAuthProvider ? 'Update' : 'Create'} OAuth Provider`}
      fullscreen={!!contextOAuthProvider}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm OAuth Provider Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'oauthProviderslocations']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextArea
            label='Description'
            placeholder='Description'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Card className='flex flex-row! items-center justify-between col-span-full'>
            <Title order={4}>Redirect URL</Title>
            <Code>
              {contextOAuthProvider
                ? `${settings.app.url}/api/auth/oauth/${contextOAuthProvider.uuid}`
                : 'Available after creation'}
            </Code>
          </Card>

          <TextInput
            withAsterisk
            label='Client Id'
            placeholder='Client Id'
            key={form.key('clientId')}
            {...form.getInputProps('clientId')}
          />
          <TextInput
            withAsterisk={!contextOAuthProvider}
            label='Client Secret'
            placeholder='Client Secret'
            type='password'
            key={form.key('clientSecret')}
            {...form.getInputProps('clientSecret')}
          />

          <TextInput
            withAsterisk
            label='Auth URL'
            placeholder='Auth URL'
            key={form.key('authUrl')}
            {...form.getInputProps('authUrl')}
          />
          <TextInput
            withAsterisk
            label='Token URL'
            placeholder='Token URL'
            key={form.key('tokenUrl')}
            {...form.getInputProps('tokenUrl')}
          />

          <TextInput
            withAsterisk
            label='Info URL'
            placeholder='Info URL'
            key={form.key('infoUrl')}
            {...form.getInputProps('infoUrl')}
          />
          <Switch
            label='Basic Auth'
            description='Uses HTTP Basic Authentication to transmit client id and secret, not common anymore'
            key={form.key('basicAuth')}
            {...form.getInputProps('basicAuth', { type: 'checkbox' })}
          />

          <TagsInput
            label='Scopes'
            placeholder='Scopes'
            description='The OAuth2 Scopes to request, make sure to include scopes for email/profile info when needed'
            key={form.key('scopes')}
            {...form.getInputProps('scopes')}
          />
          <TextInput
            withAsterisk
            label='Identifier Path'
            placeholder='Identifier Path'
            description='The Path to use to extract the unique user identifier from the Info URL response (https://serdejsonpath.live)'
            key={form.key('identifierPath')}
            {...form.getInputProps('identifierPath')}
          />

          <TextInput
            label='Email Path'
            placeholder='Email Path'
            description='The Path to use to extract the email from the Info URL response (https://serdejsonpath.live)'
            key={form.key('emailPath')}
            {...form.getInputProps('emailPath')}
          />
          <TextInput
            label='Username Path'
            placeholder='Username Path'
            description='The Path to use to extract the username from the Info URL response (https://serdejsonpath.live)'
            key={form.key('usernamePath')}
            {...form.getInputProps('usernamePath')}
          />

          <TextInput
            label='First Name Path'
            placeholder='First Name URL'
            description='The Path to use to extract the first name from the Info URL response (https://serdejsonpath.live)'
            key={form.key('nameFirstPath')}
            {...form.getInputProps('nameFirstPath')}
          />
          <TextInput
            label='Last Name Path'
            placeholder='Last Name Path'
            description='The Path to use to extract the last name from the Info URL response (https://serdejsonpath.live)'
            key={form.key('nameLastPath')}
            {...form.getInputProps('nameLastPath')}
          />

          <Switch
            label='Only allow Login'
            key={form.key('loginOnly')}
            {...form.getInputProps('loginOnly', { type: 'checkbox' })}
          />
          <Switch
            label='Bypass 2FA on Login'
            description='Allows users logging in with this provider to bypass their panel 2FA'
            key={form.key('loginBypass2fa')}
            {...form.getInputProps('loginBypass2fa', { type: 'checkbox' })}
          />

          <Switch
            label='Link Viewable to User'
            description='Allows the User to see the Connection and its identifier in the Client UI'
            key={form.key('linkViewable')}
            {...form.getInputProps('linkViewable', { type: 'checkbox' })}
          />
          <Switch
            label='Link Manageable by User'
            description='Allows the User to connect and disconnect with this provider'
            key={form.key('userManageable')}
            {...form.getInputProps('userManageable', { type: 'checkbox' })}
          />

          <Switch label='Enabled' key={form.key('enabled')} {...form.getInputProps('enabled', { type: 'checkbox' })} />
        </div>

        <Group mt='md'>
          <AdminCan action={contextOAuthProvider ? 'oauth-providers.update' : 'oauth-providers.create'} cantSave>
            <Button type='submit' disabled={!isValid} loading={loading}>
              Save
            </Button>
            {!contextOAuthProvider && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!isValid} loading={loading}>
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
          <a href='https://calagopus.com/docs/advanced/oauth' target='_blank' rel='noopener noreferrer'>
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              View Documentation
            </Button>
          </a>
        </Group>
      </form>
    </AdminContentContainer>
  );
}
