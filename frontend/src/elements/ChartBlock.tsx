import { ReactNode } from 'react';
import { makeComponentHookable } from 'shared';
import Card from './Card.tsx';

function ChartBlock({
  icon,
  title,
  legend,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`relative flex flex-col ${className ?? ''}`}>
      <div className='flex items-center justify-between px-4 py-2'>
        <h3 className='transition-colors duration-100'>
          {icon} {title}
        </h3>
        {legend && <span className='text-sm flex items-center'>{legend}</span>}
      </div>
      <div className='min-h-0 flex-1'>{children}</div>
    </Card>
  );
}

export default makeComponentHookable(ChartBlock);
