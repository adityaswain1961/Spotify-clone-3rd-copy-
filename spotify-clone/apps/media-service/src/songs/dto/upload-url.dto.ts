import { IsIn, IsString, MaxLength } from 'class-validator';

export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
] as const;

export class UploadUrlDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsIn(ACCEPTED_AUDIO_TYPES)
  contentType!: string;
}
