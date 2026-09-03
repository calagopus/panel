import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import YamlEditor from '@/elements/editors/YamlEditor.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Title from '@/elements/typography/Title.tsx';

export default function LiveYamlConfigSection({
  title,
  saveLabel,
  updateAction,
  yaml,
  onYamlChange,
  onSave,
  saving,
  error,
  errorText,
  errorExtra,
}: {
  title: string;
  saveLabel: string;
  updateAction: string;
  yaml: string | null;
  onYamlChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  errorText: ReactNode;
  errorExtra?: ReactNode;
}) {
  return (
    <div>
      <Group justify='space-between' mb='md'>
        <Title order={4}>{title}</Title>
        <AdminCan action={updateAction} cantSave>
          <Button onClick={onSave} loading={saving} disabled={yaml === null || error !== null}>
            {saveLabel}
          </Button>
        </AdminCan>
      </Group>
      {error ? (
        <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
          <Stack gap='xs'>
            {errorText}
            {errorExtra}
          </Stack>
        </Alert>
      ) : yaml === null ? (
        <Spinner.Centered />
      ) : (
        <div className='rounded-md overflow-hidden'>
          <YamlEditor height='65vh' value={yaml} onChange={(value) => onYamlChange(value ?? '')} onSave={onSave} />
        </div>
      )}
    </div>
  );
}
