import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import RecursiveGroupBuilder from '@/elements/RecursiveGroupBuilder.tsx';
import { mappingToSelectData, oauthProviderMappingMatcherLabelMapping } from '@/lib/enums.ts';
import { AdminOAuthProviderMappingMatcher } from '@/lib/schemas/admin/oauthProviders.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Matcher = AdminOAuthProviderMappingMatcher;

const matcherDefaults: Record<Matcher['type'], () => Matcher> = {
  none: () => ({ type: 'none' }),
  and: () => ({ type: 'and', matchers: [] }),
  or: () => ({ type: 'or', matchers: [] }),
  not: () => ({ type: 'not', matcher: { type: 'none' } }),
  scopes: () => ({ type: 'scopes', scopes: [] }),
  field_exists: () => ({ type: 'field_exists', path: '' }),
  field_equals: () => ({ type: 'field_equals', path: '', equals: '' }),
  field_contains: () => ({ type: 'field_contains', path: '', contains: '' }),
  field_starts_with: () => ({ type: 'field_starts_with', path: '', startsWith: '' }),
  field_ends_with: () => ({ type: 'field_ends_with', path: '', endsWith: '' }),
};

interface MatcherBuilderProps {
  matcher: Matcher;
  onChange: (matcher: Matcher) => void;
  depth?: number;
}

export default function OAuthProviderMappingMatcherBuilder({ matcher, onChange, depth = 0 }: MatcherBuilderProps) {
  const { t } = useTranslations();
  const form = 'pages.admin.oAuthProviders.tabs.mappings.page.form';

  const renderLeaf = (node: Matcher, change: (next: Matcher) => void) => (
    <>
      {node.type === 'scopes' && (
        <TagsInput
          withAsterisk
          label={t(`${form}.scopes`, {})}
          description={t(`${form}.scopesDescription`, {})}
          value={node.scopes}
          onChange={(scopes) => change({ ...node, scopes })}
        />
      )}

      {'path' in node && (
        <TextInput
          withAsterisk
          label={t(`${form}.path`, {})}
          description={t(`${form}.pathDescription`, {})}
          placeholder='$.email'
          value={node.path}
          onChange={(e) => change({ ...node, path: e.target.value })}
        />
      )}

      {node.type === 'field_equals' && (
        <TextInput
          withAsterisk
          label={t(`${form}.equals`, {})}
          value={node.equals}
          onChange={(e) => change({ ...node, equals: e.target.value })}
        />
      )}
      {node.type === 'field_contains' && (
        <TextInput
          withAsterisk
          label={t(`${form}.contains`, {})}
          value={node.contains}
          onChange={(e) => change({ ...node, contains: e.target.value })}
        />
      )}
      {node.type === 'field_starts_with' && (
        <TextInput
          withAsterisk
          label={t(`${form}.startsWith`, {})}
          value={node.startsWith}
          onChange={(e) => change({ ...node, startsWith: e.target.value })}
        />
      )}
      {node.type === 'field_ends_with' && (
        <TextInput
          withAsterisk
          label={t(`${form}.endsWith`, {})}
          value={node.endsWith}
          onChange={(e) => change({ ...node, endsWith: e.target.value })}
        />
      )}
    </>
  );

  return (
    <RecursiveGroupBuilder<Matcher>
      node={matcher}
      onChange={onChange}
      depth={depth}
      typeData={mappingToSelectData(oauthProviderMappingMatcherLabelMapping)}
      makeDefault={(type) => matcherDefaults[type as Matcher['type']]()}
      getChildren={(node) => (node.type === 'and' || node.type === 'or' ? node.matchers : null)}
      withChildren={(node, matchers) => ({ ...node, matchers }) as Matcher}
      getNotChild={(node) => (node.type === 'not' ? node.matcher : null)}
      withNotChild={(node, child) => ({ ...node, matcher: child }) as Matcher}
      emptyNode={{ type: 'none' }}
      renderLeaf={renderLeaf}
      labels={{
        type: t(`${form}.matcherType`, {}),
        allMustMatch: t('pages.admin.oAuthProviders.tabs.mappings.page.matcher.allMustMatch', {}),
        anyMustMatch: t('pages.admin.oAuthProviders.tabs.mappings.page.matcher.anyMustMatch', {}),
        mustNotMatch: t('pages.admin.oAuthProviders.tabs.mappings.page.matcher.mustNotMatch', {}),
        addChild: t('pages.admin.oAuthProviders.tabs.mappings.page.button.addMatcher', {}),
      }}
    />
  );
}
