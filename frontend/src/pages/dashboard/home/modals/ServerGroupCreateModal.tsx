import { ModalProps } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { FormEvent, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createServerGroup from '@/api/me/servers/groups/createServerGroup.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

const schema = z.object({
  name: z.string().min(2).max(31),
});

export default function ServerGroupCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const addServerGroup = useUserStore((state) => state.addServerGroup);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    initialValues: {
      name: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(schema),
  });

  const doCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    createServerGroup({
      name: form.values.name,
      serverOrder: [],
    })
      .then((serverGroup) => {
        addServerGroup(serverGroup);

        props.onClose();
        addToast(t('pages.account.home.tabs.groupedServers.page.modal.createServerGroup.toast.created', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('pages.account.home.tabs.groupedServers.page.modal.createServerGroup.title', {})}
      loading={loading}
      {...props}
      onSubmit={doCreate}
    >
      <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!form.isValid()}>
          {t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
