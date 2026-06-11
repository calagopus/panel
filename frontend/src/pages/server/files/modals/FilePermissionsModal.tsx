import { ModalProps, Stack, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import chmodFiles from '@/api/server/files/chmodFiles.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { permissionStringToNumber } from '@/lib/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

type PermissionKey = 'owner' | 'group' | 'other';
type PermissionType = 'read' | 'write' | 'execute';

export default function FilePermissionsModal({ file, opened, onClose }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingWritableDirectory, browsingDirectory } = useFileManager();

  const [permissions, setPermissions] = useState<Record<PermissionKey, Record<PermissionType, boolean>>>({
    owner: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    other: { read: false, write: false, execute: false },
  });
  const [recursive, setRecursive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) {
      setRecursive(false);
    }
  }, [opened]);

  useEffect(() => {
    if (file?.mode) {
      const octalValue = permissionStringToNumber(file.mode);
      const octalString = octalValue.toString().padStart(3, '0');

      const [ownerPerms, groupPerms, otherPerms] = octalString.split('').map(Number);

      setPermissions({
        owner: {
          read: (ownerPerms & 4) !== 0,
          write: (ownerPerms & 2) !== 0,
          execute: (ownerPerms & 1) !== 0,
        },
        group: {
          read: (groupPerms & 4) !== 0,
          write: (groupPerms & 2) !== 0,
          execute: (groupPerms & 1) !== 0,
        },
        other: {
          read: (otherPerms & 4) !== 0,
          write: (otherPerms & 2) !== 0,
          execute: (otherPerms & 1) !== 0,
        },
      });
    }
  }, [file?.mode]);

  const togglePermission = (category: PermissionKey, type: PermissionType) => {
    setPermissions((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: !prev[category][type],
      },
    }));
  };

  const getPermissionString = () => {
    const { owner, group, other } = permissions;

    const getTriad = (perms: Record<PermissionType, boolean>) => {
      return (perms.read ? 'r' : '-') + (perms.write ? 'w' : '-') + (perms.execute ? 'x' : '-');
    };

    const fileTypeIndicator = file?.mode?.[0] || '-';
    return fileTypeIndicator + getTriad(owner) + getTriad(group) + getTriad(other);
  };

  const getOctalValue = () => {
    const getValue = (perms: Record<PermissionType, boolean>) => {
      return (perms.read ? 4 : 0) + (perms.write ? 2 : 0) + (perms.execute ? 1 : 0);
    };

    return parseInt(
      getValue(permissions.owner).toString() +
        getValue(permissions.group).toString() +
        getValue(permissions.other).toString(),
    );
  };

  const PermissionGroup = ({
    title,
    category,
    perms,
  }: {
    title: string;
    category: PermissionKey;
    perms: Record<PermissionType, boolean>;
  }) => (
    <Card>
      <Title order={3}>{title}</Title>
      <Stack mt='sm'>
        {Object.entries(perms).map(([type, value]: [string, boolean]) => (
          <Checkbox
            key={type}
            label={type[0].toUpperCase().concat(type.slice(1))}
            checked={value}
            onChange={() => togglePermission(category, type as PermissionType)}
            disabled={!browsingWritableDirectory}
          />
        ))}
      </Stack>
    </Card>
  );

  const doChmod = () => {
    if (!file) return;

    const newPermissions = getOctalValue();

    setLoading(true);

    chmodFiles({
      uuid: server.uuid,
      root: browsingDirectory,
      files: [{ file: file.name, mode: newPermissions.toString(), recursive }],
    })
      .then(({ updated }) => {
        onClose();
        if (updated > 0) {
          if (updated === 1) {
            addToast(t('pages.server.files.toast.permissionsUpdated', {}), 'success');
          } else {
            addToast(
              t('pages.server.files.toast.permissionsUpdatedMany', { files: tItem('file', updated) }),
              'success',
            );
          }
        } else {
          addToast(t('pages.server.files.toast.permissionsCouldNotBeUpdated', {}), 'error');
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.filePermissions.title', {})} onClose={onClose} opened={opened} size='lg'>
      <Card>
        <div className='flex flex-row justify-between'>
          <Title order={3}>{t('pages.server.files.modal.filePermissions.symbolic', {})}</Title>
          <Badge variant='light' color='blue' size='xl' className='lowercase!'>
            {getPermissionString()}
          </Badge>
        </div>
        <div className='mt-2 flex flex-row justify-between'>
          <Title order={3}>{t('pages.server.files.modal.filePermissions.octal', {})}</Title>
          <Badge variant='light' color='green' size='xl'>
            {getOctalValue()}
          </Badge>
        </div>
      </Card>

      <div className='mt-4 grid grid-cols-3 gap-4'>
        <PermissionGroup
          title={t('pages.server.files.modal.filePermissions.owner', {})}
          category='owner'
          perms={permissions.owner}
        />
        <PermissionGroup
          title={t('pages.server.files.modal.filePermissions.group', {})}
          category='group'
          perms={permissions.group}
        />
        <PermissionGroup
          title={t('pages.server.files.modal.filePermissions.other', {})}
          category='other'
          perms={permissions.other}
        />
      </div>

      <Card mt='md'>
        <Title order={3}>{t('pages.server.files.modal.filePermissions.breakdown', {})}</Title>
        <div className='text-sm space-y-1'>
          <div>
            <Code className='font-bold'>r</Code> - {t('pages.server.files.modal.filePermissions.readPermission', {})}
          </div>
          <div>
            <Code className='font-bold'>w</Code> - {t('pages.server.files.modal.filePermissions.writePermission', {})}
          </div>
          <div>
            <Code className='font-bold'>x</Code> - {t('pages.server.files.modal.filePermissions.executePermission', {})}
          </div>
        </div>
      </Card>

      {browsingWritableDirectory && file?.directory && (
        <Switch
          label={t('pages.server.files.modal.filePermissions.form.recursive', {})}
          name='recursive'
          checked={recursive}
          onChange={(e) => setRecursive(e.target.checked)}
          className='mt-4'
        />
      )}

      <ModalFooter>
        <Button onClick={doChmod} loading={loading} disabled={!browsingWritableDirectory}>
          {t('common.button.save', {})}
        </Button>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
