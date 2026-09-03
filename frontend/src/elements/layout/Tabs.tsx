import {
  Tabs as MantineTabs,
  TabsList as MantineTabsList,
  TabsPanel as MantineTabsPanel,
  TabsTab as MantineTabsTab,
  TabsListProps,
  TabsPanelProps,
  TabsProps,
  TabsTabProps,
} from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(({ ...rest }, ref) => {
  return <MantineTabsList ref={ref} {...rest} />;
});

const TabsTab = forwardRef<HTMLButtonElement, TabsTabProps>(({ ...rest }, ref) => {
  return <MantineTabsTab ref={ref} {...rest} />;
});

const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(({ ...rest }, ref) => {
  return <MantineTabsPanel ref={ref} {...rest} />;
});

const Tabs = makeComponentHookable(
  forwardRef<HTMLDivElement, TabsProps>(({ ...rest }, ref) => {
    return <MantineTabs ref={ref} {...rest} />;
  }),
  {
    List: makeComponentHookable(TabsList),
    Tab: makeComponentHookable(TabsTab),
    Panel: makeComponentHookable(TabsPanel),
  },
);

export default Tabs;
