import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useDebouncedValue } from '@mantine/hooks';
import classNames from 'classnames';
import { useState } from 'react';
import { z } from 'zod';
import previewEmailTemplate from '@/api/admin/settings/email-templates/previewEmailTemplate.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Select from '@/elements/input/Select.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSettingsEmailVariableSchema } from '@/lib/schemas/admin/settings.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type Width = 'desktop' | 'mobile';

export default function EmailTemplatePreview({
  identifier,
  subject,
  content,
  enabled,
  variables,
}: {
  identifier: string;
  subject: string;
  content: string;
  enabled: boolean;
  variables: z.infer<typeof adminSettingsEmailVariableSchema>[];
}) {
  const { t } = useTranslations();
  const languages = useGlobalStore((state) => state.languages);
  const defaultLanguage = useAdminStore((state) => state.app.language);

  const [language, setLanguage] = useState(defaultLanguage);
  const [width, setWidth] = useState<Width>('desktop');
  const [debouncedSubject] = useDebouncedValue(subject, 400);
  const [debouncedContent] = useDebouncedValue(content, 400);

  const {
    data: preview,
    loading,
    error,
  } = useResource({
    queryKey: queryKeys.admin.emailTemplates.preview(identifier, {
      language,
      subject: debouncedSubject,
      content: debouncedContent,
      variables,
    }),
    queryFn: () =>
      previewEmailTemplate(identifier, {
        language,
        subject: debouncedSubject || undefined,
        content: debouncedContent || undefined,
      }),
    silent: true,
    keepPrevious: true,
  });

  return (
    <div className='flex flex-col flex-1 min-h-[60vh]'>
      <Stack gap='xs' p='md'>
        <Group justify='space-between'>
          <Select
            size='xs'
            searchable
            value={language}
            onChange={(value) => value && setLanguage(value)}
            data={languages.map((l) => ({
              label: new Intl.DisplayNames([l], { type: 'language' }).of(l) ?? l,
              value: l,
            }))}
          />
          <SegmentedControl
            size='xs'
            value={width}
            onChange={(value) => setWidth(value as Width)}
            data={[
              { value: 'desktop', label: t('pages.admin.settings.tabs.mailTemplates.page.preview.desktop', {}) },
              { value: 'mobile', label: t('pages.admin.settings.tabs.mailTemplates.page.preview.mobile', {}) },
            ]}
          />
        </Group>
        {!enabled && (
          <Alert color='yellow' icon={faExclamationTriangle}>
            {t('pages.admin.settings.tabs.mailTemplates.page.preview.disabled', {})}
          </Alert>
        )}
        {error ? (
          <Alert color='red' title={t('pages.admin.settings.tabs.mailTemplates.page.preview.error', {})}>
            <Text size='sm' style={{ fontFamily: 'var(--mantine-font-family-monospace)', whiteSpace: 'pre-wrap' }}>
              {httpErrorToHuman(error)}
            </Text>
          </Alert>
        ) : (
          <Text size='xs' c='dimmed'>
            {t('pages.admin.settings.tabs.mailTemplates.page.preview.sampleData', {})}
          </Text>
        )}
      </Stack>
      <Divider />
      {preview ? (
        <>
          <Group gap='xs' px='md' py='xs' wrap='nowrap'>
            <Text size='sm' c='dimmed' className='shrink-0'>
              {t('pages.admin.settings.tabs.mailTemplates.page.form.subject', {})}
            </Text>
            <Text size='sm' fw={500} truncate>
              {preview.subject}
            </Text>
            {loading && <Spinner size={14} />}
          </Group>
          <Divider />
          <div className='relative flex-1 bg-(--mantine-color-default) overflow-auto'>
            <iframe
              title={preview.subject}
              sandbox=''
              srcDoc={preview.body}
              className={classNames(
                'block h-full min-h-[60vh] mx-auto border-0 bg-white',
                width === 'mobile' ? 'w-93.75 max-w-full' : 'w-full',
              )}
            />
          </div>
        </>
      ) : (
        !error && (
          <div className='flex items-center justify-center h-64'>
            <Spinner />
          </div>
        )
      )}
    </div>
  );
}
