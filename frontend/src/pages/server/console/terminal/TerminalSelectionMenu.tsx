import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface TerminalSelectionMenuProps {
  top: number;
  onCopy: () => void;
}

export default function TerminalSelectionMenu({ top, onCopy }: TerminalSelectionMenuProps) {
  const { t } = useTranslations();

  return (
    <div
      className='absolute left-1/2 -translate-x-1/2 z-10 shadow-md rounded-(--mantine-radius-default)'
      style={{ top }}
    >
      <Tooltip label={t('pages.server.console.tooltip.copySelection', {})}>
        <ActionIcon
          variant='default'
          size='lg'
          aria-label={t('pages.server.console.tooltip.copySelection', {})}
          onClick={onCopy}
        >
          <FontAwesomeIcon icon={faCopy} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
