import { faCopy, faDice, faRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { makeComponentHookable } from 'shared';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  canGeneratePassword,
  DEFAULT_PASSWORD_GENERATOR_OPTIONS,
  generatePassword,
  isPasswordCharsetAllowed,
  PASSWORD_CHARSETS,
  type PasswordGeneratorConstraints,
  type PasswordGeneratorOptions,
  passwordGeneratorOptionsSchema,
  passwordLengthBounds,
  resolvePasswordOptions,
} from '@/lib/auth/passwordGenerator.ts';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface PasswordGeneratorPopoverProps {
  onGenerate: (password: string) => void;
  constraints?: PasswordGeneratorConstraints;
  disabled?: boolean;
}

function PasswordGeneratorPopover({ onGenerate, constraints, disabled }: PasswordGeneratorPopoverProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [opened, setOpened] = useState(false);
  const [options, setOptions] = useUserSetting(
    'passwords::generator',
    passwordGeneratorOptionsSchema,
    DEFAULT_PASSWORD_GENERATOR_OPTIONS,
  );
  const [password, setPassword] = useState('');

  const bounds = passwordLengthBounds(constraints);
  const resolved = resolvePasswordOptions(options, constraints) ?? options;

  const regenerate = (next: PasswordGeneratorOptions) =>
    setPassword(canGeneratePassword(next, constraints) ? generatePassword(next, constraints) : '');

  const updateOptions = (patch: Partial<PasswordGeneratorOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    regenerate(next);
  };

  const toggle = () => {
    if (!opened) regenerate(options);
    setOpened((o) => !o);
  };

  const use = () => {
    onGenerate(password);
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} width={320} position='bottom-end' shadow='md' withinPortal>
      <Popover.Target>
        <Tooltip label={t('common.elements.passwordGenerator.tooltip', {})} withArrow disabled={opened}>
          <ActionIcon
            variant='subtle'
            color='gray'
            disabled={disabled}
            aria-label={t('common.elements.passwordGenerator.tooltip', {})}
            onClick={toggle}
          >
            <FontAwesomeIcon icon={faDice} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap='sm'>
          <TextInput
            readOnly
            value={password}
            className='font-mono'
            {...ignorePasswordManagerProps}
            rightSectionWidth={60}
            rightSection={
              <Group gap={2} wrap='nowrap'>
                <ActionIcon
                  variant='subtle'
                  color='gray'
                  disabled={!password}
                  aria-label={t('common.button.copy', {})}
                  onClick={() => handleRawCopyToClipboard(password, addToast)}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </ActionIcon>
                <ActionIcon
                  variant='subtle'
                  color='gray'
                  disabled={!password}
                  aria-label={t('common.elements.passwordGenerator.button.regenerate', {})}
                  onClick={() => regenerate(options)}
                >
                  <FontAwesomeIcon icon={faRotate} />
                </ActionIcon>
              </Group>
            }
          />

          <NumberInput
            label={t('common.elements.passwordGenerator.length', {})}
            min={bounds?.[0]}
            max={bounds?.[1]}
            clampBehavior='strict'
            allowDecimal={false}
            disabled={bounds?.[0] === bounds?.[1]}
            value={resolved.length}
            onChange={(value) => {
              if (typeof value === 'number') updateOptions({ length: value });
            }}
          />

          <Stack gap='xs'>
            {PASSWORD_CHARSETS.map((charset) => (
              <Checkbox
                key={charset}
                label={t(`common.elements.passwordGenerator.${charset}`, {})}
                checked={resolved[charset]}
                disabled={!isPasswordCharsetAllowed(charset, constraints)}
                onChange={(e) => updateOptions({ [charset]: e.currentTarget.checked })}
              />
            ))}
            <Checkbox
              label={t('common.elements.passwordGenerator.excludeAmbiguous', {})}
              checked={options.excludeAmbiguous}
              onChange={(e) => updateOptions({ excludeAmbiguous: e.currentTarget.checked })}
            />
          </Stack>

          {!password && (
            <Text size='sm' c='red'>
              {t('common.elements.passwordGenerator.noCharsets', {})}
            </Text>
          )}

          <Button leftSection={<FontAwesomeIcon icon={faDice} />} disabled={!password} onClick={use}>
            {t('common.elements.passwordGenerator.button.use', {})}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export default makeComponentHookable(PasswordGeneratorPopover);
