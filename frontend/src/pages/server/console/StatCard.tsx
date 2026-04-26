import { faCog, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Popover, ThemeIcon } from '@mantine/core';
import { ReactNode } from 'react';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';

export default function StatCard({
  icon,
  label,
  value,
  order,
  copyOnClick,
  popover,
  limit,
  details,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
  order?: number;
  copyOnClick?: boolean;
  popover?: ReactNode;
  limit?: string | null;
  details?: string | null;
}) {
  return (
    <Card className='flex flex-row! items-center' style={{ order }}>
      <ThemeIcon size='xl' radius='md'>
        <FontAwesomeIcon size='xl' icon={icon} />
      </ThemeIcon>
      <div className='flex flex-col ml-4 w-full'>
        <div className='w-full flex justify-between'>
          <span className='text-sm text-left text-gray-400 font-bold'>{label}</span>
          {popover && (
            <Popover position='bottom' withArrow shadow='md'>
              <Popover.Target>
                <Button variant='transparent' size='compact-xs'>
                  <FontAwesomeIcon size='lg' icon={faCog} />
                </Button>
              </Popover.Target>
              <Popover.Dropdown>{popover}</Popover.Dropdown>
            </Popover>
          )}
        </div>
        <span className='text-lg font-bold'>
          {copyOnClick ? (
            <CopyOnClick content={value} className='text-left'>
              {value} {limit && <span className='text-sm text-gray-400'>/ {limit}</span>}{' '}
              {details && <span className='text-sm text-gray-400'>({details})</span>}
            </CopyOnClick>
          ) : (
            <>
              {value} {limit && <span className='text-sm text-gray-400'>/ {limit}</span>}{' '}
              {details && <span className='text-sm text-gray-400'>({details})</span>}
            </>
          )}
        </span>
      </div>
    </Card>
  );
}
