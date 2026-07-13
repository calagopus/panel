import { isConflictingState } from '@/lib/server.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import EulaModalFeature from './EulaModalFeature.tsx';
import JavaVersionModalFeature from './JavaVersionModalFeature.tsx';

export default function FeatureProvider() {
  const { user } = useAuth();
  const server = useServerStore((state) => state.server);

  if (isConflictingState(server, user)) {
    return null;
  }

  return (
    <>
      {server.egg.features.includes('eula') && <EulaModalFeature />}
      {server.egg.features.includes('java_version') && <JavaVersionModalFeature />}
      {window.extensionContext.extensionRegistry.pages.server.console.features
        .filter((feature) => !feature.filter || feature.filter(server.egg.features))
        .map(({ component: Component }, i) => (
          <Component key={`feature-${i}`} />
        ))}
    </>
  );
}
