import { ReactNode, useState } from 'react';
import IgnoredFilesBrowser from '@/elements/IgnoredFilesBrowser.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import Stack from '@/elements/Stack.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props {
  serverUuid: string;
  label?: ReactNode;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
}

export default function IgnoredFilesInput({ serverUuid, label, description, value, onChange }: Props) {
  const { t } = useTranslations();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Stack gap='xs'>
      <TagsInput label={label} description={description} value={value} onChange={onChange} />

      <Switch
        label={t('common.form.previewIgnoredFiles', {})}
        checked={showPreview}
        onChange={(e) => setShowPreview(e.target.checked)}
      />

      {showPreview && <IgnoredFilesBrowser serverUuid={serverUuid} patterns={value} />}
    </Stack>
  );
}
