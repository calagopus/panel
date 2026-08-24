import { listExtensionIdentifiers } from './extension-overrides.ts';

export function extensionChunkGroups() {
  return listExtensionIdentifiers().map((identifier) => ({
    name: `extension-${identifier}`,
    // extensions resolve through `frontend/extensions/<id>` or `backend-extensions/<id>/frontend`
    test: new RegExp(`(?:frontend/extensions|backend-extensions)/${identifier}/.*\\.css(?:\\?.*)?$`),
    priority: 30,
    includeDependenciesRecursively: false,
  }));
}
