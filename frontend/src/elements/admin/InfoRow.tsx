import { ReactNode } from 'react';
import Text from '@/elements/typography/Text.tsx';

export default function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4 py-1.5 border-b border-(--mantine-color-default-border) last:border-b-0'>
      <Text size='sm' c='dimmed' className='shrink-0'>
        {label}
      </Text>
      <div className='text-right text-sm'>{children}</div>
    </div>
  );
}
