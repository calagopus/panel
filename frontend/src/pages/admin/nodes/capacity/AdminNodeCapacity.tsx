import { faHardDrive, faMemory, faMicrochip, faServer, faUserLarge } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import getNodeCapacity from '@/api/admin/nodes/getNodeCapacity.ts';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import SemiCircleProgress from '@/elements/SemiCircleProgress.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Title from '@/elements/Title.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

function LimitedResource({
  label,
  icon,
  allocated,
  limit,
  footer,
}: {
  label: string;
  icon: React.ReactNode;
  allocated: number;
  limit: number;
  footer?: React.ReactNode;
}) {
  const percent = limit > 0 ? (allocated / limit) * 100 : 0;

  return (
    <Card>
      <Group grow>
        <div className='flex justify-center'>
          <SemiCircleProgress
            value={Math.min(percent, 100)}
            label={<>{percent.toFixed(1)}%</>}
            filledSegmentColor={percent >= 90 ? 'red' : undefined}
          />
        </div>
        <div className='flex flex-col text-right flex-1'>
          <Title order={2}>
            {icon} {label}
          </Title>
          <h2>
            {bytesToString(mbToBytes(allocated))} / {bytesToString(mbToBytes(limit))}
          </h2>
          {footer}
        </div>
      </Group>
    </Card>
  );
}

function UnlimitedResource({
  label,
  icon,
  value,
  footer,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <Card>
      <Group grow>
        <div className='flex justify-center'>
          <SemiCircleProgress value={100} label='--' filledSegmentColor='gray' />
        </div>
        <div className='flex flex-col text-right flex-1'>
          <Title order={2}>
            {icon} {label}
          </Title>
          <h2>{value}</h2>
          <p className='text-xs'>{footer ?? t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}</p>
        </div>
      </Group>
    </Card>
  );
}

export default function AdminNodeCapacity({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();

  const { data: capacity } = useResource({
    queryKey: queryKeys.admin.nodes.capacity(node.uuid),
    queryFn: () => getNodeCapacity(node.uuid),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.capacity.page.title', {})}
      subtitle={t('pages.admin.nodes.tabs.capacity.page.subtitle', {})}
      titleOrder={2}
    >
      {!capacity ? (
        <Spinner.Centered />
      ) : (
        <>
          <Group>
            <Badge color={node.deploymentEnabled ? 'green' : 'red'} variant='light'>
              {node.deploymentEnabled
                ? t('pages.admin.nodes.tabs.capacity.page.status.deploymentEnabled', {})
                : t('pages.admin.nodes.tabs.capacity.page.status.deploymentDisabled', {})}
            </Badge>
            <Badge color={node.maintenanceEnabled ? 'red' : 'gray'} variant='light'>
              {node.maintenanceEnabled
                ? t('pages.admin.nodes.tabs.capacity.page.status.maintenanceEnabled', {})
                : t('pages.admin.nodes.tabs.capacity.page.status.maintenanceDisabled', {})}
            </Badge>
          </Group>

          <div className='mt-4'>
            <TitleCard
              title={t('pages.admin.nodes.tabs.capacity.page.card.resources', {})}
              icon={<FontAwesomeIcon icon={faUserLarge} />}
              rightSection={
                <Badge color='gray' variant='light'>
                  <FontAwesomeIcon icon={faServer} className='mr-1.5' />
                  {t('pages.admin.nodes.tabs.capacity.page.label.servers', {})}: {capacity.allocated.servers}
                </Badge>
              }
            >
              <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
                {capacity.limits.memory === 0 ? (
                  <UnlimitedResource
                    label={t('pages.admin.nodes.tabs.capacity.page.label.memory', {})}
                    icon={<FontAwesomeIcon icon={faMemory} />}
                    value={bytesToString(mbToBytes(capacity.allocated.memory))}
                    footer={
                      capacity.allocated.memoryOverhead > 0
                        ? t('pages.admin.nodes.tabs.capacity.page.label.overhead', {
                            size: bytesToString(mbToBytes(capacity.allocated.memoryOverhead)),
                          })
                        : undefined
                    }
                  />
                ) : (
                  <LimitedResource
                    label={t('pages.admin.nodes.tabs.capacity.page.label.memory', {})}
                    icon={<FontAwesomeIcon icon={faMemory} />}
                    allocated={capacity.allocated.memory}
                    limit={capacity.limits.memory}
                    footer={
                      <p className='text-xs'>
                        {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                          size: bytesToString(
                            mbToBytes(Math.max(capacity.limits.memory - capacity.allocated.memory, 0)),
                          ),
                        })}
                        {capacity.allocated.memoryOverhead > 0 &&
                          ` ${t('pages.admin.nodes.tabs.capacity.page.label.overhead', {
                            size: bytesToString(mbToBytes(capacity.allocated.memoryOverhead)),
                          })}`}
                      </p>
                    }
                  />
                )}
                {capacity.limits.disk === 0 ? (
                  <UnlimitedResource
                    label={t('pages.admin.nodes.tabs.capacity.page.label.disk', {})}
                    icon={<FontAwesomeIcon icon={faHardDrive} />}
                    value={bytesToString(mbToBytes(capacity.allocated.disk))}
                  />
                ) : (
                  <LimitedResource
                    label={t('pages.admin.nodes.tabs.capacity.page.label.disk', {})}
                    icon={<FontAwesomeIcon icon={faHardDrive} />}
                    allocated={capacity.allocated.disk}
                    limit={capacity.limits.disk}
                    footer={
                      <p className='text-xs'>
                        {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                          size: bytesToString(mbToBytes(Math.max(capacity.limits.disk - capacity.allocated.disk, 0))),
                        })}
                      </p>
                    }
                  />
                )}
                <UnlimitedResource
                  label={t('pages.admin.nodes.tabs.capacity.page.label.cpu', {})}
                  icon={<FontAwesomeIcon icon={faMicrochip} />}
                  value={`${capacity.allocated.cpu}%`}
                  footer={t('pages.admin.nodes.tabs.capacity.page.label.cores', {
                    cores: (capacity.allocated.cpu / 100).toFixed(2),
                  })}
                />
              </div>
            </TitleCard>
          </div>
        </>
      )}
    </AdminSubContentContainer>
  );
}
