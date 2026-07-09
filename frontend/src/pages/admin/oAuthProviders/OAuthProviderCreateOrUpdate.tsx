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
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Title from '@/elements/Title.tsx';
import { serializeForApi } from '@/lib/api-transform.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import OAuthProviderDuplicateModal from '@/pages/admin/oAuthProviders/modals/OAuthProviderDuplicateModal.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type OAuthFormValues = z.infer<typeof adminOAuthProviderUpdateSchema>;

export default function OAuthProviderCreateOrUpdate({
  contextOAuthProvider,
}: {
  contextOAuthProvider?: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const settings = useGlobalStore((state) => state.settings);

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<OAuthFormValues>('admin.oAuthProviders.createOrUpdate');
  const mergedSchema = adminOAuthProviderUpdateSchema.unwrap().extend(zodShape);

  const form = useForm<OAuthFormValues>({
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
      ...(extInitialValues as Partial<OAuthFormValues>),
    },
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    OAuthFormValues,
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

    const data = serializeForApi(adminOAuthProviderUpdateSchema, contextOAuthProvider) as Record<string, unknown>;
    delete data.client_id;
    delete data.client_secret;

    const contents =
      format === 'json' ? JSON.stringify(data, undefined, 2) : dump(data, { flowLevel: -1, forceQuotes: true });
    const fileURL = URL.createObjectURL(new Blob([contents], { type: 'text/plain' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = fileURL;
    downloadLink.download = `oauth-provider-${contextOAuthProvider.uuid}.${format === 'json' ? 'json' : 'yml'}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();

    URL.revokeObjectURL(fileURL);
    downloadLink.remove();
  };

  const fieldsTop: FieldDef<OAuthFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}) },
  ];

  const fieldsMain: FieldDef<OAuthFormValues>[] = [
    {
      type: 'text',
      name: 'clientId',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.clientId', {}),
      required: true,
    },
    {
      type: 'password',
      name: 'clientSecret',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.clientSecret', {}),
      props: { withAsterisk: !contextOAuthProvider },
    },
    {
      type: 'text',
      name: 'authUrl',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.authUrl', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'tokenUrl',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.tokenUrl', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'infoUrl',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.infoUrl', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'basicAuth',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuth', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuthDescription', {}),
    },
    {
      type: 'tags',
      name: 'scopes',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.scopes', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.scopesDescription', {}),
    },
    {
      type: 'text',
      name: 'identifierPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.identifierPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.identifierPathDescription', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'emailPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.emailPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.emailPathDescription', {}),
    },
    {
      type: 'text',
      name: 'usernamePath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.usernamePath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.usernamePathDescription', {}),
    },
    {
      type: 'text',
      name: 'nameFirstPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPathDescription', {}),
      props: { placeholder: t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPathPlaceholder', {}) },
    },
    {
      type: 'text',
      name: 'nameLastPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.nameLastPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.nameLastPathDescription', {}),
    },
    {
      type: 'switch',
      name: 'loginOnly',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.loginOnly', {}),
    },
    {
      type: 'switch',
      name: 'loginBypass2fa',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.loginBypass2fa', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.loginBypass2faDescription', {}),
    },
    {
      type: 'switch',
      name: 'linkViewable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.linkViewable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.linkViewableDescription', {}),
    },
    {
      type: 'switch',
      name: 'userManageable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.userManageable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.userManageableDescription', {}),
    },
    { type: 'switch', name: 'enabled', label: t('common.form.enabled', {}) },
  ];

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
        <FormEngine form={form} fields={fieldsTop} extensions={[formExtension]} />

        <Card className='flex flex-row! items-center justify-between mt-4'>
          <Title order={4}>{t('pages.admin.oAuthProviders.tabs.general.page.card.redirectUrl.title', {})}</Title>
          <Code>
            {contextOAuthProvider
              ? `${settings.app.url}/api/auth/oauth/${contextOAuthProvider.uuid}`
              : t('pages.admin.oAuthProviders.tabs.general.page.card.redirectUrl.unavailable', {})}
          </Code>
        </Card>

        <FormEngine form={form} fields={fieldsMain} className='mt-4' extensions={[formExtension]} />

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
                    type: 'action',
                    icon: faFileDownload,
                    label: t('common.button.exportAs', { format: 'JSON' }),
                    onClick: () => doExport('json'),
                    color: 'gray',
                  },
                  {
                    type: 'action',
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
