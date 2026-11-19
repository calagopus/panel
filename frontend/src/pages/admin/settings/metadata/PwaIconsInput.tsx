import { faIcons, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import PwaImageFields from './PwaImageFields.tsx';

type MetadataFormValues = z.infer<typeof adminSettingsMetadataSchema>;

export default function PwaIconsInput({
  form,
  assetUrls,
}: {
  form: UseFormReturnType<MetadataFormValues>;
  assetUrls: string[];
}) {
  const { t } = useTranslations();

  return (
    <TitleCard title={t('pages.admin.settings.tabs.metadata.page.form.pwaIcons', {})} icon={faIcons}>
      <Stack>
        <Text size='sm' c='dimmed'>
          {t('pages.admin.settings.tabs.metadata.page.form.pwaIconsDescription', {})}
        </Text>

        {form.values.pwaIcons.map((_, index) => (
          <Card key={form.key(`pwaIcons.${index}`)} withBorder padding='md'>
            <Group align='flex-start' wrap='nowrap'>
              <Stack gap='xs' className='flex-1'>
                <PwaImageFields form={form} path={`pwaIcons.${index}`} assetUrls={assetUrls} />
                <Select
                  withAsterisk
                  label={t('pages.admin.settings.tabs.metadata.page.form.iconPurpose', {})}
                  data={[
                    { label: t('pages.admin.settings.tabs.metadata.page.enum.iconPurpose.any', {}), value: 'any' },
                    {
                      label: t('pages.admin.settings.tabs.metadata.page.enum.iconPurpose.maskable', {}),
                      value: 'maskable',
                    },
                    {
                      label: t('pages.admin.settings.tabs.metadata.page.enum.iconPurpose.monochrome', {}),
                      value: 'monochrome',
                    },
                  ]}
                  key={form.key(`pwaIcons.${index}.purpose`)}
                  {...form.getInputProps(`pwaIcons.${index}.purpose`)}
                />
              </Stack>
              <ActionIcon color='red' variant='subtle' onClick={() => form.removeListItem('pwaIcons', index)}>
                <FontAwesomeIcon icon={faTrash} />
              </ActionIcon>
            </Group>
          </Card>
        ))}

        <Group>
          <Button
            variant='light'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
            disabled={form.values.pwaIcons.length >= 8}
            onClick={() => form.insertListItem('pwaIcons', { src: '', sizes: '', type: null, purpose: 'any' })}
          >
            {t('pages.admin.settings.tabs.metadata.page.button.addIcon', {})}
          </Button>
        </Group>
      </Stack>
    </TitleCard>
  );
}
