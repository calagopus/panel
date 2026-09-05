import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import createEggConfiguration from '@/api/admin/egg-configurations/createEggConfiguration.ts';
import deleteEggConfiguration from '@/api/admin/egg-configurations/deleteEggConfiguration.ts';
import updateEggConfiguration from '@/api/admin/egg-configurations/updateEggConfiguration.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import EggConfigurationDuplicateModal from '@/pages/admin/egg-configurations/modals/EggConfigurationDuplicateModal.tsx';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useGroupedEggOptions } from '@/plugins/useGroupedEggOptions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import {
  eggConfigurationEmptyFormValues,
  eggConfigurationToFormValues,
  useEggConfigurationFormFields,
} from './eggConfigurationFormValues.tsx';

const loadServerRoutes = () => import('@/routers/routes/serverRoutes.ts');

type EggConfigFormValues = z.infer<typeof adminEggConfigurationUpdateSchema>;

export default function EggConfigurationCreateOrUpdate({
  contextEggConfiguration,
}: {
  contextEggConfiguration?: z.infer<typeof adminEggConfigurationSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const languages = useGlobalStore((state) => state.languages);

  const { eggOptions, loading: eggsLoading } = useGroupedEggOptions();

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const [defaultRoutes, setDefaultRoutes] = useState<{
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: ServerRouteDefinition[];
  }>({ order: [], entries: [] });

  const form = useFormEngine<EggConfigFormValues>('admin.eggConfigurations.createOrUpdate', {
    schema: adminEggConfigurationUpdateSchema.unwrap(),
    initialValues: eggConfigurationEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    EggConfigFormValues,
    z.infer<typeof adminEggConfigurationSchema>
  >({
    form,
    createFn: () => createEggConfiguration(adminEggConfigurationUpdateSchema.parse(form.getValues())),
    updateFn: contextEggConfiguration
      ? () =>
          updateEggConfiguration(
            contextEggConfiguration.uuid,
            adminEggConfigurationUpdateSchema.parse(form.getValues()),
          )
      : undefined,
    deleteFn: contextEggConfiguration ? () => deleteEggConfiguration(contextEggConfiguration.uuid) : undefined,
    doUpdate: !!contextEggConfiguration,
    basePath: '/admin/egg-configurations',
    resourceName: t('pages.admin.eggConfigurations.resourceName', {}),
  });

  useHydrateForm(form, contextEggConfiguration, eggConfigurationToFormValues);

  useEffect(() => {
    loadServerRoutes()
      .then((module) => {
        const entries = [...module.default, ...window.extensionContext.extensionRegistry.routes.serverRoutes];

        for (const interceptor of window.extensionContext.extensionRegistry.routes.serverRouteInterceptors) {
          interceptor(entries);
        }

        const routes: z.infer<typeof eggConfigurationRouteItemSchema>[] = [];

        for (const route of entries) {
          if (route.name === undefined) continue;
          routes.push({ type: 'route', path: route.path });
        }

        setDefaultRoutes({
          order: routes,
          entries,
        });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, []);

  const fields = useEggConfigurationFormFields({ eggOptions, eggsLoading, defaultRoutes, languages });

  return (
    <AdminContentContainer
      title={
        contextEggConfiguration
          ? t('pages.admin.eggConfigurations.tabs.general.page.titleUpdate', {})
          : t('pages.admin.eggConfigurations.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextEggConfiguration}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.eggConfigurations.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      {contextEggConfiguration && (
        <EggConfigurationDuplicateModal
          eggConfiguration={contextEggConfiguration}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      {!eggsLoading && eggOptions.length === 0 && (
        <Alert color='yellow' mb='xs' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
          {t('pages.admin.eggConfigurations.tabs.general.page.form.eggsEmpty', {})}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.eggConfigurations.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan
            action={contextEggConfiguration ? 'egg-configurations.update' : 'egg-configurations.create'}
            cantSave
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextEggConfiguration && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextEggConfiguration && (
            <AdminCan action='egg-configurations.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextEggConfiguration && (
            <AdminCan action='egg-configurations.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
