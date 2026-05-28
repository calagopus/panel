import { createContext, type ReactNode, useContext } from 'react';

interface TranslationContextType {
  language: string;
  setLanguage: (language: string) => void;

  t(key: string, values: Record<string, string | number>): string;
  tReact(key: string, values: Record<string, ReactNode>): ReactNode;
  tItem(key: string, count: number): string;
}

export const TranslationContext = createContext<TranslationContextType | undefined>(undefined);
export let globalTranslationHandle: TranslationContextType | null = null;

export function setGlobalTranslationHandle(handle: TranslationContextType) {
  globalTranslationHandle = handle;
}

export type LanguageData = {
  items: TranslationItemRecord;
  translations: TranslationRecord;
};

export type TranslationRecord = {
  [k: string]: string | TranslationRecord;
};

export type TranslationItem = Record<Intl.LDMLPluralRule, string>;
export type TranslationItemRecord = {
  [k: string]: TranslationItem;
};

type LeafPaths<T, Prefix extends string = ''> = T extends TranslationRecord
  ? {
      [K in keyof T & string]: T[K] extends TranslationRecord ? LeafPaths<T[K], `${Prefix}${K}.`> : `${Prefix}${K}`;
    }[keyof T & string]
  : never;
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? T[Head] extends TranslationRecord
      ? PathValue<T[Head], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

export type GetPlaceholders<S extends string> = S extends `${string}{${infer W}}${infer RE}`
  ? [W, ...GetPlaceholders<RE>]
  : [];

export class DefinedTranslations<
  I extends TranslationItemRecord,
  O extends TranslationRecord,
  P extends string = LeafPaths<O>,
> {
  namespace: string;
  items: I;
  itemsObj: I;
  obj: O;
  paths: keyof P;
  mapping: Record<string, string>;

  subTranslations: Record<string, LanguageData>;

  constructor(data: { items: I; translations: O }) {
    this.namespace = '';
    this.items = data.items;
    this.itemsObj = structuredClone(data.items);
    this.obj = data.translations;
    this.paths = null as never;
    this.mapping = getTranslationMapping(data.translations) as never;
    this.subTranslations = { '': { items: this.itemsObj, translations: this.obj } };
  }

  public mergeFrom(other: this): this {
    for (const item in other.items) {
      this.items[`${other.namespace}.${item}` as keyof I] = other.items[item];
    }
    for (const key in other.mapping) {
      this.mapping[`${other.namespace}.${key}` as string] = other.mapping[key];
    }
    this.subTranslations[other.namespace] = {
      items: other.itemsObj,
      translations: other.obj,
    };

    return this;
  }

  public useTranslations() {
    const context = useContext(TranslationContext);
    if (!context) {
      throw new Error('useTranslations must be used within a TranslationProvider');
    }

    const namespace = this.namespace;

    return {
      language: context.language,
      setLanguage: context.setLanguage,
      t<K extends P>(
        key: K,
        values: Record<GetPlaceholders<PathValue<O, K> & string>[number], string | number>,
      ): string {
        return context.t(`${namespace}.${key as string}`, values);
      },
      tReact<K extends P>(
        key: K,
        values: Record<GetPlaceholders<PathValue<O, K> & string>[number], ReactNode>,
      ): ReactNode {
        return context.tReact(`${namespace}.${key as string}`, values);
      },
      tItem(key: keyof I, count: number): string {
        return context.tItem(`${namespace}.${key as string}`, count);
      },
    };
  }

  public getTranslations() {
    const context = globalTranslationHandle;
    if (!context) {
      throw new Error('getTranslations can only be used after the translation handle has been set');
    }

    const namespace = this.namespace;

    return {
      language: context.language,
      setLanguage: context.setLanguage,
      t<K extends P>(
        key: K,
        values: Record<GetPlaceholders<PathValue<O, K> & string>[number], string | number>,
      ): string {
        return context.t(`${namespace}.${key as string}`, values);
      },
      tReact<K extends P>(
        key: K,
        values: Record<GetPlaceholders<PathValue<O, K> & string>[number], ReactNode>,
      ): ReactNode {
        return context.tReact(`${namespace}.${key as string}`, values);
      },
      tItem(key: keyof I, count: number): string {
        return context.tItem(`${namespace}.${key as string}`, count);
      },
    };
  }
}

export function defineEnglishItem(singular: string, plural: string): TranslationItem {
  return {
    zero: `{count} ${plural}`,
    one: `{count} ${singular}`,
    two: `{count} ${plural}`,
    few: `{count} ${plural}`,
    many: `{count} ${plural}`,
    other: `{count} ${plural}`,
  };
}

export function getTranslationMapping(obj: TranslationRecord, parent?: string): Record<string, string> {
  const mapping: Record<string, string> = {};

  function formatKey(key: string): string {
    if (parent) {
      return `${parent}.${key}`;
    } else {
      return key;
    }
  }

  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const subMapping = getTranslationMapping(obj[key], formatKey(key));

      for (const key in subMapping) {
        mapping[key] = subMapping[key];
      }
    } else {
      mapping[formatKey(key)] = obj[key];
    }
  }

  return mapping;
}

export function defineTranslations<
  const I extends TranslationItemRecord,
  const O extends TranslationRecord,
>(translations: { items: I; translations: O }): DefinedTranslations<I, O> {
  return new DefinedTranslations(translations);
}
