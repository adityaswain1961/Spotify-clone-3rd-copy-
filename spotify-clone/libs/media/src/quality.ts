export const AUDIO_QUALITIES = ['low', 'high'] as const;
export type AudioQuality = (typeof AUDIO_QUALITIES)[number];

/**
 * Progressive AAC-LC renditions in fast-start MP4 (.m4a).
 * - low  (96 kbps):  ~0.7 MB/min, starts instantly on mobile data.
 * - high (256 kbps): ~1.9 MB/min, near-transparent quality on Wi-Fi / for downloads.
 */
export const RENDITIONS: Record<AudioQuality, { bitrate: string; file: string }> = {
  low: { bitrate: '96k', file: 'low.m4a' },
  high: { bitrate: '256k', file: 'high.m4a' },
};

export const AUDIO_MIME_TYPE = 'audio/mp4';

export function audioKey(songId: string, quality: AudioQuality): string {
  return `songs/${songId}/${RENDITIONS[quality].file}`;
}

export function coverKey(songId: string): string {
  return `covers/${songId}.jpg`;
}
