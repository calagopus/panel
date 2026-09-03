import { ListItemProps, ListProps, List as MantineList, ListItem as MantineListItem } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const ListItem = forwardRef<HTMLLIElement, ListItemProps>(({ ...rest }, ref) => {
  return <MantineListItem ref={ref} {...rest} />;
});

const List = makeComponentHookable(
  ({ ...rest }: ListProps) => {
    return <MantineList {...rest} />;
  },
  {
    Item: makeComponentHookable(ListItem),
  },
);

export default List;
