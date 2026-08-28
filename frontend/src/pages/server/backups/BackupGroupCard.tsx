import { faChevronRight, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ComponentProps, ReactNode } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Card from '@/elements/Card.tsx';
import Collapse from '@/elements/Collapse.tsx';
import { useUserSettingMapEntry } from '@/lib/userSettings.ts';

const expandedSchema = z.boolean();

export default function BackupGroupCard({
  storageKey,
  header,
  actions,
  dragHandleProps,
  children,
}: {
  storageKey: string;
  header: ReactNode;
  actions?: ReactNode;
  dragHandleProps?: ComponentProps<'button'>;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useUserSettingMapEntry(
    'server::backup_groups_expanded',
    storageKey,
    expandedSchema,
    true,
  );

  return (
    <Card p={0} className='overflow-hidden rounded-xl!'>
      <div
        className={classNames(
          'flex flex-row items-end sm:items-center gap-3 px-3 justify-between',
          isExpanded && 'border-b border-(--mantine-color-default-border)',
        )}
      >
        <div className={classNames('flex flex-col my-3', actions ? 'sm:my-0' : undefined)}>
          <div className='flex flex-row'>
            {dragHandleProps && (
              <ActionIcon
                size='md'
                variant='subtle'
                color='gray'
                style={{ cursor: 'grab', flexShrink: 0 }}
                className='text-gray-400! light:text-gray-500!'
                {...dragHandleProps}
              >
                <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 16 }} />
              </ActionIcon>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className='flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity'
            >
              <FontAwesomeIcon
                icon={faChevronRight}
                className={classNames(
                  isExpanded ? 'rotate-90' : 'rotate-0',
                  'transition duration-200 w-3 h-3 text-(--mantine-color-dimmed) shrink-0',
                )}
              />
              {header}
            </button>
          </div>
        </div>

        {actions && (
          <div className='flex flex-col sm:flex-row items-center gap-1 mb-1.5 sm:mb-0 py-2.5 flex-1 sm:flex-0 justify-end'>
            {actions}
          </div>
        )}
      </div>

      <Collapse expanded={isExpanded}>{children}</Collapse>
    </Card>
  );
}
