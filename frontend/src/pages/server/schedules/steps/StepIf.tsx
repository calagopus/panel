import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Stack from '@/elements/Stack.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import ScheduleConditionBuilder from '../ScheduleConditionBuilder.tsx';

export default function StepIf({ form }: { form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>> }) {
  return (
    <Stack>
      <ScheduleConditionBuilder
        condition={form.getInputProps('action.condition').value}
        onChange={(condition) => form.setFieldValue('action.condition', condition)}
      />
    </Stack>
  );
}
