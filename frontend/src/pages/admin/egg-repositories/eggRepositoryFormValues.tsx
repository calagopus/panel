import { faUnlockKeyhole } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import { type FieldDef } from '@/elements/form-engine/index.ts';
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
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CredentialPassword from './forms/CredentialPassword.tsx';
import CredentialPrivateKey from './forms/CredentialPrivateKey.tsx';

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

export const eggRepositoryEmptyFormValues: EggRepositoryFormValues = {
  name: '',
  description: null,
  gitRepository: '',
  credentials: undefined,
};

export const eggRepositoryToFormValues = (
  eggRepository: z.infer<typeof adminEggRepositorySchema>,
): Partial<EggRepositoryFormValues> => ({
  name: eggRepository.name,
  description: eggRepository.description,
  gitRepository: eggRepository.gitRepository,
  credentials: undefined,
});

export function useEggRepositoryFormFields(
  contextEggRepository?: z.infer<typeof adminEggRepositorySchema>,
): FieldDef<EggRepositoryFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'text',
      name: 'gitRepository',
      label: t('pages.admin.eggRepositories.tabs.general.page.form.gitRepository', {}),
      required: true,
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3, colSpan: 'full' },
    {
      type: 'custom',
      name: 'credentials',
      colSpan: 'full',
      render: (f) => (
        <CollapsibleSection
          icon={<FontAwesomeIcon icon={faUnlockKeyhole} />}
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
      ),
    },
  ];
}
