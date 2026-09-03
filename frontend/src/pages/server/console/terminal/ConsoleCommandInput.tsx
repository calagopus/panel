import { KeyboardEvent, RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import { commandSnippetFilter } from '@/lib/editor/xterm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface ConsoleCommandInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  inputValueRef: RefObject<string>;
  inputValueUpdatedRef: RefObject<boolean>;
  inputValueCompletedRef: RefObject<boolean>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export default function ConsoleCommandInput({
  inputValue,
  setInputValue,
  inputValueRef,
  inputValueUpdatedRef,
  inputValueCompletedRef,
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
          data={commandSnippets.map((s) => `!${s.name}`)}
          filter={commandSnippetFilter}
          onOptionSubmit={(option) => {
            const snippet = commandSnippets.find((s) => `!${s.name}` === option);
            if (snippet) {
              inputValueUpdatedRef.current = true;
              inputValueCompletedRef.current = true;
              inputValueRef.current = snippet.command;
              setInputValue(snippet.command);
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
