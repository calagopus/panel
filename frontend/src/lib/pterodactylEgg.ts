interface ExportedEggReplacement {
  match: string;
  replace_with: unknown;
}

interface ExportedEggFile {
  parser: string;
  replace: ExportedEggReplacement[];
}

interface ExportedEggVariable {
  name: string;
  description: string | null;
  env_variable: string;
  default_value: string | null;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string[];
}

interface ExportedEgg {
  name: string;
  description: string | null;
  author: string;
  config: {
    files: Record<string, ExportedEggFile>;
    startup: { done: string[] };
    stop: { type: string; value: string | null };
  };
  scripts: {
    installation: { container: string; entrypoint: string; content: string };
  };
  startup_commands: Record<string, string>;
  features: string[];
  docker_images: Record<string, string>;
  file_denylist: string[];
  variables: ExportedEggVariable[];
}

export function toPterodactylEgg(exported: object): object {
  const egg = exported as ExportedEgg;

  const files: Record<string, unknown> = {};
  for (const [filename, file] of Object.entries(egg.config?.files ?? {})) {
    files[filename] = {
      parser: file.parser,
      find: Object.fromEntries(
        (file.replace ?? []).map((replacement) => [replacement.match, replacement.replace_with]),
      ),
    };
  }

  let stop: string;
  if (egg.config?.stop?.type === 'signal') {
    stop =
      egg.config.stop.value === 'SIGINT'
        ? '^C'
        : egg.config.stop.value === 'SIGKILL'
          ? '^^C'
          : (egg.config.stop.value ?? '');
  } else {
    stop = egg.config?.stop?.value ?? '';
  }

  const startup = egg.startup_commands?.Default ?? Object.values(egg.startup_commands ?? {})[0] ?? '';

  return {
    _comment: 'DO NOT EDIT: FILE GENERATED AUTOMATICALLY BY CALAGOPUS PANEL',
    meta: {
      version: 'PTDL_v2',
      update_url: null,
    },
    exported_at: new Date().toISOString(),
    name: egg.name,
    author: egg.author,
    description: egg.description,
    features: egg.features ?? [],
    docker_images: egg.docker_images ?? {},
    file_denylist: egg.file_denylist ?? [],
    startup,
    config: {
      files: JSON.stringify(files),
      startup: JSON.stringify({ done: egg.config?.startup?.done ?? [] }),
      logs: '{}',
      stop,
    },
    scripts: {
      installation: {
        script: egg.scripts?.installation?.content ?? '',
        container: egg.scripts?.installation?.container ?? '',
        entrypoint: egg.scripts?.installation?.entrypoint ?? '',
      },
    },
    variables: (egg.variables ?? []).map((variable) => ({
      name: variable.name,
      description: variable.description,
      env_variable: variable.env_variable,
      default_value: variable.default_value,
      user_viewable: variable.user_viewable,
      user_editable: variable.user_editable,
      rules: (variable.rules ?? []).join('|'),
      field_type: 'text',
    })),
  };
}
