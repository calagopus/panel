import { faBan, faCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Input, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import debounce from 'debounce';
import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import countIgnoreMatches from '@/api/server/files/countIgnoreMatches.ts';
import Button from '@/elements/buttons/Button.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import IgnoredFilesBrowser from '@/elements/files/IgnoredFilesBrowser.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

const LINE_HEIGHT = 22;
const VERTICAL_PADDING = 8;
const MAX_AUTO_COUNTED_PATTERNS = 20;
const MAX_PATTERNS_PER_REQUEST = 32;

function parsePatterns(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unanchoredExceptions(patterns: string[]): string[] {
  return [
    ...new Set(
      patterns.filter((pattern) => pattern.startsWith('!') && !pattern.slice(1).replace(/\/+$/, '').includes('/')),
    ),
  ];
}

function isCountedPattern(pattern: string): boolean {
  return !pattern.startsWith('#') && !pattern.startsWith('!');
}

async function countMatches(
  serverUuid: string,
  patterns: string[],
  signal: AbortSignal,
): Promise<Record<string, number | null>> {
  const chunks: string[][] = [];
  for (let i = 0; i < patterns.length; i += MAX_PATTERNS_PER_REQUEST) {
    chunks.push(patterns.slice(i, i + MAX_PATTERNS_PER_REQUEST));
  }

  const counts = await Promise.all(chunks.map((chunk) => countIgnoreMatches(serverUuid, chunk, signal)));
  return Object.fromEntries(counts.flat().map((count, index) => [patterns[index], count]));
}

function MatchIndicator({ count }: { count: number | null }) {
  const { t } = useTranslations();
  const maxResults = useGlobalStore((state) => state.settings.server.maxFileManagerSearchResults);

  if (count === null) {
    return (
      <>
        <FontAwesomeIcon icon={faTriangleExclamation} className='text-(--mantine-color-red-filled)' />
        <Text size='xs' c='dimmed' truncate>
          {t('common.elements.ignoredFilesInput.invalid', {})}
        </Text>
      </>
    );
  }

  return (
    <>
      <FontAwesomeIcon
        icon={count === 0 ? faTriangleExclamation : faCheck}
        className={count === 0 ? 'text-(--mantine-color-yellow-filled)' : 'text-(--mantine-color-green-filled)'}
      />
      <Text size='xs' c='dimmed' truncate>
        {count === 0
          ? t('common.elements.ignoredFilesInput.noMatches', {})
          : t('common.elements.ignoredFilesInput.matches', {
              count: count >= maxResults ? `${maxResults}+` : count,
            })}
      </Text>
    </>
  );
}

function MatchGutter({
  serverUuid,
  lines,
  settledLines,
  enabled,
  gutterRef,
}: {
  serverUuid: string;
  lines: string[];
  settledLines: string[];
  enabled: boolean;
  gutterRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslations();
  const canReadFiles = useServerCan('files.read');

  const patterns = [
    ...new Set(settledLines.map((line) => line.trim()).filter((pattern) => pattern && isCountedPattern(pattern))),
  ];

  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.server(serverUuid).files.ignoreMatches(patterns),
    queryFn: ({ signal }) => countMatches(serverUuid, patterns, signal),
    enabled: enabled && canReadFiles && patterns.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    meta: { progress: false },
  });

  if (!canReadFiles) return null;

  return (
    <div className='w-32 shrink-0 relative border-l border-(--mantine-color-default-border) bg-(--mantine-color-default)'>
      <div ref={gutterRef} className='absolute inset-0 overflow-hidden' style={{ paddingBlock: VERTICAL_PADDING }}>
        {lines.map((line, index) => {
          const pattern = line.trim();
          const settled = pattern === settledLines[index]?.trim();

          return (
            <div key={index} className='flex items-center gap-1.5 px-2 overflow-hidden' style={{ height: LINE_HEIGHT }}>
              {!pattern || !settled || pattern.startsWith('#') ? null : pattern.startsWith('!') ? (
                <>
                  <FontAwesomeIcon icon={faBan} className='text-(--mantine-color-dimmed)' />
                  <Text size='xs' c='dimmed' truncate>
                    {t('common.elements.ignoredFilesInput.exception', {})}
                  </Text>
                </>
              ) : data && Object.hasOwn(data, pattern) ? (
                <MatchIndicator count={data[pattern]} />
              ) : isFetching ? (
                <Spinner size={10} />
              ) : isError ? (
                <Text size='xs' c='dimmed' truncate>
                  {t('common.elements.ignoredFilesInput.unavailable', {})}
                </Text>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CountMatchesButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations();
  const canReadFiles = useServerCan('files.read');

  if (!canReadFiles) return null;

  return (
    <Button size='compact-xs' variant='default' className='shrink-0' onClick={onClick}>
      {t('common.elements.ignoredFilesInput.countMatches', {})}
    </Button>
  );
}

function PreviewSection({ serverUuid, patterns }: { serverUuid: string; patterns: string[] }) {
  const { t } = useTranslations();
  const canReadFiles = useServerCan('files.read');
  const [showPreview, setShowPreview] = useState(false);

  if (!canReadFiles) return null;

  return (
    <>
      <Switch
        label={t('common.form.previewIgnoredFiles', {})}
        checked={showPreview}
        onChange={(e) => setShowPreview(e.target.checked)}
      />

      {showPreview && <IgnoredFilesBrowser serverUuid={serverUuid} patterns={patterns} />}
    </>
  );
}

interface Props {
  serverUuid?: string;
  label?: ReactNode;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
}

export default function IgnoredFilesInput({ serverUuid, label, description, value, onChange }: Props) {
  const { t } = useTranslations();

  const [text, setText] = useState(() => value.join('\n'));
  const [settledText, setSettledText] = useState(text);
  const [countingRequested, setCountingRequested] = useState(false);
  const focused = useRef(false);
  const gutterRef = useRef<HTMLDivElement>(null);

  const updateSettledText = useMemo(() => debounce((next: string) => setSettledText(next), 600), []);

  useEffect(() => {
    updateSettledText(text);
  }, [text]);

  useEffect(() => {
    if (focused.current) return;

    const next = value.join('\n');
    setText((current) => (parsePatterns(current).join('\n') === next ? current : next));
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    onChange(parsePatterns(next));
  };

  const withinAutoLimit = parsePatterns(settledText).length <= MAX_AUTO_COUNTED_PATTERNS;
  const needsManualCount = !withinAutoLimit && !countingRequested;

  return (
    <Stack gap='xs'>
      <Stack gap={2}>
        {label && <Input.Label>{label}</Input.Label>}
        {description && <Input.Description>{description}</Input.Description>}

        <div className='flex items-stretch border border-(--mantine-color-default-border) rounded-md overflow-hidden'>
          <TextArea
            className='flex-1 min-w-0'
            variant='unstyled'
            autosize
            minRows={4}
            maxRows={14}
            spellCheck={false}
            autoCapitalize='off'
            autoCorrect='off'
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => {
              focused.current = true;
            }}
            onBlur={() => {
              focused.current = false;
            }}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            styles={{
              input: {
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 'var(--mantine-font-size-sm)',
                lineHeight: `${LINE_HEIGHT}px`,
                paddingBlock: VERTICAL_PADDING,
                paddingInline: 12,
                whiteSpace: 'pre',
                overflowX: 'auto',
              },
            }}
          />

          {serverUuid && (
            <MatchGutter
              serverUuid={serverUuid}
              lines={text.split(/\r?\n/)}
              settledLines={settledText.split(/\r?\n/)}
              enabled={withinAutoLimit || countingRequested}
              gutterRef={gutterRef}
            />
          )}
        </div>

        <Group justify='space-between' gap='xs' align='center' wrap='nowrap'>
          <Input.Description>
            {serverUuid && needsManualCount
              ? t('common.elements.ignoredFilesInput.tooManyPatterns', { max: MAX_AUTO_COUNTED_PATTERNS })
              : t('common.elements.ignoredFilesInput.onePatternPerLine', {})}
          </Input.Description>
          {serverUuid && needsManualCount && <CountMatchesButton onClick={() => setCountingRequested(true)} />}
        </Group>

        {unanchoredExceptions(value).map((pattern) => (
          <Text key={pattern} size='xs' c='yellow'>
            {t('common.elements.ignoredFilesInput.unanchoredException', {
              pattern,
              anchored: `!/${pattern.slice(1)}`,
            }).md()}
          </Text>
        ))}
      </Stack>

      {serverUuid && <PreviewSection serverUuid={serverUuid} patterns={value} />}
    </Stack>
  );
}
