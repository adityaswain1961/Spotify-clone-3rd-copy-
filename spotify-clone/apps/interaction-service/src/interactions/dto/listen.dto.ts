import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsOptional, IsUUID, ValidateNested } from 'class-validator';

export class ListenDto {
  @IsUUID()
  songId!: string;

  /** When the listen happened. Lets the app replay listens recorded while offline. */
  @IsOptional()
  @IsISO8601()
  listenedAt?: string;
}

export class ListenBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ListenDto)
  events!: ListenDto[];
}
