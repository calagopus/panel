import { Input, Text, UnstyledButton } from '@mantine/core';
import { ReactNode, useState } from 'react';
import { makeComponentHookable } from 'shared';
import Group from '@/elements/Group.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Mode = 'text' | 'json';

function jsonType(value: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'string';
}

interface JsonInputProps {
  label?: string;
  withAsterisk?: boolean;
  // The parent form is uncontrolled, so the initial value arrives as `defaultValue`.
  defaultValue?: JsonValue;
  value?: JsonValue;
  onChange: (value: JsonValue) => void;
  error?: ReactNode;
}

function JsonInput({ label, withAsterisk, defaultValue, value: controlledValue, onChange, error }: JsonInputProps) {
  const { t } = useTranslations();

  const initial = controlledValue ?? defaultValue ?? '';
  const [value, setValue] = useState<JsonValue>(initial);
  const [mode, setMode] = useState<Mode>(typeof initial === 'string' ? 'text' : 'json');
  const [draft, setDraft] = useState(() => (typeof initial === 'string' ? '' : JSON.stringify(initial, null, 2)));
  const [parseError, setParseError] = useState(false);

  const typeLabels: Record<ReturnType<typeof jsonType>, string> = {
    string: t('common.elements.jsonInput.enum.type.string', {}),
    number: t('common.elements.jsonInput.enum.type.number', {}),
    boolean: t('common.elements.jsonInput.enum.type.boolean', {}),
    object: t('common.elements.jsonInput.enum.type.object', {}),
    array: t('common.elements.jsonInput.enum.type.array', {}),
    null: t('common.elements.jsonInput.enum.type.null', {}),
  };

  const modes: { value: Mode; label: string }[] = [
    { value: 'text', label: t('common.elements.jsonInput.textMode', {}) },
    { value: 'json', label: t('common.elements.jsonInput.jsonMode', {}) },
  ];

  const commit = (next: JsonValue) => {
    setValue(next);
    onChange(next);
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;

    if (next === 'json') {
      setDraft(JSON.stringify(value, null, 2));
      setParseError(false);
    } else {
      commit(typeof value === 'string' ? value : JSON.stringify(value));
    }

    setMode(next);
  };

  const handleJsonChange = (text: string) => {
    setDraft(text);

    try {
      commit(JSON.parse(text) as JsonValue);
      setParseError(false);
    } catch {
      setParseError(true);
    }
  };

  return (
    <Stack gap={4}>
      <Group justify='space-between' align='center' gap='xs' wrap='nowrap'>
        {label ? <Input.Label required={withAsterisk}>{label}</Input.Label> : <span />}
        <Group gap={6} wrap='nowrap' align='center'>
          {mode === 'json' && (
            <Text size='xs' fw={600} c={parseError ? 'red' : 'dimmed'}>
              {parseError ? t('common.elements.jsonInput.invalidJson', {}) : typeLabels[jsonType(value)]}
            </Text>
          )}
          {modes.map(({ value: modeValue, label: modeLabel }) => (
            <UnstyledButton key={modeValue} onClick={() => changeMode(modeValue)}>
              <Text
                size='xs'
                fw={mode === modeValue ? 700 : 400}
                c={mode === modeValue ? 'var(--mantine-primary-color-filled)' : 'dimmed'}
              >
                {modeLabel}
              </Text>
            </UnstyledButton>
          ))}
        </Group>
      </Group>

      {mode === 'text' ? (
        <TextInput
          value={typeof value === 'string' ? value : JSON.stringify(value)}
          onChange={(e) => commit(e.target.value)}
          error={error}
        />
      ) : (
        <TextArea
          value={draft}
          onChange={(e) => handleJsonChange(e.target.value)}
          error={parseError ? t('common.elements.jsonInput.invalidJson', {}) : error}
          autosize
          minRows={2}
          spellCheck={false}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
      )}
    </Stack>
  );
}

export default makeComponentHookable(JsonInput);
