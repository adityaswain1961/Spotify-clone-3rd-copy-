import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class SongMetadataDto {
  @IsString()
  s3Key!: string;

  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  duration!: number;

  @IsArray()
  @IsString({ each: true })
  genres!: string[];

  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @IsOptional()
  @IsUUID()
  albumId?: string;

  @IsOptional()
  @IsString()
  coverImageKey?: string;
}
