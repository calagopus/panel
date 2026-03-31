import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Stepper, Text, Title } from '@mantine/core';
import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import updateOobeSettings from '@/api/admin/settings/updateOobeSettings.ts';
import Card from '@/elements/Card.tsx';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import { to } from '@/lib/routes.ts';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { steps } from '@/routers/oobeSteps.ts';
import { useGlobalStore } from '@/stores/global.ts';

export interface OobeComponentProps {
  onNext: () => void;
  skipFrom: (step: z.infer<typeof oobeStepKey>) => void;
}

export default function OobeRouter() {
  const { t } = useTranslations();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, setSettings } = useGlobalStore();
  const { user } = useAuth();

  const activeStep = steps.find((step) => to(step.path, '/oobe') === location.pathname);

  const currentAllowedStep = settings.oobeStep ? steps.find((s) => s.stepKey === settings.oobeStep) : null;

  useEffect(() => {
    const isLoginRoute = location.pathname === to('/login', '/oobe');
    const isPreAuth = activeStep?.preAuth ?? false;

    if (!user && !isPreAuth) {
      if (!isLoginRoute) navigate(to('/login', '/oobe'));
      return;
    }

    if (user && currentAllowedStep) {
      const expectedPath = to(currentAllowedStep.path, '/oobe');
      if (location.pathname !== expectedPath) {
        navigate(expectedPath);
      }
      return;
    }
  }, [user, activeStep, currentAllowedStep, location.pathname]);

  const filteredSteps = () => steps.filter((s) => s.label);

  const onNext = () => {
    const idx = filteredSteps().findIndex((s) => s.path === activeStep?.path);
    const nextStep = filteredSteps()[idx + 1];

    if (!nextStep) return;

    if (nextStep.stepKey) {
      updateOobeSettings(nextStep.stepKey).then(() => {
        setSettings({ ...settings, oobeStep: nextStep.stepKey });
      });
    }

    navigate(to(nextStep.path, '/oobe'));
  };

  const skipFrom = (stepKey: z.infer<typeof oobeStepKey>) => {
    const step = steps.find((s) => s.stepKey === stepKey);
    if (!step || !step.skipTo) return;

    const skipToStep = steps.find((s) => s.stepKey === step.skipTo);
    if (!skipToStep?.stepKey) return;

    updateOobeSettings(skipToStep.stepKey).then(() => {
      setSettings({ ...settings, oobeStep: skipToStep.stepKey });
    });
    navigate(to(skipToStep.path, '/oobe'));
  };

  return (
    <ContentContainer title={`Setting up ${settings.app.name}`}>
      <div className='flex flex-col gap-4 items-center justify-center min-h-screen p-4'>
        <div className='flex flex-col items-center gap-2'>
          <img src='/icon.svg' className='h-48' alt='Calagopus Icon' />
          <div>
            <Title order={2} ta='center'>
              {t('pages.oobe.welcome.title', {})}
            </Title>
            <Text size='lg' ta='center' c='dimmed'>
              {t('pages.oobe.welcome.subtitle', {})}
            </Text>
          </div>
        </div>
        <Card>
          <div className='flex flex-col gap-6'>
            {user && (
              <Stepper active={filteredSteps().findIndex((s) => s.path === activeStep?.path)}>
                {filteredSteps().map((step, index) => (
                  <Stepper.Step
                    key={index}
                    label={step.label}
                    icon={step.icon ? <FontAwesomeIcon icon={step.icon} /> : null}
                  />
                ))}
              </Stepper>
            )}
            <Box className='max-w-[calc(100%-40px)] w-full mx-auto'>
              <Routes>
                {steps.map(({ component: Component, ...step }, index) => (
                  <Route key={index} path={step.path} element={<Component onNext={onNext} skipFrom={skipFrom} />} />
                ))}
              </Routes>
            </Box>
          </div>
        </Card>
      </div>
    </ContentContainer>
  );
}
