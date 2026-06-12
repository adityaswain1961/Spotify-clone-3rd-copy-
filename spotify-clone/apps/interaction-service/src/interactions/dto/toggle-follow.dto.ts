import { IsUUID } from 'class-validator';

export class ToggleFollowDto {
  @IsUUID()
  artistId!: string;
}

