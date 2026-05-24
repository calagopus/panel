import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
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
  onSubmit: _,
  ...props
}: NewDirectoryModalProps) {
  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof assetDirectoryCreateSchema>
  >({
    initialValues: { name: '' },
    validate: zod4Resolver(assetDirectoryCreateSchema),
    onClose,
    onSubmit: async (values) => {
      const fullPath = currentDirectory ? `${currentDirectory}/${values.name}` : values.name;
      onNavigate(fullPath);
    },
  });

  return (
    <FormModal
      title='New Directory'
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      {...props}
    >
      <TextInput
        withAsterisk
        label='Directory name'
        placeholder='Directory name'
        data-autofocus
        {...form.getInputProps('name')}
      />

      <p className='mt-2 text-sm break-all'>
        <span>Will be created at </span>
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
    </FormModal>
  );
}
