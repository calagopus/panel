import { LanguageFn } from 'highlight.js';
import hljs from 'highlight.js/lib/core';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import Spinner from '@/elements/Spinner.tsx';
import Code from './Code.tsx';

const registeredLanguages = new Set<string>();

interface HljsCodeProps extends React.ComponentProps<typeof Code> {
  languageName: string;
  language: () => Promise<LanguageFn>;
}

export default forwardRef<HTMLPreElement, HljsCodeProps>(function HljsCode(
  { children, languageName, language, ...props }: HljsCodeProps,
  ref: React.Ref<HTMLPreElement>,
) {
  const codeContent = typeof children === 'string' ? children : 'Code content is not a string.';
  const [languageLoaded, setLanguageLoaded] = useState(registeredLanguages.has(languageName));

  const rendered = useCallback(() => {
    if (!registeredLanguages.has(languageName)) {
      return hljs.highlightAuto(codeContent).value;
    }

    return hljs.highlight(codeContent, { language: languageName }).value;
  }, [codeContent, languageName, languageLoaded]);

  useEffect(() => {
    if (!registeredLanguages.has(languageName)) {
      language().then((lang) => {
        hljs.registerLanguage(languageName, lang);
        registeredLanguages.add(languageName);
        setLanguageLoaded(true);
      });
    }
  }, [languageName, language]);

  return !languageLoaded ? (
    <Spinner.Centered />
  ) : (
    <Code
      block
      ref={ref}
      dangerouslySetInnerHTML={{
        __html: rendered(),
      }}
      {...props}
    />
  );
});
