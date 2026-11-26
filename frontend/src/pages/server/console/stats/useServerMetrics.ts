import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { formatBytes, formatBytesRate, formatPercent, useStreamChart } from '@/lib/chart.ts';
import { bitsPerSecondToString, mbToBytes } from '@/lib/format/size.ts';
import { serverResourceUsageSchema } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useServerStatsPending } from './useServerStatsPending.ts';

const IDLE_RATES = {
  networkRx: 0,
  networkTx: 0,
  networkRxPackets: 0,
  networkTxPackets: 0,
  diskRead: 0,
  diskWrite: 0,
  diskReadOps: 0,
  diskWriteOps: 0,
};

const MIN_SAMPLE_SECONDS = 0.5;

export function useServerMetrics() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const stats = useServerStore((state) => state.stats);
  const statsPending = useServerStatsPending();

  const [rates, setRates] = useState(IDLE_RATES);
  const previous = useRef<{ stats: z.infer<typeof serverResourceUsageSchema>; timestamp: number } | null>(null);
  const wasOffline = useRef(false);

  const cpu = useStreamChart({
    series: useMemo(() => [t('common.stat.cpuLoad', {})], [t]),
    format: formatPercent,
    min: 10,
    limit: server.limits.cpu > 0 ? server.limits.cpu : null,
  });
  const memory = useStreamChart({
    series: useMemo(() => [t('common.stat.memoryLoad', {})], [t]),
    format: formatBytes,
    scale: 'binary',
    min: mbToBytes(64),
    limit: server.limits.memory > 0 ? mbToBytes(server.limits.memory) : null,
  });
  const network = useStreamChart({
    series: useMemo(() => [t('common.stat.outbound', {}), t('common.stat.inbound', {})], [t]),
    format: bitsPerSecondToString,
    min: 1000,
  });
  const diskIo = useStreamChart({
    series: useMemo(() => [t('common.stat.write', {}), t('common.stat.read', {})], [t]),
    format: formatBytesRate,
    scale: 'binary',
    min: 1024,
  });

  const offline = !stats?.state || (stats.state === 'offline' && server.status !== 'installing');

  useEffect(() => {
    if (offline) {
      previous.current = null;
      if (!wasOffline.current) {
        wasOffline.current = true;
        cpu.push(0);
        memory.push(0);
        network.push([0, 0]);
        diskIo.push([0, 0]);
        setRates(IDLE_RATES);
      }
      return;
    }

    wasOffline.current = false;

    const now = performance.now();
    const seconds = previous.current ? (now - previous.current.timestamp) / 1000 : 0;
    if (previous.current && seconds < MIN_SAMPLE_SECONDS) return;
    const before =
      previous.current && seconds > 0 && stats.uptime >= previous.current.stats.uptime ? previous.current.stats : null;
    const rate = (current: number | undefined, last: number | undefined) =>
      before && current !== undefined && last !== undefined ? Math.max((current - last) / seconds, 0) : 0;

    const next = {
      networkRx: rate(stats.network.rxBytes, before?.network.rxBytes) * 8,
      networkTx: rate(stats.network.txBytes, before?.network.txBytes) * 8,
      networkRxPackets: rate(stats.network.rxPackets, before?.network.rxPackets),
      networkTxPackets: rate(stats.network.txPackets, before?.network.txPackets),
      diskRead: rate(stats.disk?.readBytes, before?.disk?.readBytes),
      diskWrite: rate(stats.disk?.writeBytes, before?.disk?.writeBytes),
      diskReadOps: rate(stats.disk?.readOps, before?.disk?.readOps),
      diskWriteOps: rate(stats.disk?.writeOps, before?.disk?.writeOps),
    };

    cpu.push(stats.cpuAbsolute);
    memory.push(stats.memoryBytes);
    network.push([next.networkTx, next.networkRx]);
    if (stats.disk) {
      diskIo.push([next.diskWrite, next.diskRead]);
    }
    setRates(next);

    previous.current = { stats, timestamp: now };
  }, [stats, offline, cpu.push, memory.push, network.push, diskIo.push]);

  return { stats, statsPending, offline, rates, cpu, memory, network, diskIo };
}
