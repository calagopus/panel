import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { adminMountSchema, adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type MountFormValues = z.infer<typeof adminMountUpdateSchema>;

export const mountEmptyFormValues: MountFormValues = {
  name: '',
  description: null,
  source: '',
  target: '',
  readOnly: false,
  userMountable: false,
};

export const mountToFormValues = (mount: z.infer<typeof adminMountSchema>): MountFormValues => ({
  name: mount.name,
  description: mount.description,
  source: mount.source,
  target: mount.target,
  readOnly: mount.readOnly,
  userMountable: mount.userMountable,
});

export function useMountFormFields(): FieldDef<MountFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    { type: 'text', name: 'source', label: t('common.form.source', {}), required: true },
    { type: 'text', name: 'target', label: t('common.form.target', {}), required: true },
    { type: 'switch', name: 'readOnly', label: t('common.readOnly', {}) },
    { type: 'switch', name: 'userMountable', label: t('pages.admin.mounts.tabs.general.page.form.userMountable', {}) },
  ];
}
