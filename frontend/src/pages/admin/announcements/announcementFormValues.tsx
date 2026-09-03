import { useMemo } from 'react';
import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { announcementTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { adminAnnouncementSchema, adminAnnouncementUpdateSchema } from '@/lib/schemas/admin/announcements.ts';
import { searchableMultiselectField } from '@/lib/searchableMultiselectField.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useGroupedEggOptions } from '@/plugins/useGroupedEggOptions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type AnnouncementFormValues = z.infer<typeof adminAnnouncementUpdateSchema>;

export const announcementEmptyFormValues: AnnouncementFormValues = {
  type: 'info',
  enabled: true,
  enabledStart: null,
  enabledEnd: null,
  dismissible: false,
  dismissibleEnd: null,
  title: '',
  titleTranslations: {},
  content: '',
  contentTranslations: {},
  locations: [],
  nodes: [],
  backupConfigurations: [],
  eggs: [],
};

export const announcementToFormValues = (
  announcement: z.infer<typeof adminAnnouncementSchema>,
): Partial<AnnouncementFormValues> => ({
  type: announcement.type,
  enabled: announcement.enabled,
  enabledStart: announcement.enabledStart,
  enabledEnd: announcement.enabledEnd,
  dismissible: announcement.dismissible,
  dismissibleEnd: announcement.dismissibleEnd,
  title: announcement.title,
  titleTranslations: announcement.titleTranslations,
  content: announcement.content,
  contentTranslations: announcement.contentTranslations,
  locations: announcement.locations,
  nodes: announcement.nodes,
  backupConfigurations: announcement.backupConfigurations,
  eggs: announcement.eggs,
});

type SearchableResource = ReturnType<typeof useSearchableResource<{ uuid: string; name: string }>>;

interface AnnouncementFormFieldsOptions {
  languages: string[];
  canReadLocations: boolean;
  canReadNodes: boolean;
  canReadBackupConfigurations: boolean;
  locations: SearchableResource;
  nodes: SearchableResource;
  backupConfigurations: SearchableResource;
  eggOptions: ReturnType<typeof useGroupedEggOptions>['eggOptions'];
  eggsLoading: boolean;
}

export function useAnnouncementFormFields({
  languages,
  canReadLocations,
  canReadNodes,
  canReadBackupConfigurations,
  locations,
  nodes,
  backupConfigurations,
  eggOptions,
  eggsLoading,
}: AnnouncementFormFieldsOptions): FieldDef<AnnouncementFormValues>[] {
  const { t } = useTranslations();

  return useMemo(
    () => [
      {
        type: 'select',
        name: 'type',
        label: t('common.form.type', {}),
        required: true,
        options: mappingToSelectData(announcementTypeLabelMapping),
      },
      {
        type: 'localizedtext',
        name: 'title',
        label: t('common.form.title', {}),
        required: true,
        translationsName: 'titleTranslations',
        languages,
      },
      {
        type: 'localizedtextarea',
        name: 'content',
        label: t('common.form.content', {}),
        required: true,
        colSpan: 'full',
        translationsName: 'contentTranslations',
        languages,
      },
      {
        type: 'date',
        name: 'dismissibleEnd',
        label: t('pages.admin.announcements.tabs.general.page.form.dismissibleEnd', {}),
        props: { clearable: true },
      },
      {
        type: 'date',
        name: 'enabledStart',
        label: t('pages.admin.announcements.tabs.general.page.form.enabledStart', {}),
        props: { clearable: true },
      },
      {
        type: 'date',
        name: 'enabledEnd',
        label: t('pages.admin.announcements.tabs.general.page.form.enabledEnd', {}),
        props: { clearable: true },
      },
      searchableMultiselectField<AnnouncementFormValues>({
        name: 'locations',
        label: t('pages.admin.announcements.tabs.general.page.form.locations', {}),
        description: t('pages.admin.announcements.tabs.general.page.form.locationsDescription', {}),
        resource: locations,
        canRead: canReadLocations,
      }),
      searchableMultiselectField<AnnouncementFormValues>({
        name: 'nodes',
        label: t('pages.admin.announcements.tabs.general.page.form.nodes', {}),
        description: t('pages.admin.announcements.tabs.general.page.form.nodesDescription', {}),
        resource: nodes,
        canRead: canReadNodes,
      }),
      searchableMultiselectField<AnnouncementFormValues>({
        name: 'backupConfigurations',
        label: t('pages.admin.announcements.tabs.general.page.form.backupConfigurations', {}),
        description: t('pages.admin.announcements.tabs.general.page.form.backupConfigurationsDescription', {}),
        resource: backupConfigurations,
        canRead: canReadBackupConfigurations,
      }),
      {
        type: 'multiselectgroup',
        name: 'eggs',
        label: t('common.form.eggs', {}),
        data: eggOptions,
        props: {
          placeholder: t('pages.admin.announcements.tabs.general.page.form.eggsPlaceholder', {}),
          searchable: true,
          loading: eggsLoading,
        },
      },
      { type: 'switch', name: 'enabled', label: t('common.form.enabled', {}) },
      {
        type: 'switch',
        name: 'dismissible',
        label: t('pages.admin.announcements.tabs.general.page.form.dismissible', {}),
      },
    ],
    [
      t,
      languages,
      canReadLocations,
      canReadNodes,
      canReadBackupConfigurations,
      locations,
      nodes,
      backupConfigurations,
      eggOptions,
      eggsLoading,
    ],
  );
}
