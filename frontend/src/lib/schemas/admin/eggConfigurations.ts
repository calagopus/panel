import { ZodType, z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';
import { eggConfigurationRouteItemSchema } from '../generic.ts';

export const adminEggConfigurationDeploymentRandomSchema = z.object({
  type: z.literal('random'),
});

export const adminEggConfigurationDeploymentRangeSchema = z.object({
  type: z.literal('range'),
  endPort: z.number().min(0),
  startPort: z.number().min(0),
});

export const adminEggConfigurationDeploymentAddPrimarySchema = z.object({
  type: z.literal('add_primary'),
  value: z.number().min(0),
});

export const adminEggConfigurationDeploymentSubtractPrimarySchema = z.object({
  type: z.literal('subtract_primary'),
  value: z.number().min(0),
});

export const adminEggConfigurationDeploymentMultiplyPrimarySchema = z.object({
  type: z.literal('multiply_primary'),
  value: z.number(),
});

export const adminEggConfigurationDeploymentDividePrimarySchema = z.object({
  type: z.literal('divide_primary'),
  value: z.number(),
});

export interface EggConfigurationDeployment {
  mode:
    | z.infer<typeof adminEggConfigurationDeploymentRandomSchema>
    | z.infer<typeof adminEggConfigurationDeploymentRangeSchema>
    | z.infer<typeof adminEggConfigurationDeploymentAddPrimarySchema>
    | z.infer<typeof adminEggConfigurationDeploymentSubtractPrimarySchema>
    | z.infer<typeof adminEggConfigurationDeploymentMultiplyPrimarySchema>
    | z.infer<typeof adminEggConfigurationDeploymentDividePrimarySchema>;
  assignToVariable: string | null;
}

export const adminEggConfigurationDeploymentSchema: ZodType<EggConfigurationDeployment> = z.lazy(() =>
  z.object({
    mode: z.discriminatedUnion('type', [
      adminEggConfigurationDeploymentRandomSchema,
      adminEggConfigurationDeploymentRangeSchema,
      adminEggConfigurationDeploymentAddPrimarySchema,
      adminEggConfigurationDeploymentSubtractPrimarySchema,
      adminEggConfigurationDeploymentMultiplyPrimarySchema,
      adminEggConfigurationDeploymentDividePrimarySchema,
    ]),
    assignToVariable: z.preprocess(nullableString, z.string().max(255).nullable()),
  }),
);

export const adminEggConfigurationSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  order: z.number().min(0),
  eggs: z.uuid().array(),
  configAllocations: z
    .object({
      deployment: z.object({
        additional: z.lazy(() => z.array(adminEggConfigurationDeploymentSchema)),
        dedicated: z.boolean(),
        primary: z
          .object({
            endPort: z.number().min(0).max(65535),
            startPort: z.number().min(0).max(65535),
            assignToVariable: z.preprocess(nullableString, z.string().max(255).nullable()),
          })
          .nullable(),
      }),
      userSelfAssign: z.object({
        enabled: z.boolean(),
        requirePrimaryAllocation: z.boolean(),
        startPort: z.number().min(1024).max(65535),
        endPort: z.number().min(1024).max(65535),
      }),
    })
    .nullable(),
  configRoutes: z
    .object({
      order: z.array(eggConfigurationRouteItemSchema),
    })
    .nullable(),
  created: z.date(),
});

export const adminEggConfigurationUpdateSchema = z.lazy(() =>
  adminEggConfigurationSchema.omit({
    uuid: true,
    created: true,
  }),
);
