import type { UseFormReturnType } from '@mantine/form';
import { deepmerge } from 'deepmerge-ts';
import type { FC } from 'react';
import { deepMergeZod, Registry } from 'shared';
import { z } from 'zod';

type ExtendedFormHook<BaseFormType extends z.ZodTypeAny, FormType extends z.ZodTypeAny> = UseFormReturnType<
  z.infer<FormType> & z.infer<BaseFormType>
>;
export type FormComponentProps<BaseFormType extends z.ZodTypeAny, FormType extends z.ZodTypeAny, Props = {}> = Props & {
  form: ExtendedFormHook<BaseFormType, FormType>;
};
type Component<BaseFormType extends z.ZodTypeAny, FormType extends z.ZodTypeAny, Props = {}> = FC<
  FormComponentProps<BaseFormType, FormType, Props>
>;

export class FormContainerRegistry<BaseFormType extends z.ZodTypeAny, Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);
    this.mergedSchema = this.mergedSchema
      ? other.mergedSchema
        ? deepMergeZod(this.mergedSchema, other.mergedSchema)
        : this.mergedSchema
      : other.mergedSchema;

    return this;
  }

  public prependedComponents: Component<BaseFormType, z.ZodTypeAny, Props>[] = [];
  public appendedComponents: Component<BaseFormType, z.ZodTypeAny, Props>[] = [];
  public mergedSchema: z.ZodTypeAny = z.object({});
  public mergedDefaultValues: object = {};

  public prependComponent<FormType extends z.ZodTypeAny>(
    schema: FormType,
    defaultValues: z.infer<FormType>,
    component: Component<BaseFormType, FormType, Props>,
  ): this {
    this.mergedSchema = deepMergeZod(this.mergedSchema, schema);
    this.mergedDefaultValues = deepmerge(this.mergedDefaultValues, defaultValues as object);

    this.prependedComponents.push(component as Component<BaseFormType, z.ZodTypeAny, Props>);
    return this;
  }

  public appendComponent<FormType extends z.ZodTypeAny>(
    schema: FormType,
    defaultValues: z.infer<FormType>,
    component: Component<BaseFormType, FormType, Props>,
  ): this {
    this.mergedSchema = deepMergeZod(this.mergedSchema, schema);
    this.mergedDefaultValues = deepmerge(this.mergedDefaultValues, defaultValues as object);

    this.appendedComponents.push(component as Component<BaseFormType, z.ZodTypeAny, Props>);
    return this;
  }
}
