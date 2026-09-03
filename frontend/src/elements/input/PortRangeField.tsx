import { UseFormReturnType } from '@mantine/form';
import Group from '@/elements/layout/Group.tsx';
import NumberInput from './NumberInput.tsx';

interface PortRangeFieldProps<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  startPath: string;
  endPath: string;
  startLabel: string;
  endLabel: string;
  min?: number;
  max?: number;
}

export default function PortRangeField<T extends Record<string, unknown>>({
  form,
  startPath,
  endPath,
  startLabel,
  endLabel,
  min = 1,
  max = 65535,
}: PortRangeFieldProps<T>) {
  const f = form as UseFormReturnType<Record<string, unknown>>;

  return (
    <Group grow>
      <NumberInput
        label={startLabel}
        placeholder={String(min)}
        min={min}
        max={max}
        key={f.key(startPath)}
        {...f.getInputProps(startPath)}
      />
      <NumberInput
        label={endLabel}
        placeholder={String(max)}
        min={min}
        max={max}
        key={f.key(endPath)}
        {...f.getInputProps(endPath)}
      />
    </Group>
  );
}
