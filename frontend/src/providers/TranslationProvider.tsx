import { Table, Text, Title, TitleOrder } from '@mantine/core';
import { Fragment, ReactNode, startTransition, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { getTranslationMapping, setGlobalTranslationHandle, TranslationContext, TranslationItemRecord } from 'shared';
import { z } from 'zod';
import { $ZodConfig } from 'zod/v4/core';
import { axiosInstance } from '@/api/axios.ts';
import Anchor from '@/elements/Anchor.tsx';
import Code from '@/elements/Code.tsx';
import { getGlobalStore } from '@/stores/global.ts';
import baseTranslations from '@/translations.ts';

const zodLocaleModules = import.meta.glob('/node_modules/zod/v4/locales/*.js');
const monacoNlsModules = import.meta.glob('/node_modules/monaco-editor/esm/nls.messages.*.js');
const monacoLocaleAliases: Record<string, string> = { zh: 'zh-cn', pt: 'pt-br' };
const monacoNlsCache: Record<string, string[] | undefined> = {};

const LANGUAGE_STORAGE_KEY = 'last_language';

type LanguageData = {
  items: TranslationItemRecord;
  translations: Record<string, string>;
};

interface MarkdownOptions {
  html?: boolean;
}

declare global {
  interface String {
    md(options?: MarkdownOptions): ReactNode;
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

const Header =
  ({ order }: { order: TitleOrder }) =>
  (props: React.ComponentProps<typeof Title>) => <Title order={order} {...props} />;

const getInitialLanguage = (): string => {
  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage) return storedLanguage;

  const { languages, settings } = getGlobalStore();
  const browserLanguage = navigator.language.split('-')[0];
  const language = languages.includes(browserLanguage) ? browserLanguage : settings.app.language || 'en';

  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

  return language;
};

String.prototype.md = function (options?: MarkdownOptions): ReactNode {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={options?.html ? [rehypeRaw, rehypeSanitize] : undefined}
      components={{
        a: SafeMarkdownLink,
        p: ({ children }) => <Text component='span'>{children}</Text>,
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
          <Text component='span' fw={700}>
            {children}
          </Text>
        ),
        em: ({ children }) => (
          <Text component='span' td='italic'>
            {children}
          </Text>
        ),
        ins: ({ children }) => (
          <Text component='span' td='underline'>
            {children}
          </Text>
        ),
        del: ({ children }) => (
          <Text component='span' td='line-through'>
            {children}
          </Text>
        ),
      }}
    >
      {this.toString()}
    </Markdown>
  );
};

const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);

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
    const path = `/node_modules/monaco-editor/esm/nls.messages.${locale}.js`;

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

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      if (language === 'en') {
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';

        setLanguageData(null);
      } else {
        axiosInstance
          .get(`/translations/${language}.json`)
          .then(({ data }) => {
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
            setLanguage('en');
            console.error(err);
          });
      }

      loadZod(language);
      loadMonaco(language);
    });

    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

    return () => {
      cancelled = true;
    };
  }, [language]);

  const contextValue = useMemo(() => {
    const t = (key: string, values: Record<string, string | number>): string => {
      if (!languageData?.translations[key] && !baseTranslations.mapping[key as never]) {
        throw new Error(`Language key ${key} not found.`);
      }

      let translation = languageData?.translations[key] || (baseTranslations.mapping[key as never] as string);

      if (values) {
        Object.keys(values).forEach((placeholder) => {
          translation = translation.replaceAll(`{${placeholder}}`, String(values[placeholder]));
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
            translation = translation.replaceAll(`{${placeholder}}`, String(value));
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

      const translationItem = languageData?.items[key] || baseTranslations.items[key as never];
      const rules = new Intl.PluralRules(language);

      return translationItem[rules.select(count)].replaceAll('{count}', count.toString());
    };

    return { language, setLanguage, t, tReact, tItem };
  }, [language, languageData]);

  setGlobalTranslationHandle(contextValue);

  return <TranslationContext.Provider value={contextValue}>{children}</TranslationContext.Provider>;
};

export default TranslationProvider;
export { getTranslations, useTranslations } from './contexts/translationContext.ts';
