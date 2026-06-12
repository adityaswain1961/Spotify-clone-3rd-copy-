import { IsString, IsUUID } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsUUID()
  refreshToken!: string;
}
