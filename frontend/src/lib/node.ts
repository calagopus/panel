import jsYaml from 'js-yaml';
import { z } from 'zod';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';

export const NODE_AIO_UUID = '7dbbbb63-1734-48c4-e1de-d1a65f62cada';

export const isNodeAIO = (node: z.infer<typeof adminNodeSchema>) => {
  return node.uuid === NODE_AIO_UUID;
};

interface NodeConfigurationParams {
  node: z.infer<typeof adminNodeSchema>;
  remote: string;
  apiPort: number;
  sftpPort: number;
}

export const getNodeConfiguration = ({ node, remote, apiPort, sftpPort }: NodeConfigurationParams) => {
  let origin = window.location.origin;
  try {
    origin = new URL(remote).origin;
  } catch {
    // ignore
  }

  return {
    uuid: node.uuid,
    token_id: node.tokenId,
    token: node.token,
    api: {
      port: apiPort,
      disable_openapi_docs: true,
      upload_limit: 10240,
    },
    system: {
      sftp: {
        bind_port: sftpPort,
      },
    },
    allowed_mounts: [],
    remote: origin,
  };
};

export const getNodeConfigurationCommand = ({ node, remote, apiPort, sftpPort }: NodeConfigurationParams) => {
  return `wings configure --join-data ${btoa(jsYaml.dump(getNodeConfiguration({ node, remote, apiPort, sftpPort }), { condenseFlow: true, indent: 1, noArrayIndent: true }))}`;
};

export const getNodeUrl = (node: z.infer<typeof adminNodeSchema>, path: string = '') => {
  const url = new URL(`${node.publicUrl ?? node.url}${path}`);
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
  return url.toString();
};
