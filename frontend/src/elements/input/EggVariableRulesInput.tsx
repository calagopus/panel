import { Combobox, Input, Pill, PillsInput, Popover, Text, UnstyledButton, useCombobox } from '@mantine/core';
import { ReactNode, useEffect, useState } from 'react';
import { makeComponentHookable } from 'shared';
import Button from '@/elements/buttons/Button.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { RuleDefinition, RuleValidator, useRuleValidator } from '@/lib/ruleValidator.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Mode = 'editor' | 'text';

interface Props {
  label?: ReactNode;
  description?: string;
  error?: ReactNode;
  value?: string[];
  onChange: (rules: string[]) => void;
  envVariables: string[];
}

interface Editor {
  definition: RuleDefinition;
  slots: string[];
  index: number | null;
  attempted: boolean;
}

interface Problem {
  message: string;
  color: 'red' | 'orange';
}

const VERSIONS = ['1', '2', '3', '4', '5', '6', '7', '8', 'max'];
const MONOSPACE = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } };
const NO_PORTAL = { withinPortal: false };

const parseRule = (rule: string): [string, string] => {
  const separator = rule.indexOf(':');

  return separator === -1 ? [rule, ''] : [rule.slice(0, separator), rule.slice(separator + 1)];
};

const findDefinition = (catalog: RuleDefinition[], name: string) =>
  catalog.find((definition) => definition.name === name || definition.aliases.includes(name));

// argument slots are joined with ',' to rebuild the rule
const toSlots = (definition: RuleDefinition, args: string): string[] => {
  switch (definition.arguments) {
    case 'none':
      return [];
    case 'numberRange':
      return args.split(',').slice(0, 2);
    case 'fieldValues': {
      const [field, ...values] = args.split(',');
      return [field, values.join(',')];
    }
    default:
      return [args];
  }
};

const composeRule = (definition: RuleDefinition, slots: string[]): string => {
  const args = slots.filter((slot) => slot !== '').join(',');

  return args ? `${definition.name}:${args}` : definition.name;
};

const referencedVariables = (definition: RuleDefinition, args: string): string[] => {
  switch (definition.arguments) {
    case 'field':
    case 'fieldValues':
      return args ? [args.split(',')[0]] : [];
    case 'fields':
      return args ? args.split(',') : [];
    default:
      return [];
  }
};

// Laravel-style `a|b` strings, gluing back regex rules whose pattern contains a `|`
const splitRules = (text: string, validator: RuleValidator): string[] => {
  const pieces = text
    .replace(/\r?\n/g, '|')
    .split('|')
    .map((piece) => piece.trim())
    .filter(Boolean);

  const rules: string[] = [];
  for (let index = 0; index < pieces.length; index++) {
    let rule = pieces[index];

    if ((rule.startsWith('regex:') || rule.startsWith('not_regex:')) && validator.checkRule(rule)) {
      for (let end = index + 1; end < pieces.length; end++) {
        const candidate = pieces.slice(index, end + 1).join('|');
        if (!validator.checkRule(candidate)) {
          rule = candidate;
          index = end;
          break;
        }
      }
    }

    rules.push(rule);
  }

  return rules;
};

function EggVariableRulesInput({ label, description, error, value = [], onChange, envVariables }: Props) {
  const { t } = useTranslations();
  const validator = useRuleValidator();
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  const [mode, setMode] = useState<Mode>('editor');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (search) combobox.selectFirstOption();
  }, [search]);

  if (!validator) {
    return <TagsInput label={label} description={description} error={error} value={value} onChange={onChange} />;
  }

  const variableOptions = envVariables.filter(Boolean);

  const argumentHint = (definition: RuleDefinition): string | null => {
    switch (definition.arguments) {
      case 'none':
        return null;
      case 'flag':
        return t('common.elements.eggVariableRulesInput.flag', { flag: definition.flag ?? '' });
      case 'number':
        return t('common.elements.eggVariableRulesInput.value', {});
      case 'numberRange':
        return `${t('common.elements.eggVariableRulesInput.minimum', {})}, ${t('common.elements.eggVariableRulesInput.maximum', {})}`;
      case 'version':
        return t('common.elements.eggVariableRulesInput.version', {});
      case 'field':
        return t('common.elements.eggVariableRulesInput.variable', {});
      case 'fields':
        return t('common.elements.eggVariableRulesInput.variables', {});
      case 'fieldValues':
        return `${t('common.elements.eggVariableRulesInput.variable', {})}, ${t('common.elements.eggVariableRulesInput.values', {})}`;
      case 'values':
        return t('common.elements.eggVariableRulesInput.values', {});
      case 'formats':
        return t('common.elements.eggVariableRulesInput.formats', {});
      case 'pattern':
        return t('common.elements.eggVariableRulesInput.pattern', {});
    }
  };

  const ruleProblem = (rule: string): Problem | null => {
    const ruleError = validator.checkRule(rule);
    if (ruleError) return { message: ruleError, color: 'red' };

    const [ruleName, args] = parseRule(rule);
    const definition = findDefinition(validator.catalog, ruleName);
    const unknown = definition
      ? referencedVariables(definition, args).find((variable) => !variableOptions.includes(variable))
      : undefined;

    return unknown
      ? { message: t('common.elements.eggVariableRulesInput.unknownVariable', { variable: unknown }), color: 'orange' }
      : null;
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;

    if (next === 'text') {
      setDraft(value.join('|'));
      setEditor(null);
    }

    setMode(next);
  };

  const addRule = (rule: string) => {
    onChange([...value, rule]);
    setSearch('');
    setSearchError(null);
  };

  const submitOption = (option: string) => {
    const definition = option.includes(':') ? undefined : findDefinition(validator.catalog, option);

    if (definition && definition.arguments !== 'none') {
      setEditor({ definition, slots: [], index: null, attempted: false });
      setSearch('');
      combobox.closeDropdown();
      return;
    }

    const ruleError = validator.checkRule(option);
    if (ruleError) {
      setSearchError(ruleError);
      return;
    }

    addRule(option);
  };

  const openEditor = (index: number) => {
    const [ruleName, args] = parseRule(value[index]);
    const definition = findDefinition(validator.catalog, ruleName);
    if (!definition) return;

    combobox.closeDropdown();
    setEditor({ definition, slots: toSlots(definition, args), index, attempted: false });
  };

  const removeRule = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    setEditor(null);
  };

  const commitEditor = () => {
    if (!editor) return;

    const rule = composeRule(editor.definition, editor.slots);
    if (validator.checkRule(rule)) {
      setEditor({ ...editor, attempted: true });
      return;
    }

    onChange(
      editor.index === null ? [...value, rule] : value.map((current, i) => (i === editor.index ? rule : current)),
    );
    setEditor(null);
  };

  const setSlot = (index: number, slot: string) =>
    setEditor((current) => {
      if (!current) return current;

      const slots = [...current.slots];
      slots[index] = slot;
      return { ...current, slots };
    });

  const searchName = parseRule(search.trim())[0];
  const matches = (definition: RuleDefinition, match: (name: string) => boolean) =>
    match(definition.name) || definition.aliases.some(match);
  const options = search.includes(':')
    ? []
    : searchName
      ? [
          ...validator.catalog.filter((definition) => matches(definition, (name) => name.startsWith(searchName))),
          ...validator.catalog.filter(
            (definition) =>
              !matches(definition, (name) => name.startsWith(searchName)) &&
              matches(definition, (name) => name.includes(searchName)),
          ),
        ]
      : validator.catalog;

  const renderArguments = (current: Editor) => {
    const { definition, slots } = current;

    const variableInput = (slot: number, inputLabel: string) => (
      <Autocomplete
        label={inputLabel}
        data={variableOptions}
        value={slots[slot] ?? ''}
        onChange={(next) => setSlot(slot, next)}
        comboboxProps={NO_PORTAL}
      />
    );
    const listInput = (slot: number, inputLabel: string, placeholder?: string) => (
      <TextInput
        label={inputLabel}
        description={t('common.elements.eggVariableRulesInput.commaSeparated', {})}
        placeholder={placeholder}
        value={slots[slot] ?? ''}
        onChange={(e) => setSlot(slot, e.target.value)}
      />
    );

    switch (definition.arguments) {
      case 'none':
        return null;
      case 'flag':
        return (
          <Checkbox
            label={t('common.elements.eggVariableRulesInput.flag', { flag: definition.flag ?? '' })}
            checked={slots[0] === definition.flag}
            onChange={(e) => setSlot(0, e.target.checked ? (definition.flag ?? '') : '')}
          />
        );
      case 'number':
        return (
          <NumberInput
            label={t('common.elements.eggVariableRulesInput.value', {})}
            value={slots[0] ?? ''}
            onChange={(next) => setSlot(0, String(next))}
            data-autofocus
          />
        );
      case 'numberRange':
        return (
          <Group grow>
            <NumberInput
              label={t('common.elements.eggVariableRulesInput.minimum', {})}
              value={slots[0] ?? ''}
              onChange={(next) => setSlot(0, String(next))}
              data-autofocus
            />
            <NumberInput
              label={t('common.elements.eggVariableRulesInput.maximum', {})}
              value={slots[1] ?? ''}
              onChange={(next) => setSlot(1, String(next))}
            />
          </Group>
        );
      case 'version':
        return (
          <Select
            label={t('common.elements.eggVariableRulesInput.version', {})}
            data={VERSIONS}
            value={slots[0] || null}
            onChange={(next) => setSlot(0, next ?? '')}
            allowDeselect
            comboboxProps={NO_PORTAL}
          />
        );
      case 'field':
        return variableInput(0, t('common.elements.eggVariableRulesInput.variable', {}));
      case 'fields':
        return (
          <MultiSelect
            label={t('common.elements.eggVariableRulesInput.variables', {})}
            data={variableOptions}
            value={slots[0] ? slots[0].split(',') : []}
            onChange={(next) => setSlot(0, next.join(','))}
            comboboxProps={NO_PORTAL}
          />
        );
      case 'fieldValues':
        return (
          <>
            {variableInput(0, t('common.elements.eggVariableRulesInput.variable', {}))}
            {listInput(1, t('common.elements.eggVariableRulesInput.values', {}))}
          </>
        );
      case 'values':
        return listInput(0, t('common.elements.eggVariableRulesInput.values', {}));
      case 'formats':
        return listInput(0, t('common.elements.eggVariableRulesInput.formats', {}), 'Y-m-d,H:i');
      case 'pattern':
        return (
          <TextInput
            label={t('common.elements.eggVariableRulesInput.pattern', {})}
            placeholder='/^[a-z0-9_]+$/i'
            value={slots[0] ?? ''}
            onChange={(e) => setSlot(0, e.target.value)}
            styles={MONOSPACE}
            data-autofocus
          />
        );
    }
  };

  const problems = value.flatMap((rule) => {
    const problem = ruleProblem(rule);
    return problem ? [{ rule, ...problem }] : [];
  });

  const editorRule = editor ? composeRule(editor.definition, editor.slots) : null;
  const editorError = editor && editorRule ? validator.checkRule(editorRule) : null;

  const modes: { value: Mode; label: string }[] = [
    { value: 'editor', label: t('common.elements.eggVariableRulesInput.editorMode', {}) },
    { value: 'text', label: t('common.elements.eggVariableRulesInput.textMode', {}) },
  ];

  return (
    <Stack gap={4}>
      <Group justify='space-between' align='center' gap='xs' wrap='nowrap'>
        {label ? <Input.Label>{label}</Input.Label> : <span />}
        <Group gap={6} wrap='nowrap' align='center'>
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
      {description && <Input.Description>{description}</Input.Description>}

      {mode === 'text' ? (
        <TextArea
          description={t('common.elements.eggVariableRulesInput.textDescription', {})}
          placeholder='required|string|max:20'
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(splitRules(e.target.value, validator));
          }}
          autosize
          minRows={2}
          spellCheck={false}
          styles={MONOSPACE}
        />
      ) : (
        <Popover
          opened={editor !== null}
          onDismiss={() => setEditor(null)}
          position='bottom-start'
          width='target'
          trapFocus
          shadow='md'
        >
          <Popover.Target>
            <div>
              <Combobox store={combobox} onOptionSubmit={submitOption}>
                <Combobox.DropdownTarget>
                  <PillsInput
                    onClick={() => combobox.openDropdown()}
                    error={!!error || problems.some((problem) => problem.color === 'red')}
                  >
                    <Pill.Group>
                      {value.map((rule, index) => {
                        const problem = ruleProblem(rule);
                        const pill = (
                          <Pill
                            key={`${index}-${rule}`}
                            withRemoveButton
                            onRemove={() => removeRule(index)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if ((e.target as HTMLElement).closest('.mantine-Pill-remove')) return;
                              openEditor(index);
                            }}
                            ff='monospace'
                            bg={problem ? `var(--mantine-color-${problem.color}-light)` : undefined}
                            c={problem ? `var(--mantine-color-${problem.color}-light-color)` : undefined}
                            className='cursor-pointer'
                          >
                            {rule}
                          </Pill>
                        );

                        return problem ? (
                          <Tooltip key={`${index}-${rule}`} label={problem.message}>
                            {pill}
                          </Tooltip>
                        ) : (
                          pill
                        );
                      })}
                      <Combobox.EventsTarget>
                        <PillsInput.Field
                          value={search}
                          placeholder={
                            value.length === 0 ? t('common.elements.eggVariableRulesInput.addRule', {}) : undefined
                          }
                          onFocus={() => combobox.openDropdown()}
                          onBlur={() => combobox.closeDropdown()}
                          onChange={(e) => {
                            setSearch(e.currentTarget.value);
                            setSearchError(null);
                            combobox.openDropdown();
                            combobox.updateSelectedOptionIndex();
                          }}
                          onKeyDown={(e) => {
                            // the field lives inside the egg variable form, Enter must never submit it
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            } else if (e.key === 'Backspace' && search === '' && value.length > 0) {
                              e.preventDefault();
                              removeRule(value.length - 1);
                            }
                          }}
                          ff='monospace'
                        />
                      </Combobox.EventsTarget>
                    </Pill.Group>
                  </PillsInput>
                </Combobox.DropdownTarget>

                <Combobox.Dropdown>
                  <Combobox.Options mah={260} style={{ overflowY: 'auto' }}>
                    {search.includes(':') ? (
                      <Combobox.Option value={search.trim()}>
                        <Text size='sm' ff='monospace'>
                          {t('common.button.add', {})} {search.trim()}
                        </Text>
                      </Combobox.Option>
                    ) : options.length === 0 ? (
                      <Combobox.Empty>{t('elements.selectInput.noResults', {})}</Combobox.Empty>
                    ) : (
                      options.map((definition) => (
                        <Combobox.Option key={definition.name} value={definition.name}>
                          <Group justify='space-between' wrap='nowrap' gap='xs'>
                            <Text size='sm' ff='monospace'>
                              {definition.name}
                            </Text>
                            {argumentHint(definition) && (
                              <Text size='xs' c='dimmed' truncate>
                                {argumentHint(definition)}
                              </Text>
                            )}
                          </Group>
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>
            </div>
          </Popover.Target>

          <Popover.Dropdown>
            {editor && (
              <Stack gap='xs'>
                <Text size='sm' fw={600} ff='monospace'>
                  {editor.definition.name}
                </Text>
                {renderArguments(editor)}
                <Text size='xs' ff='monospace' c={editor.attempted && editorError ? 'red' : 'dimmed'}>
                  {editor.attempted && editorError ? editorError : editorRule}
                </Text>
                <Group gap='xs' justify='flex-end'>
                  {editor.index !== null && (
                    <Button size='xs' variant='subtle' color='red' onClick={() => removeRule(editor.index!)}>
                      {t('common.button.remove', {})}
                    </Button>
                  )}
                  <Button size='xs' variant='default' onClick={() => setEditor(null)}>
                    {t('common.button.cancel', {})}
                  </Button>
                  <Button size='xs' onClick={commitEditor}>
                    {editor.index === null ? t('common.button.add', {}) : t('common.button.update', {})}
                  </Button>
                </Group>
              </Stack>
            )}
          </Popover.Dropdown>
        </Popover>
      )}

      {searchError && <Input.Error>{searchError}</Input.Error>}
      {problems.map((problem, index) => (
        <Text key={`${index}-${problem.rule}`} size='xs' c={problem.color}>
          <Text span ff='monospace' size='xs'>
            {problem.rule}
          </Text>
          : {problem.message}
        </Text>
      ))}
      {error && <Input.Error>{error}</Input.Error>}
    </Stack>
  );
}

export default makeComponentHookable(EggVariableRulesInput);
