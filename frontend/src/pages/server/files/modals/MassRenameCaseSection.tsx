import { faFont } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import Select from '@/elements/input/Select.tsx';
import { MassRenameOptions, RenameCase } from '@/lib/files/massRename.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MassRenameCaseSection({
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
      icon={<FontAwesomeIcon icon={faFont} />}
      title={t('pages.server.files.modal.massRename.section.caseConversion', {})}
      enabled={enabled}
      onToggle={onToggle}
    >
      <Select
        label={t('pages.server.files.modal.massRename.case.label', {})}
        value={options.caseTransform}
        onChange={(value) => setOptions((o) => ({ ...o, caseTransform: (value ?? 'none') as RenameCase }))}
        data={[
          { value: 'none', label: t('pages.server.files.modal.massRename.case.none', {}) },
          { value: 'lower', label: t('pages.server.files.modal.massRename.case.lower', {}) },
          { value: 'upper', label: t('pages.server.files.modal.massRename.case.upper', {}) },
          { value: 'title', label: t('pages.server.files.modal.massRename.case.title', {}) },
          { value: 'capitalize', label: t('pages.server.files.modal.massRename.case.capitalize', {}) },
        ]}
      />
    </CollapsibleSection>
  );
}
