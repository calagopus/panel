import { z } from 'zod';
import { adminEggConfigScriptSchema, adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

type ScriptFormValues = z.infer<typeof adminEggConfigScriptSchema>;

export const eggScriptEmptyFormValues: ScriptFormValues = {
  container: '',
  entrypoint: '',
  content: '',
};

export const eggToScriptFormValues = (egg: z.infer<typeof adminEggSchema>): ScriptFormValues => ({
  container: egg.configScript.container,
  entrypoint: egg.configScript.entrypoint,
  content: egg.configScript.content,
});
