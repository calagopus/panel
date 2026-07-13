import { Registry } from 'shared';
import type { FieldTransform, FormId, ZodFieldShape } from '@/elements/form-engine/types.ts';

export type { ZodFieldShape };

export interface FormExtensionSlot<T extends Record<string, unknown> = Record<string, unknown>> {
  zodShape?: ZodFieldShape;
  initialValues?: Partial<T>;
  transform?: FieldTransform<T>;
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

  public extend<T extends Record<string, unknown> = Record<string, unknown>>(
    formId: FormId,
    slot: FormExtensionSlot<T>,
  ): this {
    const existing = this.slots.get(formId) ?? [];
    this.slots.set(formId, [...existing, slot as FormExtensionSlot]);
    return this;
  }

  public getSlots(formId: FormId): FormExtensionSlot[] {
    return this.slots.get(formId) ?? [];
  }
}
