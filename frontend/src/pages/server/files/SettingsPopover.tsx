import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentType, ReactNode } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SettingsPopover({
  tooltip,
  registry,
  keyPrefix,
  children,
}: {
  tooltip?: ReactNode;
  registry: { prependedComponents: ComponentType[]; appendedComponents: ComponentType[] };
  keyPrefix: string;
  children: ReactNode;
}) {
  const { t } = useTranslations();
  const trigger = (
    <Button
      variant='transparent'
      size='compact-xs'
      aria-label={typeof tooltip === 'string' ? tooltip : t('pages.server.files.tooltip.settings', {})}
    >
      <FontAwesomeIcon size='lg' icon={faCog} />
    </Button>
  );

  return (
    <Popover position='bottom' withArrow shadow='md'>
      <Popover.Target>{tooltip ? <Tooltip label={tooltip}>{trigger}</Tooltip> : trigger}</Popover.Target>
      <Popover.Dropdown>
        <div className='flex flex-col space-y-2'>
          <ExtensionSlot components={registry.prependedComponents} name={`${keyPrefix}-prepended`} />

          {children}

          <ExtensionSlot components={registry.appendedComponents} name={`${keyPrefix}-appended`} />
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
