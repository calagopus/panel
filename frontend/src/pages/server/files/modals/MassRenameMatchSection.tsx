import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import { MassRenameOptions } from '@/lib/files/massRename.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MassRenameMatchSection({
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
  const { t } = useTranslations();

  return (
    <CollapsibleSection
      icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
      title={t('pages.server.files.modal.massRename.section.matchOptions', {})}
      enabled={enabled}
      onToggle={onToggle}
    >
      <Stack gap='sm'>
        <Switch
          label={t('pages.server.files.modal.massRename.option.regex', {})}
          description={t('pages.server.files.modal.massRename.option.regexDescription', {})}
          checked={options.regex}
          onChange={(e) => setOptions((o) => ({ ...o, regex: e.target.checked }))}
        />
        <Group grow>
          <Switch
            label={t('pages.server.files.modal.massRename.option.caseSensitive', {})}
            checked={options.caseSensitive}
            onChange={(e) => setOptions((o) => ({ ...o, caseSensitive: e.target.checked }))}
          />
          <Switch
            label={t('pages.server.files.modal.massRename.option.allOccurrences', {})}
            checked={options.allOccurrences}
            onChange={(e) => setOptions((o) => ({ ...o, allOccurrences: e.target.checked }))}
          />
        </Group>
      </Stack>
    </CollapsibleSection>
  );
}
