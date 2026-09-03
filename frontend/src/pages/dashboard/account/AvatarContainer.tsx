import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMutation } from '@tanstack/react-query';
import classNames from 'classnames';
import { useRef, useState } from 'react';
import AvatarEditor, { AvatarEditorRef } from 'react-avatar-editor';
import { httpErrorToHuman } from '@/api/axios.ts';
import removeAvatar from '@/api/me/account/removeAvatar.ts';
import updateAvatar from '@/api/me/account/updateAvatar.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import FileInput from '@/elements/input/FileInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function AvatarContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const editor = useRef<AvatarEditorRef>(null);

  const onError = (err: unknown) => addToast(httpErrorToHuman(err), 'error');

  const onMutationSuccess = (avatar: string | null, message: string) => {
    addToast(message, 'success');
    setUser({ ...user!, avatar });
    setFile(null);
  };

  const updateMutation = useMutation({
    mutationFn: updateAvatar,
    onSuccess: (avatar) => onMutationSuccess(avatar, t('pages.account.account.containers.avatar.toast.updated', {})),
    onError,
  });

  const removeMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => onMutationSuccess(null, t('pages.account.account.containers.avatar.toast.removed', {})),
    onError,
  });

  const isPending = updateMutation.isPending || removeMutation.isPending;

  const doUpdate = () => {
    if (!file || isPending) return;

    editor.current?.getImageScaledToCanvas().toBlob((blob) => blob && updateMutation.mutate(blob), 'image/webp', 0.9);
  };

  return (
    <TitleCard
      title={t('pages.account.account.containers.avatar.title', {})}
      icon={<FontAwesomeIcon icon={faImage} />}
      className={classNames(
        'h-full order-60 md:col-span-2',
        requireTwoFactorActivation && 'blur-xs pointer-events-none select-none',
      )}
    >
      <Group className='h-full'>
        <AvatarEditor
          key={file ? `${file.name}-${file.lastModified}` : (user?.avatar ?? 'empty')}
          ref={editor}
          image={file ?? user?.avatar ?? undefined}
          height={512}
          width={512}
          showGrid
          onLoadFailure={() => {
            setFile((current) => {
              if (!current) return null;
              addToast(t('pages.account.account.containers.avatar.toast.loadFailed', {}), 'error');
              return null;
            });
          }}
          style={{ width: 256, height: 256, borderRadius: '0.25rem' }}
        />

        <Stack className='h-full grow'>
          <FileInput
            label={t('pages.account.account.containers.avatar.form.avatar', {})}
            value={file}
            onChange={setFile}
            accept='image/*'
            disabled={isPending}
            clearable
          />

          <Group>
            <Button loading={updateMutation.isPending} disabled={!file || isPending} onClick={doUpdate}>
              {t('common.button.update', {})}
            </Button>
            <Button
              color='red'
              loading={removeMutation.isPending}
              disabled={!user?.avatar || isPending}
              onClick={() => removeMutation.mutate()}
            >
              {t('common.button.remove', {})}
            </Button>
          </Group>
        </Stack>
      </Group>
    </TitleCard>
  );
}
