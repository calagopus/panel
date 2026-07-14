import { z } from 'zod';

export const userCommandSnippetSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(31),
  eggs: z.uuid().array().max(100),
  command: z.string().min(1).max(1024),
  created: z.coerce.date(),
});

export const userCommandSnippetUpdateSchema = z.lazy(() =>
  userCommandSnippetSchema.omit({
    uuid: true,
    created: true,
  }),
);
