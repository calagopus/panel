import { faExclamationTriangle, faLock } from '@fortawesome/free-solid-svg-icons';
import { ReactNode } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import YamlEditor from '@/elements/editors/YamlEditor.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Code from '@/elements/typography/Code.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function LiveYamlConfigSection({
  title,
  saveLabel,
  updateAction,
  yaml,
  lockedPaths,
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
  lockedPaths: string[];
  onYamlChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  errorText: ReactNode;
  errorExtra?: ReactNode;
}) {
  const { t } = useTranslations();

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
        <Alert color='red' icon={faExclamationTriangle}>
          <Stack gap='xs'>
            {errorText}
            {errorExtra}
          </Stack>
        </Alert>
      ) : yaml === null ? (
        <Spinner.Centered />
      ) : (
        <Stack>
          {lockedPaths.length > 0 && (
            <Alert color='blue' icon={faLock}>
              <Stack gap='xs'>
                {t('elements.lockedConfigPaths.notice', {})}
                <div className='flex flex-wrap gap-1'>
                  {lockedPaths.map((path) => (
                    <Code key={path}>{path}</Code>
                  ))}
                </div>
              </Stack>
            </Alert>
          )}
          <div className='rounded-md overflow-hidden'>
            <YamlEditor height='65vh' value={yaml} onChange={(value) => onYamlChange(value ?? '')} onSave={onSave} />
          </div>
        </Stack>
      )}
    </div>
  );
}
