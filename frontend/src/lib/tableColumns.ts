export const assetTableColumns = ['', 'Name', 'Size', 'Created'];

export const backupConfigurationTableColumns = ['ID', 'Name', 'Disk', 'Created'];

export const databaseHostTableColumns = ['ID', 'Name', 'Type', 'Created'];

export const databaseHostDatabaseTableColumns = ['Name', 'Server', 'Type', 'Address', 'Username', 'Size', 'Created'];

export const locationDatabaseHostTableColumns = ['ID', 'Name', 'Type', 'Added', ''];

export const locationTableColumns = ['ID', 'Name', 'Backup Configuration', 'Created'];

export const eggRepositoryTableColumns = ['ID', 'Name', 'Description', 'Git Repository', 'Created'];

export const mountTableColumns = ['ID', 'Name', 'Source', 'Target', 'Created'];

export const nestTableColumns = ['ID', 'Name', 'Author', 'Description', 'Created'];

export const eggTableColumns = ['ID', 'Name', 'Author', 'Description', 'Created'];

export const eggConfigurationTableColumns = ['ID', 'Order', 'Name', 'Eggs', 'Created'];

export const nodeTableColumns = ['', 'ID', 'Name', 'Location', 'Created'];

export const nodeMountTableColumns = ['ID', 'Name', 'Source', 'Target', 'Added', ''];

export const nodeAllocationTableColumns = ['', 'ID', 'Server', 'IP', 'IP Alias', 'Port', 'Created'];

export const oauthProviderTableColumns = [
  'ID',
  'Name',
  'Enabled',
  'Login Only',
  'Link Viewable',
  'User Manageable',
  'Created',
];

export const roleTableColumns = ['ID', 'Name', 'Server Permissions', 'Admin Permissions', 'Created'];

export const serverTableColumns = ['ID', 'Status', 'Name', 'Node', 'Owner', 'Allocation', 'Created'];

export const serverMountTableColumns = ['ID', 'Name', 'Source', 'Target', 'Added', ''];

export const serverAllocationTableColumns = ['', 'IP', 'IP Alias', 'Port', 'Notes', 'Created', ''];

export const userTableColumns = ['', 'ID', 'Username', 'Role', 'Created'];

export const eggRepositoryEggTableColumns = ['', 'Path', 'Name', 'Author', 'Description', ''];

export const adminOAuthProviderUsersTableColumns = ['ID', 'User', 'Identifier', 'Last Used', 'Created'];

export const adminUserOAuthLinkTableColumns = ['ID', 'OAuth Provider', 'Identifier', 'Last Used', 'Created', ''];

export const adminActivityColumns = ['', 'Actor', 'Event', 'IP', 'When', ''];
