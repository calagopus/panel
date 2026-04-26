import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Stepper, Text, Title } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import getEggRepositories from '@/api/admin/egg-repositories/getEggRepositories.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNodeAllocations from '@/api/admin/nodes/allocations/getNodeAllocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import updateOobeSettings from '@/api/admin/settings/updateOobeSettings.ts';
import AppIcon from '@/elements/AppIcon.tsx';
import Card from '@/elements/Card.tsx';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import OobeSidebarFooter from '@/elements/oobe/OobeSidebarFooter.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { to } from '@/lib/routes.ts';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { steps } from '@/routers/oobeSteps.ts';
import { useGlobalStore } from '@/stores/global.ts';

export interface OobeData {
  locations: z.infer<typeof adminLocationSchema>[];
  nodes: z.infer<typeof adminNodeSchema>[];
  allocations: z.infer<typeof adminNodeAllocationSchema>[];
  servers: z.infer<typeof adminServerSchema>[];
  eggRepositories: z.infer<typeof adminEggRepositorySchema>[];
  isLoading: boolean;
  refetch: () => void;
}

export interface OobeComponentProps {
  onNext: () => void;
  onBack: () => void;
  canGoBack: boolean;
  skipFrom: (step: z.infer<typeof oobeStepKey>) => void;
  data: OobeData;
}

const filteredSteps = steps.filter((s) => s.label);

export default function OobeRouter() {
  const { t } = useTranslations();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings, setSettings } = useGlobalStore();
  const { user } = useAuth();

  const activeStep = steps.find((step) => to(step.path, '/oobe') === location.pathname);
  const currentAllowedStep = settings.oobeStep ? steps.find((s) => s.stepKey === settings.oobeStep) : null;

  const { data: locationsData, isLoading: locLoading } = useQuery({
    queryKey: queryKeys.admin.locations.all(),
    queryFn: () => getLocations(1).then((r) => r.data),
    enabled: !!user,
  });
  const { data: nodesData, isLoading: nodesLoading } = useQuery({
    queryKey: queryKeys.admin.nodes.all(),
    queryFn: () => getNodes(1).then((r) => r.data),
    enabled: !!user,
  });
  const nodeUuid = nodesData?.[0]?.uuid;
  const { data: nodeAllocationsData, isLoading: nodeAllocationsLoading } = useQuery({
    queryKey: queryKeys.admin.nodes.allocations(nodeUuid ?? ''),
    queryFn: () => getNodeAllocations(nodeUuid!, 1).then((r) => r.data),
    enabled: !!user && !!nodeUuid,
  });
  const { data: serversData, isLoading: serversLoading } = useQuery({
    queryKey: queryKeys.admin.servers.all(),
    queryFn: () => getServers(1).then((r) => r.data),
    enabled: !!user,
  });
  const { data: eggReposData, isLoading: eggReposLoading } = useQuery({
    queryKey: queryKeys.admin.eggRepositories.all(),
    queryFn: () => getEggRepositories(1).then((r) => r.data),
    enabled: !!user,
  });

  const oobeData: OobeData = {
    locations: locationsData ?? [],
    nodes: nodesData ?? [],
    allocations: nodeAllocationsData ?? [],
    servers: serversData ?? [],
    eggRepositories: eggReposData ?? [],
    isLoading: locLoading || nodesLoading || nodeAllocationsLoading || serversLoading || eggReposLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.locations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.all() });
      if (nodeUuid) queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocations(nodeUuid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggRepositories.all() });
    },
  };

  const currentStepIndex = filteredSteps.findIndex((s) => s.path === activeStep?.path);
  const allowedStepIndex = currentAllowedStep
    ? filteredSteps.findIndex((s) => s.stepKey === currentAllowedStep.stepKey)
    : -1;

  useEffect(() => {
    const isLoginRoute = location.pathname === to('/login', '/oobe');
    const isPreAuth = activeStep?.preAuth ?? false;

    if (!user && !isPreAuth) {
      if (!isLoginRoute) navigate(to('/login', '/oobe'));
      return;
    }

    if (user && currentAllowedStep) {
      if (isPreAuth) {
        navigate(to(currentAllowedStep.path, '/oobe'));
        return;
      }
      if (currentStepIndex < 0 || currentStepIndex > allowedStepIndex) {
        navigate(to(currentAllowedStep.path, '/oobe'));
      }
    }
  }, [user, activeStep, currentAllowedStep, location.pathname]);

  const onNext = () => {
    const nextStep = filteredSteps[currentStepIndex + 1];
    if (!nextStep) return;

    const nextIndex = filteredSteps.findIndex((s) => s.path === nextStep.path);
    if (nextStep.stepKey && nextIndex > allowedStepIndex) {
      setSettings({ ...settings, oobeStep: nextStep.stepKey });
      updateOobeSettings(nextStep.stepKey);
    }

    navigate(to(nextStep.path, '/oobe'));
  };

  const onBack = () => {
    for (let i = currentStepIndex - 1; i >= 0; i--) {
      const step = filteredSteps[i];
      if (!step.preAuth || !user) {
        navigate(to(step.path, '/oobe'));
        return;
      }
    }
  };

  const canGoBack = currentStepIndex > 0 && filteredSteps.slice(0, currentStepIndex).some((s) => !s.preAuth || !user);

  const skipFrom = (stepKey: z.infer<typeof oobeStepKey>) => {
    const step = steps.find((s) => s.stepKey === stepKey);
    if (!step || !step.skipTo) return;

    const skipToStep = steps.find((s) => s.stepKey === step.skipTo);
    if (!skipToStep?.stepKey) return;

    const skipToIndex = filteredSteps.findIndex((s) => s.stepKey === skipToStep.stepKey);
    if (skipToIndex > allowedStepIndex) {
      setSettings({ ...settings, oobeStep: skipToStep.stepKey });
      updateOobeSettings(skipToStep.stepKey);
    }
    navigate(to(skipToStep.path, '/oobe'));
  };

  const showDataLoading = !activeStep?.preAuth && oobeData.isLoading && !!user;

  return (
    <div className='lg:flex h-full'>
      <Sidebar>
        <AppIcon />
        <Sidebar.Divider />

        <Stepper
          active={currentStepIndex}
          size='sm'
          my='sm'
          orientation='vertical'
          onStepClick={(index) => {
            const step = filteredSteps[index];
            if (step && index <= allowedStepIndex && !(step.preAuth && !!user)) {
              navigate(to(step.path, '/oobe'));
            }
          }}
        >
          {filteredSteps.map((step, index) => (
            <Stepper.Step
              key={index}
              label={step.label}
              description={step.description}
              icon={step.icon ? <FontAwesomeIcon icon={step.icon} /> : null}
              style={{
                cursor: index <= allowedStepIndex && !(step.preAuth && !!user) ? 'pointer' : 'default',
              }}
            />
          ))}
        </Stepper>
        <OobeSidebarFooter complete={currentStepIndex} total={filteredSteps.length} />
      </Sidebar>
      <div className='max-w-[100vw] flex-1 lg:ml-0'>
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
                <Box className='xl:min-w-3xl max-w-[calc(100%-40px)] w-full mx-auto'>
                  {showDataLoading ? (
                    <Spinner />
                  ) : (
                    <Routes>
                      {steps.map(({ component: Component, ...step }, index) => (
                        <Route
                          key={index}
                          path={step.path}
                          element={
                            <Component
                              onNext={onNext}
                              onBack={onBack}
                              canGoBack={canGoBack}
                              skipFrom={skipFrom}
                              data={oobeData}
                            />
                          }
                        />
                      ))}
                    </Routes>
                  )}
                </Box>
              </div>
            </Card>
          </div>
        </ContentContainer>
      </div>
    </div>
  );
}
