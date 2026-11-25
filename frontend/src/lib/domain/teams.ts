import { z } from 'zod';
import { endsWithInheritedIgnoredFiles } from '@/lib/domain/subusers.ts';
import { teamMemberManagementLabelMapping } from '@/lib/enums.ts';
import {
  userTeamMemberManagement,
  userTeamMemberSchema,
  userTeamPresetSchema,
  userTeamSchema,
} from '@/lib/schemas/user/teams.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

type Team = Pick<z.infer<typeof userTeamSchema>, 'membership'>;
type TeamMember = z.infer<typeof userTeamMemberSchema>;
type TeamPreset = z.infer<typeof userTeamPresetSchema>;
type TeamMemberManagement = z.infer<typeof userTeamMemberManagement>;

// mirrors the backend `TeamActor`, which stays authoritative

export const isTeamOwner = (team: Team): team is Team & { membership: null } => team.membership === null;

export const isTeamMember = (team: Team): team is Team & { membership: NonNullable<Team['membership']> } =>
  team.membership !== null;

export const isTeamInvitePending = (team: Team) => team.membership !== null && team.membership.accepted === null;

export const canManageTeamMembers = (team: Team) =>
  team.membership === null || team.membership.management.includes('members');

export const canManageTeamPresets = (team: Team) =>
  team.membership === null || team.membership.management.includes('presets');

export const canManageTeam = (team: Team) => team.membership === null || team.membership.management.length > 0;

export const outranksTeamPreset = (team: Team, preset: TeamPreset) =>
  team.membership === null || preset.weight < team.membership.preset.weight;

// an invite can always be withdrawn by whoever sent it
export const canRemoveTeamMember = (team: Team, member: TeamMember, userUuid: string | undefined) =>
  member.user.uuid !== userUuid &&
  (outranksTeamPreset(team, member.preset) || (member.accepted === null && member.inviter?.uuid === userUuid));

export function canGrantTeamPreset(
  team: Team,
  preset: Pick<TeamPreset, 'weight' | 'permissions' | 'ignoredFiles'>,
): boolean {
  if (team.membership === null) return true;

  const own = team.membership.preset;

  return (
    preset.weight < own.weight &&
    preset.permissions.every((permission) => own.permissions.includes(permission)) &&
    endsWithInheritedIgnoredFiles(preset.ignoredFiles, own.ignoredFiles)
  );
}

export const grantableTeamManagement = (team: Team): TeamMemberManagement[] =>
  team.membership === null ? [...userTeamMemberManagement.options] : team.membership.management;

export const teamManagementLabel = (management: TeamMemberManagement[]): string =>
  management.length === 0
    ? getTranslations().t('common.none', {})
    : management.map((entry) => teamMemberManagementLabelMapping[entry]()).join(', ');
