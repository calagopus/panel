import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Collapse, Text, UnstyledButton } from '@mantine/core';
import { makeComponentHookable } from 'shared';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';

interface CollapsibleSectionProps {
  icon: IconLike;
  title: string;
  className?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleSection({ icon, title, className, enabled, onToggle, children }: CollapsibleSectionProps) {
  return (
    <Box
      className={className}
      style={{
        background: enabled ? 'var(--mantine-color-default)' : 'transparent',
        border: `1px solid var(--mantine-color-default-border)`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}
    >
      <UnstyledButton
        onClick={() => onToggle(!enabled)}
        style={{
          width: '100%',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <ThemeIcon size={28} radius={6} variant='light' color={enabled ? 'blue' : 'gray'}>
          <Icon icon={icon} />
        </ThemeIcon>
        <Text size='sm' fw={500} c={enabled ? undefined : 'dimmed'} style={{ flex: 1, textAlign: 'left' }}>
          {title}
        </Text>
        <FontAwesomeIcon
          icon={faChevronDown}
          size='xs'
          style={{
            color: 'var(--mantine-color-dimmed)',
            transform: enabled ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </UnstyledButton>
      <Collapse expanded={enabled}>
        <Box px='sm' pb='sm' pt={4}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

export default makeComponentHookable(CollapsibleSection);
