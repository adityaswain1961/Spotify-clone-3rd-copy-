/**
 * Seed demo accounts and real, playable songs.
 *
 *   pnpm db:seed                 # synthesize a few demo tracks with ffmpeg
 *   pnpm db:seed ~/Music/demo    # import your own files ("Artist - Title.mp3" sets the artist)
 *
 * Idempotent: songs that are already published are skipped.
 */
import '@spotify/env';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join, resolve } from 'path';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createStorage, ingestSongAudio, runFfmpeg } from '@spotify/media';

const DEMO_PASSWORD = 'password123';
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']);

interface SeedTrack {
  file: string;
  title: string;
  artist: string;
  genres: string[];
  cover?: string;
}

const prisma = new PrismaClient();
const storage = createStorage();

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artist';

async function ensureUser(email: string, displayName: string, role: UserRole) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role,
      profile: { create: { displayName } },
      ...(role === UserRole.ARTIST ? { artist: { create: { stageName: displayName } } } : {}),
    },
    include: { artist: true },
  });
}

async function ensureArtist(stageName: string) {
  const user = await ensureUser(`${slug(stageName)}@demo.dev`, stageName, UserRole.ARTIST);
  return user.artist ?? prisma.artist.create({ data: { userId: user.id, stageName } });
}

/** "Artist - Title.mp3" -> { artist, title }; otherwise the whole name is the title. */
function parseFileName(file: string): { artist: string; title: string } {
  const name = basename(file, extname(file)).replace(/[_]+/g, ' ').trim();
  const split = name.split(/\s+-\s+/);
  return split.length >= 2
    ? { artist: split[0].trim(), title: split.slice(1).join(' - ').trim() }
    : { artist: 'Demo Artist', title: name };
}

async function tracksFromFolder(folder: string): Promise<SeedTrack[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => ({ file: join(folder, entry.name), genres: [], ...parseFileName(entry.name) }));
}

/**
 * A short arpeggiated chord progression: envelope is zero at each note boundary
 * so steps don't click. Different keys/tempos make each demo track distinct.
 */
function arpeggioExpression(rootHz: number, bpm: number): string {
  const eighth = 30 / bpm;
  const bar = eighth * 8;
  const chord = `floor(mod(t/${bar},4))`;
  const progression = `if(eq(${chord},0),0,if(eq(${chord},1),5,if(eq(${chord},2),7,-3)))`;
  const step = `floor(mod(t/${eighth},4))`;
  const arp = `if(eq(${step},0),0,if(eq(${step},1),4,if(eq(${step},2),7,12)))`;
  const root = `${rootHz}*pow(2,(${progression})/12)`;
  const envelope = `pow(sin(PI*mod(t/${eighth},1)),2)`;
  return `0.32*${envelope}*sin(2*PI*${root}*pow(2,(${arp})/12)*t)+0.12*sin(2*PI*${root}/2*t)`;
}

const DEMO_TRACKS = [
  { title: 'Midnight Arcade', artist: 'Neon Harbor', genres: ['synthwave'], root: 220, bpm: 112, colors: ['0x1db954', '0x0b3d2e'] },
  { title: 'Paper Lanterns', artist: 'Neon Harbor', genres: ['ambient'], root: 196, bpm: 84, colors: ['0xff8a3d', '0x3a0ca3'] },
  { title: 'Glass Rivers', artist: 'Lowtide', genres: ['chill', 'electronic'], root: 247, bpm: 96, colors: ['0x4cc9f0', '0x1b1b3a'] },
  { title: 'Static Bloom', artist: 'Lowtide', genres: ['electronic'], root: 262, bpm: 124, colors: ['0xf72585', '0x240046'] },
  { title: 'Northern Drive', artist: 'Polar Echo', genres: ['synthwave'], root: 175, bpm: 104, colors: ['0xffd60a', '0x003566'] },
  { title: 'Soft Machines', artist: 'Polar Echo', genres: ['lofi'], root: 233, bpm: 78, colors: ['0x90e0ef', '0x6a040f'] },
];

async function synthesizeTracks(workDir: string): Promise<SeedTrack[]> {
  const durationSec = 75;
  const tracks: SeedTrack[] = [];
  for (const [index, demo] of DEMO_TRACKS.entries()) {
    const file = join(workDir, `demo-${index}.wav`);
    const cover = join(workDir, `demo-${index}.jpg`);
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `aevalsrc='${arpeggioExpression(demo.root, demo.bpm)}':s=44100:d=${durationSec}`,
      '-af', `aecho=0.8:0.7:${Math.round(60000 / demo.bpm / 2)}:0.25,afade=t=in:d=2,afade=t=out:st=${durationSec - 4}:d=4`,
      '-ac', '2',
      file,
    ]);
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `gradients=s=600x600:c0=${demo.colors[0]}:c1=${demo.colors[1]}:x0=0:y0=0:x1=600:y1=600:d=1`,
      '-frames:v', '1',
      '-q:v', '3',
      cover,
    ]);
    tracks.push({ file, cover, title: demo.title, artist: demo.artist, genres: demo.genres });
  }
  return tracks;
}

async function main(): Promise<void> {
  const folder = process.argv[2] ? resolve(process.argv[2]) : null;
  const workDir = await mkdtemp(join(tmpdir(), 'spotify-seed-'));

  try {
    console.log(`Storage driver: ${storage.driver}`);
    const listener = await ensureUser('listener@demo.dev', 'Demo Listener', UserRole.LISTENER);
    const tracks = folder ? await tracksFromFolder(folder) : await synthesizeTracks(workDir);
    if (!tracks.length) throw new Error(`No audio files found in ${folder}`);

    const songIds: string[] = [];
    for (const track of tracks) {
      const artist = await ensureArtist(track.artist);
      const existing = await prisma.song.findFirst({ where: { artistId: artist.id, title: track.title } });
      if (existing?.isPublished) {
        console.log(`- skip   ${track.artist} - ${track.title} (already published)`);
        songIds.push(existing.id);
        continue;
      }

      const song =
        existing ??
        (await prisma.song.create({
          data: { title: track.title, duration: 0, artistId: artist.id, genres: track.genres, isPublished: false },
        }));
      const started = Date.now();
      await ingestSongAudio({ prisma, storage }, song.id, track.file, { coverFile: track.cover });
      console.log(`+ added  ${track.artist} - ${track.title} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      songIds.push(song.id);
    }

    const playlist =
      (await prisma.playlist.findFirst({ where: { userId: listener.id, title: 'Demo Mix' } })) ??
      (await prisma.playlist.create({
        data: { userId: listener.id, title: 'Demo Mix', description: 'Everything from the seed script', isPublic: true },
      }));
    const inPlaylist = new Set(
      (await prisma.playlistSong.findMany({ where: { playlistId: playlist.id }, select: { songId: true } })).map((row) => row.songId),
    );
    let position = await prisma.playlistSong.count({ where: { playlistId: playlist.id } });
    for (const songId of songIds) {
      if (inPlaylist.has(songId)) continue;
      position += 1;
      await prisma.playlistSong.create({ data: { playlistId: playlist.id, songId, position } });
    }

    console.log(`\nDone. ${songIds.length} songs ready.`);
    console.log(`Sign in with listener@demo.dev / ${DEMO_PASSWORD} (or register a new account).`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
