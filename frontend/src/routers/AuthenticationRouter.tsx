import { useMemo } from 'react';
import { Route, Routes } from 'react-router';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import authenticationRoutes from '@/routers/routes/authenticationRoutes.ts';

export default function AuthenticationRouter() {
  const { t } = useTranslations();

  const allAuthenticationRoutes = useMemo(() => {
    const routes = [...authenticationRoutes, ...window.extensionContext.extensionRegistry.routes.authenticationRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.authenticationRouteInterceptors) {
      interceptor(routes);
    }

    return routes;
  }, []);

  return (
    <Routes>
      {allAuthenticationRoutes
        .filter((route) => !route.filter || route.filter())
        .map(({ path, element: Element }) => (
          <Route key={path} path={path} element={<Element />} />
        ))}
      <Route
        path='*'
        element={
          <ContentContainer title={t('elements.screenBlock.notFound.title', {})}>
            <ScreenBlock
              title={t('elements.screenBlock.notFound.title', {})}
              content={t('elements.screenBlock.notFound.content', {})}
            />
          </ContentContainer>
        }
      />
    </Routes>
  );
}
