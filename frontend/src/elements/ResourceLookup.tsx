import { faEye, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { IconLike } from '@/elements/data-display/Icon.tsx';
import { getHttpStatus, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';

export interface ResourceLookupField {
  label: string;
  value: ReactNode;
}

export function ResourceLookupResult({
  title,
  icon,
  fields,
}: {
  title: string;
  icon: IconLike;
  fields: ResourceLookupField[];
}) {
  return (
    <TitleCard title={title} icon={icon}>
      <Stack gap='xs'>
        {fields.map((field) => (
          <Group key={field.label} justify='space-between'>
            <Text size='sm' fw={500}>
              {field.label}
            </Text>
            <Text size='sm'>{field.value}</Text>
          </Group>
        ))}
      </Stack>
    </TitleCard>
  );
}

export interface ResourceLookupLabels {
  inputLabel: string;
  inputPlaceholder?: string;
  search: string;
  notFound: string;
  resultTitle: string;
  viewResult: string;
}

export interface ResourceLookupProps<T> {
  labels: ResourceLookupLabels;
  resultIcon: IconLike;
  lookup: (identifier: string) => Promise<T>;
  fields: (result: T) => ResourceLookupField[];
  href: (result: T) => string;
  disabled?: boolean;
  resetKey?: unknown;
  onNavigate?: () => void;
  renderActions: (viewButton: ReactNode) => ReactNode;
  children?: ReactNode;
}

export default function ResourceLookup<T>({
  labels,
  resultIcon,
  lookup,
  fields,
  href,
  disabled,
  resetKey,
  onNavigate,
  renderActions,
  children,
}: ResourceLookupProps<T>) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [notFound, setNotFound] = useState(false);
  const requestId = useRef(0);

  const reset = () => {
    requestId.current++;
    setLoading(false);
    setResult(null);
    setNotFound(false);
  };

  useEffect(() => {
    reset();
  }, [resetKey]);

  const canSearch = !disabled && !!identifier.trim();

  const doSearch = () => {
    if (!canSearch) return;

    reset();
    setLoading(true);
    const id = requestId.current;

    lookup(identifier.trim())
      .then((found) => {
        if (id === requestId.current) setResult(found);
      })
      .catch((err) => {
        if (id !== requestId.current) return;

        if (getHttpStatus(err) === 404) {
          setNotFound(true);
        } else {
          addToast(httpErrorToHuman(err), 'error');
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };

  return (
    <>
      <Stack>
        {children}

        <Group align='flex-end'>
          <TextInput
            label={labels.inputLabel}
            placeholder={labels.inputPlaceholder}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              reset();
            }}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            style={{ flex: 1 }}
          />
          <Button onClick={doSearch} loading={loading} disabled={!canSearch}>
            {labels.search}
          </Button>
        </Group>

        {notFound && <Alert icon={faMagnifyingGlass}>{labels.notFound}</Alert>}

        {result && <ResourceLookupResult title={labels.resultTitle} icon={resultIcon} fields={fields(result)} />}
      </Stack>

      {renderActions(
        result && (
          <Button
            color='blue'
            leftSection={<FontAwesomeIcon icon={faEye} />}
            onClick={() => {
              onNavigate?.();
              navigate(href(result));
            }}
          >
            {labels.viewResult}
          </Button>
        ),
      )}
    </>
  );
}
