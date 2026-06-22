import { Registry } from 'shared';
import type { ZodType } from 'zod';
import type { ExtensionField, FormExtension } from '@/elements/form-engine/types.ts';

export type ZodFieldShape = Record<string, ZodType>;

export interface FormExtensionSlot {
  fields?: ExtensionField<Record<string, unknown>>[];
  zodShape?: ZodFieldShape;
  initialValues?: Record<string, unknown>;
  overrides?: FormExtension<Record<string, unknown>>['overrides'];
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

  public extend(formId: string, slot: FormExtensionSlot): this {
    const existing = this.slots.get(formId) ?? [];
    this.slots.set(formId, [...existing, slot]);
    return this;
  }

  public getSlots(formId: string): FormExtensionSlot[] {
    return this.slots.get(formId) ?? [];
  }
}
