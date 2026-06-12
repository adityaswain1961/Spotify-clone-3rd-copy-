import { IsUUID } from 'class-validator';

export class ListenDto {
  @IsUUID()
  songId!: string;
}

