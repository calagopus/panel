import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getEmailTemplate from '@/api/admin/settings/email-templates/getEmailTemplate.ts';
import getEmailTemplates from '@/api/admin/settings/email-templates/getEmailTemplates.ts';
import updateEmailTemplate from '@/api/admin/settings/email-templates/updateEmailTemplate.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Anchor from '@/elements/Anchor.tsx';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import NavLink from '@/elements/NavLink.tsx';
import Paper from '@/elements/Paper.tsx';
import ScrollArea from '@/elements/ScrollArea.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const templateFormSchema = z.object({
  subject: z.string().min(1).max(255),
  enabled: z.boolean(),
});

export default function EmailTemplatesContainer() {
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();
  const queryClient = useQueryClient();

  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const form = useForm<z.infer<typeof templateFormSchema>>({
    initialValues: { subject: '', enabled: true },
    validateInputOnBlur: true,
    validate: zod4Resolver(templateFormSchema),
  });

  const { data: templates, loading: templatesLoading } = useResource({
    queryKey: queryKeys.admin.emailTemplates.all(),
    queryFn: getEmailTemplates,
  });

  const { data: template, loading: templateLoading } = useResource({
    queryKey: queryKeys.admin.emailTemplates.detail(selectedIdentifier!),
    queryFn: () => getEmailTemplate(selectedIdentifier!),
    enabled: selectedIdentifier !== null,
  });

  useEffect(() => {
    if (!template) return;

    const values = {
      subject: template.subject ?? template.defaultSubject,
      enabled: template.enabled,
    };

    form.setValues(values);
    form.resetDirty(values);
    setEditorContent('');
  }, [template]);

  const handleSelect = (identifier: string) => {
    setSelectedIdentifier(identifier);
    setEditorContent('');
  };

  const effectiveContent = template
    ? editorContent !== ''
      ? editorContent
      : (template.content ?? template.defaultContent)
    : '';
  const isContentDirty =
    template !== undefined && editorContent !== '' && editorContent !== (template.content ?? template.defaultContent);

  const doSave = () => {
    if (!selectedIdentifier || !template) return;

    setSaving(true);

    const payload: { content?: string | null; subject?: string | null; enabled?: boolean } = {
      subject: form.values.subject,
      enabled: form.values.enabled,
    };
    if (isContentDirty) payload.content = editorContent;

    updateEmailTemplate(selectedIdentifier, payload)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.emailTemplates.detail(selectedIdentifier!) });
        addToast(t('pages.admin.settings.tabs.mailTemplates.page.toast.saved', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

  const doReset = () => {
    if (!selectedIdentifier || !template) return;

    setConfirmReset(false);
    setSaving(true);
    updateEmailTemplate(selectedIdentifier, {
      content: null,
      subject: null,
      enabled: template.defaultEnabled,
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.emailTemplates.detail(selectedIdentifier!) });
        setEditorContent('');
        addToast(t('pages.admin.settings.tabs.mailTemplates.page.toast.reset', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

  const sidebar = (
    <Paper withBorder radius='md' className='flex flex-col overflow-hidden shrink-0 md:w-72 w-full md:h-full'>
      <div className='px-3 py-2.5 bg-(--mantine-color-default)'>
        <Text size='xs' fw={600} c='dimmed' tt='uppercase' style={{ letterSpacing: '0.05em' }}>
          {t('pages.admin.settings.tabs.mailTemplates.page.sidebar.templates', {})}
        </Text>
      </div>
      <Divider />
      <ScrollArea className='flex-1' type='auto'>
        <Stack gap={0} p='xs'>
          {templatesLoading && (
            <Text size='sm' c='dimmed' p='xs'>
              {t('pages.admin.settings.tabs.mailTemplates.page.sidebar.loading', {})}
            </Text>
          )}
          {templates?.map((tpl) => (
            <NavLink
              key={tpl.identifier}
              label={tpl.identifier}
              active={selectedIdentifier === tpl.identifier}
              onClick={() => handleSelect(tpl.identifier)}
              styles={{
                label: {
                  fontSize: 'var(--mantine-font-size-sm)',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                },
              }}
            />
          ))}
        </Stack>
      </ScrollArea>

      {template && (
        <>
          <Divider />
          <div className='px-3 py-2.5 bg-(--mantine-color-default)'>
            <Text size='xs' fw={600} c='dimmed' tt='uppercase' style={{ letterSpacing: '0.05em' }}>
              {t('pages.admin.settings.tabs.mailTemplates.page.sidebar.availableVariables', {})}
            </Text>
          </div>
          <Divider />
          <ScrollArea type='auto' mah={180}>
            <Group gap='xs' p='sm'>
              {template.availableVariables.map((variable) => (
                <Badge
                  key={variable}
                  variant='light'
                  color='blue'
                  style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
                >
                  {`{{ ${variable} }}`}
                </Badge>
              ))}
            </Group>
          </ScrollArea>
        </>
      )}
    </Paper>
  );

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.mailTemplates.page.title', {})} titleOrder={2}>
      <ConfirmationModal
        title={t('pages.admin.settings.tabs.mailTemplates.page.modal.reset.title', {})}
        opened={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirmed={doReset}
        confirm={t('common.button.reset', {})}
      >
        {tReact('pages.admin.settings.tabs.mailTemplates.page.modal.reset.content', {
          identifier: selectedIdentifier ?? '',
        })}
      </ConfirmationModal>

      <Alert>
        <Text size='sm'>
          {t('pages.admin.settings.tabs.mailTemplates.page.alert.syntaxBefore', {})}
          &nbsp;
          <Anchor href='https://github.com/mitsuhiko/minijinja' target='_blank' rel='noopener noreferrer' size='sm'>
            {t('pages.admin.settings.tabs.mailTemplates.page.alert.syntaxLink', {})}
          </Anchor>
          &nbsp;
          {t('pages.admin.settings.tabs.mailTemplates.page.alert.syntaxMiddle', {})}{' '}
          <Text span ff='monospace' size='sm'>
            {'{{ variable }}'}
          </Text>{' '}
          {t('pages.admin.settings.tabs.mailTemplates.page.alert.syntaxAnd', {})}{' '}
          <Text span ff='monospace' size='sm'>
            {'{% if %}'}
          </Text>{' '}
          {t('pages.admin.settings.tabs.mailTemplates.page.alert.syntaxOr', {})}{' '}
          <Text span ff='monospace' size='sm'>
            {'{% for %}'}
          </Text>{' '}
          {t('pages.admin.settings.tabs.mailTemplates.page.alert.syntaxAfter', {})}
        </Text>
      </Alert>

      <div className='mt-4 flex flex-col md:flex-row gap-4'>
        {sidebar}

        <Paper withBorder radius='md' className='flex flex-col flex-1 min-w-0 overflow-hidden'>
          {selectedIdentifier === null ? (
            <div className='flex items-center justify-center h-64'>
              <Text c='dimmed' size='sm'>
                {t('pages.admin.settings.tabs.mailTemplates.page.empty', {})}
              </Text>
            </div>
          ) : templateLoading ? (
            <div className='flex items-center justify-center h-64'>
              <Text c='dimmed' size='sm'>
                {t('pages.admin.settings.tabs.mailTemplates.page.loadingTemplate', {})}
              </Text>
            </div>
          ) : template ? (
            <>
              <div className='px-4 py-2.5 bg-(--mantine-color-default) shrink-0'>
                <Group justify='space-between'>
                  <Group gap='xs'>
                    <Text size='sm' fw={500} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {selectedIdentifier}
                    </Text>
                  </Group>
                  <Group gap='xs'>
                    <Button size='xs' variant='subtle' onClick={() => setConfirmReset(true)} disabled={saving}>
                      {t('common.tooltip.resetToDefault', {})}
                    </Button>
                    <AdminCan action='settings.update' cantSave>
                      <Button size='xs' loading={saving} disabled={!isContentDirty && !form.isDirty()} onClick={doSave}>
                        {t('common.button.save', {})}
                      </Button>
                    </AdminCan>
                  </Group>
                </Group>
              </div>
              <Divider />
              <Stack gap='md' p='md'>
                <Group align='flex-start'>
                  <TextInput
                    label={t('pages.admin.settings.tabs.mailTemplates.page.form.subject', {})}
                    className='flex-1'
                    required
                    key={form.key('subject')}
                    {...form.getInputProps('subject')}
                  />
                  <Switch
                    label={t('common.form.enabled', {})}
                    mt='xl'
                    key={form.key('enabled')}
                    {...form.getInputProps('enabled', { type: 'checkbox' })}
                  />
                </Group>
              </Stack>

              <Divider />

              <MonacoEditor
                height='60vh'
                language='html'
                value={effectiveContent}
                options={{
                  stickyScroll: { enabled: false },
                  minimap: { enabled: false },
                  codeLens: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: false,
                  wordWrap: 'on',
                }}
                onChange={(value) => setEditorContent(value ?? '')}
              />
            </>
          ) : null}
        </Paper>
      </div>
    </AdminSubContentContainer>
  );
}
