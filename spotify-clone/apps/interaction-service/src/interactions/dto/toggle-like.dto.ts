import { IsOptional, IsUUID } from 'class-validator';

export class ToggleLikeDto {
  @IsOptional()
  @IsUUID()
  songId?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;
}

