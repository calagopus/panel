import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import JsonInput from '@/elements/input/JsonInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import { adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggConfigFileReplaceEditor({
  form,
  index,
}: {
  form: UseFormReturnType<z.infer<typeof adminEggUpdateSchema>>;
  index: number;
}) {
  const { t } = useTranslations();

  return (
    <div className='flex flex-col'>
      {form.getValues().configFiles[index].replace.length === 0 ? (
        <p className='mb-2'>{t('pages.admin.nests.tabs.eggs.page.tabs.general.page.emptyReplacements', {})}</p>
      ) : (
        form.getValues().configFiles[index].replace.map((_, replaceIndex) => (
          <Card key={replaceIndex} className='flex flex-row! mb-2'>
            <div className='flex flex-col w-full'>
              <Group grow w='100%' align='flex-start'>
                <TextInput
                  withAsterisk
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.match', {})}
                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.match`)}
                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.match`)}
                />
                <TextInput
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.ifValue', {})}
                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                />
                <JsonInput
                  withAsterisk
                  label={t('common.form.replaceWith', {})}
                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                />
              </Group>
              <Group grow mt='md'>
                <Switch
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.insertNew', {})}
                  description={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.insertNewDescription', {})}
                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.insertNew`)}
                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.insertNew`, {
                    type: 'checkbox',
                  })}
                />
                <Switch
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.updateExisting', {})}
                  description={t(
                    'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.updateExistingDescription',
                    {},
                  )}
                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.updateExisting`)}
                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.updateExisting`, {
                    type: 'checkbox',
                  })}
                />
              </Group>
            </div>

            <ActionIcon
              color='red'
              variant='light'
              size='input-md'
              className='ml-4'
              onClick={() => form.removeListItem(`configFiles.${index}.replace`, replaceIndex)}
            >
              <FontAwesomeIcon icon={faMinus} />
            </ActionIcon>
          </Card>
        ))
      )}

      <Button
        variant='light'
        onClick={() =>
          form.insertListItem(`configFiles.${index}.replace`, {
            match: '',
            insertNew: false,
            updateExisting: true,
            ifValue: null,
            replaceWith: '',
          })
        }
        className='w-fit!'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
      >
        {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.addReplacement', {})}
      </Button>
    </div>
  );
}
