import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export type SearchType = 'song' | 'artist' | 'playlist' | 'all';

export class SearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsIn(['song', 'artist', 'playlist', 'all'])
  type?: SearchType = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number = 10;
}

