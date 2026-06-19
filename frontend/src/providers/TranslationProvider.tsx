import { Text, Title, TitleOrder } from '@mantine/core';
import { Fragment, ReactNode, startTransition, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { getTranslationMapping, setGlobalTranslationHandle, TranslationContext, TranslationItemRecord } from 'shared';
import { z } from 'zod';
import { $ZodConfig } from 'zod/v4/core';
import { axiosInstance } from '@/api/axios.ts';
import Anchor from '@/elements/Anchor.tsx';
import Code from '@/elements/Code.tsx';
import { getGlobalStore } from '@/stores/global.ts';
import baseTranslations from '@/translations.ts';

const modules = import.meta.glob('/node_modules/zod/v4/locales/*.js');

type LanguageData = {
  items: TranslationItemRecord;
  translations: Record<string, string>;
};

declare global {
  interface String {
    md(): ReactNode;
  }
}

const SafeMarkdownLink = ({ href, children }: { href?: string; children?: ReactNode }) => {
  if (href && /^(javascript|data|vbscript):/i.test(href)) {
    return <span>{children}</span>;
  }
  return <Anchor href={href}>{children}</Anchor>;
};

const Header =
  ({ order }: { order: TitleOrder }) =>
  (props: React.ComponentProps<typeof Title>) => <Title order={order} {...props} />;

String.prototype.md = function (): ReactNode {
  return (
    <Markdown
      components={{
        a: SafeMarkdownLink,
        p: ({ children }) => <Text component='span'>{children}</Text>,
        h1: Header({ order: 1 }),
        h2: Header({ order: 2 }),
        h3: Header({ order: 3 }),
        h4: Header({ order: 4 }),
        h5: Header({ order: 5 }),
        h6: Header({ order: 6 }),
        code: ({ children }) => <Code>{children}</Code>,
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
  const [language, setLanguage] = useState(
    localStorage.getItem('last_language') || getGlobalStore().settings.app.language || 'en',
  );
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);

  const loadZod = async (lang: string) => {
    if (!modules[`/node_modules/zod/v4/locales/${lang}.js`]) {
      return;
    }

    const { default: locale } = (await modules[`/node_modules/zod/v4/locales/${lang}.js`]()) as {
      default: () => $ZodConfig;
    };

    z.config(locale());
  };

  useEffect(() => {
    startTransition(() => {
      if (language === 'en') {
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';

        setLanguageData(null);
      } else {
        axiosInstance
          .get(`/translations/${language}.json`)
          .then(({ data }) => {
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
            setLanguage('en');
            console.error(err);
          });
      }

      loadZod(language);
    });

    localStorage.setItem('last_language', language);
  }, [language]);

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

  setGlobalTranslationHandle({ language, setLanguage, t, tReact, tItem });

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, tReact, tItem }}>
      {children}
    </TranslationContext.Provider>
  );
};

export default TranslationProvider;
export { getTranslations, useTranslations } from './contexts/translationContext.ts';
