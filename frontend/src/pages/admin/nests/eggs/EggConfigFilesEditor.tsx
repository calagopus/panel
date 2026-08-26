import { faFileText, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { processConfigurationParserLabelMapping } from '@/lib/enums.ts';
import { adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggConfigFileReplaceEditor from './EggConfigFileReplaceEditor.tsx';

export default function EggConfigFilesEditor({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminEggUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <TitleCard
      title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.card.configFiles', {})}
      icon={<FontAwesomeIcon icon={faFileText} size='sm' />}
    >
      {form.getValues().configFiles.length === 0 ? (
        <p className='mb-2'>{t('pages.admin.nests.tabs.eggs.page.tabs.general.page.emptyConfigFiles', {})}</p>
      ) : (
        form.getValues().configFiles.map((_, index) => (
          <Card key={index} className='flex flex-row! justify-between mb-2'>
            <Stack w='100%'>
              <Group grow>
                <TextInput
                  withAsterisk
                  label={t('common.form.filePath', {})}
                  key={form.key(`configFiles.${index}.file`)}
                  {...form.getInputProps(`configFiles.${index}.file`)}
                />
                <Select
                  withAsterisk
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.parser', {})}
                  data={Object.entries(processConfigurationParserLabelMapping).map(([value, label]) => ({
                    label,
                    value,
                  }))}
                  key={form.key(`configFiles.${index}.parser`)}
                  {...form.getInputProps(`configFiles.${index}.parser`)}
                />
              </Group>

              <Switch
                label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.createNewFile', {})}
                description={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.createNewFileDescription', {})}
                key={form.key(`configFiles.${index}.createNew`)}
                {...form.getInputProps(`configFiles.${index}.createNew`, {
                  type: 'checkbox',
                })}
              />

              <EggConfigFileReplaceEditor form={form} configFileIndex={index} />
            </Stack>

            <ActionIcon
              color='red'
              variant='light'
              size='input-md'
              className='ml-4'
              onClick={() =>
                form.setValues({
                  ...form.getValues(),
                  configFiles: form.getValues().configFiles.filter((_, i) => i !== index),
                })
              }
            >
              <FontAwesomeIcon icon={faMinus} />
            </ActionIcon>
          </Card>
        ))
      )}

      <Button
        variant='light'
        onClick={() =>
          form.setValues({
            ...form.getValues(),
            configFiles: [
              ...form.getValues().configFiles,
              {
                file: '',
                parser: 'file',
                createNew: true,
                replace: [],
              },
            ],
          })
        }
        className='w-fit!'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
      >
        {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.addConfigFile', {})}
      </Button>
    </TitleCard>
  );
}
