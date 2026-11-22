import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ToggleLikeDto {
  @IsOptional()
  @IsUUID()
  songId?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  /**
   * Desired state. Send it: setting is idempotent, so a request replayed after an
   * offline period can never flip the like back. Omit it for legacy toggle behaviour.
   */
  @IsOptional()
  @IsBoolean()
  liked?: boolean;
}
