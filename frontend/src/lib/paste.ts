import { useToast } from '@/providers/ToastProvider.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export function pasteFromClipboard(): Promise<string> {
  if (!window.isSecureContext) {
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-999999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();

    return new Promise<string>((resolve, reject) => {
      const successful = document.execCommand('paste');
      const value = textArea.value;
      textArea.remove();
      successful && value ? resolve(value) : reject();
    }).catch(() => {
      const result = window.prompt(getTranslations().t('elements.pasteOnClick.toast.pasteManual', {}), '');
      if (result === null) {
        return Promise.reject();
      }
      return result;
    });
  }

  return navigator.clipboard.readText();
}

export function handleRawPasteFromClipboard(
  onPaste: (text: string) => void,
  addToast?: ReturnType<typeof useToast>['addToast'],
) {
  pasteFromClipboard()
    .then((text) => {
      onPaste(text);
      addToast?.(getTranslations().t('elements.pasteOnClick.toast.pasted', {}), 'success');
    })
    .catch((err) => {
      console.error(err);
      addToast?.(getTranslations().t('elements.pasteOnClick.toast.failed', {}), 'error');
    });
}

export function handlePasteFromClipboard(
  onPaste: (text: string) => void,
  addToast?: ReturnType<typeof useToast>['addToast'],
) {
  return (e: React.MouseEvent) => {
    e.preventDefault();

    handleRawPasteFromClipboard(onPaste, addToast);
  };
}
