import { faApple, faWindows } from '@fortawesome/free-brands-svg-icons';
import { faCopy, faKeyboard, faPaste, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Flex, Stack, Text } from '@mantine/core';
import { ReactNode, useState } from 'react';
import Button from '@/elements/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { handleRawCopyToClipboard } from '@/lib/copy.ts';
import { buildCoreShortcutCategories, getShortcutDefinitions } from '@/lib/coreShortcuts.tsx';
import { handleRawPasteFromClipboard } from '@/lib/paste.ts';
import {
  effectiveBinding,
  parseShortcuts,
  ShortcutCategory,
  ShortcutDefinition,
  serializeShortcuts,
} from '@/lib/shortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import EditableShortcutItem from './EditableShortcutItem.tsx';

export default function DashboardShortcuts() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const definitions = getShortcutDefinitions();
  const overrides = useGlobalStore((state) => state.shortcutOverrides);
  const resetAllShortcuts = useGlobalStore((state) => state.resetAllShortcuts);
  const importShortcutOverrides = useGlobalStore((state) => state.importShortcutOverrides);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const categories: Record<string, ShortcutCategory> = {
    ...buildCoreShortcutCategories(),
    ...window.extensionContext.extensionRegistry.shortcuts.categories,
  };

  const categoryLabel = (id: string) => categories[id]?.label() ?? id;
  const categoryIcon = (id: string): ReactNode =>
    categories[id]?.icon ?? <FontAwesomeIcon icon={faKeyboard} size='sm' />;

  const groupedMap = new Map<string, ShortcutDefinition[]>();
  for (const definition of definitions) {
    const list = groupedMap.get(definition.category) ?? [];
    list.push(definition);
    groupedMap.set(definition.category, list);
  }
  const grouped = Array.from(groupedMap.entries()).sort(([a], [b]) => categoryLabel(a).localeCompare(categoryLabel(b)));

  const onCopy = () =>
    handleRawCopyToClipboard(serializeShortcuts({ definitions, overrides, categoryLabel }), addToast);

  const onPaste = () =>
    handleRawPasteFromClipboard((text) => {
      const parsed = parseShortcuts(text, definitions);
      const changes = Object.keys(parsed.overrides).length + parsed.resets.length;

      importShortcutOverrides(parsed.overrides, parsed.resets);

      addToast(
        changes === 0
          ? t('pages.account.shortcuts.toast.importedNone', {})
          : t('pages.account.shortcuts.toast.imported', { shortcuts: tItem('shortcut', changes) }),
        changes === 0 ? 'warning' : 'success',
      );

      if (parsed.unknown.length > 0 || parsed.invalid.length > 0) {
        addToast(
          t('pages.account.shortcuts.toast.importErrors', {
            unknown: tItem('shortcut', parsed.unknown.length),
            invalid: tItem('line', parsed.invalid.length),
          }),
          'warning',
        );
      }
    }, addToast);

  const onResetAll = () => {
    resetAllShortcuts();
    addToast(t('pages.account.shortcuts.toast.resetAll', {}), 'success');
  };

  return (
    <AccountContentContainer
      title={t('pages.account.shortcuts.title', {})}
      subtitle={t('pages.account.shortcuts.subtitle', {})}
      contentRight={
        <Flex align='center' gap='xs' wrap='wrap'>
          <Button
            h={32}
            size='compact-sm'
            variant='default'
            leftSection={<FontAwesomeIcon icon={faCopy} />}
            onClick={onCopy}
          >
            {t('pages.account.shortcuts.button.copy', {})}
          </Button>
          <Button
            h={32}
            size='compact-sm'
            variant='default'
            leftSection={<FontAwesomeIcon icon={faPaste} />}
            onClick={onPaste}
          >
            {t('pages.account.shortcuts.button.paste', {})}
          </Button>
          <Button
            h={32}
            size='compact-sm'
            variant='default'
            leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
            onClick={onResetAll}
            disabled={Object.keys(overrides).length === 0}
          >
            {t('pages.account.shortcuts.button.resetAll', {})}
          </Button>
          <Flex
            align='center'
            gap='xs'
            px='sm'
            h={32}
            style={{
              background: 'var(--mantine-color-default)',
              borderRadius: 6,
              border: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <FontAwesomeIcon icon={isMac ? faApple : faWindows} style={{ color: 'var(--mantine-color-gray-5)' }} />
            <Text size='sm' c='gray.5'>
              {isMac ? t('pages.account.shortcuts.detectedMac', {}) : t('pages.account.shortcuts.detectedWindows', {})}
            </Text>
          </Flex>
        </Flex>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.keyboardShortcuts.container}
    >
      <div className='md:columns-2 gap-4 space-y-4'>
        {window.extensionContext.extensionRegistry.pages.dashboard.keyboardShortcuts.shortcutSections.prependedComponents.map(
          (Component, i) => (
            <Component key={`shortcuts-shortcutSection-prepended-${i}`} />
          ),
        )}

        {grouped.map(([category, defs]) => (
          <div key={category} className='break-inside-avoid'>
            <TitleCard title={categoryLabel(category)} icon={categoryIcon(category)}>
              <Stack gap={0}>
                {defs.map((definition, index) => (
                  <EditableShortcutItem
                    key={definition.id}
                    definition={definition}
                    binding={effectiveBinding(definition, overrides)}
                    overridden={Object.hasOwn(overrides, definition.id)}
                    isMac={isMac}
                    recording={recordingId === definition.id}
                    setRecordingId={setRecordingId}
                    hideBorder={index === defs.length - 1}
                  />
                ))}
              </Stack>
            </TitleCard>
          </div>
        ))}

        {window.extensionContext.extensionRegistry.pages.dashboard.keyboardShortcuts.shortcutSections.appendedComponents.map(
          (Component, i) => (
            <Component key={`shortcuts-shortcutSection-appended-${i}`} />
          ),
        )}
      </div>
    </AccountContentContainer>
  );
}
