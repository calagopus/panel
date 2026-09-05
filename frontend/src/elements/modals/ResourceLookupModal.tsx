import { faEye, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { getHttpStatus, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface ResourceLookupField {
  label: string;
  value: ReactNode;
}

interface ResourceLookupModalProps<T> extends ModalProps {
  labels: {
    title: string;
    inputLabel: string;
    inputPlaceholder?: string;
    search: string;
    notFound: string;
    resultTitle: string;
    viewResult: string;
  };
  resultIcon: ReactNode;
  lookup: (identifier: string) => Promise<T>;
  fields: (result: T) => ResourceLookupField[];
  href: (result: T) => string;
}

export default function ResourceLookupModal<T>({
  labels,
  resultIcon,
  lookup,
  fields,
  href,
  ...props
}: ResourceLookupModalProps<T>) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [notFound, setNotFound] = useState(false);

  const reset = () => {
    setResult(null);
    setNotFound(false);
  };

  const doSearch = () => {
    if (!identifier.trim()) return;

    setLoading(true);
    reset();

    lookup(identifier.trim())
      .then((found) => setResult(found))
      .catch((err) => {
        if (getHttpStatus(err) === 404) {
          setNotFound(true);
        } else {
          addToast(httpErrorToHuman(err), 'error');
        }
      })
      .finally(() => setLoading(false));
  };

  const handleClose = () => {
    setIdentifier('');
    reset();
    props.onClose();
  };

  return (
    <Modal title={labels.title} {...props} onClose={handleClose}>
      <Stack>
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
          <Button onClick={doSearch} loading={loading} disabled={!identifier.trim()}>
            {labels.search}
          </Button>
        </Group>

        {notFound && <Alert icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}>{labels.notFound}</Alert>}

        {result && (
          <TitleCard title={labels.resultTitle} icon={resultIcon}>
            <Stack gap='xs'>
              {fields(result).map((field) => (
                <Group key={field.label} justify='space-between'>
                  <Text size='sm' fw={500}>
                    {field.label}
                  </Text>
                  <Text size='sm'>{field.value}</Text>
                </Group>
              ))}
            </Stack>
          </TitleCard>
        )}
      </Stack>

      <ModalFooter>
        {result && (
          <Button color='blue' leftSection={<FontAwesomeIcon icon={faEye} />} onClick={() => navigate(href(result))}>
            {labels.viewResult}
          </Button>
        )}
        <Button variant='default' onClick={handleClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
