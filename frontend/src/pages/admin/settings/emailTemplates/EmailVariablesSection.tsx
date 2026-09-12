import { faFloppyDisk, faPlus, faRotateLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import deleteEmailVariable from '@/api/admin/settings/email-templates/variables/deleteEmailVariable.ts';
import getEmailVariables from '@/api/admin/settings/email-templates/variables/getEmailVariables.ts';
import updateEmailVariable from '@/api/admin/settings/email-templates/variables/updateEmailVariable.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import LocalizedTextArea from '@/elements/input/LocalizedTextArea.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import ScrollArea from '@/elements/layout/ScrollArea.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSettingsEmailVariableSchema } from '@/lib/schemas/admin/settings.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import EmailVariableCreateModal from './EmailVariableCreateModal.tsx';

type EmailVariable = z.infer<typeof adminSettingsEmailVariableSchema>;

interface Draft {
  value: string | null;
  valueTranslations: Record<string, string>;
}

const draftOf = (variable: EmailVariable): Draft => ({
  value: variable.value,
  valueTranslations: variable.valueTranslations,
});

const sameTranslations = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);

  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const sameDraft = (a: Draft, b: Draft): boolean =>
  a.value === b.value && sameTranslations(a.valueTranslations, b.valueTranslations);

function EmailVariableRow({
  templateIdentifier,
  variable,
  languages,
  onChanged,
  onRemove,
}: {
  templateIdentifier: string | null;
  variable: EmailVariable;
  languages: string[];
  onChanged: () => void;
  onRemove: (variable: EmailVariable) => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [draft, setDraft] = useState<Draft>(() => draftOf(variable));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftOf(variable));
  }, [variable]);

  const dirty = !sameDraft(draft, draftOf(variable));
  const missingValue = !variable.system && (draft.value === null || draft.value === '');
  const hasOverride = variable.value !== null || Object.keys(variable.valueTranslations).length > 0;

  const placeholders = Object.fromEntries(
    ['en', ...languages].map((language) => [
      language,
      language === 'en'
        ? (variable.defaultValue ?? '')
        : (draft.value ?? variable.defaultTranslations[language] ?? variable.defaultValue ?? ''),
    ]),
  );

  const doSave = () => {
    setSaving(true);

    updateEmailVariable(templateIdentifier, variable.name, {
      value: draft.value,
      valueTranslations: draft.valueTranslations,
    })
      .then(() => {
        addToast(t('pages.admin.settings.tabs.mailTemplates.page.variables.toast.saved', {}), 'success');
        onChanged();
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

  return (
    <LocalizedTextArea
      label={
        <Group gap='xs' align='center' wrap='nowrap'>
          <Code className='whitespace-nowrap'>{`vars.${variable.name}`}</Code>
          {!variable.system && (
            <Badge variant='light' color='blue' size='xs'>
              {t('pages.admin.settings.tabs.mailTemplates.page.variables.custom', {})}
            </Badge>
          )}
          <AdminCan action={['settings.read', 'email-templates.update']}>
            <Group gap={4} wrap='nowrap'>
              <Tooltip label={t('common.button.save', {})}>
                <ActionIcon
                  variant='subtle'
                  color='blue'
                  size='sm'
                  loading={saving}
                  disabled={!dirty || missingValue}
                  onClick={doSave}
                >
                  <FontAwesomeIcon icon={faFloppyDisk} className='w-3.5 h-3.5' />
                </ActionIcon>
              </Tooltip>
              {variable.system ? (
                <Tooltip label={t('common.tooltip.resetToDefault', {})}>
                  <ActionIcon
                    variant='subtle'
                    color='gray'
                    size='sm'
                    disabled={!hasOverride || saving}
                    onClick={() => onRemove(variable)}
                  >
                    <FontAwesomeIcon icon={faRotateLeft} className='w-3.5 h-3.5' />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Tooltip label={t('common.tooltip.delete', {})}>
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    size='sm'
                    disabled={saving}
                    onClick={() => onRemove(variable)}
                  >
                    <FontAwesomeIcon icon={faTrash} className='w-3.5 h-3.5' />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </AdminCan>
        </Group>
      }
      languages={languages}
      value={draft.value}
      setValue={(value) => setDraft((d) => ({ ...d, value }))}
      valueTranslations={draft.valueTranslations}
      setValueTranslations={(valueTranslations) => setDraft((d) => ({ ...d, valueTranslations }))}
      placeholders={placeholders}
      error={
        missingValue ? t('pages.admin.settings.tabs.mailTemplates.page.variables.error.valueRequired', {}) : undefined
      }
      autosize
      minRows={1}
      maxRows={6}
      styles={{
        input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 'var(--mantine-font-size-sm)' },
      }}
    />
  );
}

export default function EmailVariablesSection({
  templateIdentifier,
  className,
}: {
  templateIdentifier: string | null;
  className?: string;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const languages = useGlobalStore((state) => state.languages);

  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<EmailVariable | null>(null);

  const { data: variables, invalidate } = useResource({
    queryKey: queryKeys.admin.emailTemplates.variables(templateIdentifier),
    queryFn: () => getEmailVariables(templateIdentifier),
  });

  const doRemove = () => {
    if (!removing) return;
    setRemoving(null);

    deleteEmailVariable(templateIdentifier, removing.name)
      .then(() => {
        addToast(
          t(
            removing.system
              ? 'pages.admin.settings.tabs.mailTemplates.page.variables.toast.reset'
              : 'pages.admin.settings.tabs.mailTemplates.page.variables.toast.deleted',
            {},
          ),
          'success',
        );
        invalidate();
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  };

  return (
    <Paper withBorder radius='md' className={classNames('flex! flex-col overflow-hidden', className)}>
      <EmailVariableCreateModal
        templateIdentifier={templateIdentifier}
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />
      <ConfirmationModal
        title={
          removing?.system
            ? t('pages.admin.settings.tabs.mailTemplates.page.variables.modal.reset.title', {})
            : t('pages.admin.settings.tabs.mailTemplates.page.variables.modal.delete.title', {})
        }
        opened={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirmed={doRemove}
        confirm={removing?.system ? t('common.button.reset', {}) : t('common.button.delete', {})}
      >
        {t(
          removing?.system
            ? 'pages.admin.settings.tabs.mailTemplates.page.variables.modal.reset.content'
            : 'pages.admin.settings.tabs.mailTemplates.page.variables.modal.delete.content',
          { name: removing?.name ?? '' },
        ).md()}
      </ConfirmationModal>

      <div className='px-4 py-2.5 bg-(--mantine-color-default) shrink-0'>
        <Group justify='space-between' wrap='nowrap'>
          <Text size='sm' fw={500}>
            {t('pages.admin.settings.tabs.mailTemplates.page.variables.title', {})}
          </Text>
          <AdminCan action={['settings.read', 'email-templates.update']}>
            <Button
              size='xs'
              variant='subtle'
              leftSection={<FontAwesomeIcon icon={faPlus} className='w-3 h-3' />}
              onClick={() => setCreateOpen(true)}
            >
              {t('pages.admin.settings.tabs.mailTemplates.page.variables.add', {})}
            </Button>
          </AdminCan>
        </Group>
      </div>
      <Divider />
      <ScrollArea className='flex-1 min-h-0 max-h-[70vh] md:max-h-none' type='auto'>
        <Stack gap='md' p='md'>
          <Text size='xs' c='dimmed'>
            {templateIdentifier === null
              ? t('pages.admin.settings.tabs.mailTemplates.page.variables.globalDescription', {})
              : t('pages.admin.settings.tabs.mailTemplates.page.variables.description', {})}{' '}
            <Code>{'{{ vars.name }}'}</Code>{' '}
            {t('pages.admin.settings.tabs.mailTemplates.page.variables.descriptionAfter', {})}
          </Text>

          {variables === undefined ? (
            <Text size='sm' c='dimmed'>
              {t('pages.admin.settings.tabs.mailTemplates.page.variables.loading', {})}
            </Text>
          ) : variables.length > 0 ? (
            variables.map((variable) => (
              <EmailVariableRow
                key={variable.name}
                templateIdentifier={templateIdentifier}
                variable={variable}
                languages={languages}
                onChanged={invalidate}
                onRemove={setRemoving}
              />
            ))
          ) : (
            <Text size='sm' c='dimmed'>
              {t('pages.admin.settings.tabs.mailTemplates.page.variables.empty', {})}
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
