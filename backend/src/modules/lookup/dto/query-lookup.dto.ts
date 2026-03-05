import { IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryLookupDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  taxonomy?: string;
}
