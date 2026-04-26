import { faChevronDown, faChevronUp, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Checkbox, Group, Input, Stack, Title } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import { permissionCategoryIconMapping } from '@/lib/enums.ts';
import { apiPermissionsSchema, permissionMapSchema } from '@/lib/schemas/generic.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const permissionIconMap: Record<
  keyof z.infer<typeof apiPermissionsSchema>,
  'userPermissionIcons' | 'adminPermissionIcons' | 'serverPermissionIcons'
> = {
  userPermissions: 'userPermissionIcons',
  adminPermissions: 'adminPermissionIcons',
  serverPermissions: 'serverPermissionIcons',
};

export default function PermissionSelector({
  label,
  className,
  withAsterisk,
  permissionsMapType,
  permissions,
  selectedPermissions,
  setSelectedPermissions,
}: {
  label?: string;
  className?: string;
  withAsterisk?: boolean;
  permissionsMapType: keyof z.infer<typeof apiPermissionsSchema>;
  permissions: z.infer<typeof permissionMapSchema>;
  selectedPermissions: string[];
  setSelectedPermissions: (selected: string[]) => void;
}) {
  const { t } = useTranslations();

  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const permissionIcons = window.extensionContext.extensionRegistry.permissionIcons;

  const allPermissionKeys = useMemo(() => {
    return Object.entries(permissions).flatMap(([category, { permissions: perms }]) =>
      Object.keys(perms).map((perm) => `${category}.${perm}`),
    );
  }, [permissions]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((cat) => cat !== category);
      }
      return [...prev, category];
    });
  }, []);

  const togglePermission = useCallback(
    (permissionKey: string) => {
      setSelectedPermissions(
        selectedPermissions.includes(permissionKey)
          ? selectedPermissions.filter((perm) => perm !== permissionKey)
          : [...selectedPermissions, permissionKey],
      );
    },
    [selectedPermissions, setSelectedPermissions],
  );

  const toggleAllInCategory = useCallback(
    (category: string) => {
      const categoryPermissions = Object.keys(permissions[category].permissions).map((perm) => `${category}.${perm}`);

      const allSelected = categoryPermissions.every((perm) => selectedPermissions.includes(perm));

      if (allSelected) {
        setSelectedPermissions(selectedPermissions.filter((perm) => !categoryPermissions.includes(perm)));
      } else {
        const newPermissions = new Set([...selectedPermissions, ...categoryPermissions]);
        setSelectedPermissions(Array.from(newPermissions));
      }
    },
    [permissions, selectedPermissions, setSelectedPermissions],
  );

  const selectAllPermissions = useCallback(() => {
    setSelectedPermissions(allPermissionKeys);
  }, [allPermissionKeys, setSelectedPermissions]);

  const clearAllPermissions = useCallback(() => {
    setSelectedPermissions([]);
  }, [setSelectedPermissions]);

  const sortedSelectedPermissions = useMemo(() => {
    return [...selectedPermissions].sort();
  }, [selectedPermissions]);

  const getCategorySelectionState = useCallback(
    (category: string) => {
      const categoryPermissions = Object.keys(permissions[category].permissions);
      const selectedCount = categoryPermissions.filter((perm) =>
        selectedPermissions.includes(`${category}.${perm}`),
      ).length;

      if (selectedCount === 0) return 'none';
      if (selectedCount === categoryPermissions.length) return 'all';
      return 'partial';
    },
    [permissions, selectedPermissions],
  );

  const selectedPanel = (
    <Card>
      <Title order={3} c='white'>
        {t('elements.permissionSelector.selectedPermissions', { count: selectedPermissions.length })}
      </Title>
      <div className='max-h-96 overflow-y-auto'>
        {selectedPermissions.length === 0 ? (
          <p className='text-gray-200 text-sm'>{t('elements.permissionSelector.noPermissions', {})}</p>
        ) : (
          <div className='space-y-1'>
            {sortedSelectedPermissions.map((permission) => (
              <Card key={permission} className='border border-neutral-600' padding='xs'>
                <Group justify='space-between'>
                  <span className='text-sm font-mono text-white'>{permission}</span>
                  <ActionIcon color='red' onClick={() => togglePermission(permission)}>
                    <FontAwesomeIcon icon={faX} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div className='mt-4 flex flex-row'>
        <Button disabled={selectedPermissions.length === allPermissionKeys.length} onClick={selectAllPermissions}>
          {t('common.button.selectAll', {})}
        </Button>
        <Button
          disabled={selectedPermissions.length === 0}
          color='red'
          variant='outline'
          onClick={clearAllPermissions}
          className='ml-2'
        >
          {t('common.button.deselectAll', {})}
        </Button>
      </div>
    </Card>
  );

  return (
    <Stack gap={0} className={className}>
      {label && <Input.Label required={withAsterisk}>{label}</Input.Label>}

      <div className='flex flex-col lg:flex-row lg:items-start gap-6'>
        <div className='flex-1 space-y-4 min-w-0'>
          {Object.entries(permissions).map(([category, { description, permissions: perms }]) => {
            const isExpanded = expandedCategories.includes(category);
            const selectionState = getCategorySelectionState(category);

            return (
              <Card key={category}>
                <div className='flex items-center justify-between gap-1'>
                  <div className='flex items-center gap-3'>
                    {permissionIcons[permissionIconMap[permissionsMapType]][category] ?? (
                      <FontAwesomeIcon
                        icon={permissionCategoryIconMapping[category]}
                        className='w-5 h-5 text-gray-50'
                      />
                    )}
                    <div>
                      <Title order={5} c='white' className='uppercase'>
                        {category.replace('-', ' ')}
                      </Title>
                      <p className='text-sm text-gray-200 mt-1'>{description}</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      onChange={() => toggleAllInCategory(category)}
                      indeterminate={selectionState === 'partial'}
                      checked={selectionState === 'all'}
                    />
                    <ActionIcon variant='subtle' onClick={() => toggleCategory(category)}>
                      {isExpanded ? (
                        <FontAwesomeIcon icon={faChevronUp} className='w-4 h-4 text-gray-200' />
                      ) : (
                        <FontAwesomeIcon icon={faChevronDown} className='w-4 h-4 text-gray-200' />
                      )}
                    </ActionIcon>
                  </div>
                </div>

                {isExpanded && (
                  <div className='p-4'>
                    <div className='space-y-3'>
                      {Object.entries(perms).map(([permission, permDescription]) => {
                        const permissionKey = `${category}.${permission}`;
                        const isSelected = selectedPermissions.includes(permissionKey);

                        return (
                          <Checkbox.Card
                            key={permission}
                            checked={isSelected}
                            onChange={() => togglePermission(permissionKey)}
                            color={isSelected ? 'green' : ''}
                            bd='0'
                          >
                            <Group wrap='nowrap' align='flex-start'>
                              <Checkbox.Indicator />
                              <div>
                                <div className='text-gray-50 font-bold'>
                                  {permission.charAt(0).toUpperCase() + permission.slice(1)}
                                </div>
                                <div className='text-sm text-gray-200 mt-1'>{permDescription}</div>
                              </div>
                            </Group>
                          </Checkbox.Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className='w-full lg:w-1/3 lg:sticky lg:top-15 lg:self-start'>{selectedPanel}</div>
      </div>
    </Stack>
  );
}
