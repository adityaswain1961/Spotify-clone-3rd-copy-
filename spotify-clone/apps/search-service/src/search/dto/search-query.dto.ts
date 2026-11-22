import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const SEARCH_TYPES = ['song', 'artist', 'playlist', 'all'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export class SearchQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type: SearchType = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size = 20;
}
