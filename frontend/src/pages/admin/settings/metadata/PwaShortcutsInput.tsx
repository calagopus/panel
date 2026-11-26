import { faArrowUpRightFromSquare, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type MetadataFormValues = z.infer<typeof adminSettingsMetadataSchema>;

export default function PwaShortcutsInput({ form }: { form: UseFormReturnType<MetadataFormValues> }) {
  const { t } = useTranslations();

  return (
    <TitleCard
      title={t('pages.admin.settings.tabs.metadata.page.form.pwaShortcuts', {})}
      icon={faArrowUpRightFromSquare}
    >
      <Stack>
        <Text size='sm' c='dimmed'>
          {t('pages.admin.settings.tabs.metadata.page.form.pwaShortcutsDescription', {})}
        </Text>

        {form.values.pwaShortcuts.map((_, index) => (
          <Card key={form.key(`pwaShortcuts.${index}`)} withBorder padding='md'>
            <Group align='flex-start' wrap='nowrap'>
              <Stack gap='xs' className='flex-1'>
                <TextInput
                  withAsterisk
                  label={t('common.form.name', {})}
                  key={form.key(`pwaShortcuts.${index}.name`)}
                  {...form.getInputProps(`pwaShortcuts.${index}.name`)}
                />
                <TextInput
                  label={t('pages.admin.settings.tabs.metadata.page.form.shortcutShortName', {})}
                  key={form.key(`pwaShortcuts.${index}.shortName`)}
                  {...form.getInputProps(`pwaShortcuts.${index}.shortName`)}
                />
                <TextInput
                  withAsterisk
                  label={t('pages.admin.settings.tabs.metadata.page.form.shortcutUrl', {})}
                  placeholder='/admin'
                  key={form.key(`pwaShortcuts.${index}.url`)}
                  {...form.getInputProps(`pwaShortcuts.${index}.url`)}
                />
                <TextInput
                  label={t('common.form.description', {})}
                  key={form.key(`pwaShortcuts.${index}.description`)}
                  {...form.getInputProps(`pwaShortcuts.${index}.description`)}
                />
              </Stack>
              <ActionIcon color='red' variant='subtle' onClick={() => form.removeListItem('pwaShortcuts', index)}>
                <FontAwesomeIcon icon={faTrash} />
              </ActionIcon>
            </Group>
          </Card>
        ))}

        <Group>
          <Button
            variant='light'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
            disabled={form.values.pwaShortcuts.length >= 10}
            onClick={() =>
              form.insertListItem('pwaShortcuts', { name: '', shortName: null, url: '/', description: null })
            }
          >
            {t('pages.admin.settings.tabs.metadata.page.button.addShortcut', {})}
          </Button>
        </Group>
      </Stack>
    </TitleCard>
  );
}
