import { faChevronDown, faExternalLink, faFileDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { dump } from 'js-yaml';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createOAuthProvider from '@/api/admin/oauth-providers/createOAuthProvider.ts';
import deleteOAuthProvider from '@/api/admin/oauth-providers/deleteOAuthProvider.ts';
import updateOAuthProvider from '@/api/admin/oauth-providers/updateOAuthProvider.ts';
import Anchor from '@/elements/Anchor.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Title from '@/elements/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';
import OAuthProviderDuplicateModal from '@/pages/admin/oAuthProviders/modals/OAuthProviderDuplicateModal.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function OAuthProviderCreateOrUpdate({
  contextOAuthProvider,
}: {
  contextOAuthProvider?: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { settings } = useGlobalStore();

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

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
    resourceName: t('pages.admin.oAuthProviders.resourceName', {}),
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

    addToast(t('pages.admin.oAuthProviders.tabs.general.page.toast.exported', {}), 'success');

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
      const yamlData = dump(data, { flowLevel: -1, forceQuotes: true });
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
      title={t(
        contextOAuthProvider
          ? 'pages.admin.oAuthProviders.tabs.general.page.titleUpdate'
          : 'pages.admin.oAuthProviders.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextOAuthProvider}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.oAuthProviders.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.oAuthProviders.tabs.general.page.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      {contextOAuthProvider && (
        <OAuthProviderDuplicateModal
          oauthProvider={contextOAuthProvider}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.oAuthProviders.all()))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label={t('common.form.name', {})}
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextArea
            label={t('common.form.description', {})}
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Card className='flex flex-row! items-center justify-between col-span-full'>
            <Title order={4}>{t('pages.admin.oAuthProviders.tabs.general.page.card.redirectUrl.title', {})}</Title>
            <Code>
              {contextOAuthProvider
                ? `${settings.app.url}/api/auth/oauth/${contextOAuthProvider.uuid}`
                : t('pages.admin.oAuthProviders.tabs.general.page.card.redirectUrl.unavailable', {})}
            </Code>
          </Card>

          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.clientId', {})}
            key={form.key('clientId')}
            {...form.getInputProps('clientId')}
          />
          <TextInput
            withAsterisk={!contextOAuthProvider}
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.clientSecret', {})}
            type='password'
            key={form.key('clientSecret')}
            {...form.getInputProps('clientSecret')}
          />

          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.authUrl', {})}
            key={form.key('authUrl')}
            {...form.getInputProps('authUrl')}
          />
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.tokenUrl', {})}
            key={form.key('tokenUrl')}
            {...form.getInputProps('tokenUrl')}
          />

          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.infoUrl', {})}
            key={form.key('infoUrl')}
            {...form.getInputProps('infoUrl')}
          />
          <Switch
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuth', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuthDescription', {})}
            key={form.key('basicAuth')}
            {...form.getInputProps('basicAuth', { type: 'checkbox' })}
          />

          <TagsInput
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.scopes', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.scopesDescription', {})}
            key={form.key('scopes')}
            {...form.getInputProps('scopes')}
          />
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.identifierPath', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.identifierPathDescription', {})}
            key={form.key('identifierPath')}
            {...form.getInputProps('identifierPath')}
          />

          <TextInput
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.emailPath', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.emailPathDescription', {})}
            key={form.key('emailPath')}
            {...form.getInputProps('emailPath')}
          />
          <TextInput
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.usernamePath', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.usernamePathDescription', {})}
            key={form.key('usernamePath')}
            {...form.getInputProps('usernamePath')}
          />

          <TextInput
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPath', {})}
            placeholder={t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPathPlaceholder', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPathDescription', {})}
            key={form.key('nameFirstPath')}
            {...form.getInputProps('nameFirstPath')}
          />
          <TextInput
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.nameLastPath', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.nameLastPathDescription', {})}
            key={form.key('nameLastPath')}
            {...form.getInputProps('nameLastPath')}
          />

          <Switch
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.loginOnly', {})}
            key={form.key('loginOnly')}
            {...form.getInputProps('loginOnly', { type: 'checkbox' })}
          />
          <Switch
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.loginBypass2fa', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.loginBypass2faDescription', {})}
            key={form.key('loginBypass2fa')}
            {...form.getInputProps('loginBypass2fa', { type: 'checkbox' })}
          />

          <Switch
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.linkViewable', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.linkViewableDescription', {})}
            key={form.key('linkViewable')}
            {...form.getInputProps('linkViewable', { type: 'checkbox' })}
          />
          <Switch
            label={t('pages.admin.oAuthProviders.tabs.general.page.form.userManageable', {})}
            description={t('pages.admin.oAuthProviders.tabs.general.page.form.userManageableDescription', {})}
            key={form.key('userManageable')}
            {...form.getInputProps('userManageable', { type: 'checkbox' })}
          />

          <Switch
            label={t('common.form.enabled', {})}
            key={form.key('enabled')}
            {...form.getInputProps('enabled', { type: 'checkbox' })}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextOAuthProvider ? 'oauth-providers.update' : 'oauth-providers.create'} cantSave>
            <Button type='submit' disabled={!isValid} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextOAuthProvider && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!isValid} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
            {contextOAuthProvider && (
              <ContextMenu
                menuProps={{ position: 'top', offset: 40 }}
                items={[
                  {
                    icon: faFileDownload,
                    label: t('common.button.exportAs', { format: 'JSON' }),
                    onClick: () => doExport('json'),
                    color: 'gray',
                  },
                  {
                    icon: faFileDownload,
                    label: t('common.button.exportAs', { format: 'YAML' }),
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
                    {t('common.button.export', {})}
                  </Button>
                )}
              </ContextMenu>
            )}
          </AdminCan>
          {contextOAuthProvider && (
            <AdminCan action='oauth-providers.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextOAuthProvider && (
            <AdminCan action='oauth-providers.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
          <Anchor
            href='https://calagopus.com/docs/additional/setting-up-oauth/'
            target='_blank'
            rel='noopener noreferrer'
          >
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              {t('common.button.viewDocumentation', {})}
            </Button>
          </Anchor>
        </Group>
      </form>
    </AdminContentContainer>
  );
}
