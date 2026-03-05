import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
