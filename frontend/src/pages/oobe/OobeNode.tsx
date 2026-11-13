import {
  faAddressCard,
  faChevronLeft,
  faExclamationTriangle,
  faGlobe,
  faGlobeAmericas,
  faNetworkWired,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createNodeAllocations from '@/api/admin/nodes/allocations/createNodeAllocations.ts';
import createNode from '@/api/admin/nodes/createNode.ts';
import updateNode from '@/api/admin/nodes/updateNode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { schemaFormOptions } from '@/elements/form-engine/useFormEngine.ts';
import NodeAllocationIpInput from '@/elements/input/NodeAllocationIpInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { isNodeAIO, WINGS_DEFAULT_PORT } from '@/lib/domain/node.ts';
import { resolvePorts } from '@/lib/network/ip.ts';
import { getUrlConnectPort, urlIsMissingPort, withUrlPort } from '@/lib/network/url.ts';
import { adminNodeAllocationsSchema } from '@/lib/schemas/admin/nodes.ts';
import { oobeNodeSchema } from '@/lib/schemas/oobe.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeNode({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvedPorts, setResolvedPorts] = useState<number[]>([]);

  const [existingNode, setExistingNode] = useState(data.nodes[0]);
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
    ...liveValidation,
    ...schemaFormOptions<z.infer<typeof oobeNodeSchema>>(oobeNodeSchema),
  });

  const allocationsForm = useForm<z.infer<typeof adminNodeAllocationsSchema>>({
    initialValues: {
      ip: '',
      ipAlias: null,
      ports: [],
    },
    ...liveValidation,
    validate: zod4Resolver(adminNodeAllocationsSchema),
  });

  useEffect(() => {
    if (!locationUuid && !isEdit) {
      setError(t('pages.oobe.node.error.noLocations', {}));
    }
  }, [locationUuid, isEdit]);

  useEffect(() => {
    const { resolved, toRemove } = resolvePorts(allocationsForm.values.ports);

    for (const removable of toRemove) {
      allocationsForm.setFieldValue('ports', (p) => p.filter((r) => r !== removable));
    }

    setResolvedPorts(resolved);
  }, [allocationsForm.values.ports]);

  const showAllocationsForm = data.allocations.length === 0;

  const onSubmit = async (values: z.infer<typeof oobeNodeSchema>) => {
    setLoading(true);

    try {
      let nodeIsAIO: boolean;

      if (isEdit) {
        await updateNode(existingNode.uuid, {
          name: values.name,
          description: existingNode.description,
          deploymentEnabled: existingNode.deploymentEnabled,
          maintenanceEnabled: existingNode.maintenanceEnabled,
          publicUrl: values.publicUrl,
          url: values.url,
          sftpHost: values.sftpHost,
          sftpPort: values.sftpPort,
          memory: values.memory,
          disk: values.disk,
          locationUuid: existingNode.location.uuid,
          backupConfigurationUuid: existingNode.backupConfiguration?.uuid ?? null,
        });

        nodeIsAIO = isNodeAIO(existingNode);

        if (showAllocationsForm && allocationsForm.values.ip && resolvedPorts.length > 0) {
          await createNodeAllocations(existingNode.uuid, {
            ip: allocationsForm.values.ip,
            ipAlias: null,
            ports: resolvedPorts,
          });
        }
      } else {
        const node = await createNode({
          name: values.name,
          description: null,
          deploymentEnabled: true,
          maintenanceEnabled: false,
          publicUrl: values.publicUrl,
          url: values.url,
          sftpHost: values.sftpHost,
          sftpPort: values.sftpPort,
          memory: values.memory,
          disk: values.disk,
          locationUuid: locationUuid!,
          backupConfigurationUuid: null,
        });
        setExistingNode(node);
        nodeIsAIO = isNodeAIO(node);

        await createNodeAllocations(node.uuid, {
          ip: allocationsForm.values.ip,
          ipAlias: null,
          ports: resolvedPorts,
        });
      }

      data.refetch();
      onNext(nodeIsAIO ? 1 : 0);
    } catch (msg) {
      setError(httpErrorToHuman(msg));
    }
    setLoading(false);
  };

  const isFormValid = form.isValid() && !!locationUuid && (!showAllocationsForm || allocationsForm.isValid());

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.node.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap='xl'>
          <div className='flex flex-col gap-4'>
            <TextInput
              withAsterisk
              label={t('common.form.name', {})}
              placeholder={t('pages.oobe.node.form.namePlaceholder', {})}
              leftSection={<FontAwesomeIcon icon={faAddressCard} size='sm' />}
              {...form.getInputProps('name')}
            />
            <div className='flex flex-col sm:flex-row gap-2'>
              <TextInput
                withAsterisk
                className='flex-1'
                label={t('common.form.url', {})}
                description={t('pages.oobe.node.form.urlDescription', {})}
                leftSection={<FontAwesomeIcon icon={faGlobe} size='sm' />}
                placeholder='https://node.example.com:8080'
                {...form.getInputProps('url')}
                disabled={isEdit && isNodeAIO(existingNode)}
              />
              <TextInput
                className='flex-1'
                label={t('common.form.publicUrl', {})}
                description={t('pages.oobe.node.form.publicUrlDescription', {})}
                leftSection={<FontAwesomeIcon icon={faGlobeAmericas} size='sm' />}
                placeholder='https://node.example.com:8080'
                {...form.getInputProps('publicUrl')}
                disabled={isEdit && isNodeAIO(existingNode)}
              />
            </div>
            {!(isEdit && isNodeAIO(existingNode)) && urlIsMissingPort(form.values.url) && (
              <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                <div className='flex flex-col items-start gap-2'>
                  {t('pages.admin.nodes.tabs.general.page.alert.urlMissingPort', {
                    port: String(getUrlConnectPort(form.values.url) ?? 443),
                    wingsPort: String(WINGS_DEFAULT_PORT),
                  }).md()}
                  <Button
                    size='compact-xs'
                    variant='light'
                    color='yellow'
                    onClick={() => form.setFieldValue('url', withUrlPort(form.values.url, WINGS_DEFAULT_PORT))}
                  >
                    {t('common.button.addDefaultPort', {
                      port: String(WINGS_DEFAULT_PORT),
                    })}
                  </Button>
                </div>
              </Alert>
            )}
            <div className='flex flex-col sm:flex-row gap-2'>
              <TextInput
                className='flex-1'
                label={t('common.form.sftpHost', {})}
                placeholder={t('common.form.sftpHost', {})}
                leftSection={<FontAwesomeIcon icon={faNetworkWired} size='sm' />}
                {...form.getInputProps('sftpHost')}
              />
              <NumberInput
                withAsterisk
                className='flex-1'
                label={t('common.form.sftpPort', {})}
                placeholder={t('common.form.sftpPort', {})}
                leftSection={<FontAwesomeIcon icon={faNetworkWired} size='sm' />}
                min={1}
                max={65535}
                {...form.getInputProps('sftpPort')}
              />
            </div>
            <div className='flex flex-col sm:flex-row gap-2'>
              <SizeInput
                withAsterisk
                label={t('common.form.memory', {})}
                description={t('pages.admin.nodes.tabs.general.page.form.unlimitedTooltip', {})}
                mode='mb'
                min={0}
                className='flex-1'
                value={form.values.memory}
                onChange={(value) => form.setFieldValue('memory', value)}
              />
              <SizeInput
                withAsterisk
                label={t('common.form.disk', {})}
                description={t('pages.admin.nodes.tabs.general.page.form.unlimitedTooltip', {})}
                mode='mb'
                min={0}
                className='flex-1'
                value={form.values.disk}
                onChange={(value) => form.setFieldValue('disk', value)}
              />
            </div>

            {showAllocationsForm && (
              <Card>
                <Title order={4}>{t('pages.oobe.node.allocationsTitle', {})}</Title>
                <div className='flex flex-col sm:flex-row gap-2 items-start'>
                  <NodeAllocationIpInput
                    withAsterisk
                    className='flex-1'
                    nodeUuid={existingNode?.uuid}
                    label={t('pages.oobe.node.form.ip', {})}
                    {...allocationsForm.getInputProps('ip')}
                  />
                  <TagsInput
                    withAsterisk
                    flex={1}
                    label={t('common.form.portRanges', {})}
                    placeholder={t('common.form.portRangesPlaceholder', {})}
                    {...allocationsForm.getInputProps('ports')}
                  />
                </div>
              </Card>
            )}
          </div>

          <Group justify='flex-end'>
            {!isEdit && (
              <Text size='xs' c='dimmed' className='flex-1' miw={200}>
                {t('pages.oobe.node.skipHint', {})}
              </Text>
            )}
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
