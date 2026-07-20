import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { oauthProviderMappingMatcherLabelMapping } from '@/lib/enums.ts';
import { AdminOAuthProviderMappingMatcher } from '@/lib/schemas/admin/oauthProviders.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const maxMatcherDepth = 3;

interface MatcherBuilderProps {
  matcher: AdminOAuthProviderMappingMatcher;
  onChange: (matcher: AdminOAuthProviderMappingMatcher) => void;
  depth?: number;
}

export default function OAuthProviderMappingMatcherBuilder({ matcher, onChange, depth = 0 }: MatcherBuilderProps) {
  const { t } = useTranslations();
  const handleTypeChange = (type: string) => {
    switch (type) {
      case 'none':
        onChange({ type: 'none' });
        break;
      case 'and':
        onChange({ type: 'and', matchers: [] });
        break;
      case 'or':
        onChange({ type: 'or', matchers: [] });
        break;
      case 'not':
        onChange({ type: 'not', matcher: { type: 'none' } });
        break;
      case 'scopes':
        onChange({ type: 'scopes', scopes: [] });
        break;
      case 'field_exists':
        onChange({ type: 'field_exists', path: '' });
        break;
      case 'field_equals':
        onChange({ type: 'field_equals', path: '', equals: '' });
        break;
      case 'field_contains':
        onChange({ type: 'field_contains', path: '', contains: '' });
        break;
      case 'field_starts_with':
        onChange({ type: 'field_starts_with', path: '', startsWith: '' });
        break;
      case 'field_ends_with':
        onChange({ type: 'field_ends_with', path: '', endsWith: '' });
        break;
    }
  };

  const handleNestedMatcherChange = (index: number, newMatcher: AdminOAuthProviderMappingMatcher) => {
    if (matcher.type === 'and' || matcher.type === 'or') {
      const newMatchers = [...matcher.matchers];
      newMatchers[index] = newMatcher;
      onChange({ ...matcher, matchers: newMatchers });
    }
  };

  const addNestedMatcher = () => {
    if (matcher.type === 'and' || matcher.type === 'or') {
      onChange({
        ...matcher,
        matchers: [...matcher.matchers, { type: 'none' }],
      });
    }
  };

  const removeNestedMatcher = (index: number) => {
    if (matcher.type === 'and' || matcher.type === 'or') {
      const newMatchers = matcher.matchers.filter((_, i) => i !== index);
      onChange({ ...matcher, matchers: newMatchers });
    }
  };

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <Stack>
        <Select
          withAsterisk
          label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.matcherType', {})}
          value={matcher.type}
          onChange={(value) => value && handleTypeChange(value)}
          data={Object.entries(oauthProviderMappingMatcherLabelMapping)
            .map(([value, label]) => ({
              value,
              label: label(),
            }))
            .filter((m) => depth < maxMatcherDepth || !['and', 'or', 'not'].includes(m.value))}
        />

        {matcher.type === 'scopes' && (
          <TagsInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.scopes', {})}
            description={t('pages.admin.oAuthProviders.tabs.mappings.page.form.scopesDescription', {})}
            value={matcher.scopes}
            onChange={(scopes) => onChange({ ...matcher, scopes })}
          />
        )}

        {(matcher.type === 'field_exists' ||
          matcher.type === 'field_equals' ||
          matcher.type === 'field_contains' ||
          matcher.type === 'field_starts_with' ||
          matcher.type === 'field_ends_with') && (
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.path', {})}
            description={t('pages.admin.oAuthProviders.tabs.mappings.page.form.pathDescription', {})}
            placeholder='$.email'
            value={matcher.path}
            onChange={(e) => onChange({ ...matcher, path: e.target.value })}
          />
        )}

        {matcher.type === 'field_equals' && (
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.equals', {})}
            value={matcher.equals}
            onChange={(e) => onChange({ ...matcher, equals: e.target.value })}
          />
        )}
        {matcher.type === 'field_contains' && (
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.contains', {})}
            value={matcher.contains}
            onChange={(e) => onChange({ ...matcher, contains: e.target.value })}
          />
        )}
        {matcher.type === 'field_starts_with' && (
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.startsWith', {})}
            value={matcher.startsWith}
            onChange={(e) => onChange({ ...matcher, startsWith: e.target.value })}
          />
        )}
        {matcher.type === 'field_ends_with' && (
          <TextInput
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.endsWith', {})}
            value={matcher.endsWith}
            onChange={(e) => onChange({ ...matcher, endsWith: e.target.value })}
          />
        )}

        {(matcher.type === 'and' || matcher.type === 'or') && (
          <>
            {depth < maxMatcherDepth && (
              <Group>
                <Text size='sm'>
                  {matcher.type === 'and'
                    ? t('pages.admin.oAuthProviders.tabs.mappings.page.matcher.allMustMatch', {})
                    : t('pages.admin.oAuthProviders.tabs.mappings.page.matcher.anyMustMatch', {})}
                </Text>
                <Button
                  size='xs'
                  variant='light'
                  leftSection={<FontAwesomeIcon icon={faPlus} />}
                  onClick={addNestedMatcher}
                >
                  {t('pages.admin.oAuthProviders.tabs.mappings.page.button.addMatcher', {})}
                </Button>
              </Group>
            )}

            {matcher.matchers.map((nestedMatcher, index) => (
              <Group key={index} align='flex-start'>
                <div style={{ flex: 1 }}>
                  <OAuthProviderMappingMatcherBuilder
                    matcher={nestedMatcher}
                    onChange={(newMatcher) => handleNestedMatcherChange(index, newMatcher)}
                    depth={depth + 1}
                  />
                </div>
                <ActionIcon color='red' variant='light' onClick={() => removeNestedMatcher(index)}>
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              </Group>
            ))}
          </>
        )}
        {matcher.type === 'not' && (
          <>
            <Text size='sm'>{t('pages.admin.oAuthProviders.tabs.mappings.page.matcher.mustNotMatch', {})}</Text>

            <div style={{ flex: 1 }}>
              <OAuthProviderMappingMatcherBuilder
                matcher={matcher.matcher}
                onChange={(nestedMatcher) => onChange({ ...matcher, matcher: nestedMatcher })}
                depth={depth + 1}
              />
            </div>
          </>
        )}
      </Stack>
    </div>
  );
}
