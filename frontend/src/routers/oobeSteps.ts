import {
  faCogs,
  faDownload,
  faEarthAmerica,
  faGraduationCap,
  faRocket,
  faServer,
  faUsers,
  faWrench,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { ComponentType } from 'react';
import { z } from 'zod';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';
import OobeConfiguration from '@/pages/oobe/OobeConfiguration.tsx';
import OobeFinished from '@/pages/oobe/OobeFinished.tsx';
import OobeLocation from '@/pages/oobe/OobeLocation.tsx';
import OobeLogin from '@/pages/oobe/OobeLogin.tsx';
import OobeNode from '@/pages/oobe/OobeNode.tsx';
import OobeNodeConfigure from '@/pages/oobe/OobeNodeConfigure.tsx';
import OobeRegister from '@/pages/oobe/OobeRegister.tsx';
import OobeRepositories from '@/pages/oobe/OobeRepositories.tsx';
import OobeServer from '@/pages/oobe/OobeServer.tsx';
import OobeWelcome from '@/pages/oobe/OobeWelcome.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export interface OobeStep {
  path: string;
  stepKey: z.infer<typeof oobeStepKey> | null;
  label?: string | null;
  icon?: IconDefinition | null;
  component: ComponentType<OobeComponentProps>;
  preAuth?: boolean;
  skipTo?: z.infer<typeof oobeStepKey>;
}

export const steps: OobeStep[] = [
  {
    path: '',
    stepKey: 'register',
    label: 'Welcome',
    icon: faRocket,
    component: OobeWelcome,
    preAuth: true,
  },
  {
    path: '/register',
    stepKey: null,
    label: 'Register',
    icon: faUsers,
    component: OobeRegister,
    preAuth: true,
  },
  {
    path: '/login',
    stepKey: null,
    label: null,
    icon: null,
    component: OobeLogin,
    preAuth: true,
  },
  {
    path: '/configuration',
    stepKey: 'configuration',
    label: 'Configuration',
    icon: faCogs,
    component: OobeConfiguration,
  },
  {
    path: '/repositories',
    stepKey: 'repositories',
    label: 'Egg Repositories',
    icon: faDownload,
    component: OobeRepositories,
    skipTo: 'location',
  },
  {
    path: '/location',
    stepKey: 'location',
    label: 'Location',
    icon: faEarthAmerica,
    component: OobeLocation,
    skipTo: 'finished',
  },
  {
    path: '/node',
    stepKey: 'node',
    label: 'Node',
    icon: faServer,
    component: OobeNode,
    skipTo: 'finished',
  },
  {
    path: '/nodeconfiguration',
    stepKey: 'nodeconfiguration',
    label: 'Node Configuration',
    icon: faWrench,
    component: OobeNodeConfigure,
    skipTo: 'finished',
  },
  {
    path: '/server',
    stepKey: 'server',
    label: 'Server',
    icon: faServer,
    component: OobeServer,
    skipTo: 'finished',
  },
  {
    path: '/finish',
    stepKey: 'finished',
    label: 'Finish',
    icon: faGraduationCap,
    component: OobeFinished,
  },
];
