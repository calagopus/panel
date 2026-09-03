import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faBan,
  faPen,
  faPlay,
  faRotateLeft,
  faXmark,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Flex from '@/elements/layout/Flex.tsx';
import Group from '@/elements/layout/Group.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import KbdKey from '@/elements/typography/KbdKey.tsx';
import Text from '@/elements/typography/Text.tsx';
import { disableShortcut, resetShortcut, setShortcutBinding } from '@/lib/quickActions/shortcutOverrides.ts';
import {
  bindingFromEvent,
  ModifierKey,
  ShortcutBinding,
  ShortcutDefinition,
  shortcutDescription,
} from '@/lib/quickActions/shortcuts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const ARROW_ICONS: Record<string, IconDefinition> = {
  ArrowUp: faArrowUp,
  ArrowDown: faArrowDown,
  ArrowLeft: faArrowLeft,
  ArrowRight: faArrowRight,
};

const KEY_LABELS: Record<string, string> = {
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: 'Bks',
  Enter: 'Ent',
  ' ': 'Spc',
  Tab: 'Tab',
};

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

const MODIFIER_ORDER: ModifierKey[] = ['ctrlOrMeta', 'ctrl', 'meta', 'alt', 'shift'];

function bindingKeys(binding: ShortcutBinding, isMac: boolean): (string | { icon: IconDefinition })[] {
  const keys: (string | { icon: IconDefinition })[] = MODIFIER_ORDER.filter((m) => binding.modifiers.includes(m)).map(
    (m) => modifierLabel(m, isMac),
  );

  if (binding.key in ARROW_ICONS) keys.push({ icon: ARROW_ICONS[binding.key] });
  else keys.push(KEY_LABELS[binding.key] ?? (binding.key.length === 1 ? binding.key.toUpperCase() : binding.key));

  return keys;
}

interface EditableShortcutItemProps {
  definition: ShortcutDefinition;
  binding: ShortcutBinding | null;
  overridden: boolean;
  isMac: boolean;
  recording: boolean;
  setRecordingId: (id: string | null) => void;
  hideBorder?: boolean;
}

export default function EditableShortcutItem({
  definition,
  binding,
  overridden,
  isMac,
  recording,
  setRecordingId,
  hideBorder,
}: EditableShortcutItemProps) {
  const { t } = useTranslations();

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setRecordingId(null);
        return;
      }

      const next = bindingFromEvent(event);
      if (!next) return;

      setShortcutBinding(definition.id, next);
      setRecordingId(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [recording, definition.id, setRecordingId]);

  return (
    <Flex
      align='center'
      justify='space-between'
      gap='sm'
      px='xs'
      mih={48}
      style={{ borderBottom: hideBorder ? 'none' : '1px solid var(--mantine-color-default-border)' }}
    >
      <Group gap={6} wrap='nowrap' className='min-w-0'>
        <Text size='sm' style={{ minWidth: 0, flex: 1 }}>
          <ScrollingText>{shortcutDescription(definition)}</ScrollingText>
        </Text>
        {overridden && (
          <Badge size='xs' variant='light' color='blue' style={{ flexShrink: 0 }}>
            {t('pages.account.shortcuts.label.modified', {})}
          </Badge>
        )}
      </Group>

      <Flex align='center' gap={6} wrap='nowrap' style={{ flexShrink: 0 }}>
        <Flex align='center' justify='flex-end' gap={6} wrap='nowrap' style={{ minWidth: 104 }}>
          {recording ? (
            <Text size='xs' c='yellow' fw={500} className='whitespace-nowrap'>
              {t('pages.account.shortcuts.label.recording', {})}
            </Text>
          ) : binding ? (
            bindingKeys(binding, isMac).map((key, index) => (
              <Flex key={index} align='center' gap={6}>
                {index > 0 && (
                  <Text size='xs' c='dimmed' fw={500}>
                    +
                  </Text>
                )}
                {typeof key === 'string' ? <KbdKey>{key}</KbdKey> : <KbdKey icon={key.icon}>{null}</KbdKey>}
              </Flex>
            ))
          ) : (
            <Text size='xs' c='dimmed'>
              {t('pages.account.shortcuts.label.disabled', {})}
            </Text>
          )}
        </Flex>

        <Tooltip
          label={recording ? t('common.button.cancel', {}) : t('pages.account.shortcuts.button.rebind', {})}
          withArrow
        >
          <ActionIcon variant='subtle' size='sm' onClick={() => setRecordingId(recording ? null : definition.id)}>
            <FontAwesomeIcon icon={recording ? faXmark : faPen} style={{ fontSize: 12 }} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={binding ? t('common.button.disable', {}) : t('common.button.enable', {})} withArrow>
          <ActionIcon
            variant='subtle'
            size='sm'
            onClick={() => (binding ? disableShortcut(definition.id) : resetShortcut(definition.id))}
            disabled={!binding && !overridden}
          >
            <FontAwesomeIcon icon={binding ? faBan : faPlay} style={{ fontSize: 12 }} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('common.tooltip.resetToDefault', {})} withArrow>
          <ActionIcon
            variant='subtle'
            size='sm'
            color='red'
            onClick={() => resetShortcut(definition.id)}
            disabled={!overridden}
          >
            <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 12 }} />
          </ActionIcon>
        </Tooltip>
      </Flex>
    </Flex>
  );
}
