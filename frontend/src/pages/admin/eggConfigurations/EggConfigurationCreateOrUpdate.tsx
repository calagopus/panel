import { faList, faPlay, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useState } from 'react';
import { ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import createEggConfiguration from '@/api/admin/egg-configurations/createEggConfiguration.ts';
import deleteEggConfiguration from '@/api/admin/egg-configurations/deleteEggConfiguration.ts';
import updateEggConfiguration from '@/api/admin/egg-configurations/updateEggConfiguration.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import RouteOrderEditor from '@/elements/RouteOrderEditor.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import EggConfigurationDuplicateModal from '@/pages/admin/eggConfigurations/modals/EggConfigurationDuplicateModal.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import EggConfigurationAllocationsSection from './EggConfigurationAllocationsSection.tsx';

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

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const [eggs, setEggs] = useState<{ group: string; items: { label: string; value: string }[] }[]>([]);
  const [eggsLoading, setEggsLoading] = useState(true);
  const [defaultRoutes, setDefaultRoutes] = useState<{
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: ServerRouteDefinition[];
  }>({ order: [], entries: [] });

  const form = useFormEngine<EggConfigFormValues>('admin.eggConfigurations.createOrUpdate', {
    schema: adminEggConfigurationUpdateSchema.unwrap(),
    initialValues: {
      name: '',
      description: null,
      order: 0,
      eggs: [],
      configAllocations: null,
      configStartup: null,
      configRoutes: null,
    },
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

  useEffect(() => {
    if (contextEggConfiguration) {
      form.setValues({
        name: contextEggConfiguration.name,
        description: contextEggConfiguration.description,
        order: contextEggConfiguration.order,
        eggs: contextEggConfiguration.eggs,
        configAllocations: contextEggConfiguration.configAllocations,
        configStartup: contextEggConfiguration.configStartup,
        configRoutes: contextEggConfiguration.configRoutes,
      });
    }
  }, [contextEggConfiguration]);

  useEffect(() => {
    getAllEggs()
      .then((eggs) => {
        setEggs(
          eggs.map((v) => ({
            group: v.nest.name,
            items: v.eggs.map((e) => ({
              label: e.name,
              value: e.uuid,
            })),
          })),
        );
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setEggsLoading(false));
  }, []);

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

  const formIsValid = form.isValid();

  const fields: FieldDef<EggConfigFormValues>[] = useMemo(
    (): FieldDef<EggConfigFormValues>[] => [
      { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
      {
        type: 'number',
        name: 'order',
        label: t('pages.admin.eggConfigurations.tabs.general.page.form.order', {}),
        required: true,
      },
      {
        type: 'multiselectgroup',
        name: 'eggs',
        label: t('common.form.eggs', {}),
        data: eggs,
        props: {
          placeholder: t('pages.admin.eggConfigurations.tabs.general.page.form.eggsPlaceholder', {}),
          searchable: true,
          loading: !eggs.length,
        },
      },
      { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
      {
        type: 'custom',
        name: 'configAllocations',
        colSpan: 'full',
        render: () => <EggConfigurationAllocationsSection form={form} />,
      },
      {
        type: 'custom',
        name: 'configStartup',
        colSpan: 'full',
        render: (f) => (
          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faPlay} />}
            title={t('pages.admin.eggConfigurations.tabs.general.page.startup.title', {})}
            enabled={f.values.configStartup !== null}
            onToggle={(enabled) =>
              f.setFieldValue(
                'configStartup',
                enabled
                  ? {
                      allowCustomStartupCommand: false,
                    }
                  : null,
              )
            }
          >
            <Switch
              label={t('pages.admin.eggConfigurations.tabs.general.page.startup.form.allowCustomStartupCommand', {})}
              description={t(
                'pages.admin.eggConfigurations.tabs.general.page.startup.form.allowCustomStartupCommandDescription',
                {},
              )}
              key={f.key('configStartup.allowCustomStartupCommand')}
              {...f.getInputProps('configStartup.allowCustomStartupCommand', {
                type: 'checkbox',
              })}
            />
          </CollapsibleSection>
        ),
      },
      {
        type: 'custom',
        name: 'configRoutes',
        colSpan: 'full',
        render: (f) => (
          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faList} />}
            title={t('elements.routeOrderEditor.title', {})}
            enabled={f.values.configRoutes !== null}
            onToggle={(enabled) => f.setFieldValue('configRoutes', enabled ? { order: defaultRoutes.order } : null)}
          >
            {f.values.configRoutes && (
              <RouteOrderEditor
                value={f.values.configRoutes.order}
                onChange={(order) => f.setFieldValue('configRoutes.order', order)}
                routes={defaultRoutes.entries}
                languages={languages}
              />
            )}
          </CollapsibleSection>
        ),
      },
    ],
    [t, eggs, form, defaultRoutes, languages],
  );

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

      {!eggsLoading && eggs.length === 0 && (
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
            <Button type='submit' disabled={!formIsValid} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextEggConfiguration && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!formIsValid} loading={loading}>
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
