import { faCog, faReply } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { serverVariableSchema } from '@/lib/schemas/server/startup.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Tooltip from './Tooltip.tsx';

interface Props {
  variable: z.infer<typeof serverVariableSchema>;
  overrideReadonly?: boolean;
  loading?: boolean;
  disabled?: boolean;
  value: string;
  setValue: (value: string) => void;
}

export default function VariableContainer({
  variable,
  overrideReadonly = false,
  loading = false,
  disabled = false,
  value,
  setValue,
}: Props) {
  const { t, language } = useTranslations();

  const title = variable.nameTranslations?.[language] || variable.name;
  const description = variable.descriptionTranslations?.[language] || variable.description;

  return (
    <TitleCard title={title} icon={<FontAwesomeIcon icon={faCog} />}>
      <div className='flex flex-row w-full justify-between items-start'>
        <div className='w-full'>
          {variable.rules.includes('boolean') ||
          (variable.rules.includes('string') &&
            (variable.rules.includes('in:1,0') ||
              variable.rules.includes('in:0,1') ||
              variable.rules.includes('in:true,false') ||
              variable.rules.includes('in:false,true'))) ? (
            <Switch
              name={variable.envVariable}
              defaultChecked={value === '1' || value === 'true'}
              onChange={(e) =>
                setValue(
                  variable.rules.includes('in:1,0') || variable.rules.includes('in:0,1')
                    ? e.target.checked
                      ? '1'
                      : '0'
                    : e.target.checked
                      ? 'true'
                      : 'false',
                )
              }
              disabled={disabled || loading || (!variable.isEditable && !overrideReadonly)}
              label={variable.name}
            />
          ) : variable.rules.includes('string') && variable.rules.some((rule) => rule.startsWith('in:')) ? (
            <Select
              withAsterisk={variable.rules.includes('required')}
              id={variable.envVariable}
              data={variable.rules
                .find((rule) => rule.startsWith('in:'))
                ?.replace('in:', '')
                .split(',')
                .map((option) => ({ value: option, label: option }))}
              value={value}
              onChange={(value) => setValue(value ?? '')}
              disabled={disabled || loading || (!variable.isEditable && !overrideReadonly)}
            />
          ) : variable.rules.includes('integer') ||
            variable.rules.includes('int') ||
            variable.rules.includes('numeric') ||
            variable.rules.includes('num') ? (
            <NumberInput
              withAsterisk={variable.rules.includes('required')}
              id={variable.envVariable}
              placeholder={variable.defaultValue ?? ''}
              value={value}
              onChange={(value) => setValue(String(value))}
              disabled={disabled || loading || (!variable.isEditable && !overrideReadonly)}
            />
          ) : variable.isSecret ? (
            <PasswordInput
              withAsterisk={variable.rules.includes('required')}
              id={variable.envVariable}
              placeholder={variable.defaultValue ?? ''}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled || loading || (!variable.isEditable && !overrideReadonly)}
            />
          ) : (
            <TextInput
              withAsterisk={variable.rules.includes('required')}
              id={variable.envVariable}
              placeholder={variable.defaultValue ?? ''}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled || loading || (!variable.isEditable && !overrideReadonly)}
              rightSection={
                <Tooltip label={t('common.tooltip.resetToDefault', {})}>
                  <ActionIcon
                    variant='subtle'
                    disabled={
                      !variable.defaultValue ||
                      disabled ||
                      loading ||
                      (!variable.isEditable && !overrideReadonly) ||
                      value === variable.defaultValue
                    }
                    onClick={() => setValue(variable.defaultValue ?? '')}
                  >
                    <FontAwesomeIcon icon={faReply} />
                  </ActionIcon>
                </Tooltip>
              }
            />
          )}
          <p className='text-gray-400 text-sm mt-4'>{description?.md()}</p>
        </div>
        {!variable.isEditable ? <Badge className='min-w-fit ml-4'>{t('common.readOnly', {})}</Badge> : null}
      </div>
    </TitleCard>
  );
}
