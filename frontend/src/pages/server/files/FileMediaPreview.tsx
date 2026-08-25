import { Audio } from '@gfazioli/mantine-audio';
import { useEffect, useRef } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useShallow } from 'zustand/react/shallow';
import Select from '@/elements/input/Select.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerStore } from '@/stores/fileManager.ts';

interface FileImagePreviewProps {
  src: string;
  name: string;
}

export function FileImagePreview({ src, name }: FileImagePreviewProps) {
  const smoothing = useFileManagerStore((state) => state.imageViewerSmoothing);

  return (
    <div data-file-manager-image-preview className='flex h-full min-w-0 items-center justify-center overflow-hidden'>
      <TransformWrapper minScale={0.5} centerOnInit>
        <TransformComponent wrapperClass='h-full! w-full! rounded-md'>
          <img
            src={src}
            alt={name}
            className='max-h-full max-w-full object-contain'
            style={{ imageRendering: smoothing ? undefined : 'pixelated' }}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

interface FileAudioPreviewProps {
  src: string;
}

interface PitchAdjustableAudioElement extends HTMLAudioElement {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
}

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => ({
  value: String(rate),
  label: `${rate}x`,
}));

export function FileAudioPreview({ src }: FileAudioPreviewProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const { volume, playbackRate, setVolume, setPlaybackRate } = useFileManagerStore(
    useShallow((state) => ({
      volume: state.audioPlayerVolume,
      playbackRate: state.audioPlayerPlaybackRate,
      setVolume: state.setAudioPlayerVolume,
      setPlaybackRate: state.setAudioPlayerPlaybackRate,
    })),
  );

  useEffect(() => {
    const audio = rootRef.current?.querySelector('audio') as PitchAdjustableAudioElement | null;
    if (!audio) return;

    // Calagopus intentionally links speed and pitch for file previews.
    audio.preservesPitch = false;
    audio.mozPreservesPitch = false;
    audio.webkitPreservesPitch = false;
  }, [src, playbackRate]);

  return (
    <div
      ref={rootRef}
      data-file-manager-audio-preview
      className='flex h-full min-w-0 items-center justify-center overflow-auto p-4'
    >
      <Audio
        size='xl'
        w='100%'
        maw='42rem'
        src={src}
        volume={volume}
        onVolumeChange={setVolume}
        playbackRate={playbackRate}
        onPlaybackRateChange={setPlaybackRate}
        onError={(error) => (error ? addToast(error.message, 'error') : undefined)}
        shortcuts
      >
        <Audio.Waveform height={120} mirrorGap={2} />
        <Audio.Controls>
          <Audio.SkipButton seconds={-15} label={t('pages.server.files.tooltip.back', { seconds: 15 })} />
          <Audio.PlayButton
            playLabel={t('pages.server.files.tooltip.play', {})}
            pauseLabel={t('pages.server.files.tooltip.pause', {})}
          />
          <Audio.SkipButton seconds={15} label={t('pages.server.files.tooltip.forward', { seconds: 15 })} />
          <Audio.Timeline />
          <Audio.TimeDisplay />
          <Audio.MuteButton
            muteLabel={t('pages.server.files.tooltip.mute', {})}
            unmuteLabel={t('pages.server.files.tooltip.unmute', {})}
          />
          <Audio.VolumeSlider />
          <Select
            aria-label={t('pages.server.files.tooltip.playbackRate', {})}
            value={playbackRate.toString()}
            onChange={(value) => setPlaybackRate(Number(value))}
            data={playbackRates}
            style={{ width: 80 }}
          />
        </Audio.Controls>
      </Audio>
    </div>
  );
}
