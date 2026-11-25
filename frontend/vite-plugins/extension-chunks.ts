import { listExtensionIdentifiers } from './extension-overrides.ts';

export function extensionChunkGroups() {
  return listExtensionIdentifiers().map((identifier) => ({
    name: `extension-${identifier}`,
    // extensions resolve through `frontend/extensions/<id>` or `backend-extensions/<id>/frontend`
    // `?inline`/`?raw`/`?url` css are js modules (theme variant `stylesheets`), keep them out of the eager css chunk
    test: new RegExp(
      `(?:frontend/extensions|backend-extensions)/${identifier}/.*\\.css(?:\\?(?!(?:.*&)?(?:inline|raw|url)\\b).*)?$`,
    ),
    priority: 30,
    includeDependenciesRecursively: false,
  }));
}
