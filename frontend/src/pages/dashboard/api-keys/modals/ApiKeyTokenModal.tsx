import { ModalProps } from '@mantine/core';
import Button from '@/elements/buttons/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = Omit<ModalProps, 'title' | 'opened'> & {
  token: string | null;
  recreated?: boolean;
};

export default function ApiKeyTokenModal({ token, recreated, onClose, ...props }: Props) {
  const { t } = useTranslations();

  return (
    <Modal
      title={
        recreated
          ? t('pages.account.apiKeys.modal.apiKeyToken.titleRecreated', {})
          : t('pages.account.apiKeys.modal.apiKeyToken.titleCreated', {})
      }
      opened={token !== null}
      onClose={onClose}
      {...props}
    >
      <Stack>
        <Text>
          {recreated
            ? t('pages.account.apiKeys.modal.apiKeyToken.descriptionRecreated', {})
            : t('pages.account.apiKeys.modal.apiKeyToken.descriptionCreated', {})}
        </Text>

        {token && (
          <CopyOnClick content={token}>
            <Code block className='break-all'>
              {token}
            </Code>
          </CopyOnClick>
        )}

        <ModalFooter>
          <Button variant='default' onClick={onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
