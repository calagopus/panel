import {
  Timeline as MantineTimeline,
  TimelineItem as MantineTimelineItem,
  TimelineItemProps,
  TimelineProps,
} from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const TimelineItem = forwardRef<HTMLDivElement, TimelineItemProps>(({ ...rest }, ref) => {
  return <MantineTimelineItem ref={ref} {...rest} />;
});

const Timeline = makeComponentHookable(
  forwardRef<HTMLDivElement, TimelineProps>(({ ...rest }, ref) => {
    return <MantineTimeline ref={ref} {...rest} />;
  }),
  {
    Item: makeComponentHookable(TimelineItem),
  },
);

export default Timeline;
