import { z } from 'zod';
import SystemStatistics from '@/elements/admin/SystemStatistics.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminDatabaseAgentHostStatistics({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t, tItem } = useTranslations();

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.statistics.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.statistics.subContainer}
      registryProps={{ databaseAgentHost }}
    >
      <SystemStatistics
        wsPath={`/api/admin/database-agent-hosts/${databaseAgentHost.uuid}/system/stats/ws`}
        labels={{
          cpu: t('common.stat.cpu', {}),
          memory: t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.memory', {}),
          disk: t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.disk', {}),
          network: t('common.stat.network', {}),
          resourcesCard: t('common.stat.resources', {}),
          graphsCard: t('pages.admin.databaseAgentHosts.tabs.statistics.page.card.graphs', {}),
          cpuLoad: t('common.stat.cpuLoad', {}),
          memoryUsage: t('common.stat.memoryUsage', {}),
          diskIo: t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.diskIo', {}),
          networkTraffic: t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.networkTraffic', {}),
          diskRead: t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.diskRead', {}),
          diskWrite: t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.diskWrite', {}),
          inbound: t('common.stat.inbound', {}),
          outbound: t('common.stat.outbound', {}),
          connectionLost: t('pages.admin.databaseAgentHosts.tabs.statistics.page.toast.connectionLost', {}),
          cpuThreads: (model, threads) =>
            t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.cpuThreads', {
              model,
              threads: tItem('thread', threads),
            }),
          memoryUsedByProcess: (size) =>
            t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.usedByAgent', { size }),
          networkIn: (in_) => t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.networkIn', { in: in_ }),
          networkOut: (out) => t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.networkOut', { out }),
        }}
      />
    </AdminSubContentContainer>
  );
}
