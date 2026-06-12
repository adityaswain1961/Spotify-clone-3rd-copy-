import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreatePlaylistDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
