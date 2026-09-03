import { dump } from 'js-yaml';
import { z } from 'zod';
import { downloadTextFile } from '@/lib/download/download.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export type ResourceExportFormat = 'json' | 'yaml';

export function serializeResourceFile<T extends z.ZodTypeAny>(
  schema: T,
  data: z.infer<T>,
  format: ResourceExportFormat,
  omit: string[] = [],
): { contents: string; extension: 'json' | 'yml' } {
  const serialized = serializeForApi(schema, data);

  if (omit.length > 0 && serialized !== null && typeof serialized === 'object' && !Array.isArray(serialized)) {
    for (const key of omit) {
      delete (serialized as Record<string, unknown>)[key];
    }
  }

  const contents =
    format === 'json'
      ? JSON.stringify(serialized, undefined, 2)
      : dump(serialized, { flowLevel: -1, forceQuotes: true });

  return { contents, extension: format === 'json' ? 'json' : 'yml' };
}

export function downloadResourceFile<T extends z.ZodTypeAny>(
  schema: T,
  data: z.infer<T>,
  filenamePrefix: string,
  format: ResourceExportFormat,
  omit: string[] = [],
): void {
  const { contents, extension } = serializeResourceFile(schema, data, format, omit);
  downloadTextFile(contents, `${filenamePrefix}.${extension}`);
}
