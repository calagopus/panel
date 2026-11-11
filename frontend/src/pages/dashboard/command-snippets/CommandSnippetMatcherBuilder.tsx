import { z } from 'zod';
import getUserEggs from '@/api/me/servers/eggs/getUserEggs.ts';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import RecursiveGroupBuilder from '@/elements/RecursiveGroupBuilder.tsx';
import { commandSnippetMatcherLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverEggSchema } from '@/lib/schemas/server/server.ts';
import { UserCommandSnippetMatcher } from '@/lib/schemas/user/commandSnippets.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Matcher = UserCommandSnippetMatcher;
type EggsMatcher = Extract<Matcher, { type: 'eggs' }>;

const matcherDefaults: Record<Matcher['type'], () => Matcher> = {
  never: () => ({ type: 'never' }),
  all: () => ({ type: 'all' }),
  and: () => ({ type: 'and', matchers: [] }),
  or: () => ({ type: 'or', matchers: [] }),
  not: () => ({ type: 'not', matcher: { type: 'eggs', eggs: [] } }),
  eggs: () => ({ type: 'eggs', eggs: [] }),
};

function EggsLeaf({ node, onChange }: { node: EggsMatcher; onChange: (node: Matcher) => void }) {
  const { t } = useTranslations();

  const eggs = useInfiniteSearchableResource<z.infer<typeof serverEggSchema>>({
    queryKey: queryKeys.user.eggs.all(),
    fetcher: (page, search) => getUserEggs(page, search),
  });

  return (
    <MultiSelect
      label={t('common.form.eggs', {})}
      placeholder={t('pages.account.commandSnippets.form.eggsPlaceholder', {})}
      data={eggs.items.map((egg) => ({
        label: egg.name,
        value: egg.uuid,
      }))}
      searchable
      searchValue={eggs.search}
      onSearchChange={eggs.setSearch}
      infiniteScroll={eggs.infiniteScroll}
      loading={eggs.loading}
      value={node.eggs}
      onChange={(value) => onChange({ ...node, eggs: value })}
    />
  );
}

interface CommandSnippetMatcherBuilderProps {
  matcher: Matcher;
  onChange: (matcher: Matcher) => void;
}

export default function CommandSnippetMatcherBuilder({ matcher, onChange }: CommandSnippetMatcherBuilderProps) {
  const { t } = useTranslations();

  return (
    <RecursiveGroupBuilder<Matcher>
      node={matcher}
      onChange={onChange}
      typeData={mappingToSelectData(commandSnippetMatcherLabelMapping)}
      makeDefault={(type) => matcherDefaults[type as Matcher['type']]()}
      getChildren={(node) => (node.type === 'and' || node.type === 'or' ? node.matchers : null)}
      withChildren={(node, matchers) => ({ ...node, matchers }) as Matcher}
      getNotChild={(node) => (node.type === 'not' ? node.matcher : null)}
      withNotChild={(node, child) => ({ ...node, matcher: child }) as Matcher}
      emptyNode={{ type: 'eggs', eggs: [] }}
      renderLeaf={(node, change) => node.type === 'eggs' && <EggsLeaf node={node} onChange={change} />}
      labels={{
        type: t('pages.account.commandSnippets.form.matcherType', {}),
        allMustMatch: t('pages.account.commandSnippets.matcher.allMustMatch', {}),
        anyMustMatch: t('pages.account.commandSnippets.matcher.anyMustMatch', {}),
        mustNotMatch: t('pages.account.commandSnippets.matcher.mustNotMatch', {}),
        addChild: t('pages.account.commandSnippets.button.addMatcher', {}),
      }}
    />
  );
}
