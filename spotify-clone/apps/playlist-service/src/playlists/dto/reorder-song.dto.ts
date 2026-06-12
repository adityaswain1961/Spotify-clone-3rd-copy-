import { IsInt, IsUUID, Min } from 'class-validator';

export class ReorderSongDto {
  @IsUUID()
  songId!: string;

  @IsInt()
  @Min(1)
  newPosition!: number;
}
