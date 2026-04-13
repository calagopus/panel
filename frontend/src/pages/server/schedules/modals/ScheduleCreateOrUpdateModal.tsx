import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps, Stack, Title } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createSchedule from '@/api/server/schedules/createSchedule.ts';
import updateSchedule from '@/api/server/schedules/updateSchedule.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Divider from '@/elements/Divider.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { scheduleTriggerDefaultMapping, scheduleTriggerLabelMapping } from '@/lib/enums.ts';
import { serverScheduleSchema, serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { TriggerExtraForm, TriggerInlineForm } from '../triggers/TriggerForm.tsx';

type Props = ModalProps & {
  propSchedule?: z.infer<typeof serverScheduleSchema>;
  onScheduleUpdate?: (schedule: z.infer<typeof serverScheduleUpdateSchema>) => void;
};

export default function ScheduleCreateOrUpdateModal({ propSchedule, onScheduleUpdate, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, addSchedule } = useServerStore();

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverScheduleUpdateSchema>>(
    {
      initialValues: {
        name: '',
        enabled: true,
        triggers: [],
        condition: {
          type: 'none',
        },
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverScheduleUpdateSchema),
    },
    onClose,
  );

  useEffect(() => {
    if (propSchedule) {
      form.setValues({
        name: propSchedule.name,
        enabled: propSchedule.enabled,
        triggers: propSchedule.triggers,
      });
    }
  }, [propSchedule]);

  const doCreateOrUpdate = () => {
    setLoading(true);

    if (propSchedule?.uuid) {
      updateSchedule(server.uuid, propSchedule.uuid, form.values)
        .then(() => {
          addToast(t('pages.server.schedules.toast.updated', {}), 'success');
          handleClose();
          onScheduleUpdate?.(form.values);
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        })
        .finally(() => setLoading(false));
    } else {
      createSchedule(server.uuid, form.values)
        .then((schedule) => {
          addToast(t('pages.server.schedules.toast.created', {}), 'success');
          form.reset();
          handleClose();
          addSchedule(schedule);
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        })
        .finally(() => setLoading(false));
    }
  };

  const removeTrigger = (index: number) => {
    form.removeListItem('triggers', index);
  };

  const addTrigger = () => {
    form.insertListItem('triggers', scheduleTriggerDefaultMapping.cron);
  };

  return (
    <Modal
      title={
        propSchedule?.uuid
          ? t('pages.server.schedules.modal.updateSchedule.title', {})
          : t('pages.server.schedules.modal.createSchedule.title', {})
      }
      onClose={handleClose}
      opened={opened}
      size='lg'
    >
      <Stack>
        <TextInput
          label={t('pages.server.schedules.form.scheduleName', {})}
          placeholder={t('pages.server.schedules.form.scheduleName', {})}
          {...form.getInputProps('name')}
        />

        <Switch
          label={t('pages.server.schedules.form.enabled', {})}
          name='enabled'
          {...form.getInputProps('enabled', { type: 'checkbox' })}
        />

        <div>
          <Title order={4} mb='sm'>
            {t('pages.server.schedules.form.triggersList', {})}
          </Title>
          {form.values.triggers.map((_, index) => (
            <div key={`trigger-${index}`} className='flex flex-col'>
              {index !== 0 && <Divider my='sm' />}

              <div className='flex flex-row items-end space-x-2 mb-2'>
                <Select
                  label={t('pages.server.schedules.form.triggerNumber', { number: index + 1 })}
                  placeholder={t('pages.server.schedules.form.triggerNumber', { number: index + 1 })}
                  className='flex-1'
                  data={Object.entries(scheduleTriggerLabelMapping).map(([value, label]) => ({
                    value,
                    label: label(),
                  }))}
                  {...form.getInputProps(`triggers.${index}.type`)}
                />

                <TriggerInlineForm form={form} index={index} />

                <ActionIcon size='input-sm' color='red' variant='light' onClick={() => removeTrigger(index)}>
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              </div>

              <TriggerExtraForm form={form} index={index} />
            </div>
          ))}

          <Button onClick={addTrigger} mt='md' variant='light' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('pages.server.schedules.button.addTrigger', {})}
          </Button>
        </div>

        <ModalFooter>
          <Button onClick={doCreateOrUpdate} loading={loading} disabled={!form.isValid()}>
            {propSchedule?.uuid ? t('common.button.update', {}) : t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
