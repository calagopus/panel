import {
  faClock,
  faCloudDownload,
  faCloudUpload,
  faEthernet,
  faHardDrive,
  faMemory,
  faMicrochip,
} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';
import Checkbox from '@/elements/input/Checkbox.tsx';
import StatCard from '@/elements/StatCard.tsx';
import { formatAllocation } from '@/lib/server.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerDetails() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const stats = useServerStore((state) => state.stats);
  const state = useServerStore((state) => state.state);

  const [doNormalizeCpuLoad, setDoNormalizeCpuLoad] = useState(localStorage.getItem('normalize_cpu_load') === 'true');

  const networkRef = useRef({
    rxBytes: -1,
    txBytes: -1,
    rxPackets: -1,
    txPackets: -1,
    timestamp: Date.now(),
    rxBytesSpeed: 0,
    txBytesSpeed: 0,
    rxPacketsSpeed: 0,
    txPacketsSpeed: 0,
  });

  useEffect(() => {
    localStorage.setItem('normalize_cpu_load', String(doNormalizeCpuLoad));
  }, [doNormalizeCpuLoad]);

  useEffect(() => {
    if (!stats) return;

    const now = Date.now();
    const timeDelta = (now - networkRef.current.timestamp) / 1000;

    if (timeDelta >= 0.5) {
      const hasPreviousSample = networkRef.current.rxBytes >= 0;

      const rxBytesDelta = hasPreviousSample ? stats.network.rxBytes - networkRef.current.rxBytes : 0;
      const txBytesDelta = hasPreviousSample ? stats.network.txBytes - networkRef.current.txBytes : 0;
      const rxPacketsDelta = hasPreviousSample ? stats.network.rxPackets - networkRef.current.rxPackets : 0;
      const txPacketsDelta = hasPreviousSample ? stats.network.txPackets - networkRef.current.txPackets : 0;

      networkRef.current = {
        rxBytes: stats.network.rxBytes,
        txBytes: stats.network.txBytes,
        rxPackets: stats.network.rxPackets,
        txPackets: stats.network.txPackets,
        timestamp: now,
        rxBytesSpeed: rxBytesDelta / timeDelta,
        txBytesSpeed: txBytesDelta / timeDelta,
        rxPacketsSpeed: rxPacketsDelta / timeDelta,
        txPacketsSpeed: txPacketsDelta / timeDelta,
      };

      if (networkRef.current.rxBytesSpeed < 0) networkRef.current.rxBytesSpeed = 0;
      if (networkRef.current.txBytesSpeed < 0) networkRef.current.txBytesSpeed = 0;
      if (networkRef.current.rxPacketsSpeed < 0) networkRef.current.rxPacketsSpeed = 0;
      if (networkRef.current.txPacketsSpeed < 0) networkRef.current.txPacketsSpeed = 0;
    }
  }, [stats]);

  return (
    <div className='flex flex-col space-y-4'>
      <StatCard
        icon={faEthernet}
        label={t('pages.server.console.details.address', {})}
        order={10}
        copyOnClick={!!server.allocation}
        value={server.allocation ? formatAllocation(server.allocation, server.egg.separatePort) : t('common.na', {})}
      />
      {server.egg.separatePort && server.allocation && (
        <StatCard
          icon={faEthernet}
          label={t('pages.server.console.details.port', {})}
          order={20}
          copyOnClick={!!server.allocation}
          value={server.allocation.port.toString()}
        />
      )}
      <StatCard
        icon={faClock}
        label={t('pages.server.console.details.uptime', {})}
        order={30}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : formatMilliseconds(stats?.uptime || 0)
        }
      />
      <StatCard
        icon={faMicrochip}
        label={t('pages.server.console.details.cpuLoad', {})}
        order={40}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : doNormalizeCpuLoad
              ? `${(((stats?.cpuAbsolute || 0) / (stats?.cpuLimitAbsolute || 100)) * 100).toFixed(2)}%`
              : `${(stats?.cpuAbsolute || 0).toFixed(2)}%`
        }
        limit={
          doNormalizeCpuLoad ? null : server.limits.cpu !== 0 ? `${server.limits.cpu}%` : t('common.unlimited', {})
        }
        popover={
          <Checkbox
            label={t('pages.server.console.details.normalizeCpuLoad', {})}
            checked={doNormalizeCpuLoad}
            onChange={(e) => setDoNormalizeCpuLoad(e.target.checked)}
          />
        }
      />
      <StatCard
        icon={faMemory}
        label={t('pages.server.console.details.memoryLoad', {})}
        order={50}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : bytesToString(stats?.memoryBytes || 0)
        }
        limit={server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : t('common.unlimited', {})}
      />
      <StatCard
        icon={faHardDrive}
        label={t('pages.server.console.details.diskUsage', {})}
        order={60}
        value={bytesToString(stats?.diskBytes || 0)}
        limit={server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : t('common.unlimited', {})}
      />
      <StatCard
        icon={faCloudDownload}
        label={t('pages.server.console.details.networkIn', {})}
        order={70}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : bytesToString(stats?.network.rxBytes || 0)
        }
        details={
          state === 'offline' && server.status !== 'installing'
            ? null
            : `${bytesToString(Math.round(networkRef.current.rxBytesSpeed), undefined, true)}/s, ${Math.round(networkRef.current.rxPacketsSpeed)} pps`
        }
      />
      <StatCard
        icon={faCloudUpload}
        label={t('pages.server.console.details.networkOut', {})}
        order={80}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : bytesToString(stats?.network.txBytes || 0)
        }
        details={
          state === 'offline' && server.status !== 'installing'
            ? null
            : `${bytesToString(Math.round(networkRef.current.txBytesSpeed), undefined, true)}/s, ${Math.round(networkRef.current.txPacketsSpeed)} pps`
        }
      />
      {window.extensionContext.extensionRegistry.pages.server.console.statCards.map((StatCard, i) => (
        <StatCard key={`console-stat-card-${i}`} />
      ))}
    </div>
  );
}
