import { faExclamationTriangle, faFingerprint } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Divider, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getOAuthProviders from '@/api/auth/getOAuthProviders.ts';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AuthWrapper from '../AuthWrapper.tsx';

export default function LoginOAuth() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [oAuthProviders, setOAuthProviders] = useState<z.infer<typeof oAuthProviderSchema>[]>([]);

  useEffect(() => {
    getOAuthProviders().then((oAuthProviders) => {
      setOAuthProviders(oAuthProviders);
    });
  }, []);

  return (
    <AuthWrapper>
      <Stack className='w-full'>
        {error && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            color='red'
            title={t('common.alert.error', {})}
            onClose={() => setError('')}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        <div>
          <Title order={2}>{t('pages.auth.oauth.title', {})}</Title>
          <Text className='text-neutral-400!'>{t('pages.auth.oauth.subtitle', {})}</Text>
        </div>

        <Card>
          <Stack>
            {oAuthProviders.map((oAuthProvider) => (
              <a key={oAuthProvider.uuid} href={`/api/auth/oauth/redirect/${oAuthProvider.uuid}`}>
                <Button leftSection={<FontAwesomeIcon icon={faFingerprint} />} size='md' fullWidth>
                  {t('pages.auth.button.loginWith', { name: oAuthProvider.name })}
                </Button>
              </a>
            ))}

            <Divider label={t('common.divider.or', {})} labelPosition='center' />

            <Button variant='light' onClick={() => navigate('/auth/login')} size='md' fullWidth>
              {t('common.button.back', {})}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </AuthWrapper>
  );
}
