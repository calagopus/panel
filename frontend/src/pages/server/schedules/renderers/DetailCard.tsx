import type { ReactNode } from 'react';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';

interface DetailCardProps {
  icon: React.ReactNode;
  label: string;
  value: ReactNode;
  color?: string;
}

export default function DetailCard({ icon, label, value, color = 'blue' }: DetailCardProps) {
  return (
    <Card className='flex flex-row! items-center flex-1'>
      <ThemeIcon size='xl' radius='md' color={color}>
        {icon}
      </ThemeIcon>
      <div className='flex flex-col ml-4 w-full'>
        <div className='w-full flex justify-between'>
          <span className='text-sm text-(--mantine-color-dimmed) font-bold'>{label}</span>
        </div>
        <span className='text-lg font-bold'>{value}</span>
      </div>
    </Card>
  );
}
