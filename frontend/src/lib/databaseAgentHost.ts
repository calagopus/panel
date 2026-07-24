import { dump } from 'js-yaml';

export const DATABASE_AGENT_DEFAULT_PORT = 8080;

interface DatabaseAgentHostConfigurationParams {
  token: string;
  apiPort: number;
}

export const getDatabaseAgentHostConfiguration = ({ token, apiPort }: DatabaseAgentHostConfigurationParams) => {
  return {
    api: {
      bind: `0.0.0.0:${apiPort}`,
      token,
    },
  };
};

export const getDatabaseAgentHostConfigurationCommand = (params: DatabaseAgentHostConfigurationParams) => {
  const config = getDatabaseAgentHostConfiguration(params);
  const yaml = dump(config, {
    flowSkipCommaSpace: true,
    flowSkipColonSpace: true,
    quoteFlowKeys: true,
    indent: 1,
    seqNoIndent: true,
  });
  return `calagopus-db-agent configure --join-data ${btoa(yaml)}`;
};
