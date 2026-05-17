import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Collapse, Text, UnstyledButton } from '@mantine/core';
import { makeComponentHookable } from 'shared';

interface CollapsibleSectionProps {
  icon: React.ReactNode;
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
        <Box
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: enabled ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-default-hover)',
            color: enabled ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-gray-5)',
            transition: 'background 0.15s ease',
          }}
        >
          {icon}
        </Box>
        <Text size='sm' fw={500} c={enabled ? undefined : 'dimmed'} style={{ flex: 1, textAlign: 'left' }}>
          {title}
        </Text>
        <FontAwesomeIcon
          icon={faChevronDown}
          size='xs'
          style={{
            color: 'var(--mantine-color-gray-6)',
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
