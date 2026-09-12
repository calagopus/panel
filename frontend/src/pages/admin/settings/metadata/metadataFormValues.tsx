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
};

export const metadataToFormValues = (metadata: MetadataFormValues): Partial<MetadataFormValues> => ({ ...metadata });

interface MetadataFormFieldsOptions {
  assetUrls: string[];
  descriptionPlaceholder: string;
  ogImagePlaceholder: string;
}

export function useMetadataFormFields({
  assetUrls,
  descriptionPlaceholder,
  ogImagePlaceholder,
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
  ];
}
