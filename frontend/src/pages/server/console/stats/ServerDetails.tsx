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
import { z } from 'zod';
import StatCard from '@/elements/data-display/StatCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { formatAllocation } from '@/lib/domain/server.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const NORMALIZE_CPU_LOAD_KEY = 'console::normalize_cpu_load';
const normalizeCpuLoadSchema = z.boolean();

export default function ServerDetails() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const stats = useServerStore((state) => state.stats);
  const state = useServerStore((state) => state.state);

  const [doNormalizeCpuLoad, setDoNormalizeCpuLoad] = useUserSetting(
    NORMALIZE_CPU_LOAD_KEY,
    normalizeCpuLoadSchema,
    false,
  );

  const [networkSpeeds, setNetworkSpeeds] = useState({
    rxBytesSpeed: 0,
    txBytesSpeed: 0,
    rxPacketsSpeed: 0,
    txPacketsSpeed: 0,
  });

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

      setNetworkSpeeds({
        rxBytesSpeed: networkRef.current.rxBytesSpeed,
        txBytesSpeed: networkRef.current.txBytesSpeed,
        rxPacketsSpeed: networkRef.current.rxPacketsSpeed,
        txPacketsSpeed: networkRef.current.txPacketsSpeed,
      });
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
        label={t('common.stat.uptime', {})}
        order={30}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : formatMilliseconds(stats?.uptime || 0)
        }
      />
      <StatCard
        icon={faMicrochip}
        label={t('common.stat.cpuLoad', {})}
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
        progress={state === 'offline' && server.status !== 'installing' ? null : stats?.cpuAbsolute}
        total={server.limits.cpu}
        popover={
          <Checkbox
            label={
              <span className='inline-flex items-center gap-1'>
                {t('pages.server.console.details.normalizeCpuLoad', {})}
                <UserSettingScopeMenu
                  settingKey={NORMALIZE_CPU_LOAD_KEY}
                  value={doNormalizeCpuLoad}
                  withinPortal={false}
                />
              </span>
            }
            checked={doNormalizeCpuLoad}
            onChange={(e) => setDoNormalizeCpuLoad(e.target.checked)}
          />
        }
      />
      <StatCard
        icon={faMemory}
        label={t('common.stat.memoryLoad', {})}
        order={50}
        value={
          state === 'offline' && server.status !== 'installing'
            ? t('common.enum.serverState.offline', {})
            : bytesToString(stats?.memoryBytes || 0)
        }
        limit={server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : t('common.unlimited', {})}
        progress={state === 'offline' && server.status !== 'installing' ? null : stats?.memoryBytes}
        total={mbToBytes(server.limits.memory)}
      />
      <StatCard
        icon={faHardDrive}
        label={t('common.stat.diskUsage', {})}
        order={60}
        value={bytesToString(stats?.diskBytes || 0)}
        limit={server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : t('common.unlimited', {})}
        progress={stats?.diskBytes}
        total={mbToBytes(server.limits.disk)}
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
            : `${bytesToString(Math.round(networkSpeeds.rxBytesSpeed), undefined, true)}/s, ${Math.round(networkSpeeds.rxPacketsSpeed)} pps`
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
            : `${bytesToString(Math.round(networkSpeeds.txBytesSpeed), undefined, true)}/s, ${Math.round(networkSpeeds.txPacketsSpeed)} pps`
        }
      />
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.server.console.statCards}
        name='console-stat-card'
      />
    </div>
  );
}
