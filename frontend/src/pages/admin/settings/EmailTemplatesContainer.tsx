import { Divider, Group, NavLink, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

const templateFormSchema = z.object({
  subject: z.string().min(1).max(255),
  enabled: z.boolean(),
});

export default function EmailTemplatesContainer() {
  const { addToast } = useToast();
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

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: queryKeys.admin.emailTemplates.all(),
    queryFn: getEmailTemplates,
  });

  const { data: template, isLoading: templateLoading } = useQuery({
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
        addToast('Email template saved.', 'success');
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
        addToast('Email template reset to default.', 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

  const sidebar = (
    <Paper withBorder radius='md' className='flex flex-col overflow-hidden shrink-0 md:w-72 w-full md:h-full'>
      <div className='px-3 py-2.5 bg-(--mantine-color-default)'>
        <Text size='xs' fw={600} c='dimmed' tt='uppercase' style={{ letterSpacing: '0.05em' }}>
          Templates
        </Text>
      </div>
      <Divider />
      <ScrollArea className='flex-1' type='auto'>
        <Stack gap={0} p='xs'>
          {templatesLoading && (
            <Text size='sm' c='dimmed' p='xs'>
              Loading...
            </Text>
          )}
          {templates?.map((t) => (
            <NavLink
              key={t.identifier}
              label={t.identifier}
              active={selectedIdentifier === t.identifier}
              onClick={() => handleSelect(t.identifier)}
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
              Available Variables
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
    <AdminSubContentContainer title='Email Template Settings' titleOrder={2}>
      <ConfirmationModal
        title='Reset to default'
        opened={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirmed={doReset}
        confirm='Reset'
      >
        This will discard your custom template for <strong>{selectedIdentifier}</strong> and restore the built-in
        default. This cannot be undone.
      </ConfirmationModal>

      <Alert>
        <Text size='sm'>
          Templates use the&nbsp;
          <Anchor href='https://github.com/mitsuhiko/minijinja' target='_blank' rel='noopener noreferrer' size='sm'>
            MiniJinja
          </Anchor>
          &nbsp; templating syntax. Variables are referenced with{' '}
          <Text span ff='monospace' size='sm'>
            {'{{ variable }}'}
          </Text>{' '}
          and control structures like{' '}
          <Text span ff='monospace' size='sm'>
            {'{% if %}'}
          </Text>{' '}
          and{' '}
          <Text span ff='monospace' size='sm'>
            {'{% for %}'}
          </Text>{' '}
          are supported.
        </Text>
      </Alert>

      <div className='mt-4 flex flex-col md:flex-row gap-4'>
        {sidebar}

        <Paper withBorder radius='md' className='flex flex-col flex-1 min-w-0 overflow-hidden'>
          {selectedIdentifier === null ? (
            <div className='flex items-center justify-center h-64'>
              <Text c='dimmed' size='sm'>
                Select a template from the sidebar to edit it
              </Text>
            </div>
          ) : templateLoading ? (
            <div className='flex items-center justify-center h-64'>
              <Text c='dimmed' size='sm'>
                Loading template...
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
                      Reset to default
                    </Button>
                    <AdminCan action='settings.update' cantSave>
                      <Button size='xs' loading={saving} disabled={!isContentDirty && !form.isDirty()} onClick={doSave}>
                        Save
                      </Button>
                    </AdminCan>
                  </Group>
                </Group>
              </div>
              <Divider />
              <Stack gap='md' p='md'>
                <Group align='flex-start'>
                  <TextInput
                    label='Subject'
                    className='flex-1'
                    required
                    key={form.key('subject')}
                    {...form.getInputProps('subject')}
                  />
                  <Switch
                    label='Enabled'
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
                  smoothScrolling: true,
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
