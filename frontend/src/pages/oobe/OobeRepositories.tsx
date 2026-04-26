import { faCheck, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import createEggRepository from '@/api/admin/egg-repositories/createEggRepository.ts';
import syncEggRepository from '@/api/admin/egg-repositories/syncEggRepository.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { adminEggRepositoryUpdateSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeRepositories({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { t } = useTranslations();

  const repositories: z.infer<typeof adminEggRepositoryUpdateSchema>[] = [
    {
      name: t('pages.oobe.eggRepositories.repositories.pterodactylGame.title', {}),
      description: t('pages.oobe.eggRepositories.repositories.pterodactylGame.description', {}),
      gitRepository: 'https://github.com/pterodactyl/game-eggs',
    },
    {
      name: t('pages.oobe.eggRepositories.repositories.pterodactylApplication.title', {}),
      description: t('pages.oobe.eggRepositories.repositories.pterodactylApplication.description', {}),
      gitRepository: 'https://github.com/pterodactyl/application-eggs',
    },
    {
      name: t('pages.oobe.eggRepositories.repositories.pterodactylGeneral.title', {}),
      description: t('pages.oobe.eggRepositories.repositories.pterodactylGeneral.description', {}),
      gitRepository: 'https://github.com/pterodactyl/generic-eggs',
    },
  ];

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

          const repository = await createEggRepository(repo);
          await syncEggRepository(repository.uuid);
        });

      await Promise.all(promises);

      data.refetch();
      onNext();
    } catch (msg) {
      setError(httpErrorToHuman(msg));
    } finally {
      setLoading(false);
    }
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
          {canGoBack && (
            <Button variant='subtle' onClick={onBack} leftSection={<FontAwesomeIcon icon={faChevronLeft} />}>
              Back
            </Button>
          )}
          <Button variant='outline' onClick={() => skipFrom('repositories')}>
            {t('common.button.skip', {})}
          </Button>
          <Button type='submit' disabled={!hasSelection} loading={loading} onClick={() => onSubmit()}>
            {t('pages.oobe.eggRepositories.button.submit', {})}
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
