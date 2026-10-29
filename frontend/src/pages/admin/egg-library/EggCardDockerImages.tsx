import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggCardDockerImages({ dockerImages }: { dockerImages: Record<string, string> }) {
  const { t } = useTranslations();

  const entries = Object.entries(dockerImages);
  if (!entries.length) return null;

  return (
    <div className='mb-3'>
      <p className='mb-1.5 text-xs text-(--mantine-color-dimmed)'>
        {t('pages.admin.eggLibrary.card.dockerImages', {})}
      </p>
      <div className='flex flex-col gap-1'>
        {entries.map(([name, image]) => (
          <div key={name} className='flex items-center justify-between gap-3 min-w-0'>
            <span className='shrink-0 text-xs text-(--mantine-color-text)'>{name}</span>
            <span className='min-w-0 truncate font-mono text-[11px] text-(--mantine-color-dimmed)'>{image}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
