import { faHeartPulse } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { useState } from 'react';
import { z } from 'zod';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const NODE_DEFAULT_CLEAN_EXIT_CODES = [0];
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

const isExitCode = (tag: string) => /^-?\d+$/.test(tag) && Number(tag) >= I32_MIN && Number(tag) <= I32_MAX;
const toExitCodeTags = (codes: number[] | null) => codes?.map(String) ?? null;

export default function EggCrashDetectionEditor({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminEggUpdateSchema>>;
}) {
  const { t } = useTranslations();

  const [disabled, setDisabled] = useState(() => form.getValues().configCrashDetection.enabled === false);
  form.watch('configCrashDetection.enabled', ({ value }) => setDisabled(value === false));

  // tags stay raw so a mistyped code is shown as typed; the form holds NaN for it, which fails validation
  const [exitCodeTags, setExitCodeTags] = useState(() =>
    toExitCodeTags(form.getValues().configCrashDetection.cleanExitCodes),
  );
  form.watch('configCrashDetection.cleanExitCodes', ({ value }) =>
    setExitCodeTags((tags) =>
      tags && value && tags.length === value.length && tags.every((tag, i) => Object.is(Number(tag), value[i]))
        ? tags
        : toExitCodeTags(value),
    ),
  );

  const invalidExitCodes = (exitCodeTags ?? []).filter((tag) => !isExitCode(tag));

  return (
    <TitleCard
      title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.card.crashDetection', {})}
      icon={<FontAwesomeIcon icon={faHeartPulse} size='sm' />}
    >
      <Stack>
        <Switch
          label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.disableCrashDetection', {})}
          description={t(
            'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.disableCrashDetectionDescription',
            {},
          )}
          key={form.key('configCrashDetection.enabled')}
          defaultChecked={disabled}
          onChange={(e) =>
            form.setFieldValue('configCrashDetection.enabled', e.currentTarget.checked ? false : null, {
              forceUpdate: false,
            })
          }
        />

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Select
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.detectCleanExitAsCrash', {})}
            description={t(
              'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.detectCleanExitAsCrashDescription',
              {},
            )}
            disabled={disabled}
            data={[
              {
                label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.nodeDefault', {}),
                value: 'nodeDefault',
              },
              {
                label: t('common.yes', {}),
                value: 'yes',
              },
              {
                label: t('common.no', {}),
                value: 'no',
              },
            ]}
            key={form.key('configCrashDetection.detectCleanExitAsCrash')}
            defaultValue={
              { true: 'yes', false: 'no', null: 'nodeDefault' }[
                String(form.getValues().configCrashDetection.detectCleanExitAsCrash)
              ]
            }
            onChange={(value) =>
              form.setFieldValue(
                'configCrashDetection.detectCleanExitAsCrash',
                value === 'yes' ? true : value === 'no' ? false : null,
                { forceUpdate: false },
              )
            }
          />

          <NumberInput
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.crashTimeout', {})}
            description={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.crashTimeoutDescription', {})}
            placeholder={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.nodeDefault', {})}
            disabled={disabled}
            min={0}
            allowDecimal={false}
            allowNegative={false}
            key={form.key('configCrashDetection.timeout')}
            defaultValue={form.getValues().configCrashDetection.timeout ?? ''}
            onChange={(value) =>
              form.setFieldValue('configCrashDetection.timeout', typeof value === 'number' ? value : null, {
                forceUpdate: false,
              })
            }
          />
        </div>

        <Switch
          label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.overrideCleanExitCodes', {})}
          description={t(
            'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.overrideCleanExitCodesDescription',
            {},
          )}
          disabled={disabled}
          checked={exitCodeTags !== null}
          onChange={(e) =>
            form.setFieldValue(
              'configCrashDetection.cleanExitCodes',
              e.currentTarget.checked ? NODE_DEFAULT_CLEAN_EXIT_CODES : null,
            )
          }
        />

        {!disabled && exitCodeTags !== null && (
          <TagsInput
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.cleanExitCodes', {})}
            placeholder={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.cleanExitCodePlaceholder', {})}
            value={exitCodeTags}
            onChange={(tags) => {
              setExitCodeTags(tags);
              form.setFieldValue('configCrashDetection.cleanExitCodes', tags.map(Number));
            }}
            invalidTags={invalidExitCodes}
            error={
              invalidExitCodes.length > 0
                ? t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.cleanExitCodesInvalid', {})
                : undefined
            }
          />
        )}
      </Stack>
    </TitleCard>
  );
}
