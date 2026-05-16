import { useToast } from '@/providers/ToastProvider.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export function copyToClipboard(text: string) {
  if (!window.isSecureContext) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-999999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    return new Promise<void>((resolve, reject) => {
      document.execCommand('copy') ? resolve() : reject();
      textArea.remove();
    }).catch(() => {
      const successful = window.prompt(getTranslations().t('elements.copyOnClick.toast.copyManual', {}), text);
      if (successful === null) {
        return Promise.reject();
      }
    });
  }

  return navigator.clipboard.writeText(text);
}

export function handleRawCopyToClipboard(text: string, addToast?: ReturnType<typeof useToast>['addToast']) {
  copyToClipboard(text)
    .then(() => {
      addToast?.(getTranslations().t('elements.copyOnClick.toast.copied', {}), 'success');
    })
    .catch((err) => {
      console.error(err);
      addToast?.(getTranslations().t('elements.copyOnClick.toast.failed', {}), 'error');
    });
}

export function handleCopyToClipboard(text: string, addToast?: ReturnType<typeof useToast>['addToast']) {
  return (e: React.MouseEvent) => {
    e.preventDefault();

    handleRawCopyToClipboard(text, addToast);
  };
}
