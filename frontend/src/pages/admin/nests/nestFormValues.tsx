import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { adminNestSchema, adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type NestFormValues = z.infer<typeof adminNestUpdateSchema>;

export const nestEmptyFormValues: NestFormValues = {
  author: '',
  name: '',
  description: null,
};

export const nestToFormValues = (nest: z.infer<typeof adminNestSchema>): Partial<NestFormValues> => ({
  author: nest.author,
  name: nest.name,
  description: nest.description,
});

export function useNestFormFields(): FieldDef<NestFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'text', name: 'author', label: t('common.form.author', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3, colSpan: 'full' },
  ];
}
