import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Title from '@/elements/typography/Title.tsx';
import { serverScheduleStepMatchRegexSchema, serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepMatchRegex({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.steps.matchRegex.form.input', {})}
        placeholder={t('pages.server.schedules.steps.matchRegex.form.input', {})}
        value={form.getInputProps('action.input').value}
        error={form.getInputProps('action.input').error}
        onChange={(v) => form.setFieldValue('action.input', v)}
      />

      <TextInput
        label={t('pages.server.schedules.steps.matchRegex.form.regex', {})}
        placeholder={t('pages.server.schedules.steps.matchRegex.form.regex', {})}
        {...form.getInputProps('action.regex')}
      />

      <div>
        <Title order={4} mb='sm'>
          {t('pages.server.schedules.steps.matchRegex.form.outputs', {})}
        </Title>
        {(form.values.action as z.infer<typeof serverScheduleStepMatchRegexSchema>).outputInto.map(
          (outputInto, index) => (
            <div key={`output-${index}`} className='flex flex-row items-end space-x-2 mb-2'>
              <ScheduleDynamicParameterInput
                label={t('pages.server.schedules.steps.matchRegex.form.outputNumber', { number: index + 1 })}
                allowNull
                output
                allowString={false}
                value={form.getInputProps(`action.outputInto.${index}`).value}
                error={form.getInputProps(`action.outputInto.${index}`).error}
                onChange={(v) => form.setFieldValue(`action.outputInto.${index}`, v)}
              />

              <ActionIcon
                size='input-sm'
                color='red'
                variant='light'
                onClick={() => form.removeListItem('action.outputInto', index)}
              >
                <FontAwesomeIcon icon={faMinus} />
              </ActionIcon>
            </div>
          ),
        )}

        <Button
          onClick={() => form.insertListItem('action.outputInto', { variable: '' })}
          variant='light'
          leftSection={<FontAwesomeIcon icon={faPlus} />}
        >
          {t('pages.server.schedules.button.addOutput', {})}
        </Button>
      </div>
    </Stack>
  );
}
