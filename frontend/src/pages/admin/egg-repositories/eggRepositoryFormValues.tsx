import { faExclamationTriangle, faUnlockKeyhole } from '@fortawesome/free-solid-svg-icons';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import NestSelect from '@/elements/input/NestSelect.tsx';
import Select from '@/elements/input/Select.tsx';
import { eggRepositoryCredentialTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import {
  adminEggRepositoryCredentialsPasswordSchema,
  adminEggRepositoryCredentialsPrivateKeySchema,
  adminEggRepositoryCredentialsSchema,
  adminEggRepositoryCredentialsUpdateSchema,
  adminEggRepositorySchema,
  adminEggRepositoryUpdateSchema,
} from '@/lib/schemas/admin/eggRepositories.ts';
import NestCreateField from '@/pages/admin/nests/NestCreateField.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CredentialPassword from './forms/CredentialPassword.tsx';
import CredentialPrivateKey from './forms/CredentialPrivateKey.tsx';
import SshHostKey from './forms/SshHostKey.tsx';

type EggRepositoryFormValues = z.infer<typeof adminEggRepositoryUpdateSchema>;

export type AdminEggRepositoryCredentialType = z.infer<typeof adminEggRepositoryCredentialsUpdateSchema>['type'];

export const adminEggRepositoryCredentialsDefaults: Record<
  AdminEggRepositoryCredentialType,
  z.infer<typeof adminEggRepositoryCredentialsSchema>
> = {
  none: { type: 'none' },
  password: { type: 'password', username: '', password: '' },
  private_key: { type: 'private_key', username: 'git', privateKey: '', passphrase: null },
};

const defaultPorts: Record<string, string> = { 'http:': '80', 'https:': '443', 'ssh:': '22' };

// mirrors the backend's same_origin check; the update clears stored credentials when it fails
const repositoryOrigin = (gitRepository: string): string | null => {
  if (!gitRepository.includes('://')) {
    // scp-style `user@host:path`, split the way gix does
    const colon = gitRepository.indexOf(':');
    if (colon === -1 || colon === gitRepository.length - 1) {
      return null;
    }

    const prefix = gitRepository.slice(0, colon);
    if (prefix.includes('/')) {
      return null;
    }

    return `ssh://${prefix.slice(prefix.lastIndexOf('@') + 1).toLowerCase()}:${defaultPorts['ssh:']}`;
  }

  try {
    const url = new URL(gitRepository);
    return `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || defaultPorts[url.protocol]}`;
  } catch {
    return null;
  }
};

export const eggRepositoryEmptyFormValues: EggRepositoryFormValues = {
  name: '',
  description: null,
  gitRepository: '',
  credentials: undefined,
  sshHostKey: null,
  defaultNestUuid: null,
  autoSync: true,
};

export const eggRepositoryToFormValues = (
  eggRepository: z.infer<typeof adminEggRepositorySchema>,
): Partial<EggRepositoryFormValues> => ({
  name: eggRepository.name,
  description: eggRepository.description,
  gitRepository: eggRepository.gitRepository,
  credentials: undefined,
  sshHostKey: eggRepository.sshHostKey,
  defaultNestUuid: eggRepository.defaultNest?.uuid ?? null,
  autoSync: eggRepository.autoSync,
});

export function useEggRepositoryFormFields(
  contextEggRepository?: z.infer<typeof adminEggRepositorySchema>,
): FieldDef<EggRepositoryFormValues>[] {
  const { t } = useTranslations();
  const canReadNests = useAdminCan('nests.read');

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'text',
      name: 'gitRepository',
      label: t('pages.admin.eggRepositories.tabs.general.page.form.gitRepository', {}),
      required: true,
    },
    {
      type: 'custom',
      name: 'sshHostKey',
      colSpan: 'full',
      render: (f) =>
        repositoryOrigin(f.values.gitRepository)?.startsWith('ssh://') ? (
          <SshHostKey
            gitRepository={f.values.gitRepository}
            originChanged={
              !!contextEggRepository?.sshHostKey &&
              f.values.sshHostKey === contextEggRepository.sshHostKey &&
              repositoryOrigin(f.values.gitRepository) !== repositoryOrigin(contextEggRepository.gitRepository)
            }
            value={f.values.sshHostKey}
            onChange={(sshHostKey) => f.setFieldValue('sshHostKey', sshHostKey)}
          />
        ) : null,
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3, colSpan: 'full' },
    {
      type: 'custom',
      name: 'defaultNestUuid',
      render: (f) => (
        <div className='flex flex-col gap-1'>
          <NestSelect
            label={t('pages.admin.eggRepositories.tabs.general.page.form.defaultNest', {})}
            description={t('pages.admin.eggRepositories.tabs.general.page.form.defaultNestDescription', {})}
            value={f.values.defaultNestUuid}
            onChange={(uuid) => f.setFieldValue('defaultNestUuid', uuid)}
            includeItems={contextEggRepository?.defaultNest ? [contextEggRepository.defaultNest] : []}
            allowDeselect
            clearable
            disabled={!canReadNests}
          />
          <NestCreateField onCreated={(nest) => f.setFieldValue('defaultNestUuid', nest.uuid)} />
        </div>
      ),
    },
    {
      type: 'switch',
      name: 'autoSync',
      label: t('pages.admin.eggRepositories.tabs.general.page.form.autoSync', {}),
      description: t('pages.admin.eggRepositories.tabs.general.page.form.autoSyncDescription', {}),
    },
    {
      type: 'custom',
      name: 'credentials',
      colSpan: 'full',
      render: (f) => {
        const origin = repositoryOrigin(f.values.gitRepository);

        return (
          <>
            {contextEggRepository &&
              contextEggRepository.credentials.type !== 'none' &&
              !f.values.credentials &&
              origin !== null &&
              origin !== repositoryOrigin(contextEggRepository.gitRepository) && (
                <Alert color='yellow' icon={faExclamationTriangle} mb='md'>
                  {t('pages.admin.eggRepositories.tabs.general.page.alert.credentialsCleared', {})}
                </Alert>
              )}
            <CollapsibleSection
              icon={faUnlockKeyhole}
              enabled={!!f.values.credentials}
              onToggle={(enabled) =>
                f.setValues({
                  credentials: enabled
                    ? (contextEggRepository?.credentials ?? adminEggRepositoryCredentialsDefaults.none)
                    : undefined,
                })
              }
              title={t('pages.admin.eggRepositories.tabs.general.page.form.credentials', {})}
            >
              <Select
                withAsterisk
                label={t('pages.admin.eggRepositories.tabs.general.page.form.credentialType', {})}
                data={mappingToSelectData(eggRepositoryCredentialTypeLabelMapping)}
                key={f.key('credentials.type')}
                {...f.getInputProps('credentials.type')}
                onChange={(value) => {
                  if (value && value !== f.values.credentials?.type) {
                    f.setValues({
                      credentials: adminEggRepositoryCredentialsDefaults[value as AdminEggRepositoryCredentialType],
                    });
                  }
                }}
              />

              {f.values.credentials?.type === 'password' ? (
                <CredentialPassword
                  form={
                    f as UseFormReturnType<{
                      credentials: z.infer<typeof adminEggRepositoryCredentialsPasswordSchema>;
                    }>
                  }
                />
              ) : f.values.credentials?.type === 'private_key' ? (
                <CredentialPrivateKey
                  form={
                    f as UseFormReturnType<{
                      credentials: z.infer<typeof adminEggRepositoryCredentialsPrivateKeySchema>;
                    }>
                  }
                />
              ) : null}
            </CollapsibleSection>
          </>
        );
      },
    },
  ];
}
