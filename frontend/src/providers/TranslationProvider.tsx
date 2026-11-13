import { Table, Text, Title, TitleOrder } from '@mantine/core';
import { Fragment, ReactNode, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getTranslationMapping,
  globalTranslationHandle,
  setGlobalTranslationHandle,
  TranslationContext,
  TranslationItemRecord,
} from 'shared';
import { z } from 'zod';
import { $ZodConfig } from 'zod/v4/core';
import { axiosInstance } from '@/api/axios.ts';
import Anchor from '@/elements/typography/Anchor.tsx';
import Code from '@/elements/typography/Code.tsx';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import { getGlobalStore, useGlobalStore } from '@/stores/global.ts';
import baseTranslations from '@/translations.ts';

const zodLocaleModules = import.meta.glob('/node_modules/zod/v4/locales/*.js');
const monacoNlsModules = import.meta.glob('/node_modules/monaco-editor/esm/vs/nls/lang/*.js');
const cronstrueLocaleModules: Record<string, () => Promise<unknown>> = {
  ar: () => import('cronstrue/locales/ar.js'),
  cs: () => import('cronstrue/locales/cs.js'),
  da: () => import('cronstrue/locales/da.js'),
  de: () => import('cronstrue/locales/de.js'),
  es: () => import('cronstrue/locales/es.js'),
  fr: () => import('cronstrue/locales/fr.js'),
  it: () => import('cronstrue/locales/it.js'),
  ja: () => import('cronstrue/locales/ja.js'),
  pl: () => import('cronstrue/locales/pl.js'),
  ro: () => import('cronstrue/locales/ro.js'),
  ru: () => import('cronstrue/locales/ru.js'),
  sk: () => import('cronstrue/locales/sk.js'),
  sv: () => import('cronstrue/locales/sv.js'),
  tr: () => import('cronstrue/locales/tr.js'),
  vi: () => import('cronstrue/locales/vi.js'),
};
const monacoLocaleAliases: Record<string, string> = { zh: 'zh-cn', pt: 'pt-br' };
const monacoNlsCache: Record<string, string[] | undefined> = {};

// zod's own regex message prints the raw pattern, schemas with a known rule override this via ruleMessage
z.config({
  customError: (issue) =>
    issue.code === 'invalid_format' && issue.format === 'regex' && globalTranslationHandle
      ? globalTranslationHandle.t('common.form.rule.invalidCharacters', {})
      : undefined,
});

type LanguageData = {
  items: TranslationItemRecord;
  translations: Record<string, string>;
};

declare global {
  interface String {
    md(): ReactNode;
  }

  var _VSCODE_NLS_MESSAGES: string[] | undefined;
  var _VSCODE_NLS_LANGUAGE: string | undefined;
}

const SafeMarkdownLink = ({ href, children }: { href?: string; children?: ReactNode }) => {
  if (href && /^(javascript|data|vbscript):/i.test(href)) {
    return <span>{children}</span>;
  }
  return (
    <Anchor href={href} inherit>
      {children}
    </Anchor>
  );
};

const detectBrowserLanguage = (languages: string[]): string | null => {
  for (const tag of navigator.languages) {
    if (languages.includes(tag)) return tag;

    try {
      const base = new Intl.Locale(tag).language;
      if (languages.includes(base)) return base;
    } catch {
      // ignore
    }
  }

  return null;
};

const Header =
  ({ order }: { order: TitleOrder }) =>
  (props: React.ComponentProps<typeof Title>) => <Title order={order} {...props} />;

export const markdownComponents: Components = {
  a: SafeMarkdownLink,
  p: ({ children }) => (
    <Text component='span' inherit>
      {children}
    </Text>
  ),
  h1: Header({ order: 1 }),
  h2: Header({ order: 2 }),
  h3: Header({ order: 3 }),
  h4: Header({ order: 4 }),
  h5: Header({ order: 5 }),
  h6: Header({ order: 6 }),
  pre: ({ children }) => <Fragment>{children}</Fragment>,
  code: ({ className, children }) => (
    <Code block={/language-/.test(className ?? '') || String(children).includes('\n')}>{children}</Code>
  ),
  table: ({ children }) => (
    <Table withTableBorder withColumnBorders>
      {children}
    </Table>
  ),
  thead: ({ children }) => <Table.Thead>{children}</Table.Thead>,
  tbody: ({ children }) => <Table.Tbody>{children}</Table.Tbody>,
  tr: ({ children }) => <Table.Tr>{children}</Table.Tr>,
  th: ({ children }) => <Table.Th>{children}</Table.Th>,
  td: ({ children }) => <Table.Td>{children}</Table.Td>,
  strong: ({ children }) => (
    <Text component='span' fw={700} inherit>
      {children}
    </Text>
  ),
  em: ({ children }) => (
    <Text component='span' td='italic' inherit>
      {children}
    </Text>
  ),
  ins: ({ children }) => (
    <Text component='span' td='underline' inherit>
      {children}
    </Text>
  ),
  del: ({ children }) => (
    <Text component='span' td='line-through' inherit>
      {children}
    </Text>
  ),
};

String.prototype.md = function (): ReactNode {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {this.toString()}
    </Markdown>
  );
};

const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState(
    safeLocalStorageGet('last_language') || getGlobalStore().settings.app.language || 'en',
  );
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const languages = useGlobalStore((state) => state.languages);
  const pendingDetection = useRef(
    !safeLocalStorageGet('last_language') && getGlobalStore().settings.user.allowChangingLanguage,
  );

  const setLanguage = useCallback((value: string) => {
    pendingDetection.current = false;
    setLanguageState(value);
  }, []);

  useEffect(() => {
    if (!pendingDetection.current || languages.length === 0) return;
    pendingDetection.current = false;

    const detected = detectBrowserLanguage(languages);
    if (detected) {
      setLanguageState(detected);
    }
  }, [languages]);

  const loadZod = async (lang: string) => {
    if (!zodLocaleModules[`/node_modules/zod/v4/locales/${lang}.js`]) {
      return;
    }

    const { default: locale } = (await zodLocaleModules[`/node_modules/zod/v4/locales/${lang}.js`]()) as {
      default: () => $ZodConfig;
    };

    z.config(locale());
  };

  const loadMonaco = async (lang: string) => {
    const locale = monacoLocaleAliases[lang] ?? lang;
    const path = `/node_modules/monaco-editor/esm/vs/nls/lang/${locale}.js`;

    if (lang === 'en' || !monacoNlsModules[path]) {
      globalThis._VSCODE_NLS_MESSAGES = undefined;
      globalThis._VSCODE_NLS_LANGUAGE = undefined;
      return;
    }

    if (!monacoNlsCache[locale]) {
      await monacoNlsModules[path]();
      monacoNlsCache[locale] = globalThis._VSCODE_NLS_MESSAGES;
    }

    globalThis._VSCODE_NLS_MESSAGES = monacoNlsCache[locale];
    globalThis._VSCODE_NLS_LANGUAGE = locale;
  };

  const loadCronstrue = async (lang: string) => {
    await cronstrueLocaleModules[lang]?.();
  };

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      if (language === 'en') {
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';

        setLanguageData(null);
      } else {
        Promise.all([axiosInstance.get(`/translations/${language}.json`), loadCronstrue(language).catch(console.error)])
          .then(([{ data }]) => {
            if (cancelled) return;
            const result: LanguageData = {
              items: data[''].items,
              translations: data[''].translations,
            };

            for (const key in data) {
              if (key === '') continue;

              for (const item in data[key].items) {
                result.items[`${key}.${item}`] = data[key].items[item];
              }
              for (const translation in data[key].translations) {
                result.translations[`${key}.${translation}`] = data[key].translations[translation];
              }
            }

            result.translations = getTranslationMapping(result.translations);

            if (import.meta.env.DEV) {
              console.debug('Loaded language data', language, result);
            }

            try {
              const lang = new Intl.Locale(language);
              document.documentElement.lang = lang.language;
              document.documentElement.dir = lang.getTextInfo().direction ?? 'ltr';
            } catch {
              // ignore
            }

            setLanguageData(result);
          })
          .catch((err) => {
            if (cancelled) return;
            setLanguageState('en');
            console.error(err);
          });
      }

      loadZod(language);
      loadMonaco(language);
    });

    safeLocalStorageSet('last_language', language);

    return () => {
      cancelled = true;
    };
  }, [language]);

  const contextValue = useMemo(() => {
    const numberFormat = new Intl.NumberFormat(language, { maximumFractionDigits: 20 });
    const pluralRules = new Intl.PluralRules(language);

    const formatValue = (value: unknown): string => {
      if (typeof value !== 'number') {
        return String(value);
      }

      return numberFormat.format(value);
    };

    const t = (key: string, values: Record<string, string | number>): string => {
      if (!languageData?.translations[key] && !baseTranslations.mapping[key as never]) {
        throw new Error(`Language key ${key} not found.`);
      }

      let translation = languageData?.translations[key] || (baseTranslations.mapping[key as never] as string);

      if (values) {
        Object.keys(values).forEach((placeholder) => {
          translation = translation.replaceAll(`{${placeholder}}`, formatValue(values[placeholder]));
        });
      }

      return translation;
    };

    const tReact = (key: string, values: Record<string, ReactNode>): ReactNode => {
      if (!languageData?.translations[key] && !baseTranslations.mapping[key as never]) {
        throw new Error(`Language key ${key} not found.`);
      }

      let translation = languageData?.translations[key] || (baseTranslations.mapping[key as never] as string);

      if (values) {
        const reactNodeKeys: string[] = [];
        Object.keys(values).forEach((placeholder) => {
          const value = values[placeholder];
          if (typeof value === 'string' || typeof value === 'number') {
            translation = translation.replaceAll(`{${placeholder}}`, formatValue(value));
          } else {
            reactNodeKeys.push(placeholder);
            translation = translation.replaceAll(`{${placeholder}}`, `%%${placeholder}%%`);
          }
        });

        if (reactNodeKeys.length === 0) {
          return (
            <Markdown
              components={{
                p: ({ children }) => <>{children}</>,
                a: SafeMarkdownLink,
              }}
            >
              {translation}
            </Markdown>
          );
        }

        const parts = translation.split(/(%%\w+%%)/g);
        return (
          <span>
            {parts.map((part, index) => {
              const match = part.match(/%%(\w+)%%/);
              if (match) {
                const placeholder = match[1];
                return <Fragment key={index}>{values[placeholder]}</Fragment>;
              }

              const leadingSpace = part.startsWith(' ') ? ' ' : '';
              const trailingSpace = part.endsWith(' ') ? ' ' : '';
              const trimmed = part.trim();
              if (!trimmed) {
                return <Fragment key={index}>{part}</Fragment>;
              }

              const hasMarkdown = /[*_`~[!#]/.test(trimmed);
              if (!hasMarkdown) {
                return <Fragment key={index}>{part}</Fragment>;
              }

              return (
                <Fragment key={index}>
                  {leadingSpace}
                  <Markdown
                    components={{
                      p: ({ children }) => <>{children}</>,
                      a: SafeMarkdownLink,
                    }}
                  >
                    {trimmed}
                  </Markdown>
                  {trailingSpace}
                </Fragment>
              );
            })}
          </span>
        );
      }

      return (
        <Markdown
          components={{
            p: ({ children }) => <>{children}</>,
            a: SafeMarkdownLink,
          }}
        >
          {translation}
        </Markdown>
      );
    };

    const tItem = (key: string, count: number): string => {
      if (!languageData?.items[key] && !baseTranslations.items[key as never]) {
        throw new Error(`Language item key ${key} not found.`);
      }

      const translatedItem = languageData?.items[key];
      const baseItem = baseTranslations.items[key as never] as TranslationItemRecord[string] | undefined;
      const form = pluralRules.select(count);
      const translation =
        translatedItem?.[form] || translatedItem?.other || baseItem?.[form] || baseItem?.other || `{count} ${key}`;

      return translation.replaceAll('{count}', formatValue(count));
    };

    return { language, setLanguage, t, tReact, tItem };
  }, [language, languageData, setLanguage]);

  setGlobalTranslationHandle(contextValue);

  return <TranslationContext.Provider value={contextValue}>{children}</TranslationContext.Provider>;
};

export default TranslationProvider;
export { getTranslations, useTranslations } from './contexts/translationContext.ts';
