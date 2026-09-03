import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/elements/buttons/Button.tsx';
import Kbd from '@/elements/typography/Kbd.tsx';
import { getShortcutDefinition } from '@/lib/quickActions/coreShortcuts.tsx';
import { useShortcutOverrides } from '@/lib/quickActions/shortcutOverrides.ts';
import { effectiveBinding, ModifierKey, ShortcutBinding } from '@/lib/quickActions/shortcuts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useQuickActionsStore } from '@/stores/quickActions.ts';

const MODIFIER_ORDER: ModifierKey[] = ['ctrlOrMeta', 'ctrl', 'meta', 'alt', 'shift'];

function modifierLabel(modifier: ModifierKey, isMac: boolean): string {
  switch (modifier) {
    case 'ctrlOrMeta':
      return isMac ? 'Cmd' : 'Ctrl';
    case 'meta':
      return 'Cmd';
    case 'alt':
      return isMac ? 'Opt' : 'Alt';
    case 'ctrl':
      return 'Ctrl';
    case 'shift':
      return 'Shift';
  }
}

function formatBindingCompact(binding: ShortcutBinding, isMac: boolean): string {
  const parts = MODIFIER_ORDER.filter((m) => binding.modifiers.includes(m)).map((m) => modifierLabel(m, isMac));
  parts.push(binding.key === ' ' ? 'Space' : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key);
  return parts.join('+');
}

export default function QuickActionsTrigger() {
  const { t } = useTranslations();
  const setOpen = useQuickActionsStore((state) => state.setOpen);
  const overrides = useShortcutOverrides();

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const definition = getShortcutDefinition('general.quickActions');
  const binding = definition ? effectiveBinding(definition, overrides) : null;
  const hint = binding ? formatBindingCompact(binding, isMac) : null;

  return (
    <Button
      variant='default'
      fullWidth
      className='mt-2'
      leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} size='sm' />}
      rightSection={hint ? <Kbd size='xs'>{hint}</Kbd> : undefined}
      onClick={() => setOpen(true)}
      styles={{
        inner: { justifyContent: 'space-between' },
        label: { color: 'var(--mantine-color-dimmed)' },
      }}
    >
      {t('elements.quickActions.trigger', {})}
    </Button>
  );
}
