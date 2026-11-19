import { ReactNode } from 'react';
import { makeComponentHookable } from 'shared';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';

export interface EmptyStateProps {
  icon: IconLike;
  title: string;
  description: ReactNode;
  flush?: boolean;
  children?: ReactNode;
}

function EmptyState({ icon, title, description, flush = false, children }: EmptyStateProps) {
  const content = (
    <>
      <ThemeIcon size='xl' mb='md' color='gray'>
        <Icon icon={icon} />
      </ThemeIcon>
      <Title order={3} c='dimmed' mb='sm'>
        {title}
      </Title>
      <Text c='dimmed' mb='md'>
        {description}
      </Text>
      {children}
    </>
  );

  return flush ? (
    <div style={{ textAlign: 'center', paddingBlock: 'var(--mantine-spacing-lg)' }}>{content}</div>
  ) : (
    <Paper withBorder p='xl' radius='md' style={{ textAlign: 'center' }}>
      {content}
    </Paper>
  );
}

export default makeComponentHookable(EmptyState);
