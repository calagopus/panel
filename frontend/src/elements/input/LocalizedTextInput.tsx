import { Box, Select, TextInput, type TextInputProps } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

interface LocalizedTextInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
  languages: string[];
  value: string | null;
  setValue: (value: string | null) => void;
  valueTranslations: Record<string, string>;
  setValueTranslations: (translations: Record<string, string>) => void;
  languageLabels?: Record<string, string>;
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

function LocalizedTextInput({
  languages,
  value,
  setValue,
  valueTranslations,
  setValueTranslations,
  languageLabels,
  label,
  disabled,
  ...inputProps
}: LocalizedTextInputProps) {
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <Box pos='relative'>
      <TextInput {...inputProps} label={label} value={currentValue} onChange={handleChange} disabled={disabled} />
      <Select
        data={selectData}
        value={selectedLang}
        onChange={(v) => setSelectedLang(v ?? EN)}
        allowDeselect={false}
        size='sm'
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
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
        }}
      />
    </Box>
  );
}

export default makeComponentHookable(LocalizedTextInput);
