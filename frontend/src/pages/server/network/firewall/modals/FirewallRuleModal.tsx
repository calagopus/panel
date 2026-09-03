import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Select from '@/elements/input/Select.tsx';
import ServerFileInput from '@/elements/input/ServerFileInput.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { networkProtocolLabelMapping, serverFirewallRuleActionLabelMapping } from '@/lib/enums.ts';
import { resolvePorts } from '@/lib/network/ip.ts';
import { serverFirewallRuleSchema } from '@/lib/schemas/server/firewall.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Rule = z.infer<typeof serverFirewallRuleSchema>;

type Props = ModalProps & {
  rule?: Rule;
  onSave: (rule: Rule) => Promise<void> | void;
};

const defaultValues: Rule = {
  action: 'deny',
  protocols: [],
  sources: [],
  ports: null,
  sourceFile: null,
};

export default function FirewallRuleModal({ rule, onSave, ...props }: Props) {
  const { t } = useTranslations();
  const serverUuid = useServerStore((state) => state.server.uuid);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<Rule>({
    initialValues: defaultValues,
    validate: zod4Resolver(serverFirewallRuleSchema),
    onClose: props.onClose,
    onSubmit: onSave,
  });

  const invalidSourceIndex = Object.keys(form.errors)
    .find((key) => key.startsWith('sources.'))
    ?.split('.')[1];

  useEffect(() => {
    if (!props.opened) return;

    const values = rule ?? defaultValues;
    form.setValues(values);
    form.resetDirty(values);
  }, [props.opened]);

  return (
    <FormModal
      isDirty={isDirty}
      loading={loading}
      title={
        rule
          ? t('pages.server.firewall.modal.editRule.title', {})
          : t('pages.server.firewall.modal.createRule.title', {})
      }
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack gap='md'>
        <Select
          withAsterisk
          label={t('pages.server.firewall.form.action', {})}
          data={Object.entries(serverFirewallRuleActionLabelMapping).map(([value, label]) => ({
            value,
            label: label(),
          }))}
          {...form.getInputProps('action')}
        />

        <MultiSelect
          label={t('pages.server.firewall.form.protocols', {})}
          description={t('pages.server.firewall.form.protocolsDescription', {})}
          placeholder={t('pages.server.firewall.form.anyProtocol', {})}
          data={Object.entries(networkProtocolLabelMapping).map(([value, label]) => ({ value, label }))}
          {...form.getInputProps('protocols')}
        />

        <TagsInput
          label={t('pages.server.firewall.form.sources', {})}
          description={t('pages.server.firewall.form.sourcesDescription', {})}
          placeholder='e.g. 203.0.113.4 or 10.0.0.0/8'
          allowReordering={false}
          {...form.getInputProps('sources')}
          error={
            invalidSourceIndex === undefined
              ? undefined
              : t('pages.server.firewall.form.invalidSource', {
                  source: form.getValues().sources[Number(invalidSourceIndex)],
                })
          }
        />

        <ServerFileInput
          serverUuid={serverUuid}
          label={t('pages.server.firewall.form.sourceFile', {})}
          description={t('pages.server.firewall.form.sourceFileDescription', {})}
          placeholder='e.g. firewall/allowed.txt'
          value={form.getValues().sourceFile ?? ''}
          onChange={(value) => form.setFieldValue('sourceFile', value === '' ? null : value)}
          error={form.errors.sourceFile}
        />

        <TagsInput
          label={t('pages.server.firewall.form.ports', {})}
          description={t('pages.server.firewall.form.portsDescription', {})}
          placeholder='e.g. 25565 or 25565-25570'
          allowReordering={false}
          value={form.getValues().ports?.map(String) ?? []}
          onChange={(ports) => {
            const { resolved } = resolvePorts(ports);
            form.setFieldValue('ports', resolved.length === 0 ? null : resolved.sort((a, b) => a - b));
          }}
          error={form.errors.ports}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {rule ? t('common.button.update', {}) : t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
