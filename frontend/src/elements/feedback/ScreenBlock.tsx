import { Title } from '@mantine/core';
import { makeComponentHookable } from 'shared';
import Card from '@/elements/data-display/Card.tsx';

function ScreenBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className='flex items-center justify-center lg:mt-6 mt-2'>
      <Card className='w-full max-w-md text-center'>
        <Title order={2}>{title}</Title>
        <div className='text-sm text-(--mantine-color-dimmed) mt-2'>{content}</div>
      </Card>
    </div>
  );
}

export default makeComponentHookable(ScreenBlock);
