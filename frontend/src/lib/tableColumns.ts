import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const announcementTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.type', {}),
    t('common.table.columns.title', {}),
    t('common.table.columns.enabled', {}),
    t('common.table.columns.created', {}),
  ];
};

export const assetTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('common.table.columns.name', {}),
    t('common.table.columns.size', {}),
    t('common.table.columns.created', {}),
    '',
  ];
};

export const backupConfigurationTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('pages.admin.backupConfigurations.table.columns.disk', {}),
    t('common.table.columns.created', {}),
  ];
};

export const databaseHostTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.type', {}),
    t('common.table.columns.created', {}),
  ];
};

export const databaseHostDatabaseTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.name', {}),
    t('common.table.columns.server', {}),
    t('common.table.columns.type', {}),
    t('common.table.columns.address', {}),
    t('common.table.columns.username', {}),
    t('common.table.columns.size', {}),
    t('common.table.columns.created', {}),
  ];
};

export const locationDatabaseHostTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.type', {}),
    t('common.table.columns.added', {}),
    '',
  ];
};

export const locationTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.backupConfiguration', {}),
    t('common.table.columns.created', {}),
  ];
};

export const eggRepositoryTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.description', {}),
    t('pages.admin.eggRepositories.table.columns.gitRepository', {}),
    t('common.table.columns.created', {}),
  ];
};

export const mountTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.source', {}),
    t('common.table.columns.target', {}),
    t('common.table.columns.created', {}),
  ];
};

export const nestTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.author', {}),
    t('common.table.columns.description', {}),
    t('common.table.columns.created', {}),
  ];
};

export const eggTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.author', {}),
    t('common.table.columns.description', {}),
    t('common.table.columns.created', {}),
  ];
};

export const eggConfigurationTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('pages.admin.eggConfigurations.table.columns.order', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.eggs', {}),
    t('common.table.columns.created', {}),
  ];
};

export const eggMountTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.source', {}),
    t('common.table.columns.target', {}),
    t('common.table.columns.added', {}),
    '',
  ];
};

export const nodeTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.location', {}),
    t('common.table.columns.created', {}),
  ];
};

export const nodeMountTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.source', {}),
    t('common.table.columns.target', {}),
    t('common.table.columns.added', {}),
    '',
  ];
};

export const nodeAllocationTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('common.table.columns.id', {}),
    t('common.table.columns.server', {}),
    t('common.table.columns.ip', {}),
    t('pages.admin.nodes.tabs.allocations.page.table.columns.ipAlias', {}),
    t('common.form.port', {}),
    t('common.table.columns.created', {}),
  ];
};

export const oauthProviderTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.enabled', {}),
    t('pages.admin.oAuthProviders.table.columns.loginOnly', {}),
    t('pages.admin.oAuthProviders.table.columns.linkViewable', {}),
    t('pages.admin.oAuthProviders.table.columns.userManageable', {}),
    t('common.table.columns.created', {}),
  ];
};

export const roleTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('pages.admin.roles.table.columns.serverPermissions', {}),
    t('pages.admin.roles.table.columns.adminPermissions', {}),
    t('common.table.columns.created', {}),
  ];
};

export const serverTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.status', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.node', {}),
    t('common.table.columns.owner', {}),
    t('common.table.columns.allocation', {}),
    t('common.table.columns.created', {}),
  ];
};

export const serverMountTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.source', {}),
    t('common.table.columns.target', {}),
    t('common.table.columns.added', {}),
    '',
  ];
};

export const serverAllocationTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('common.table.columns.ip', {}),
    t('pages.admin.servers.tabs.allocations.page.table.columns.ipAlias', {}),
    t('common.form.port', {}),
    t('common.table.columns.notes', {}),
    t('common.table.columns.created', {}),
    '',
  ];
};

export const userTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('common.table.columns.id', {}),
    t('common.table.columns.username', {}),
    t('pages.admin.users.table.columns.role', {}),
    t('common.table.columns.created', {}),
  ];
};

export const eggRepositoryEggTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('pages.admin.eggRepositories.tabs.eggs.page.table.columns.path', {}),
    t('common.table.columns.name', {}),
    t('common.table.columns.author', {}),
    t('common.table.columns.description', {}),
    t('common.table.columns.updated', {}),
  ];
};

export const adminOAuthProviderUsersTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('pages.admin.oAuthProviders.tabs.users.page.table.columns.user', {}),
    t('common.form.identifier', {}),
    t('common.table.columns.lastUsed', {}),
    t('common.table.columns.created', {}),
  ];
};

export const adminOAuthProviderMappingsTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('common.table.columns.type', {}),
    t('common.table.columns.target', {}),
    t('pages.admin.oAuthProviders.tabs.mappings.page.table.columns.scopes', {}),
    t('common.table.columns.created', {}),
    '',
  ];
};

export const adminUserOAuthLinkTableColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    t('common.table.columns.id', {}),
    t('pages.admin.users.tabs.oauthLinks.page.modal.add.form.oauthProvider', {}),
    t('common.form.identifier', {}),
    t('common.table.columns.lastUsed', {}),
    t('common.table.columns.created', {}),
    '',
  ];
};

export const adminActivityColumns = (): string[] => {
  const { t } = getTranslations();
  return [
    '',
    t('common.table.columns.actor', {}),
    t('common.table.columns.event', {}),
    t('common.table.columns.ip', {}),
    t('common.table.columns.when', {}),
    '',
  ];
};
