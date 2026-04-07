import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import classNames from 'classnames';
import { useRef, useState } from 'react';
import AvatarEditor, { AvatarEditorRef } from 'react-avatar-editor';
import { httpErrorToHuman } from '@/api/axios.ts';
import removeAvatar from '@/api/me/account/removeAvatar.ts';
import updateAvatar from '@/api/me/account/updateAvatar.ts';
import Button from '@/elements/Button.tsx';
import FileInput from '@/elements/input/FileInput.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function AvatarContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const editor = useRef<AvatarEditorRef>(null);

  const doUpdate = () => {
    setLoading(true);

    try {
      editor.current?.getImageScaledToCanvas().toBlob((blob) => {
        updateAvatar(blob ?? new Blob())
          .then((avatar) => {
            addToast(t('pages.account.account.containers.avatar.toast.updated', {}), 'success');

            setUser({ ...user!, avatar });
          })
          .catch((msg) => {
            addToast(httpErrorToHuman(msg), 'error');
          })
          .finally(() => setLoading(false));
      });
    } catch (err) {
      setLoading(false);
      console.error(err);
    }
  };

  const doRemove = () => {
    removeAvatar()
      .then(() => {
        addToast(t('pages.account.account.containers.avatar.toast.removed', {}), 'success');

        setUser({ ...user!, avatar: undefined });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <TitleCard
      title={t('pages.account.account.containers.avatar.title', {})}
      icon={<FontAwesomeIcon icon={faImage} />}
      className={classNames(
        'h-full order-50 md:col-span-2',
        requireTwoFactorActivation && 'blur-xs pointer-events-none select-none',
      )}
    >
      <Group className='h-full'>
        <AvatarEditor
          ref={editor}
          image={file ?? user!.avatar}
          height={512}
          width={512}
          showGrid
          style={{ width: 256, height: 256, borderRadius: '0.25rem' }}
        />

        <Stack className='h-full grow'>
          <FileInput
            label={t('pages.account.account.containers.avatar.form.avatar', {})}
            placeholder={t('pages.account.account.containers.avatar.form.avatar', {})}
            value={file}
            onChange={(file) => setFile(file)}
            accept='image/*'
            clearable
          />

          <Group>
            <Button loading={loading} disabled={!file} onClick={doUpdate}>
              {t('common.button.update', {})}
            </Button>
            <Button color='red' loading={loading} disabled={!user!.avatar} onClick={doRemove}>
              {t('common.button.remove', {})}
            </Button>
          </Group>
        </Stack>
      </Group>
    </TitleCard>
  );
}
