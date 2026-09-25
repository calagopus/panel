import { dump } from 'js-yaml';
import { z } from 'zod';
import { getUrlConnectPort, getUrlPortOr } from '@/lib/network/url.ts';
import { AdminNodeAllocatedCapacity, adminNodeSchema, adminNodeTokenSchema } from '@/lib/schemas/admin/nodes.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const NODE_AIO_UUID = '7dbbbb63-1734-48c4-e1de-d1a65f62cada';
export const WINGS_DEFAULT_PORT = 8080;
export const NODE_TUNNEL_DEFAULT_PORT = 7100;

export const MAX_TRANSFER_MULTIPLEX_CHANNELS = 16;

export const NODE_DEPLOYMENT_NEARLY_FULL_RATIO = 0.9;

export type NodeDeploymentState = 'disabled' | 'maintenance' | 'full' | 'nearlyFull' | 'available';

export const nodeDeploymentStateInfo: Record<NodeDeploymentState, { badgeColor: string; label: () => string }> = {
  disabled: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.node.deployment.disabled', {}),
  },
  maintenance: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.node.deployment.maintenance', {}),
  },
  full: {
    badgeColor: 'orange',
    label: () => getTranslations().t('common.node.deployment.full', {}),
  },
  nearlyFull: {
    badgeColor: 'yellow',
    label: () => getTranslations().t('common.node.deployment.nearlyFull', {}),
  },
  available: {
    badgeColor: 'green',
    label: () => getTranslations().t('common.node.deployment.available', {}),
  },
};

export const getNodeDeploymentUsage = (
  node: z.infer<typeof adminNodeSchema>,
  allocated: AdminNodeAllocatedCapacity,
) => ({
  memory: { used: allocated.memory + allocated.memoryOverhead, limit: node.memory },
  disk: { used: allocated.disk, limit: node.disk },
});

export const getNodeDeploymentState = (
  node: z.infer<typeof adminNodeSchema>,
  allocated?: AdminNodeAllocatedCapacity,
): NodeDeploymentState => {
  if (!node.deploymentEnabled) return 'disabled';
  if (node.maintenanceEnabled) return 'maintenance';
  if (!allocated) return 'available';

  const ratios = Object.values(getNodeDeploymentUsage(node, allocated)).map(({ used, limit }) =>
    limit === 0 ? 0 : used / limit,
  );
  const highest = Math.max(...ratios);

  if (highest >= 1) return 'full';
  if (highest >= NODE_DEPLOYMENT_NEARLY_FULL_RATIO) return 'nearlyFull';

  return 'available';
};

export const isNodeAIO = (node: z.infer<typeof adminNodeSchema>) => {
  return node.uuid === NODE_AIO_UUID;
};

export const getNodeTunnelDefaultHost = (node: z.infer<typeof adminNodeSchema>, appUrl: string) => {
  try {
    return new URL(isNodeAIO(node) ? appUrl : node.url).hostname;
  } catch {
    return window.location.hostname;
  }
};

export const getNodeConnectPort = (node: z.infer<typeof adminNodeSchema>) => getUrlConnectPort(node.url);
export const getNodeDefaultApiPort = (node: z.infer<typeof adminNodeSchema>) =>
  getUrlPortOr(node.url, WINGS_DEFAULT_PORT);

interface NodeConfigurationParams {
  node: z.infer<typeof adminNodeSchema>;
  token: z.infer<typeof adminNodeTokenSchema>;
  remote: string;
  apiPort: number;
  sftpPort: number;
}

export const getNodeConfiguration = ({ node, token, remote, apiPort, sftpPort }: NodeConfigurationParams) => {
  let origin = window.location.origin;
  try {
    origin = new URL(remote).origin;
  } catch {
    // ignore
  }

  return {
    uuid: node.uuid,
    token_id: token.tokenId,
    token: token.token,
    api: {
      port: apiPort,
      disable_openapi_docs: true,
      upload_limit: 0,
    },
    system: {
      sftp: {
        bind_port: sftpPort,
      },
    },
    remote: origin,
  };
};

export const getNodeConfigurationCommand = ({ node, token, remote, apiPort, sftpPort }: NodeConfigurationParams) => {
  const nodeConfig = getNodeConfiguration({ node, token, remote, apiPort, sftpPort });
  const yaml = dump(nodeConfig, {
    flowSkipCommaSpace: true,
    flowSkipColonSpace: true,
    quoteFlowKeys: true,
    indent: 1,
    seqNoIndent: true,
  });
  return `calagopus-wings configure --join-data ${btoa(yaml)}`;
};

export const getNodeEnrollmentCommand = (panelUrl: string, code: string) =>
  `calagopus-wings configure --panel-url ${panelUrl} --enroll ${code}`;

export const getNodeUrl = (node: z.infer<typeof adminNodeSchema>, path: string = '') => {
  const url = new URL(`${node.publicUrl ?? node.url}${path}`);
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
  return url.toString();
};
