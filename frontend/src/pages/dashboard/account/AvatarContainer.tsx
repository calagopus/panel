import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMutation } from '@tanstack/react-query';
import classNames from 'classnames';
import { useRef, useState } from 'react';
import AvatarEditor, { AvatarEditorRef } from 'react-avatar-editor';
import { httpErrorToHuman } from '@/api/axios.ts';
import removeAvatar from '@/api/me/account/removeAvatar.ts';
import updateAvatar from '@/api/me/account/updateAvatar.ts';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import FileInput from '@/elements/input/FileInput.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function AvatarContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const editor = useRef<AvatarEditorRef>(null);

  const updateMutation = useMutation({
    mutationFn: async (blob: Blob) => updateAvatar(blob),
    onSuccess: (avatar) => {
      addToast(t('pages.account.account.containers.avatar.toast.updated', {}), 'success');
      setUser({ ...user!, avatar });
      setFile(null);
    },
    onError: (err) => {
      console.error(err);
      addToast(httpErrorToHuman(err), 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => {
      addToast(t('pages.account.account.containers.avatar.toast.removed', {}), 'success');
      setUser({ ...user!, avatar: null });
      setFile(null);
    },
    onError: (err) => {
      console.error(err);
      addToast(httpErrorToHuman(err), 'error');
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const isAllowedExt = !!extension && ALLOWED_EXTENSIONS.includes(extension);
    const isAllowedMime = !!selectedFile.type && ALLOWED_MIME_TYPES.includes(selectedFile.type);

    if (!isAllowedExt && !isAllowedMime) {
      addToast(t('pages.account.account.containers.avatar.toast.invalidImage', {}), 'error');
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_AVATAR_FILE_SIZE) {
      addToast(t('pages.account.account.containers.avatar.toast.sizeExceeded', {}), 'error');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const doUpdate = async () => {
    if (!file) return;

    const canvas = editor.current?.getImageScaledToCanvas();
    if (!canvas) {
      addToast(t('pages.account.account.containers.avatar.toast.processFailed', {}), 'error');
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) {
      addToast(t('pages.account.account.containers.avatar.toast.processFailed', {}), 'error');
      return;
    }

    updateMutation.mutate(blob);
  };

  const isPending = updateMutation.isPending || removeMutation.isPending;
  const avatarSource = file ?? (user?.avatar ? user.avatar : undefined);
  const editorKey = file ? `file-${file.name}-${file.lastModified}` : (user?.avatar ?? 'empty');

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
          key={editorKey}
          ref={editor}
          image={avatarSource}
          height={512}
          width={512}
          showGrid
          onLoadFailure={() => {
            addToast(t('pages.account.account.containers.avatar.toast.loadFailed', {}), 'error');
            setFile(null);
          }}
          style={{ width: 256, height: 256, borderRadius: '0.25rem' }}
        />

        <Stack className='h-full grow'>
          <FileInput
            label={t('pages.account.account.containers.avatar.form.avatar', {})}
            value={file}
            onChange={handleFileChange}
            accept='image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif'
            clearable
          />

          <Group>
            <Button loading={updateMutation.isPending} disabled={!file || isPending} onClick={doUpdate}>
              {t('common.button.update', {})}
            </Button>
            <Button
              color='red'
              loading={removeMutation.isPending}
              disabled={!user!.avatar || isPending}
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
