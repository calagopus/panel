import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { assetDirectoryCreateSchema, storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';

interface NewDirectoryModalProps extends ModalProps {
  currentDirectory: string;
  existingEntries: z.infer<typeof storageAssetSchema>[];
  onNavigate: (dir: string) => void;
}

export default function NewDirectoryModal({
  currentDirectory,
  existingEntries,
  onNavigate,
  onClose,
  ...props
}: NewDirectoryModalProps) {
  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof assetDirectoryCreateSchema>>(
    {
      initialValues: { name: '' },
      validateInputOnBlur: true,
      validate: zod4Resolver(assetDirectoryCreateSchema),
    },
    onClose,
  );

  const submit = () => {
    setLoading(true);

    const fullPath = currentDirectory ? `${currentDirectory}/${form.values.name}` : form.values.name;

    const alreadyExists = existingEntries.some((e) => e.isDirectory && e.name === fullPath);

    onNavigate(fullPath);
    handleClose();

    void alreadyExists;
    setLoading(false);
  };

  return (
    <Modal title='New Directory' onClose={handleClose} {...props}>
      <form onSubmit={form.onSubmit(() => submit())}>
        <TextInput
          withAsterisk
          label='Directory name'
          placeholder='Directory name'
          data-autofocus
          {...form.getInputProps('name')}
        />

        <p className='mt-2 text-sm break-all'>
          <span className='text-neutral-200'>Will be created at </span>
          <Code>
            assets/
            <span className='text-cyan-200'>
              {currentDirectory ? `${currentDirectory}/${form.values.name}` : form.values.name}
            </span>
          </Code>
        </p>

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            Create
          </Button>
          <Button variant='default' onClick={handleClose}>
            Cancel
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
