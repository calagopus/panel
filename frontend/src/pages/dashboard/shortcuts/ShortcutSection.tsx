import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ShortcutItem, { ShortcutItemProps } from './ShortcutItem.tsx';

export interface ShortcutSectionProps {
  title: string;
  icon: IconDefinition;
  shortcuts: ShortcutItemProps[];
}

export default function ShortcutSection({ title, icon, shortcuts }: ShortcutSectionProps) {
  return (
    <TitleCard title={title} icon={<FontAwesomeIcon icon={icon} size='sm' />}>
      <Stack gap={0}>
        {shortcuts.map((shortcut, index) => (
          <ShortcutItem key={index} {...shortcut} hideBorder={index === shortcuts.length - 1} />
        ))}
      </Stack>
    </TitleCard>
  );
}
