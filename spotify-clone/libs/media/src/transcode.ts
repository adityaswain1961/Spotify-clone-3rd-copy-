import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import { join } from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { AUDIO_QUALITIES, AudioQuality, RENDITIONS } from './quality';

function ffmpegBinary(): string {
  const binary = process.env.FFMPEG_PATH ?? (ffmpegStatic as unknown as string | null);
  if (!binary) {
    throw new Error('ffmpeg not found: install ffmpeg-static or set FFMPEG_PATH');
  }
  return binary;
}

/** Run ffmpeg and resolve with its stderr (which carries stream info such as duration). */
export function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), ['-hide_banner', '-nostdin', '-y', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-800)}`));
    });
  });
}

function parseDurationSeconds(stderr: string): number | null {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) return null;
  const [, h, m, s] = match;
  return Math.round(Number(h) * 3600 + Number(m) * 60 + Number(s));
}

export interface TranscodeResult {
  durationSec: number | null;
  files: Record<AudioQuality, { path: string; bytes: number }>;
}

/**
 * Decode the source once and encode every rendition in the same ffmpeg pass.
 * `+faststart` moves the MP4 index to the front so playback can begin after the
 * first few kilobytes instead of after the whole file.
 */
export async function transcodeAudio(inputFile: string, outputDir: string): Promise<TranscodeResult> {
  const args = ['-i', inputFile];
  for (const quality of AUDIO_QUALITIES) {
    args.push(
      '-map', '0:a:0',
      '-vn',
      '-c:a', 'aac',
      '-b:a', RENDITIONS[quality].bitrate,
      '-ar', '44100',
      '-ac', '2',
      '-movflags', '+faststart',
      join(outputDir, RENDITIONS[quality].file),
    );
  }

  const stderr = await runFfmpeg(args);

  const files = {} as TranscodeResult['files'];
  for (const quality of AUDIO_QUALITIES) {
    const path = join(outputDir, RENDITIONS[quality].file);
    files[quality] = { path, bytes: (await stat(path)).size };
  }
  return { durationSec: parseDurationSeconds(stderr), files };
}

/** Pull embedded artwork (e.g. ID3 APIC) into a square 600px JPEG. Resolves false when there is none. */
export async function extractCoverArt(inputFile: string, outputFile: string): Promise<boolean> {
  try {
    await runFfmpeg([
      '-i', inputFile,
      '-an',
      '-map', '0:v:0',
      '-frames:v', '1',
      '-vf', 'scale=600:600:force_original_aspect_ratio=increase,crop=600:600',
      '-q:v', '3',
      outputFile,
    ]);
    return true;
  } catch {
    return false;
  }
}
