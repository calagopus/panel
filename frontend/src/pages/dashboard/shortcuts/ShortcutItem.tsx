import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { Flex, Text } from '@mantine/core';
import KbdKey from '@/elements/KbdKey.tsx';

export interface ShortcutItemProps {
  keys: (string | { icon: IconDefinition })[];
  description: string;
  hideBorder?: boolean;
}

export default function ShortcutItem({ keys, description, hideBorder }: ShortcutItemProps) {
  return (
    <Flex
      align='center'
      justify='space-between'
      py='sm'
      px='xs'
      style={{
        borderBottom: hideBorder ? 'none' : '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Text size='sm'>{description}</Text>
      <Flex align='center' justify='flex-end' gap={6} style={{ minWidth: 120 }}>
        {keys.map((key, index) => (
          <Flex key={index} align='center' gap={6}>
            {index > 0 && (
              <Text size='xs' c='dimmed' fw={500}>
                +
              </Text>
            )}
            {typeof key === 'string' ? <KbdKey>{key}</KbdKey> : <KbdKey icon={key.icon}>{null}</KbdKey>}
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
