import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faDocker } from '@fortawesome/free-brands-svg-icons';
import {
  faBoxArchive,
  faBriefcase,
  faChartPie,
  faCloud,
  faCode,
  faCog,
  faCogs,
  faCompress,
  faComputer,
  faCopy,
  faDatabase,
  faDownload,
  faEarthAmerica,
  faEdit,
  faEgg,
  faEnvelope,
  faEquals,
  faExpand,
  faFile,
  faFileZipper,
  faFingerprint,
  faFolder,
  faFolderOpen,
  faGear,
  faHourglass,
  faKey,
  faKiwiBird,
  faNetworkWired,
  faPlay,
  faPowerOff,
  faPuzzlePiece,
  faScroll,
  faServer,
  faSkull,
  faStopwatch,
  faTerminal,
  faTextSlash,
  faTrash,
  faUnlockKeyhole,
  faUser,
  faUserSecret,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggConfigurationDeploymentSchema } from '@/lib/schemas/admin/eggConfigurations.ts';
import { processConfigurationConfigParser } from '@/lib/schemas/admin/eggs.ts';
import { adminSettingsEmailSchema, adminSettingsStorageSchema } from '@/lib/schemas/admin/settings.ts';
import { databaseType, streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { archiveFormat, compressionLevel, fingerprintAlgorithm } from '@/lib/schemas/server/files.ts';
import {
  serverScheduleComparator,
  serverScheduleConditionSchema,
  serverSchedulePreConditionSchema,
  serverScheduleStepActionSchema,
  serverScheduleTriggerSchema,
} from '@/lib/schemas/server/schedules.ts';
import { serverBackupStatus, serverPowerAction, serverPowerState } from '@/lib/schemas/server/server.ts';
import { publicSettingsCaptchaProviderSchema } from '@/lib/schemas/settings.ts';
import { userSshKeyProvider } from '@/lib/schemas/user/sshKeys.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';
import { adminDatabaseCredentialsSchema } from './schemas/admin/databaseHosts.ts';

export const captchaProviderTypeLabelMapping: Record<
  z.infer<typeof publicSettingsCaptchaProviderSchema>['type'],
  string
> = {
  none: 'None',
  turnstile: 'Turnstile',
  recaptcha: 'reCAPTCHA',
  hcaptcha: 'hCaptcha',
  friendly_captcha: 'Friendly Captcha',
};

export const compressionLevelLabelMapping: Record<z.infer<typeof compressionLevel>, string> = {
  best_speed: 'Best Speed',
  good_speed: 'Good Speed',
  good_compression: 'Good Compression',
  best_compression: 'Best Compression',
};

export const processConfigurationParserLabelMapping: Record<
  z.infer<typeof processConfigurationConfigParser>,
  string
> = {
  file: 'File',
  yaml: 'YAML',
  properties: 'Properties',
  ini: 'INI',
  json: 'JSON',
  xml: 'XML',
  toml: 'TOML',
};

export const databaseTypeLabelMapping: Record<z.infer<typeof databaseType>, string> = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  mongodb: 'MongoDB',
};

export const databaseCredentialTypeLabelMapping: Record<
  z.infer<typeof adminDatabaseCredentialsSchema>['type'],
  string
> = {
  connection_string: 'Connection String',
  details: 'Details',
};

export const backupDiskLabelMapping: Record<z.infer<typeof adminBackupConfigurationSchema>['backupDisk'], string> = {
  local: 'Local',
  s3: 'S3',
  'ddup-bak': 'Ddup-Bak',
  btrfs: 'Btrfs',
  zfs: 'ZFS',
  restic: 'Restic',
};

export const storageDriverTypeLabelMapping: Record<z.infer<typeof adminSettingsStorageSchema>['type'], string> = {
  filesystem: 'Filesystem',
  s3: 'S3',
};

export const mailModeTypeLabelMapping: Record<z.infer<typeof adminSettingsEmailSchema>['type'], string> = {
  none: 'None',
  smtp: 'SMTP',
  sendmail: 'Sendmail Command',
  filesystem: 'Filesystem',
};

export const archiveFormatLabelMapping: Record<z.infer<typeof archiveFormat>, string> = {
  tar: '.tar',
  tar_gz: '.tar.gz',
  tar_xz: '.tar.xz',
  tar_lzip: '.tar.lz',
  tar_bz2: '.tar.bz2',
  tar_lz4: '.tar.lz4',
  tar_zstd: '.tar.zst',
  zip: '.zip',
  seven_zip: '.7z',
};

export const streamingArchiveFormatLabelMapping: Record<z.infer<typeof streamingArchiveFormat>, string> = {
  tar: '.tar',
  tar_gz: '.tar.gz',
  tar_xz: '.tar.xz',
  tar_lzip: '.tar.lz',
  tar_bz2: '.tar.bz2',
  tar_lz4: '.tar.lz4',
  tar_zstd: '.tar.zst',
  zip: '.zip',
};

export const fingerprintAlgorithmLabelMapping: Record<z.infer<typeof fingerprintAlgorithm>, string> = {
  md5: 'MD5',
  crc32: 'CRC32',
  sha1: 'SHA-1',
  sha224: 'SHA-224',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
  curseforge: 'CurseForge',
};

export const eggConfigurationDeploymentDefaultMapping: Record<
  z.infer<typeof adminEggConfigurationDeploymentSchema>['mode']['type'],
  z.infer<typeof adminEggConfigurationDeploymentSchema>['mode']
> = {
  random: {
    type: 'random',
  },
  range: {
    type: 'range',
    startPort: 1024,
    endPort: 65535,
  },
  add_primary: {
    type: 'add_primary',
    value: 0,
  },
  subtract_primary: {
    type: 'subtract_primary',
    value: 0,
  },
  multiply_primary: {
    type: 'multiply_primary',
    value: 1,
  },
  divide_primary: {
    type: 'divide_primary',
    value: 1,
  },
};

export const eggConfigurationDeploymentTypeLabelMapping: Record<
  z.infer<typeof adminEggConfigurationDeploymentSchema>['mode']['type'],
  string
> = {
  random: 'Random',
  range: 'Port Range',
  add_primary: 'Add to Primary',
  subtract_primary: 'Subtract from Primary',
  multiply_primary: 'Multiply Primary',
  divide_primary: 'Divide Primary',
};

export const schedulePreConditionLabelMapping: Record<
  z.infer<typeof serverSchedulePreConditionSchema>['type'],
  () => string
> = {
  none: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.none', {}),
  and: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.and', {}),
  or: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.or', {}),
  not: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.not', {}),
  server_state: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.serverState', {}),
  uptime: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.uptime', {}),
  cpu_usage: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.cpuUsage', {}),
  memory_usage: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.memoryUsage', {}),
  disk_usage: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.diskUsage', {}),
  file_exists: () => getTranslations().t('pages.server.schedules.enum.schedulePreConditionType.fileExists', {}),
};

export const scheduleConditionLabelMapping: Record<
  z.infer<typeof serverScheduleConditionSchema>['type'],
  () => string
> = {
  none: () => getTranslations().t('pages.server.schedules.enum.scheduleConditionType.none', {}),
  and: () => getTranslations().t('pages.server.schedules.enum.scheduleConditionType.and', {}),
  or: () => getTranslations().t('pages.server.schedules.enum.scheduleConditionType.or', {}),
  not: () => getTranslations().t('pages.server.schedules.enum.scheduleConditionType.not', {}),
  variable_exists: () => getTranslations().t('pages.server.schedules.enum.scheduleConditionType.variableExists', {}),
  variable_contains: () =>
    getTranslations().t('pages.server.schedules.enum.scheduleConditionType.variableContains', {}),
  variable_equals: () => getTranslations().t('pages.server.schedules.enum.scheduleConditionType.variableEquals', {}),
  variable_starts_with: () =>
    getTranslations().t('pages.server.schedules.enum.scheduleConditionType.variableStartsWith', {}),
  variable_ends_with: () =>
    getTranslations().t('pages.server.schedules.enum.scheduleConditionType.variableEndsWith', {}),
};

export const scheduleComparatorLabelMapping: Record<z.infer<typeof serverScheduleComparator>, () => string> = {
  smaller_than: () => getTranslations().t('pages.server.schedules.enum.scheduleComparator.smallerThan', {}),
  smaller_than_or_equals: () =>
    getTranslations().t('pages.server.schedules.enum.scheduleComparator.smallerThanOrEqual', {}),
  equal: () => getTranslations().t('pages.server.schedules.enum.scheduleComparator.equal', {}),
  greater_than_or_equals: () =>
    getTranslations().t('pages.server.schedules.enum.scheduleComparator.greaterThanOrEqual', {}),
  greater_than: () => getTranslations().t('pages.server.schedules.enum.scheduleComparator.greaterThan', {}),
};

export const scheduleComparatorOperatorMapping: Record<z.infer<typeof serverScheduleComparator>, string> = {
  smaller_than: '<',
  smaller_than_or_equals: '<=',
  equal: '==',
  greater_than: '>',
  greater_than_or_equals: '>=',
};

export const serverPowerStateLabelMapping: Record<z.infer<typeof serverPowerState>, () => string> = {
  running: () => getTranslations().t('common.enum.serverState.running', {}),
  offline: () => getTranslations().t('common.enum.serverState.offline', {}),
  starting: () => getTranslations().t('common.enum.serverState.starting', {}),
  stopping: () => getTranslations().t('common.enum.serverState.stopping', {}),
};

export const serverPowerActionLabelMapping: Record<z.infer<typeof serverPowerAction>, () => string> = {
  start: () => getTranslations().t('common.enum.serverPowerAction.start', {}),
  stop: () => getTranslations().t('common.enum.serverPowerAction.stop', {}),
  restart: () => getTranslations().t('common.enum.serverPowerAction.restart', {}),
  kill: () => getTranslations().t('common.enum.serverPowerAction.kill', {}),
};

export const serverBackupStatusLabelMapping: Record<z.infer<typeof serverBackupStatus>, () => string> = {
  starting: () => getTranslations().t('common.enum.serverBackupStatus.starting', {}),
  finished: () => getTranslations().t('common.enum.serverBackupStatus.finished', {}),
  failed: () => getTranslations().t('common.enum.serverBackupStatus.failed', {}),
};

export const scheduleStepLabelMapping: Record<z.infer<typeof serverScheduleStepActionSchema>['type'], () => string> = {
  sleep: () => getTranslations().t('pages.server.schedules.steps.sleep.title', {}),
  ensure: () => getTranslations().t('pages.server.schedules.steps.ensure.title', {}),
  format: () => getTranslations().t('pages.server.schedules.steps.format.title', {}),
  match_regex: () => getTranslations().t('pages.server.schedules.steps.matchRegex.title', {}),
  wait_for_console_line: () => getTranslations().t('pages.server.schedules.steps.waitForConsoleLine.title', {}),
  send_power: () => getTranslations().t('pages.server.schedules.steps.sendPower.title', {}),
  send_command: () => getTranslations().t('pages.server.schedules.steps.sendCommand.title', {}),
  create_backup: () => getTranslations().t('pages.server.schedules.steps.createBackup.title', {}),
  create_directory: () => getTranslations().t('pages.server.schedules.steps.createDirectory.title', {}),
  write_file: () => getTranslations().t('pages.server.schedules.steps.writeFile.title', {}),
  copy_file: () => getTranslations().t('pages.server.schedules.steps.copyFile.title', {}),
  delete_files: () => getTranslations().t('pages.server.schedules.steps.deleteFiles.title', {}),
  rename_files: () => getTranslations().t('pages.server.schedules.steps.renameFiles.title', {}),
  compress_files: () => getTranslations().t('pages.server.schedules.steps.compressFiles.title', {}),
  decompress_file: () => getTranslations().t('pages.server.schedules.steps.decompressFile.title', {}),
  update_startup_variable: () => getTranslations().t('pages.server.schedules.steps.updateStartupVariable.title', {}),
  update_startup_command: () => getTranslations().t('pages.server.schedules.steps.updateStartupCommand.title', {}),
  update_startup_docker_image: () =>
    getTranslations().t('pages.server.schedules.steps.updateStartupDockerImage.title', {}),
};

export const scheduleStepDefaultMapping: Record<
  z.infer<typeof serverScheduleStepActionSchema>['type'],
  z.infer<typeof serverScheduleStepActionSchema>
> = {
  sleep: {
    type: 'sleep',
    duration: 0,
  },
  ensure: {
    type: 'ensure',
    condition: { type: 'none' },
  },
  format: {
    type: 'format',
    format: '',
    outputInto: { variable: '' },
  },
  match_regex: {
    type: 'match_regex',
    input: '',
    regex: '',
    outputInto: [],
  },
  wait_for_console_line: {
    type: 'wait_for_console_line',
    ignoreFailure: false,
    contains: '',
    caseInsensitive: false,
    timeout: 5000,
    outputInto: null,
  },
  send_power: {
    type: 'send_power',
    ignoreFailure: false,
    action: 'start',
  },
  send_command: {
    type: 'send_command',
    ignoreFailure: false,
    command: '',
  },
  create_backup: {
    type: 'create_backup',
    ignoreFailure: false,
    foreground: false,
    name: null,
    ignoredFiles: [],
  },
  create_directory: {
    type: 'create_directory',
    ignoreFailure: false,
    root: '/',
    name: '',
  },
  write_file: {
    type: 'write_file',
    ignoreFailure: false,
    append: false,
    file: '/file.txt',
    content: '',
  },
  copy_file: {
    type: 'copy_file',
    ignoreFailure: false,
    foreground: false,
    file: '/source.txt',
    destination: '/destination.txt',
  },
  delete_files: {
    type: 'delete_files',
    root: '/',
    files: [],
  },
  rename_files: {
    type: 'rename_files',
    root: '/',
    files: [],
  },
  compress_files: {
    type: 'compress_files',
    ignoreFailure: false,
    foreground: false,
    root: '/',
    files: [],
    format: 'tar_gz',
    name: 'backup.tar.gz',
  },
  decompress_file: {
    type: 'decompress_file',
    ignoreFailure: false,
    foreground: false,
    root: '/',
    file: 'backup.tar.gz',
  },
  update_startup_variable: {
    type: 'update_startup_variable',
    ignoreFailure: false,
    envVariable: '',
    value: '',
  },
  update_startup_command: {
    type: 'update_startup_command',
    ignoreFailure: false,
    command: '',
  },
  update_startup_docker_image: {
    type: 'update_startup_docker_image',
    ignoreFailure: false,
    image: '',
  },
};

export const scheduleStepIconMapping: Record<z.infer<typeof serverScheduleStepActionSchema>['type'], IconDefinition> = {
  sleep: faHourglass,
  ensure: faEquals,
  format: faTextSlash,
  match_regex: faEquals,
  wait_for_console_line: faTerminal,
  send_power: faPowerOff,
  send_command: faTerminal,
  create_backup: faDatabase,
  create_directory: faFolder,
  write_file: faFile,
  copy_file: faCopy,
  delete_files: faTrash,
  rename_files: faEdit,
  compress_files: faCompress,
  decompress_file: faExpand,
  update_startup_variable: faGear,
  update_startup_command: faCode,
  update_startup_docker_image: faDocker,
};

export const sshKeyProviderLabelMapping: Record<z.infer<typeof userSshKeyProvider>, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  launchpad: 'Launchpad',
};

export const permissionCategoryIconMapping: Record<string, IconDefinition> = {
  stats: faChartPie,
  'email-templates': faEnvelope,
  account: faUser,
  activity: faBriefcase,
  allocations: faNetworkWired,
  'api-keys': faCloud,
  'backup-configurations': faFileZipper,
  backups: faBoxArchive,
  control: faTerminal,
  'database-hosts': faDatabase,
  databases: faDatabase,
  eggs: faEgg,
  assets: faFolderOpen,
  extensions: faPuzzlePiece,
  files: faFolderOpen,
  locations: faEarthAmerica,
  mounts: faFolder,
  nests: faKiwiBird,
  'egg-configurations': faCogs,
  'egg-repositories': faDownload,
  'oauth-providers': faFingerprint,
  nodes: faServer,
  roles: faScroll,
  schedules: faStopwatch,
  'security-keys': faUnlockKeyhole,
  servers: faComputer,
  sessions: faUserSecret,
  settings: faCog,
  'ssh-keys': faKey,
  'oauth-links': faFingerprint,
  startup: faPlay,
  subusers: faUsers,
  users: faUsers,
};

export const scheduleTriggerIconMapping: Record<z.infer<typeof serverScheduleTriggerSchema>['type'], IconDefinition> = {
  cron: faStopwatch,
  power_action: faPowerOff,
  server_state: faServer,
  backup_status: faBoxArchive,
  console_line: faTerminal,
  crash: faSkull,
};

export const scheduleTriggerColorMapping: Record<z.infer<typeof serverScheduleTriggerSchema>['type'], string> = {
  cron: 'blue',
  power_action: 'orange',
  server_state: 'green',
  backup_status: 'green',
  console_line: 'gray',
  crash: 'red',
};

export const scheduleTriggerLabelMapping: Record<z.infer<typeof serverScheduleTriggerSchema>['type'], () => string> = {
  cron: () => getTranslations().t('pages.server.schedules.triggers.cron.title', {}),
  power_action: () => getTranslations().t('pages.server.schedules.triggers.powerAction.title', {}),
  server_state: () => getTranslations().t('pages.server.schedules.triggers.serverState.title', {}),
  backup_status: () => getTranslations().t('pages.server.schedules.triggers.backupStatus.title', {}),
  console_line: () => getTranslations().t('pages.server.schedules.triggers.consoleLine.title', {}),
  crash: () => getTranslations().t('pages.server.schedules.triggers.crash.title', {}),
};

export const scheduleTriggerDefaultMapping: Record<
  z.infer<typeof serverScheduleTriggerSchema>['type'],
  z.infer<typeof serverScheduleTriggerSchema>
> = {
  cron: { type: 'cron', schedule: '' },
  power_action: { type: 'power_action', action: 'start' },
  server_state: { type: 'server_state', state: 'running' },
  backup_status: { type: 'backup_status', status: 'starting' },
  console_line: { type: 'console_line', contains: '', caseInsensitive: false, outputInto: null },
  crash: { type: 'crash' },
};
