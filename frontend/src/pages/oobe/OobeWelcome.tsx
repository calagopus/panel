import { faCheckCircle, faRocket } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { List, Text, ThemeIcon } from '@mantine/core';
import Button from '@/elements/Button.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeWelcome({ onNext }: OobeComponentProps) {
  const { t } = useTranslations();

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Text size='md' fw={500}>
          {t('pages.oobe.welcome.wizardIntro', {})}
        </Text>

        <List
          spacing='sm'
          size='sm'
          center
          icon={
            <ThemeIcon color='teal' size={20} radius='xl'>
              <FontAwesomeIcon icon={faCheckCircle} size='xs' />
            </ThemeIcon>
          }
        >
          <List.Item>{t('pages.oobe.welcome.steps.account', {})}</List.Item>
          <List.Item>{t('pages.oobe.welcome.steps.settings', {})}</List.Item>
          <List.Item>{t('pages.oobe.welcome.steps.location', {})}</List.Item>
          <List.Item>{t('pages.oobe.welcome.steps.node', {})}</List.Item>
          <List.Item>{t('pages.oobe.welcome.steps.server', {})}</List.Item>
        </List>
      </div>

      <Button className='md:max-w-fit md:ml-auto' leftSection={<FontAwesomeIcon icon={faRocket} />} onClick={onNext}>
        {t('pages.oobe.welcome.button.start', {})}
      </Button>
    </div>
  );
}
