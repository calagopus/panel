import { faList, faNetworkWired, faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo } from 'react';
import { ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import Switch from '@/elements/input/Switch.tsx';
import RouteOrderEditor from '@/elements/navigation/RouteOrderEditor.tsx';
import {
  type AdminEggConfiguration,
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useGroupedEggOptions } from '@/plugins/useGroupedEggOptions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggConfigurationAllocationsSection from './EggConfigurationAllocationsSection.tsx';

type EggConfigFormValues = z.infer<typeof adminEggConfigurationUpdateSchema>;

type EggConfigurationAllocations = NonNullable<AdminEggConfiguration['configAllocations']>;
type EggConfigurationPrimaryAllocation = NonNullable<EggConfigurationAllocations['deployment']['primary']>;
type EggConfigurationStartup = NonNullable<AdminEggConfiguration['configStartup']>;

export const eggConfigurationEmptyFormValues: EggConfigFormValues = {
  name: '',
  description: null,
  order: 0,
  eggs: [],
  configAllocations: null,
  configStartup: null,
  configRoutes: null,
};

export const defaultEggConfigurationPrimaryAllocation: EggConfigurationPrimaryAllocation = {
  startPort: 1,
  endPort: 65535,
  assignToVariable: null,
};

export const defaultEggConfigurationAllocations: EggConfigurationAllocations = {
  deployment: {
    additional: [],
    dedicated: false,
    primary: null,
  },
  userSelfAssign: {
    enabled: false,
    requirePrimaryAllocation: true,
    startPort: 1,
    endPort: 65535,
  },
};

export const defaultEggConfigurationStartup: EggConfigurationStartup = {
  allowCustomStartupCommand: false,
};

export const eggConfigurationToFormValues = (
  eggConfiguration: z.infer<typeof adminEggConfigurationSchema>,
): EggConfigFormValues => ({
  name: eggConfiguration.name,
  description: eggConfiguration.description,
  order: eggConfiguration.order,
  eggs: eggConfiguration.eggs,
  configAllocations: eggConfiguration.configAllocations,
  configStartup: eggConfiguration.configStartup,
  configRoutes: eggConfiguration.configRoutes,
});

interface EggConfigurationFormFieldsOptions {
  eggOptions: ReturnType<typeof useGroupedEggOptions>['eggOptions'];
  eggsLoading: boolean;
  defaultRoutes: {
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: ServerRouteDefinition[];
  };
  languages: string[];
}

export function useEggConfigurationFormFields({
  eggOptions,
  eggsLoading,
  defaultRoutes,
  languages,
}: EggConfigurationFormFieldsOptions): FieldDef<EggConfigFormValues>[] {
  const { t } = useTranslations();

  return useMemo(
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
        data: eggOptions,
        props: {
          placeholder: t('pages.admin.eggConfigurations.tabs.general.page.form.eggsPlaceholder', {}),
          searchable: true,
          loading: eggsLoading,
        },
      },
      { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
      {
        type: 'section',
        name: 'configAllocations',
        colSpan: 'full',
        icon: <FontAwesomeIcon icon={faNetworkWired} />,
        title: t('pages.admin.eggConfigurations.tabs.general.page.allocation.title', {}),
        nullableDefault: defaultEggConfigurationAllocations,
        render: (f) => <EggConfigurationAllocationsSection form={f} />,
      },
      {
        type: 'section',
        name: 'configStartup',
        colSpan: 'full',
        icon: <FontAwesomeIcon icon={faPlay} />,
        title: t('pages.admin.eggConfigurations.tabs.general.page.startup.title', {}),
        nullableDefault: defaultEggConfigurationStartup,
        render: (f) => (
          <Switch
            label={t('pages.admin.eggConfigurations.tabs.general.page.startup.form.allowCustomStartupCommand', {})}
            description={t(
              'pages.admin.eggConfigurations.tabs.general.page.startup.form.allowCustomStartupCommandDescription',
              {},
            )}
            key={f.key('configStartup.allowCustomStartupCommand')}
            {...f.getInputProps('configStartup.allowCustomStartupCommand', { type: 'checkbox' })}
          />
        ),
      },
      {
        type: 'section',
        name: 'configRoutes',
        colSpan: 'full',
        icon: <FontAwesomeIcon icon={faList} />,
        title: t('elements.routeOrderEditor.title', {}),
        nullableDefault: () => ({ order: defaultRoutes.order }),
        render: (f) =>
          f.values.configRoutes ? (
            <RouteOrderEditor
              value={f.values.configRoutes.order}
              onChange={(order) => f.setFieldValue('configRoutes.order', order)}
              routes={defaultRoutes.entries}
              languages={languages}
            />
          ) : null,
      },
    ],
    [t, eggOptions, eggsLoading, defaultRoutes, languages],
  );
}
