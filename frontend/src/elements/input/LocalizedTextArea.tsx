import { Box, Group, Select, Textarea, type TextareaProps } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

interface LocalizedTextAreaProps extends Omit<TextareaProps, 'value' | 'onChange'> {
  languages: string[];
  value: string | null;
  setValue: (value: string | null) => void;
  valueTranslations: Record<string, string>;
  setValueTranslations: (translations: Record<string, string>) => void;
  languageLabels?: Record<string, string>;
  placeholders?: Record<string, string>;
}

const EN = 'en';

const getLanguageName = (code: string, overrides?: Record<string, string>): string => {
  if (overrides?.[code]) return overrides[code];
  try {
    const name = new Intl.DisplayNames([getTranslations().language], { type: 'language' }).of(code);
    return name ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
};

function LocalizedTextArea({
  languages,
  value,
  setValue,
  valueTranslations,
  setValueTranslations,
  languageLabels,
  placeholders,
  label,
  disabled,
  required,
  withAsterisk,
  ...textareaProps
}: LocalizedTextAreaProps) {
  const isRequired = typeof withAsterisk === 'boolean' ? withAsterisk : required;
  const allLanguages = useMemo(() => {
    const codes = [EN, ...languages.filter((c) => c !== EN)];
    return [...new Set(codes)];
  }, [languages]);

  const [selectedLang, setSelectedLang] = useState<string>(EN);

  const selectData = useMemo(
    () =>
      allLanguages.map((code) => ({
        value: code,
        label: getLanguageName(code, languageLabels),
      })),
    [allLanguages, languageLabels],
  );

  const isEnglish = selectedLang === EN;
  const currentValue = isEnglish ? (value ?? '') : (valueTranslations[selectedLang] ?? '');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.currentTarget.value;

      if (isEnglish) {
        setValue(v === '' ? null : v);
      } else {
        const next = { ...valueTranslations };
        if (v === '') {
          delete next[selectedLang];
        } else {
          next[selectedLang] = v;
        }
        setValueTranslations(next);
      }
    },
    [isEnglish, selectedLang, setValue, valueTranslations, setValueTranslations],
  );

  return (
    <Textarea
      {...textareaProps}
      label={
        <Group justify='space-between' align='center' wrap='nowrap' gap='xs' w='100%'>
          <Box style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            {label}
            {isRequired && (
              <span aria-hidden style={{ color: 'var(--input-asterisk-color, var(--mantine-color-error))' }}>
                &nbsp;*
              </span>
            )}
          </Box>
          <Select
            data={selectData}
            value={selectedLang}
            onChange={(v) => setSelectedLang(v ?? EN)}
            allowDeselect={false}
            size='xs'
            w={130}
            comboboxProps={{ withinPortal: true }}
            disabled={disabled}
            aria-label='Language'
            styles={{
              input: {
                fontWeight: 500,
                fontSize: 'var(--mantine-font-size-xs)',
              },
            }}
          />
        </Group>
      }
      labelProps={{ labelElement: 'div', style: { display: 'block', width: '100%' } }}
      value={currentValue}
      placeholder={placeholders?.[selectedLang] ?? (typeof label === 'string' ? label : undefined)}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}

export default makeComponentHookable(LocalizedTextArea);
