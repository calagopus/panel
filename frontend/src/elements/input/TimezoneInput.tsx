import { SelectProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import getTimezones from '@/api/getTimezones.ts';
import Select from '@/elements/input/Select.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = Omit<SelectProps, 'data'>;

export default function TimezoneInput(props: Props) {
  const { t } = useTranslations();

  const { data: timezones = [], isLoading } = useQuery({
    queryKey: queryKeys.global.timezones.all(),
    queryFn: getTimezones,
    staleTime: Infinity,
  });

  const options = timezones.map((timezone) => ({ label: timezone, value: timezone }));

  return <Select label={t('common.form.timezone', {})} data={options} searchable loading={isLoading} {...props} />;
}
