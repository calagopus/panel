import { faTag } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { MassRenameOptions } from '@/lib/files/massRename.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MassRenameAffixSection({
  options,
  setOptions,
  enabled,
  onToggle,
}: {
  options: MassRenameOptions;
  setOptions: (updater: (options: MassRenameOptions) => MassRenameOptions) => void;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { t, tReact } = useTranslations();

  return (
    <CollapsibleSection
      icon={<FontAwesomeIcon icon={faTag} />}
      title={t('pages.server.files.modal.massRename.section.affixes', {})}
      enabled={enabled}
      onToggle={onToggle}
    >
      <Stack gap='sm'>
        <Group grow align='start'>
          <TextInput
            label={t('pages.server.files.modal.massRename.affix.prefix', {})}
            value={options.prefix}
            onChange={(e) => setOptions((o) => ({ ...o, prefix: e.target.value }))}
          />
          <TextInput
            label={t('pages.server.files.modal.massRename.affix.suffix', {})}
            value={options.suffix}
            onChange={(e) => setOptions((o) => ({ ...o, suffix: e.target.value }))}
          />
        </Group>
        <Text size='xs' c='dimmed'>
          {tReact('pages.server.files.modal.massRename.affix.help', { token: <Code>{'{n}'}</Code> })}
        </Text>
      </Stack>
    </CollapsibleSection>
  );
}
