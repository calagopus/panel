import { useServerStore } from '@/stores/server.ts';
import EulaModalFeature from './EulaModalFeature.tsx';
import JavaVersionModalFeature from './JavaVersionModalFeature.tsx';

export default function FeatureProvider() {
  const { server } = useServerStore();

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
