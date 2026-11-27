import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Typography } from '@mantine/core';
import { useDeferredValue, useState } from 'react';
import Markdown, { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import Anchor from '@/elements/typography/Anchor.tsx';
import { markdownComponents, useTranslations } from '@/providers/TranslationProvider.tsx';

const { p: _p, ...documentComponents } = markdownComponents;

const isExternalUrl = (url?: string) => !!url && /^(https?:|mailto:)/i.test(url);

export default function FileMarkdownPreview({ content }: { content: string }) {
  const { t } = useTranslations();
  const deferredContent = useDeferredValue(content);
  const [loadImages, setLoadImages] = useState(false);

  const components: Components = {
    ...documentComponents,
    a: ({ href, children }) =>
      isExternalUrl(href) ? (
        <Anchor href={href} target='_blank' rel='noopener noreferrer' inherit>
          {children}
        </Anchor>
      ) : (
        <span>{children}</span>
      ),
    img: ({ src, alt }) =>
      typeof src !== 'string' || !/^https?:/i.test(src) ? (
        <span className='text-(--mantine-color-dimmed)'>{alt}</span>
      ) : loadImages ? (
        <img src={src} alt={alt} referrerPolicy='no-referrer' loading='lazy' className='inline max-w-full' />
      ) : (
        <button
          type='button'
          className='inline-flex items-center gap-1.5 rounded border border-(--mantine-color-default-border) px-2 py-0.5 text-sm text-(--mantine-color-dimmed) cursor-pointer'
          title={t('pages.server.files.markdown.loadImages', {})}
          onClick={() => setLoadImages(true)}
        >
          <FontAwesomeIcon icon={faImage} />
          {alt || t('pages.server.files.markdown.image', {})}
        </button>
      ),
  };

  return (
    <div className='h-full w-full overflow-auto px-4 py-3 lg:px-6' data-file-markdown-preview>
      <Typography className='wrap-break-word [&_ol]:list-decimal [&_ul:not(.contains-task-list)]:list-disc'>
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={components}>
          {deferredContent}
        </Markdown>
      </Typography>
    </div>
  );
}
