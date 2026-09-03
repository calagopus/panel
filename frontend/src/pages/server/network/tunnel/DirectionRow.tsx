import { ReactNode } from 'react';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { INBOUND_COLOR, OUTBOUND_COLOR } from './directions.ts';

function Arrow({ incoming }: { incoming: boolean }) {
  const color = incoming ? INBOUND_COLOR : OUTBOUND_COLOR;

  return (
    <svg width={34} height={10} viewBox='0 0 34 10' className='shrink-0 overflow-visible' aria-hidden>
      <line x1={incoming ? 33 : 1} y1={5} x2={incoming ? 5 : 29} y2={5} stroke={color} strokeWidth={2} />
      <path d={incoming ? 'M 1 5 L 9 1 L 9 9 z' : 'M 33 5 L 25 1 L 25 9 z'} fill={color} />
    </svg>
  );
}

type Props = {
  incoming: boolean;
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  blocked?: string;
  addresses?: string[];
  empty?: string;
  children?: ReactNode;
};

export default function DirectionRow({
  incoming,
  label,
  checked,
  onChange,
  blocked,
  addresses = [],
  empty,
  children,
}: Props) {
  return (
    <Group align='flex-start' wrap='nowrap' gap='sm' className='py-2'>
      <Switch
        className='mt-0.5'
        checked={checked}
        disabled={!onChange || Boolean(blocked)}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        aria-label={label}
      />

      <Stack gap={2} className='min-w-0 flex-1'>
        <Group gap='xs' wrap='nowrap'>
          <Arrow incoming={incoming} />
          <Text size='sm'>{label}</Text>
        </Group>

        {blocked ? (
          <Text size='xs' c='red'>
            {blocked}
          </Text>
        ) : addresses.length > 0 ? (
          <Group gap={4}>
            {addresses.map((address) => (
              <CopyOnClick key={address} content={address}>
                <Text size='xs' ff='monospace' c='dimmed' className='hover:underline'>
                  {address}
                </Text>
              </CopyOnClick>
            ))}
          </Group>
        ) : (
          empty && (
            <Text size='xs' c='dimmed'>
              {empty}
            </Text>
          )
        )}

        {children}
      </Stack>
    </Group>
  );
}
