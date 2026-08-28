import { z } from 'zod';
import { serverScheduleStepActionSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { renderCompact } from './ActionRenderer.compact.tsx';
import { renderDetailed } from './ActionRenderer.detailed.tsx';

type ActionRendererMode = 'compact' | 'detailed';
type Action = z.infer<typeof serverScheduleStepActionSchema>;

interface ActionRendererProps {
  action: Action;
  mode?: ActionRendererMode;
}

export default function ActionRenderer({ action, mode = 'compact' }: ActionRendererProps) {
  const translations = useTranslations();

  return <>{mode === 'compact' ? renderCompact(action, translations) : renderDetailed(action, translations)}</>;
}
