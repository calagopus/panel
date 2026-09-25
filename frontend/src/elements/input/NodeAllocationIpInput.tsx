import { AutocompleteProps, ComboboxItemGroup } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { makeComponentHookable } from 'shared';
import getNodeAllocationIps from '@/api/admin/nodes/allocations/getNodeAllocationIps.ts';
import getNodeSystemIps from '@/api/admin/nodes/system/getNodeSystemIps.ts';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const ANY_ADDRESSES = ['0.0.0.0', '::'];

type Props = Omit<AutocompleteProps, 'data'> & {
  nodeUuid?: string;
  suggestedIps?: string[];
};

function NodeAllocationIpInput({ nodeUuid, suggestedIps, ...rest }: Props) {
  const { t } = useTranslations();
  const canReadNode = useAdminCan('nodes.read');
  const canReadAllocations = useAdminCan('nodes.allocations');
  const [opened, setOpened] = useState(false);

  const { data: systemIps } = useQuery({
    queryKey: queryKeys.admin.nodes.systemIps(nodeUuid!),
    queryFn: () => getNodeSystemIps(nodeUuid!),
    enabled: !!nodeUuid && canReadNode && opened,
    staleTime: 60_000,
    retry: false,
  });

  const { data: allocationIps } = useQuery({
    queryKey: queryKeys.admin.nodes.allocationIps(nodeUuid!),
    queryFn: () => getNodeAllocationIps(nodeUuid!),
    enabled: !!nodeUuid && canReadAllocations && opened,
    retry: false,
  });

  const data = useMemo(() => {
    const seen = new Set(ANY_ADDRESSES);
    const unseen = (ips: string[] | undefined) =>
      (ips ?? []).filter((ip) => {
        if (seen.has(ip)) return false;
        seen.add(ip);
        return true;
      });

    const groups: ComboboxItemGroup<string>[] = [
      { group: t('common.elements.nodeAllocationIpInput.anyAddress', {}), items: ANY_ADDRESSES },
      {
        group: t('common.elements.nodeAllocationIpInput.nodeInterfaces', {}),
        items: unseen([...(suggestedIps ?? []), ...(systemIps ?? [])]),
      },
      { group: t('common.elements.nodeAllocationIpInput.inUse', {}), items: unseen(allocationIps) },
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [suggestedIps, systemIps, allocationIps, t]);

  return (
    <Autocomplete
      {...rest}
      data={data}
      onDropdownOpen={() => setOpened(true)}
      onDropdownClose={() => setOpened(false)}
    />
  );
}

export default makeComponentHookable(NodeAllocationIpInput);
