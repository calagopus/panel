import { dump } from 'js-yaml';
import { z } from 'zod';
import { adminNodeSchema, adminNodeTokenSchema } from '@/lib/schemas/admin/nodes.ts';
import { getUrlConnectPort, getUrlPortOr } from '@/lib/url.ts';

export const NODE_AIO_UUID = '7dbbbb63-1734-48c4-e1de-d1a65f62cada';
export const WINGS_DEFAULT_PORT = 8080;

export const isNodeAIO = (node: z.infer<typeof adminNodeSchema>) => {
  return node.uuid === NODE_AIO_UUID;
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

export const getNodeUrl = (node: z.infer<typeof adminNodeSchema>, path: string = '') => {
  const url = new URL(`${node.publicUrl ?? node.url}${path}`);
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
  return url.toString();
};
