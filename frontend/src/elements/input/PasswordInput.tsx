import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PasswordInput as MantinePasswordInput, PasswordInputProps as MantinePasswordInputProps } from '@mantine/core';
import { useMergedRef, useUncontrolled } from '@mantine/hooks';
import { forwardRef, useRef } from 'react';
import { makeComponentHookable } from 'shared';
import type { PasswordGeneratorConstraints } from '@/lib/auth/passwordGenerator.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import PasswordGeneratorPopover from '@/elements/input/PasswordGeneratorPopover.tsx';
import Group from '@/elements/layout/Group.tsx';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';

const VisibilityToggleIcon = ({ reveal }: { reveal: boolean }) =>
  reveal ? (
    <FontAwesomeIcon icon={faEyeSlash} className='text-(--mantine-color-text)' />
  ) : (
    <FontAwesomeIcon icon={faEye} className='text-(--mantine-color-text)' />
  );

export interface PasswordInputProps extends MantinePasswordInputProps {
  withGenerator?: boolean;
  generatorConstraints?: PasswordGeneratorConstraints;
  onGenerate?: (password: string) => void;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      value,
      withGenerator,
      generatorConstraints,
      onGenerate,
      visible,
      defaultVisible,
      onVisibilityChange,
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const mergedRef = useMergedRef(ref, inputRef);

    const [revealed, setRevealed] = useUncontrolled({
      value: visible,
      defaultValue: defaultVisible,
      finalValue: false,
      onChange: onVisibilityChange,
    });

    const generate = (password: string) => {
      if (inputRef.current) setNativeInputValue(inputRef.current, password);
      setRevealed(true);
      onGenerate?.(password);
    };

    return (
      <MantinePasswordInput
        ref={mergedRef}
        className={className}
        value={value ?? undefined}
        placeholder={typeof rest.label === 'string' ? rest.label : undefined}
        visibilityToggleIcon={VisibilityToggleIcon}
        visible={revealed}
        onVisibilityChange={setRevealed}
        {...(rest.autoComplete ? undefined : { ...ignorePasswordManagerProps, autoComplete: 'new-password' })}
        {...(withGenerator
          ? {
              rightSectionWidth: 60,
              rightSection: (
                <Group gap={2} wrap='nowrap'>
                  <PasswordGeneratorPopover
                    onGenerate={generate}
                    constraints={generatorConstraints}
                    disabled={rest.disabled || rest.readOnly}
                  />
                  <ActionIcon
                    variant='subtle'
                    color='gray'
                    disabled={rest.disabled}
                    aria-pressed={revealed}
                    onClick={() => setRevealed(!revealed)}
                  >
                    <VisibilityToggleIcon reveal={revealed} />
                  </ActionIcon>
                </Group>
              ),
            }
          : undefined)}
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(PasswordInput);
