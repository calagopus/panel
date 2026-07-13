import { Registry } from 'shared';
import type { z } from 'zod';
import type { FieldTransform, FormId, ZodFieldShape } from '@/elements/form-engine/types.ts';

export type { ZodFieldShape };

export type InferFieldShape<S extends ZodFieldShape> = { [K in keyof S]: z.input<S[K]> };

export interface FormExtensionSlot<S extends ZodFieldShape = ZodFieldShape> {
  zodShape: S;
  initialValues: InferFieldShape<S>;
  transform?: FieldTransform<Record<string, unknown> & Partial<InferFieldShape<S>>>;
}

export class FormRegistry implements Registry {
  private readonly slots = new Map<string, FormExtensionSlot[]>();

  public mergeFrom(other: this): this {
    for (const [formId, extSlots] of other.slots) {
      const existing = this.slots.get(formId) ?? [];
      this.slots.set(formId, [...existing, ...extSlots]);
    }
    return this;
  }

  public extend<S extends ZodFieldShape>(formId: FormId, slot: FormExtensionSlot<S>): this {
    const existing = this.slots.get(formId) ?? [];
    this.slots.set(formId, [...existing, slot as unknown as FormExtensionSlot]);
    return this;
  }

  public getSlots(formId: FormId): FormExtensionSlot[] {
    return this.slots.get(formId) ?? [];
  }
}
