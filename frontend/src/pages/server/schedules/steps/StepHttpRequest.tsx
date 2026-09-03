import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Title from '@/elements/typography/Title.tsx';
import { scheduleHttpMethodLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepHttpRequestSchema, serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepHttpRequest({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <Select
        withAsterisk
        label={t('pages.server.schedules.steps.httpRequest.form.method', {})}
        data={Object.entries(scheduleHttpMethodLabelMapping).map(([value, label]) => ({
          value,
          label,
        }))}
        {...form.getInputProps('action.method')}
      />

      <TextInput
        withAsterisk
        label={t('common.form.url', {})}
        placeholder={t('common.form.url', {})}
        {...form.getInputProps('action.url')}
      />

      <div>
        <Title order={4} mb='sm'>
          {t('pages.server.schedules.steps.httpRequest.form.headers', {})}
        </Title>
        {(form.values.action as z.infer<typeof serverScheduleStepHttpRequestSchema>).headers.map((_, index) => (
          <div key={`header-${index}`} className='flex flex-row items-end space-x-2 mb-2'>
            <TextInput
              withAsterisk
              label={t('pages.server.schedules.steps.httpRequest.form.headerName', {})}
              placeholder={t('pages.server.schedules.steps.httpRequest.form.headerName', {})}
              {...form.getInputProps(`action.headers.${index}.name`)}
            />

            <ScheduleDynamicParameterInput
              label={t('pages.server.schedules.steps.httpRequest.form.headerValue', {})}
              placeholder={t('pages.server.schedules.steps.httpRequest.form.headerValue', {})}
              value={form.getInputProps(`action.headers.${index}.value`).value}
              error={form.getInputProps(`action.headers.${index}.value`).error}
              onChange={(v) => form.setFieldValue(`action.headers.${index}.value`, v)}
            />

            <ActionIcon
              size='input-sm'
              color='red'
              variant='light'
              onClick={() => form.removeListItem('action.headers', index)}
            >
              <FontAwesomeIcon icon={faMinus} />
            </ActionIcon>
          </div>
        ))}

        <Button
          onClick={() => form.insertListItem('action.headers', { name: '', value: '' })}
          variant='light'
          leftSection={<FontAwesomeIcon icon={faPlus} />}
        >
          {t('pages.server.schedules.button.addHeader', {})}
        </Button>
      </div>

      <ScheduleDynamicParameterInput
        textArea
        allowNull
        label={t('pages.server.schedules.steps.httpRequest.form.body', {})}
        value={form.getInputProps('action.body').value}
        error={form.getInputProps('action.body').error}
        onChange={(v) => form.setFieldValue('action.body', v)}
      />

      <NumberInput
        withAsterisk
        label={t('pages.server.schedules.steps.httpRequest.form.timeout', {})}
        placeholder='10000'
        min={1}
        max={60000}
        {...form.getInputProps('action.timeout')}
      />

      <ScheduleDynamicParameterInput
        allowNull
        output
        allowString={false}
        label={t('pages.server.schedules.steps.httpRequest.form.outputStatusInto', {})}
        value={form.getInputProps('action.outputStatusInto').value}
        error={form.getInputProps('action.outputStatusInto').error}
        onChange={(v) => form.setFieldValue('action.outputStatusInto', v)}
      />

      <ScheduleDynamicParameterInput
        allowNull
        output
        allowString={false}
        label={t('pages.server.schedules.steps.httpRequest.form.outputBodyInto', {})}
        value={form.getInputProps('action.outputBodyInto').value}
        error={form.getInputProps('action.outputBodyInto').error}
        onChange={(v) => form.setFieldValue('action.outputBodyInto', v)}
      />

      <Switch
        label={t('pages.server.schedules.steps.httpRequest.form.ignoreErrorStatus', {})}
        {...form.getInputProps('action.ignoreErrorStatus', { type: 'checkbox' })}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
