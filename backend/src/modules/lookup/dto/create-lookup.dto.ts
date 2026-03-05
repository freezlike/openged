import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLookupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  taxonomy?: string;
}
