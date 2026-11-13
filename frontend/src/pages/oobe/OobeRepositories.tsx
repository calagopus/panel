import { faCheck, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import createEggRepository from '@/api/admin/egg-repositories/createEggRepository.ts';
import syncEggRepository from '@/api/admin/egg-repositories/syncEggRepository.ts';
import createNest from '@/api/admin/nests/createNest.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Group from '@/elements/layout/Group.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

interface DefaultRepository {
  name: string;
  description: string;
  gitRepository: string;
  nestName: string;
}

export default function OobeRepositories({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { t } = useTranslations();
  const { user } = useAuth();

  const repositories: DefaultRepository[] = [
    {
      name: t('pages.oobe.eggRepositories.repositories.pterodactylGame.title', {}),
      description: t('pages.oobe.eggRepositories.repositories.pterodactylGame.description', {}),
      gitRepository: 'https://github.com/pterodactyl/game-eggs',
      nestName: t('pages.oobe.eggRepositories.repositories.pterodactylGame.nest', {}),
    },
    {
      name: t('pages.oobe.eggRepositories.repositories.pterodactylApplication.title', {}),
      description: t('pages.oobe.eggRepositories.repositories.pterodactylApplication.description', {}),
      gitRepository: 'https://github.com/pterodactyl/application-eggs',
      nestName: t('pages.oobe.eggRepositories.repositories.pterodactylApplication.nest', {}),
    },
    {
      name: t('pages.oobe.eggRepositories.repositories.pterodactylGeneral.title', {}),
      description: t('pages.oobe.eggRepositories.repositories.pterodactylGeneral.description', {}),
      gitRepository: 'https://github.com/pterodactyl/generic-eggs',
      nestName: t('pages.oobe.eggRepositories.repositories.pterodactylGeneral.nest', {}),
    },
  ];

  // A nest with the default name may already exist when the wizard is rerun, so reuse it instead of failing.
  const ensureNest = async (name: string): Promise<z.infer<typeof adminNestSchema>> => {
    try {
      return await createNest({ author: user!.email, name, description: null });
    } catch (err) {
      const existing = await getNests(1, name).then((nests) =>
        nests.data.find((nest) => nest.name.toLowerCase() === name.toLowerCase()),
      );
      if (!existing) {
        throw err;
      }

      return existing;
    }
  };

  const installedGitUrls = new Set(data.eggRepositories.map((r) => r.gitRepository));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  const toggleRepo = (gitRepository: string) => {
    if (installedGitUrls.has(gitRepository)) return;
    setSelectedRepos((prev) =>
      prev.includes(gitRepository) ? prev.filter((r) => r !== gitRepository) : [...prev, gitRepository],
    );
  };

  const onSubmit = async () => {
    setLoading(true);

    try {
      const promises = selectedRepos
        .filter((selected) => !installedGitUrls.has(selected))
        .map(async (selected) => {
          const repo = repositories.find((r) => r.gitRepository === selected);
          if (!repo) return;

          const nest = await ensureNest(repo.nestName);
          const repository = await createEggRepository({
            name: repo.name,
            description: repo.description,
            gitRepository: repo.gitRepository,
            defaultNestUuid: nest.uuid,
            autoSync: true,
          });
          await syncEggRepository(repository.uuid);
        });

      await Promise.all(promises);

      data.refetch();
      onNext();
    } catch (msg) {
      setError(httpErrorToHuman(msg));
    }
    setLoading(false);
  };

  const hasSelection = selectedRepos.length > 0;

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.eggRepositories.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <Stack gap='xl'>
        <Stack gap='sm'>
          <Text size='sm'>{t('pages.oobe.eggRepositories.description', {})}</Text>
          {repositories.map((repo) => {
            const isInstalled = installedGitUrls.has(repo.gitRepository);
            const isSelected = isInstalled || selectedRepos.includes(repo.gitRepository);
            return (
              <Paper
                key={repo.gitRepository}
                withBorder
                p='md'
                radius='md'
                onClick={() => toggleRepo(repo.gitRepository)}
                style={{
                  cursor: isInstalled ? 'default' : 'pointer',
                  borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
                  opacity: isInstalled ? 0.8 : 1,
                }}
              >
                <div className='flex items-start gap-3'>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleRepo(repo.gitRepository)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isInstalled}
                    mt={2}
                  />
                  <div className='flex flex-col gap-0.5 flex-1'>
                    <div className='flex items-center gap-2'>
                      <Text fw={600} size='sm'>
                        {repo.name}
                      </Text>
                      {isInstalled && (
                        <Badge size='xs' color='green' leftSection={<FontAwesomeIcon icon={faCheck} />}>
                          {t('common.badge.installed', {})}
                        </Badge>
                      )}
                    </div>
                    <Text size='xs' c='dimmed'>
                      {repo.description}
                    </Text>
                    <Text size='xs' c='blue' mt={4}>
                      {repo.gitRepository}
                    </Text>
                  </div>
                </div>
              </Paper>
            );
          })}
        </Stack>

        <Group justify='flex-end'>
          <Text size='xs' c='dimmed' className='flex-1' miw={200}>
            {t('pages.oobe.eggRepositories.skipHint', {})}
          </Text>
          {canGoBack && (
            <Button variant='subtle' onClick={onBack} leftSection={<FontAwesomeIcon icon={faChevronLeft} />}>
              Back
            </Button>
          )}
          <Button variant='outline' onClick={() => skipFrom('repositories')}>
            {t('common.button.skip', {})}
          </Button>
          <Button type='submit' disabled={!hasSelection} loading={loading} onClick={() => onSubmit()}>
            {t('common.button.import', {})}
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
