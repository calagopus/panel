import { Box, Group, Title } from '@mantine/core';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import { makeComponentHookable } from 'shared';
import Card from './Card.tsx';

export interface TitleCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  wrapperClassName?: string;
  iconClassName?: string;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
}

function TitleCard({
  title,
  icon,
  children,
  className,
  titleClassName,
  iconClassName,
  wrapperClassName,
  leftSection,
  rightSection,
}: TitleCardProps) {
  return (
    <Card withBorder radius='md' p={0} bg='dark.7' className={className}>
      <Group
        id='title-card-header'
        className={titleClassName}
        style={{
          borderBottom: '1px solid var(--mantine-color-dark-5)',
          background: 'var(--mantine-color-dark-6)',
        }}
        gap='sm'
        px='md'
        py='sm'
      >
        {leftSection}
        <Box
          id='title-card-icon'
          className={iconClassName}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: 'var(--mantine-color-dark-5)',
          }}
        >
          {icon}
        </Box>
        <Title order={5} c='gray.2' fw={600}>
          {title}
        </Title>
        {rightSection}
      </Group>
      <div className={classNames('p-4 h-full', wrapperClassName)}>{children}</div>
    </Card>
  );
}

export default makeComponentHookable(TitleCard);
