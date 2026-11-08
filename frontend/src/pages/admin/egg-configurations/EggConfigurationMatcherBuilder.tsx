import getLocation from '@/api/admin/locations/getLocation.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNode from '@/api/admin/nodes/getNode.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import MultiSelectGroup from '@/elements/input/MultiSelectGroup.tsx';
import SearchableUuidMultiSelect from '@/elements/input/SearchableUuidMultiSelect.tsx';
import RecursiveGroupBuilder from '@/elements/RecursiveGroupBuilder.tsx';
import { eggConfigurationMatcherLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminEggConfigurationMatcher } from '@/lib/schemas/admin/eggConfigurations.ts';
import { EggOptionGroup } from '@/plugins/useGroupedEggOptions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Matcher = AdminEggConfigurationMatcher;

const matcherDefaults: Record<Matcher['type'], () => Matcher> = {
  never: () => ({ type: 'never' }),
  all: () => ({ type: 'all' }),
  and: () => ({ type: 'and', matchers: [] }),
  or: () => ({ type: 'or', matchers: [] }),
  not: () => ({ type: 'not', matcher: { type: 'eggs', eggs: [] } }),
  eggs: () => ({ type: 'eggs', eggs: [] }),
  nests: () => ({ type: 'nests', nests: [] }),
  nodes: () => ({ type: 'nodes', nodes: [] }),
  locations: () => ({ type: 'locations', locations: [] }),
};

interface MatcherBuilderProps {
  matcher: Matcher;
  onChange: (matcher: Matcher) => void;
  eggOptions: EggOptionGroup[];
  eggsLoading: boolean;
}

export default function EggConfigurationMatcherBuilder({
  matcher,
  onChange,
  eggOptions,
  eggsLoading,
}: MatcherBuilderProps) {
  const { t } = useTranslations();
  const page = 'pages.admin.eggConfigurations.tabs.general.page';

  const renderLeaf = (node: Matcher, change: (next: Matcher) => void) => (
    <>
      {node.type === 'eggs' && (
        <MultiSelectGroup
          label={t(`${page}.enum.matcherType.eggs`, {})}
          placeholder={t(`${page}.form.eggsPlaceholder`, {})}
          data={eggOptions}
          searchable
          loading={eggsLoading}
          value={node.eggs}
          onChange={(eggs) => change({ ...node, eggs })}
        />
      )}
      {node.type === 'nests' && (
        <MultiSelect
          label={t(`${page}.enum.matcherType.nests`, {})}
          placeholder={t(`${page}.form.nestsPlaceholder`, {})}
          data={eggOptions.map((group) => ({ label: group.group, value: group.nestUuid }))}
          searchable
          loading={eggsLoading}
          value={node.nests}
          onChange={(nests) => change({ ...node, nests })}
        />
      )}
      {node.type === 'nodes' && (
        <SearchableUuidMultiSelect
          label={t(`${page}.enum.matcherType.nodes`, {})}
          placeholder={t(`${page}.form.nodesPlaceholder`, {})}
          value={node.nodes}
          onChange={(nodes) => change({ ...node, nodes })}
          listQueryKey={queryKeys.admin.nodes.all()}
          detailQueryKey={queryKeys.admin.nodes.detail}
          paginatedFetcher={(page, search) => getNodes(page, search)}
          fetchOne={getNode}
        />
      )}
      {node.type === 'locations' && (
        <SearchableUuidMultiSelect
          label={t(`${page}.enum.matcherType.locations`, {})}
          placeholder={t(`${page}.form.locationsPlaceholder`, {})}
          value={node.locations}
          onChange={(locations) => change({ ...node, locations })}
          listQueryKey={queryKeys.admin.locations.all()}
          detailQueryKey={queryKeys.admin.locations.detail}
          paginatedFetcher={(page, search) => getLocations(page, search)}
          fetchOne={getLocation}
        />
      )}
    </>
  );

  return (
    <RecursiveGroupBuilder<Matcher>
      node={matcher}
      onChange={onChange}
      typeData={mappingToSelectData(eggConfigurationMatcherLabelMapping)}
      makeDefault={(type) => matcherDefaults[type as Matcher['type']]()}
      getChildren={(node) => (node.type === 'and' || node.type === 'or' ? node.matchers : null)}
      withChildren={(node, matchers) => ({ ...node, matchers }) as Matcher}
      getNotChild={(node) => (node.type === 'not' ? node.matcher : null)}
      withNotChild={(node, child) => ({ ...node, matcher: child }) as Matcher}
      emptyNode={{ type: 'eggs', eggs: [] }}
      renderLeaf={renderLeaf}
      labels={{
        type: t(`${page}.form.matcherType`, {}),
        allMustMatch: t(`${page}.matcher.allMustMatch`, {}),
        anyMustMatch: t(`${page}.matcher.anyMustMatch`, {}),
        mustNotMatch: t(`${page}.matcher.mustNotMatch`, {}),
        addChild: t(`${page}.button.addMatcher`, {}),
      }}
    />
  );
}
