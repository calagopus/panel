import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { adminTeamCreateSchema, adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TeamFormValues = z.infer<typeof adminTeamCreateSchema>;

export const teamEmptyFormValues: TeamFormValues = {
  name: '',
  description: null,
  ownerUuid: '',
};

export const teamToFormValues = (team: z.infer<typeof adminTeamSchema>): Partial<TeamFormValues> => ({
  name: team.name,
  description: team.description,
  ownerUuid: team.owner.uuid,
});

export function useTeamFormFields(
  users: ReturnType<typeof useInfiniteSearchableResource<z.infer<typeof adminFullUserSchema>>>,
  canReadUsers: boolean,
  contextTeam?: z.infer<typeof adminTeamSchema>,
): FieldDef<TeamFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'ownerUuid',
      label: t('pages.admin.teams.tabs.general.page.form.owner', {}),
      required: true,
      options: (contextTeam ? [contextTeam.owner] : users.items).map((user) => ({
        label: `${user.username} (${user.email})`,
        value: user.uuid,
      })),
      props: {
        searchable: true,
        searchValue: users.search,
        onSearchChange: users.setSearch,
        infiniteScroll: users.infiniteScroll,
        disabled: !!contextTeam || !canReadUsers,
        loading: users.loading,
      },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
  ];
}
