import { faClock, faEthernet } from '@fortawesome/free-solid-svg-icons';
import Indicator from '@/elements/data-display/Indicator.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { formatAllocation } from '@/lib/domain/server.ts';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { useServerStatusLabel } from '@/plugins/server/useServerStatusLabel.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerIndicators() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const uptime = useServerStore((state) =>
    !state.stats?.state || (state.stats.state === 'offline' && state.server.status !== 'installing')
      ? null
      : state.stats.uptime,
  );
  const status = useServerStatusLabel();

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--mantine-color-dimmed)'>
      <ExtensionSlot
        components={
          window.extensionContext.extensionRegistry.pages.server.console.indicatorComponents.prependedComponents
        }
        name='console-indicator-prepended'
      />

      <Indicator
        icon={<span className='flex size-3 items-center justify-center'>{status.indicator}</span>}
        label={t('common.table.columns.status', {})}
      >
        {status.label}
      </Indicator>
      {server.allocation ? (
        <>
          <Indicator
            icon={faEthernet}
            label={t('pages.server.console.details.address', {})}
            copy={formatAllocation(server.allocation, server.egg.separatePort)}
          >
            <ScrollingText>
              <RedactedText value={formatAllocation(server.allocation, server.egg.separatePort)} />
            </ScrollingText>
          </Indicator>
          {server.egg.separatePort && (
            <Indicator
              icon={faEthernet}
              label={t('pages.server.console.details.port', {})}
              copy={server.allocation.port.toString()}
            >
              {server.allocation.port.toString()}
            </Indicator>
          )}
        </>
      ) : (
        <Indicator icon={faEthernet} label={t('pages.server.console.details.address', {})}>
          {t('common.server.noAllocation', {})}
        </Indicator>
      )}
      {uptime !== null && (
        <Indicator icon={faClock} label={t('common.stat.uptime', {})} className='tabular-nums'>
          {formatMilliseconds(uptime)}
        </Indicator>
      )}

      <ExtensionSlot
        components={
          window.extensionContext.extensionRegistry.pages.server.console.indicatorComponents.appendedComponents
        }
        name='console-indicator-appended'
      />
    </div>
  );
}
