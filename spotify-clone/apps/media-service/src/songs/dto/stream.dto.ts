import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AUDIO_QUALITIES, AudioQuality } from '@spotify/media';

export class QualityQueryDto {
  @IsOptional()
  @IsIn(AUDIO_QUALITIES)
  quality: AudioQuality = 'high';
}

export class StreamUrlsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(AUDIO_QUALITIES)
  quality: AudioQuality = 'high';
}

const splitIds = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : value;

export class SongIdsQueryDto {
  @Transform(splitIds)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];
}
