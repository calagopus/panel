import { faList, faNetworkWired, faPlay, faToggleOn } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';
import { ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import Switch from '@/elements/input/Switch.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import RouteOrderEditor from '@/elements/navigation/RouteOrderEditor.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  type AdminEggConfiguration,
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useGroupedEggOptions } from '@/plugins/useGroupedEggOptions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggConfigurationAllocationsSection from './EggConfigurationAllocationsSection.tsx';
import EggConfigurationMatcherBuilder from './EggConfigurationMatcherBuilder.tsx';

type EggConfigFormValues = z.infer<typeof adminEggConfigurationUpdateSchema>;

type EggConfigurationAllocations = NonNullable<AdminEggConfiguration['configAllocations']>;
type EggConfigurationPrimaryAllocation = NonNullable<EggConfigurationAllocations['deployment']['primary']>;
type EggConfigurationStartup = NonNullable<AdminEggConfiguration['configStartup']>;
type EggConfigurationFeatures = NonNullable<AdminEggConfiguration['configFeatures']>;

export const eggConfigurationEmptyFormValues: EggConfigFormValues = {
  name: '',
  description: null,
  order: 0,
  matcher: { type: 'eggs', eggs: [] },
  configAllocations: null,
  configStartup: null,
  configRoutes: null,
  configFeatures: null,
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

export const defaultEggConfigurationFeatures: EggConfigurationFeatures = {
  firewall: null,
  privateNetwork: null,
};

const featureStateToValue = (state: boolean | null) => (state === null ? 'inherit' : state ? 'enabled' : 'disabled');
const valueToFeatureState = (value: string) => (value === 'inherit' ? null : value === 'enabled');

export const eggConfigurationToFormValues = (
  eggConfiguration: z.infer<typeof adminEggConfigurationSchema>,
): EggConfigFormValues => ({
  name: eggConfiguration.name,
  description: eggConfiguration.description,
  order: eggConfiguration.order,
  matcher: eggConfiguration.matcher,
  configAllocations: eggConfiguration.configAllocations,
  configStartup: eggConfiguration.configStartup,
  configRoutes: eggConfiguration.configRoutes,
  configFeatures: eggConfiguration.configFeatures,
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
      { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
      {
        type: 'custom',
        name: 'matcher',
        colSpan: 'full',
        render: (f) => (
          <Stack gap='xs'>
            <div>
              <Text fw={500}>{t('pages.admin.eggConfigurations.tabs.general.page.form.matcher', {})}</Text>
              <Text size='xs' c='dimmed'>
                {t('pages.admin.eggConfigurations.tabs.general.page.form.matcherDescription', {})}
              </Text>
            </div>
            <EggConfigurationMatcherBuilder
              matcher={f.values.matcher}
              onChange={(matcher) => f.setFieldValue('matcher', matcher)}
              eggOptions={eggOptions}
              eggsLoading={eggsLoading}
            />
          </Stack>
        ),
      },
      {
        type: 'section',
        name: 'configAllocations',
        colSpan: 'full',
        icon: faNetworkWired,
        title: t('pages.admin.eggConfigurations.tabs.general.page.allocation.title', {}),
        nullableDefault: defaultEggConfigurationAllocations,
        render: (f) => <EggConfigurationAllocationsSection form={f} />,
      },
      {
        type: 'section',
        name: 'configFeatures',
        colSpan: 'full',
        icon: faToggleOn,
        title: t('pages.admin.eggConfigurations.tabs.general.page.features.title', {}),
        nullableDefault: defaultEggConfigurationFeatures,
        render: (f) =>
          f.values.configFeatures ? (
            <Stack>
              <Text size='xs' c='dimmed'>
                {t('pages.admin.eggConfigurations.tabs.general.page.features.description', {})}
              </Text>
              {(['firewall', 'privateNetwork'] as const).map((feature) => (
                <div key={feature}>
                  <Text size='sm' fw={500}>
                    {t(`pages.admin.eggConfigurations.tabs.general.page.features.form.${feature}`, {})}
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {t(`pages.admin.eggConfigurations.tabs.general.page.features.form.${feature}Description`, {})}
                  </Text>
                  <SegmentedControl
                    mt='xs'
                    value={featureStateToValue(f.values.configFeatures?.[feature] ?? null)}
                    onChange={(value) => f.setFieldValue(`configFeatures.${feature}`, valueToFeatureState(value))}
                    data={(['inherit', 'enabled', 'disabled'] as const).map((value) => ({
                      value,
                      label: t(`pages.admin.eggConfigurations.tabs.general.page.enum.featureState.${value}`, {}),
                    }))}
                  />
                </div>
              ))}
            </Stack>
          ) : null,
      },
      {
        type: 'section',
        name: 'configStartup',
        colSpan: 'full',
        icon: faPlay,
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
        icon: faList,
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
