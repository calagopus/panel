import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { detectImage } from './pwaImage.ts';

type MetadataFormValues = z.infer<typeof adminSettingsMetadataSchema>;

interface Props {
  form: UseFormReturnType<MetadataFormValues>;
  path: `pwaIcons.${number}` | `pwaScreenshots.${number}`;
  assetUrls: string[];
}

export default function PwaImageFields({ form, path, assetUrls }: Props) {
  const { t } = useTranslations();

  const detect = (src: string) => {
    if (!src) return;

    detectImage(src).then((image) => {
      if (!image || form.getInputProps(`${path}.src`).value !== src) return;

      form.setFieldValue(`${path}.sizes`, image.sizes);
      form.setFieldValue(`${path}.type`, image.type);
    });
  };

  return (
    <>
      <Autocomplete
        withAsterisk
        label={t('pages.admin.settings.tabs.metadata.page.form.imageUrl', {})}
        data={assetUrls}
        key={form.key(`${path}.src`)}
        {...form.getInputProps(`${path}.src`)}
        onOptionSubmit={detect}
        onBlur={(e) => detect(e.currentTarget.value)}
      />
      <TextInput
        withAsterisk
        label={t('pages.admin.settings.tabs.metadata.page.form.imageSizes', {})}
        description={t('pages.admin.settings.tabs.metadata.page.form.imageSizesDescription', {})}
        placeholder='512x512'
        key={form.key(`${path}.sizes`)}
        {...form.getInputProps(`${path}.sizes`)}
      />
      <TextInput
        label={t('common.form.type', {})}
        placeholder='image/png'
        key={form.key(`${path}.type`)}
        {...form.getInputProps(`${path}.type`)}
      />
    </>
  );
}
