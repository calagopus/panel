import { useTranslations } from '@/providers/TranslationProvider.tsx';

export const findFileEditorAction = (action?: string) =>
  action
    ? (window.extensionContext.extensionRegistry.pages.server.files.fileEditorActions.find(
        (candidate) => candidate.name === action,
      ) ?? null)
    : null;

export function useFileEditorTitle(action: string | undefined, fileName: string, customTitle?: string) {
  const { t } = useTranslations();
  if (customTitle) return customTitle;
  if (!fileName) return t('pages.server.files.titleEditorNew', {});
  if (action === 'image') return t('pages.server.files.titleEditorViewing', { file: fileName });
  if (action === 'audio') return t('pages.server.files.titleEditorPlaying', { file: fileName });

  return t('pages.server.files.titleEditorEditing', { file: fileName });
}
