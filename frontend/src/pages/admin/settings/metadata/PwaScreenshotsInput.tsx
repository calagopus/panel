import { faImages, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import PwaImageFields from './PwaImageFields.tsx';

type MetadataFormValues = z.infer<typeof adminSettingsMetadataSchema>;

export default function PwaScreenshotsInput({
  form,
  assetUrls,
}: {
  form: UseFormReturnType<MetadataFormValues>;
  assetUrls: string[];
}) {
  const { t } = useTranslations();

  return (
    <TitleCard title={t('pages.admin.settings.tabs.metadata.page.form.pwaScreenshots', {})} icon={faImages}>
      <Stack>
        <Text size='sm' c='dimmed'>
          {t('pages.admin.settings.tabs.metadata.page.form.pwaScreenshotsDescription', {})}
        </Text>

        {form.values.pwaScreenshots.map((_, index) => (
          <Card key={form.key(`pwaScreenshots.${index}`)} withBorder padding='md'>
            <Group align='flex-start' wrap='nowrap'>
              <Stack gap='xs' className='flex-1'>
                <PwaImageFields form={form} path={`pwaScreenshots.${index}`} assetUrls={assetUrls} />
                <Select
                  allowDeselect
                  label={t('pages.admin.settings.tabs.metadata.page.form.screenshotFormFactor', {})}
                  placeholder={t('pages.admin.settings.tabs.metadata.page.enum.screenshotFormFactor.any', {})}
                  data={[
                    {
                      label: t('pages.admin.settings.tabs.metadata.page.enum.screenshotFormFactor.wide', {}),
                      value: 'wide',
                    },
                    {
                      label: t('pages.admin.settings.tabs.metadata.page.enum.screenshotFormFactor.narrow', {}),
                      value: 'narrow',
                    },
                  ]}
                  key={form.key(`pwaScreenshots.${index}.formFactor`)}
                  {...form.getInputProps(`pwaScreenshots.${index}.formFactor`)}
                />
                <TextInput
                  label={t('pages.admin.settings.tabs.metadata.page.form.screenshotLabel', {})}
                  key={form.key(`pwaScreenshots.${index}.label`)}
                  {...form.getInputProps(`pwaScreenshots.${index}.label`)}
                />
              </Stack>
              <ActionIcon color='red' variant='subtle' onClick={() => form.removeListItem('pwaScreenshots', index)}>
                <FontAwesomeIcon icon={faTrash} />
              </ActionIcon>
            </Group>
          </Card>
        ))}

        <Group>
          <Button
            variant='light'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
            disabled={form.values.pwaScreenshots.length >= 8}
            onClick={() =>
              form.insertListItem('pwaScreenshots', { src: '', sizes: '', type: null, formFactor: null, label: null })
            }
          >
            {t('pages.admin.settings.tabs.metadata.page.button.addScreenshot', {})}
          </Button>
        </Group>
      </Stack>
    </TitleCard>
  );
}
