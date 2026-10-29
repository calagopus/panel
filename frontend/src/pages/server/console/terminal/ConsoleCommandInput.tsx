import { faTerminal, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { commandSnippetFilter } from '@/lib/editor/xterm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface ConsoleCommandInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  inputValueRef: RefObject<string>;
  inputValueUpdatedRef: RefObject<boolean>;
  inputValueCompletedRef: RefObject<boolean>;
  commandPrefix: string;
  setCommandPrefix: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export default function ConsoleCommandInput({
  inputValue,
  setInputValue,
  inputValueRef,
  inputValueUpdatedRef,
  inputValueCompletedRef,
  commandPrefix,
  setCommandPrefix,
  onKeyDown,
}: ConsoleCommandInputProps) {
  const { t } = useTranslations();
  const { commandSnippets, socketConnected, state } = useServerStore(
    useShallow((s) => ({
      commandSnippets: s.commandSnippets,
      socketConnected: s.socketConnected,
      state: s.state,
    })),
  );
  const disabled = !socketConnected || state === 'offline';

  const [prefixOpened, setPrefixOpened] = useState(false);
  const [prefixWidth, setPrefixWidth] = useState(0);
  const prefixRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const prefix = prefixRef.current;
    if (!prefix) {
      setPrefixWidth(0);
      return;
    }

    const measure = () => setPrefixWidth(prefix.scrollWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(prefix);

    return () => observer.disconnect();
  }, [commandPrefix]);

  return (
    <div className='w-full mt-4 flex flex-row'>
      <ServerCan action='control.console'>
        <Autocomplete
          value={inputValue}
          onChange={(value) => {
            if (inputValueUpdatedRef.current) {
              inputValueUpdatedRef.current = false;
              return;
            }

            inputValueRef.current = value;
            setInputValue(value);
          }}
          placeholder={t('pages.server.console.input.placeholder', {})}
          aria-label={t('pages.server.console.input.ariaLabel', {})}
          disabled={disabled}
          onKeyDown={onKeyDown}
          autoCorrect='off'
          autoCapitalize='none'
          className='w-full'
          leftSection={
            <div className='flex flex-row items-center gap-1 w-full min-w-0 pl-1.5 font-mono'>
              <Popover trapFocus opened={prefixOpened} onChange={setPrefixOpened} position='top-start'>
                <Popover.Target>
                  <Tooltip label={t('pages.server.console.tooltip.commandPrefix', {})} disabled={prefixOpened}>
                    <ActionIcon
                      className='group'
                      size='sm'
                      variant='transparent'
                      onClick={() => setPrefixOpened((o) => !o)}
                    >
                      <FontAwesomeIcon
                        icon={faTerminal}
                        className={
                          commandPrefix
                            ? 'text-(--mantine-primary-color-filled)'
                            : 'text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
                        }
                      />
                    </ActionIcon>
                  </Tooltip>
                </Popover.Target>
                <Popover.Dropdown className='flex flex-row gap-2' p='xs'>
                  <TextInput
                    placeholder={t('pages.server.console.input.prefixPlaceholder', {})}
                    value={commandPrefix}
                    maxLength={64}
                    autoCorrect='off'
                    autoCapitalize='none'
                    className='w-64'
                    classNames={{ input: 'font-mono!' }}
                    onChange={(e) => setCommandPrefix(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setPrefixOpened(false);
                    }}
                  />
                  <ActionIcon
                    size='input-sm'
                    variant='light'
                    color='gray'
                    disabled={!commandPrefix}
                    onClick={() => setCommandPrefix('')}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </ActionIcon>
                </Popover.Dropdown>
              </Popover>
              {commandPrefix && (
                <span ref={prefixRef} className='min-w-0 truncate whitespace-pre text-(--mantine-color-dimmed)'>
                  {commandPrefix}
                </span>
              )}
            </div>
          }
          leftSectionWidth={commandPrefix ? `min(${prefixWidth + 40}px, 50%)` : '2.25rem'}
          leftSectionPointerEvents='auto'
          leftSectionProps={{ className: 'font-mono justify-start!' }}
          data={commandSnippets.map((s) => `!${s.name}`)}
          filter={commandSnippetFilter}
          onOptionSubmit={(option) => {
            const snippet = commandSnippets.find((s) => `!${s.name}` === option);
            if (snippet) {
              inputValueUpdatedRef.current = true;
              inputValueCompletedRef.current = true;
              const command = snippet.command.replace(/\r?\n/g, '\\n');
              inputValueRef.current = command;
              setInputValue(command);
            }
          }}
        />
      </ServerCan>
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.server.console.terminalInputRowComponents}
        name='console-terminalInputRow'
      />
    </div>
  );
}
