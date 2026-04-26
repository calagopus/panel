import { Group, Progress, Text } from '@mantine/core';

interface Props {
  complete: number;
  total: number;
}

export default function OobeSidebarFooter({ complete, total }: Props) {
  const pct = Math.trunc((complete / total) * 100);

  return (
    <div className='border border-neutral-700 rounded-lg mt-auto p-2 justify-between items-center min-h-fit'>
      <Progress value={pct} color='blue' radius='xl' mb={6} />
      <Group justify='space-between'>
        <Text size='sm'>
          {complete} of {total} complete
        </Text>
        <Text size='sm'>{pct}%</Text>
      </Group>
    </div>
  );
}
