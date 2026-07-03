import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import AnimatedHourglass from '@/elements/AnimatedHourglass.tsx';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import Group from '@/elements/Group.tsx';
import Text from '@/elements/Text.tsx';
import ThemeIcon from '@/elements/ThemeIcon.tsx';
import Timeline from '@/elements/Timeline.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { scheduleStepIconMapping, scheduleStepLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ActionRenderer from './ActionRenderer.tsx';

const INDENT_WIDTH = 28;
const LINE_WIDTH = 2;
const BULLET_SIZE = 40;

interface ActionStepProps {
  step: z.infer<typeof serverScheduleStepSchema>;
  isActive: boolean;
  indent?: number;
  nextIndent?: number;
}

export default function ActionStep({ step, isActive, indent = 0, nextIndent = indent }: ActionStepProps) {
  const { t } = useTranslations();
  const delta = nextIndent - indent;

  return (
    <Timeline.Item
      style={
        {
          marginLeft: indent * INDENT_WIDTH,
          ...(delta !== 0 && { '--timeline-line-display': 'none' }),
        } as React.CSSProperties
      }
      bullet={
        isActive ? (
          <AnimatedHourglass />
        ) : (
          <FontAwesomeIcon icon={scheduleStepIconMapping[step.action.type]} size='sm' />
        )
      }
      title={
        <Group gap='sm' align='start'>
          <Text fw={600}>{scheduleStepLabelMapping[step.action.type]()} </Text>
          {isActive && <Badge ml='md'>{t('pages.server.schedules.view.badge.running', {})}</Badge>}
          {step.error && (
            <Tooltip label={step.error}>
              <ThemeIcon size='sm' color='red' className='cursor-help'>
                <FontAwesomeIcon icon={faExclamationTriangle} size='xs' />
              </ThemeIcon>
            </Tooltip>
          )}
        </Group>
      }
    >
      {delta !== 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: 0,
            bottom: `calc(-1 * var(--mantine-spacing-xl) - ${BULLET_SIZE / 2}px)`,
            left: (delta > 0 ? 0 : delta * INDENT_WIDTH) - LINE_WIDTH,
            width: Math.abs(delta) * INDENT_WIDTH,
            borderBottom: `${LINE_WIDTH}px solid var(--item-border-color)`,
            ...(delta > 0
              ? {
                  borderLeft: `${LINE_WIDTH}px solid var(--item-border-color)`,
                  borderBottomLeftRadius: 12,
                }
              : {
                  borderRight: `${LINE_WIDTH}px solid var(--item-border-color)`,
                  borderBottomRightRadius: 12,
                }),
          }}
        />
      )}

      <Card p='sm' mt='xs'>
        <ActionRenderer action={step.action} mode='detailed' />
      </Card>
    </Timeline.Item>
  );
}
