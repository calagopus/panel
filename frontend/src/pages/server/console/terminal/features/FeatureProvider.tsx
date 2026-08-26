import { useServerStore } from '@/stores/server.ts';
import EulaModalFeature from './EulaModalFeature.tsx';
import JavaVersionModalFeature from './JavaVersionModalFeature.tsx';

export default function FeatureProvider() {
  const eggFeatures = useServerStore((state) => state.server.egg.features);

  return (
    <>
      {eggFeatures.includes('eula') && <EulaModalFeature />}
      {eggFeatures.includes('java_version') && <JavaVersionModalFeature />}
      {window.extensionContext.extensionRegistry.pages.server.console.features
        .filter((feature) => !feature.filter || feature.filter(eggFeatures))
        .map(({ component: Component }, i) => (
          <Component key={`feature-${i}`} />
        ))}
    </>
  );
}
