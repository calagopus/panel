import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import TagsInput from '@/elements/input/TagsInput.tsx';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import PwaIconsInput from './PwaIconsInput.tsx';
import PwaScreenshotsInput from './PwaScreenshotsInput.tsx';
import PwaShortcutsInput from './PwaShortcutsInput.tsx';

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
  pwaIcons: [],
  pwaScreenshots: [],
  pwaShortcuts: [],
  pwaCategories: [],
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

    {
      type: 'custom',
      name: 'pwaCategories',
      colSpan: 'full',
      when: (values) => values.pwaEnabled,
      render: (f) => {
        const invalidCategories = f.values.pwaCategories.filter((category) => !/^[a-z0-9-]{1,32}$/.test(category));

        return (
          <TagsInput
            label={t('pages.admin.settings.tabs.metadata.page.form.pwaCategories', {})}
            description={t('pages.admin.settings.tabs.metadata.page.form.pwaCategoriesDescription', {})}
            placeholder='utilities'
            value={f.values.pwaCategories}
            onChange={(categories) =>
              f.setFieldValue(
                'pwaCategories',
                categories.map((category) => category.trim().toLowerCase().replace(/\s+/g, '-')),
              )
            }
            invalidTags={invalidCategories}
            error={
              invalidCategories.length > 0
                ? t('pages.admin.settings.tabs.metadata.page.form.pwaCategoriesInvalid', {})
                : undefined
            }
          />
        );
      },
    },

    {
      type: 'custom',
      name: 'pwaIcons',
      colSpan: 'full',
      when: (values) => values.pwaEnabled,
      render: (f) => <PwaIconsInput form={f} assetUrls={assetUrls} />,
    },

    {
      type: 'custom',
      name: 'pwaScreenshots',
      colSpan: 'full',
      when: (values) => values.pwaEnabled,
      render: (f) => <PwaScreenshotsInput form={f} assetUrls={assetUrls} />,
    },

    {
      type: 'custom',
      name: 'pwaShortcuts',
      colSpan: 'full',
      when: (values) => values.pwaEnabled,
      render: (f) => <PwaShortcutsInput form={f} />,
    },
  ];
}
