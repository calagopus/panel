import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import createOAuthProvider from '@/api/admin/oauth-providers/createOAuthProvider.ts';
import deleteOAuthProvider from '@/api/admin/oauth-providers/deleteOAuthProvider.ts';
import duplicateOAuthProvider from '@/api/admin/oauth-providers/duplicateOAuthProvider.ts';
import updateOAuthProvider from '@/api/admin/oauth-providers/updateOAuthProvider.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ResourceDuplicateModal from '@/elements/modals/ResourceDuplicateModal.tsx';
import ResourceExportMenu from '@/elements/ResourceExportMenu.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';
import Code from '@/elements/typography/Code.tsx';
import Title from '@/elements/typography/Title.tsx';
import { downloadResourceFile, type ResourceExportFormat } from '@/lib/download/export.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminOAuthProviderSchema,
  adminOAuthProviderUpdateSchema,
  oauthProviderSecretFields,
} from '@/lib/schemas/admin/oauthProviders.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import {
  oauthProviderEmptyFormValues,
  oauthProviderToFormValues,
  useOAuthProviderFormFields,
} from './oauthProviderFormValues.tsx';

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

  const form = useFormEngine<OAuthFormValues>('admin.oAuthProviders.createOrUpdate', {
    schema: adminOAuthProviderUpdateSchema.unwrap(),
    mode: 'uncontrolled',
    initialValues: oauthProviderEmptyFormValues,
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
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

  useHydrateForm(form, contextOAuthProvider, oauthProviderToFormValues);

  const doExport = (format: ResourceExportFormat) => {
    if (!contextOAuthProvider) return;

    downloadResourceFile(
      adminOAuthProviderUpdateSchema,
      contextOAuthProvider,
      `oauth-provider-${contextOAuthProvider.uuid}`,
      format,
      oauthProviderSecretFields,
    );

    addToast(t('pages.admin.oAuthProviders.tabs.general.page.toast.exported', {}), 'success');
  };

  const { fieldsTop, fieldsMain } = useOAuthProviderFormFields(!!contextOAuthProvider);

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
        {t('common.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      {contextOAuthProvider && (
        <ResourceDuplicateModal
          resourceName={t('pages.admin.oAuthProviders.resourceName', {})}
          sourceName={contextOAuthProvider.name}
          duplicate={(name) => duplicateOAuthProvider(contextOAuthProvider.uuid, name)}
          redirectTo={(duplicated) => `/admin/oauth-providers/${duplicated.uuid}`}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.oAuthProviders.all()))}>
        <FormEngine form={form} fields={fieldsTop} />

        <Card className='flex flex-col md:flex-row! items-center justify-between mt-4'>
          <Title order={4}>{t('pages.admin.oAuthProviders.tabs.general.page.card.redirectUrl.title', {})}</Title>
          <Code>
            {contextOAuthProvider
              ? `${settings.app.url}/api/auth/oauth/${contextOAuthProvider.uuid}`
              : t('pages.admin.oAuthProviders.tabs.general.page.card.redirectUrl.unavailable', {})}
          </Code>
        </Card>

        <FormEngine form={form} fields={fieldsMain} className='mt-4' />

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
            {contextOAuthProvider && <ResourceExportMenu loading={loading} onExport={doExport} />}
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
