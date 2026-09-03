import { faHashtag } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { MassRenameOptions } from '@/lib/files/massRename.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MassRenameNumberSection({
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
      icon={<FontAwesomeIcon icon={faHashtag} />}
      title={t('pages.server.files.modal.massRename.section.numbering', {})}
      enabled={enabled}
      onToggle={onToggle}
    >
      <Stack gap='sm'>
        <Switch
          label={t('pages.server.files.modal.massRename.numbering.enable', {})}
          checked={options.numbering.enabled}
          onChange={(e) => setOptions((o) => ({ ...o, numbering: { ...o.numbering, enabled: e.target.checked } }))}
        />
        <Text size='xs' c='dimmed'>
          {tReact('pages.server.files.modal.massRename.numbering.help', { token: <Code>{'{n}'}</Code> })}
        </Text>
        <Group grow>
          <NumberInput
            label={t('pages.server.files.modal.massRename.numbering.start', {})}
            value={options.numbering.start}
            onChange={(value) =>
              setOptions((o) => ({ ...o, numbering: { ...o.numbering, start: Number(value) || 0 } }))
            }
          />
          <NumberInput
            label={t('pages.server.files.modal.massRename.numbering.step', {})}
            value={options.numbering.step}
            onChange={(value) => setOptions((o) => ({ ...o, numbering: { ...o.numbering, step: Number(value) || 0 } }))}
          />
          <NumberInput
            label={t('pages.server.files.modal.massRename.numbering.padding', {})}
            min={1}
            max={10}
            value={options.numbering.padding}
            onChange={(value) =>
              setOptions((o) => ({
                ...o,
                numbering: { ...o.numbering, padding: Math.max(1, Number(value) || 1) },
              }))
            }
          />
        </Group>
      </Stack>
    </CollapsibleSection>
  );
}
