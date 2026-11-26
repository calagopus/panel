import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { NavLink } from 'react-router';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function HistoryLink() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  return (
    <Tooltip label={t('pages.server.console.history.title', {})} unwrapped>
      <NavLink
        to={`/server/${server.uuidShort}/console/history`}
        className='inline-flex p-1 text-(--mantine-color-dimmed) hover:text-(--mantine-color-text)'
        aria-label={t('pages.server.console.history.title', {})}
      >
        <FontAwesomeIcon icon={faClockRotateLeft} size='sm' />
      </NavLink>
    </Tooltip>
  );
}
