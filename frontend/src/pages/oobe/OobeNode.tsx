import {
  faAddressCard,
  faChevronLeft,
  faGlobe,
  faGlobeAmericas,
  faNetworkWired,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createNodeAllocations from '@/api/admin/nodes/allocations/createNodeAllocations.ts';
import createNode from '@/api/admin/nodes/createNode.ts';
import updateNode from '@/api/admin/nodes/updateNode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { resolvePorts } from '@/lib/ip.ts';
import { isNodeAIO } from '@/lib/node.ts';
import { adminNodeAllocationsSchema } from '@/lib/schemas/admin/nodes.ts';
import { oobeNodeSchema } from '@/lib/schemas/oobe.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeNode({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvedPorts, setResolvedPorts] = useState<number[]>([]);

  const existingNode = data.nodes[0];
  const isEdit = !!existingNode;
  const locationUuid = existingNode?.location.uuid ?? data.locations[0]?.uuid;

  const form = useForm<z.infer<typeof oobeNodeSchema>>({
    initialValues: {
      name: existingNode?.name ?? '',
      url: existingNode?.url ?? '',
      publicUrl: existingNode?.publicUrl ?? null,
      sftpHost: existingNode?.sftpHost ?? null,
      sftpPort: existingNode?.sftpPort ?? 2022,
      memory: existingNode?.memory ?? 8192,
      disk: existingNode?.disk ?? 16384,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(oobeNodeSchema),
  });

  const allocationsForm = useForm<z.infer<typeof adminNodeAllocationsSchema>>({
    initialValues: {
      ip: '',
      ipAlias: null,
      ports: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminNodeAllocationsSchema),
  });

  useEffect(() => {
    if (!locationUuid && !isEdit) {
      setError(t('pages.oobe.node.error.noLocations', {}));
    }
  }, [locationUuid, isEdit]);

  useEffect(() => {
    const { resolved, toRemove } = resolvePorts(allocationsForm.values.ports);

    for (const removable in toRemove) {
      allocationsForm.setFieldValue('ports', (p) => p.filter((r) => r !== removable));
    }

    setResolvedPorts(resolved);
  }, [allocationsForm.values.ports]);

  const onSubmit = async () => {
    setLoading(true);

    try {
      if (isEdit) {
        await updateNode(existingNode.uuid, {
          name: form.values.name,
          description: existingNode.description,
          deploymentEnabled: existingNode.deploymentEnabled,
          maintenanceEnabled: existingNode.maintenanceEnabled,
          publicUrl: form.values.publicUrl,
          url: form.values.url,
          sftpHost: form.values.sftpHost,
          sftpPort: form.values.sftpPort,
          memory: form.values.memory,
          disk: form.values.disk,
          locationUuid: existingNode.location.uuid,
          backupConfigurationUuid: existingNode.backupConfiguration?.uuid ?? null,
        });

        if (isNodeAIO(existingNode) && allocationsForm.values.ip && resolvedPorts.length > 0) {
          await createNodeAllocations(existingNode.uuid, {
            ip: allocationsForm.values.ip,
            ipAlias: null,
            ports: resolvedPorts,
          });
        }
      } else {
        const node = await createNode({
          name: form.values.name,
          description: null,
          deploymentEnabled: true,
          maintenanceEnabled: false,
          publicUrl: form.values.publicUrl,
          url: form.values.url,
          sftpHost: form.values.sftpHost,
          sftpPort: form.values.sftpPort,
          memory: form.values.memory,
          disk: form.values.disk,
          locationUuid: locationUuid!,
          backupConfigurationUuid: null,
        });

        await createNodeAllocations(node.uuid, {
          ip: allocationsForm.values.ip,
          ipAlias: null,
          ports: resolvedPorts,
        });
      }

      data.refetch();
      onNext();
    } catch (msg) {
      setError(httpErrorToHuman(msg));
    } finally {
      setLoading(false);
    }
  };

  const showAllocationsForm = (!isEdit || (existingNode && isNodeAIO(existingNode))) && data.allocations.length === 0;
  const isFormValid = form.isValid() && !!locationUuid && (!showAllocationsForm || allocationsForm.isValid());

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.node.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <form onSubmit={form.onSubmit(() => onSubmit())}>
        <Stack gap='xl'>
          <div className='flex flex-col gap-4'>
            <TextInput
              withAsterisk
              label={t('pages.oobe.node.form.name', {})}
              placeholder={t('pages.oobe.node.form.namePlaceholder', {})}
              leftSection={<FontAwesomeIcon icon={faAddressCard} size='sm' />}
              {...form.getInputProps('name')}
            />
            <div className='flex flex-col sm:flex-row gap-2'>
              <TextInput
                withAsterisk
                className='flex-1'
                label={t('pages.oobe.node.form.url', {})}
                description={t('pages.oobe.node.form.urlDescription', {})}
                leftSection={<FontAwesomeIcon icon={faGlobe} size='sm' />}
                placeholder={t('pages.oobe.node.form.urlPlaceholder', {})}
                {...form.getInputProps('url')}
                disabled={isEdit && isNodeAIO(existingNode)}
              />
              <TextInput
                className='flex-1'
                label={t('pages.oobe.node.form.publicUrl', {})}
                description={t('pages.oobe.node.form.publicUrlDescription', {})}
                leftSection={<FontAwesomeIcon icon={faGlobeAmericas} size='sm' />}
                placeholder={t('pages.oobe.node.form.publicUrlPlaceholder', {})}
                {...form.getInputProps('publicUrl')}
                disabled={isEdit && isNodeAIO(existingNode)}
              />
            </div>
            <div className='flex flex-col sm:flex-row gap-2'>
              <TextInput
                className='flex-1'
                label={t('pages.oobe.node.form.sftpHost', {})}
                placeholder={t('pages.oobe.node.form.sftpHostPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faNetworkWired} size='sm' />}
                {...form.getInputProps('sftpHost')}
              />
              <NumberInput
                withAsterisk
                className='flex-1'
                label={t('pages.oobe.node.form.sftpPort', {})}
                placeholder={t('pages.oobe.node.form.sftpPortPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faNetworkWired} size='sm' />}
                min={1}
                max={65535}
                {...form.getInputProps('sftpPort')}
              />
            </div>
            <div className='flex flex-col sm:flex-row gap-2'>
              <SizeInput
                withAsterisk
                label={t('pages.oobe.node.form.memory', {})}
                mode='mb'
                min={0}
                flex={1}
                value={form.values.memory}
                onChange={(value) => form.setFieldValue('memory', value)}
              />
              <SizeInput
                withAsterisk
                label={t('pages.oobe.node.form.disk', {})}
                mode='mb'
                min={0}
                flex={1}
                value={form.values.disk}
                onChange={(value) => form.setFieldValue('disk', value)}
              />
            </div>

            {showAllocationsForm && (
              <Card>
                <Title order={4}>{t('pages.oobe.node.allocationsTitle', {})}</Title>
                <div className='flex flex-col sm:flex-row gap-2 items-start'>
                  <TextInput
                    withAsterisk
                    className='flex-1'
                    label={t('pages.oobe.node.form.ip', {})}
                    placeholder={t('pages.oobe.node.form.ip', {})}
                    {...allocationsForm.getInputProps('ip')}
                  />
                  <TagsInput
                    withAsterisk
                    flex={1}
                    label={t('pages.oobe.node.form.portRanges', {})}
                    placeholder={t('pages.oobe.node.form.portRangesPlaceholder', {})}
                    {...allocationsForm.getInputProps('ports')}
                  />
                </div>
              </Card>
            )}
          </div>

          <Group justify='flex-end'>
            {canGoBack && (
              <Button variant='subtle' onClick={onBack} leftSection={<FontAwesomeIcon icon={faChevronLeft} />}>
                Back
              </Button>
            )}
            {!isEdit && (
              <Button variant='outline' onClick={() => skipFrom('node')}>
                {t('common.button.skip', {})}
              </Button>
            )}
            <Button type='submit' disabled={!isFormValid} loading={loading}>
              {isEdit ? t('common.button.save', {}) : t('pages.oobe.node.button.create', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
