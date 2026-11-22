import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class SongMetadataDto {
  /** The key returned by POST /songs/upload-url after the file was PUT there. */
  @IsString()
  uploadKey!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  /** Seconds. Replaced by the exact duration measured during transcoding. */
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  albumId?: string;

  @IsOptional()
  @IsString()
  coverImageKey?: string;
}
