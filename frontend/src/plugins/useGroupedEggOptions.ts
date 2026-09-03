import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

export interface EggOptionGroup {
  group: string;
  items: { label: string; value: string }[];
}

const EMPTY_GROUPS: EggOptionGroup[] = [];

export function useGroupedEggOptions() {
  const { data, loading } = useResource<EggOptionGroup[]>({
    queryKey: queryKeys.admin.eggs.grouped(),
    queryFn: () =>
      getAllEggs().then((nests) =>
        nests.map((nest) => ({
          group: nest.nest.name,
          items: nest.eggs.map((egg) => ({ label: egg.name, value: egg.uuid })),
        })),
      ),
  });

  return { eggOptions: data ?? EMPTY_GROUPS, loading };
}
