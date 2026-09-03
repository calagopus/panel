import { z } from 'zod';
import { adminEggConfigScriptSchema, adminEggSchema, adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';

type EggFormValues = z.infer<typeof adminEggUpdateSchema>;

/** Seed script a freshly-created egg gets; the installation-script tab edits it afterwards. */
export const DEFAULT_EGG_CONFIG_SCRIPT: z.infer<typeof adminEggConfigScriptSchema> = {
  container: 'debian:latest',
  entrypoint: '/bin/bash',
  content: '#!/bin/bash\n\n# Install script content goes here\n',
};

export const eggEmptyFormValues: EggFormValues = {
  eggRepositoryEggUuid: null,
  author: '',
  name: '',
  description: null,
  configFiles: [],
  configStartup: {
    done: [],
    stripAnsi: false,
  },
  configStop: {
    type: '',
    value: null,
  },
  startupCommands: { Default: '' },
  forceOutgoingIp: false,
  separatePort: false,
  features: [],
  dockerImages: {},
  fileDenylist: [],
};

export const eggToFormValues = (egg: z.infer<typeof adminEggSchema>): Partial<EggFormValues> => ({
  eggRepositoryEggUuid: egg.eggRepositoryEgg?.uuid || null,
  author: egg.author,
  name: egg.name,
  description: egg.description,
  configFiles: egg.configFiles,
  configStartup: egg.configStartup,
  configStop: egg.configStop,
  startupCommands: egg.startupCommands,
  forceOutgoingIp: egg.forceOutgoingIp,
  separatePort: egg.separatePort,
  features: egg.features,
  dockerImages: egg.dockerImages,
  fileDenylist: egg.fileDenylist,
});
