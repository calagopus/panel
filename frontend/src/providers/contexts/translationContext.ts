import { useContext } from 'react';
import { globalTranslationHandle, TranslationContext } from 'shared';
import baseTranslations from '@/translations.ts';

export const useTranslations = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslations must be used within a TranslationProvider');
  }

  return {
    language: context.language,
    setLanguage: context.setLanguage,
    t(key, values) {
      return context.t(key, values);
    },
    tReact(key, values) {
      return context.tReact(key, values);
    },
    tItem(key, count) {
      return context.tItem(key, count);
    },
  } as ReturnType<typeof baseTranslations.useTranslations>;
};

export const getTranslations = (): ReturnType<typeof useTranslations> => {
  if (!globalTranslationHandle) {
    throw new Error('getTranslations called before TranslationProvider initialized');
  }

  return globalTranslationHandle;
};
