import { ZodType, z } from 'zod';

export const userCommandSnippetMatcherNeverSchema = z.object({
  type: z.literal('never'),
});

export const userCommandSnippetMatcherAllSchema = z.object({
  type: z.literal('all'),
});

export const userCommandSnippetMatcherEggsSchema = z.object({
  type: z.literal('eggs'),
  eggs: z.array(z.uuid()).max(100),
});

export type UserCommandSnippetMatcher =
  | z.infer<typeof userCommandSnippetMatcherNeverSchema>
  | z.infer<typeof userCommandSnippetMatcherAllSchema>
  | {
      type: 'and' | 'or';
      matchers: UserCommandSnippetMatcher[];
    }
  | {
      type: 'not';
      matcher: UserCommandSnippetMatcher;
    }
  | z.infer<typeof userCommandSnippetMatcherEggsSchema>;

export const userCommandSnippetMatcherSchema: ZodType<UserCommandSnippetMatcher> = z.lazy(() =>
  z.discriminatedUnion('type', [
    userCommandSnippetMatcherNeverSchema,
    userCommandSnippetMatcherAllSchema,

    z.object({
      type: z.literal('and'),
      matchers: z.array(userCommandSnippetMatcherSchema),
    }),
    z.object({
      type: z.literal('or'),
      matchers: z.array(userCommandSnippetMatcherSchema),
    }),
    z.object({
      type: z.literal('not'),
      matcher: userCommandSnippetMatcherSchema,
    }),

    userCommandSnippetMatcherEggsSchema,
  ]),
);

export const userCommandSnippetSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(31),
  matcher: userCommandSnippetMatcherSchema,
  command: z.string().min(1).max(1024),
  created: z.coerce.date(),
});

export const userCommandSnippetUpdateSchema = z.lazy(() =>
  userCommandSnippetSchema.omit({
    uuid: true,
    created: true,
  }),
);
