import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type MetadataFormValues = z.infer<typeof adminSettingsMetadataSchema>;

export const metadataEmptyFormValues: MetadataFormValues = {
  description: null,
  themeColor: '#6c5ce7',
  ogImage: null,
  twitterCard: 'summary_large_image',
  indexable: true,
  pwaEnabled: true,
  pwaName: null,
  pwaShortName: null,
  pwaDisplay: 'standalone',
  pwaBackgroundColor: '#222222',
  pwaIcon: null,
};

export const metadataToFormValues = (metadata: MetadataFormValues): Partial<MetadataFormValues> => ({ ...metadata });

interface MetadataFormFieldsOptions {
  assetUrls: string[];
  descriptionPlaceholder: string;
  ogImagePlaceholder: string;
  pwaNamePlaceholder: string;
}

export function useMetadataFormFields({
  assetUrls,
  descriptionPlaceholder,
  ogImagePlaceholder,
  pwaNamePlaceholder,
}: MetadataFormFieldsOptions): FieldDef<MetadataFormValues>[] {
  const { t } = useTranslations();

  return [
    {
      type: 'textarea',
      name: 'description',
      label: t('pages.admin.settings.tabs.metadata.page.form.description', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.descriptionDescription', {}),
      rows: 3,
      colSpan: 'full',
      props: { placeholder: descriptionPlaceholder },
    },
    {
      type: 'autocomplete',
      name: 'ogImage',
      label: t('pages.admin.settings.tabs.metadata.page.form.ogImage', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.ogImageDescription', {}),
      options: assetUrls,
      props: { placeholder: ogImagePlaceholder },
    },
    {
      type: 'select',
      name: 'twitterCard',
      label: t('pages.admin.settings.tabs.metadata.page.form.twitterCard', {}),
      required: true,
      options: [
        { label: t('pages.admin.settings.tabs.metadata.page.enum.twitterCard.summary', {}), value: 'summary' },
        {
          label: t('pages.admin.settings.tabs.metadata.page.enum.twitterCard.summaryLargeImage', {}),
          value: 'summary_large_image',
        },
      ],
    },
    {
      type: 'text',
      name: 'themeColor',
      label: t('pages.admin.settings.tabs.metadata.page.form.themeColor', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.themeColorDescription', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'indexable',
      label: t('pages.admin.settings.tabs.metadata.page.form.indexable', {}),
    },

    {
      type: 'divider',
      name: 'pwaDivider',
      label: t('pages.admin.settings.tabs.metadata.page.form.pwa', {}),
      switchName: 'pwaEnabled',
      switchLabel: t('common.form.enabled', {}),
    },

    {
      type: 'text',
      name: 'pwaName',
      label: t('pages.admin.settings.tabs.metadata.page.form.pwaName', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.pwaNameDescription', {}),
      props: { placeholder: pwaNamePlaceholder },
      when: (values) => values.pwaEnabled,
    },

    {
      type: 'text',
      name: 'pwaShortName',
      label: t('pages.admin.settings.tabs.metadata.page.form.pwaShortName', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.pwaShortNameDescription', {}),
      props: { placeholder: pwaNamePlaceholder },
      when: (values) => values.pwaEnabled,
    },

    {
      type: 'autocomplete',
      name: 'pwaIcon',
      label: t('pages.admin.settings.tabs.metadata.page.form.pwaIcon', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.pwaIconDescription', {}),
      options: assetUrls,
      props: { placeholder: '/android-chrome-512x512.png' },
      when: (values) => values.pwaEnabled,
    },

    {
      type: 'select',
      name: 'pwaDisplay',
      label: t('pages.admin.settings.tabs.metadata.page.form.pwaDisplay', {}),
      required: true,
      options: [
        { label: t('pages.admin.settings.tabs.metadata.page.enum.pwaDisplay.standalone', {}), value: 'standalone' },
        { label: t('pages.admin.settings.tabs.metadata.page.enum.pwaDisplay.fullscreen', {}), value: 'fullscreen' },
        { label: t('pages.admin.settings.tabs.metadata.page.enum.pwaDisplay.minimalUi', {}), value: 'minimal_ui' },
        { label: t('pages.admin.settings.tabs.metadata.page.enum.pwaDisplay.browser', {}), value: 'browser' },
      ],
      when: (values) => values.pwaEnabled,
    },

    {
      type: 'text',
      name: 'pwaBackgroundColor',
      label: t('pages.admin.settings.tabs.metadata.page.form.pwaBackgroundColor', {}),
      description: t('pages.admin.settings.tabs.metadata.page.form.pwaBackgroundColorDescription', {}),
      required: true,
      when: (values) => values.pwaEnabled,
    },
  ];
}
