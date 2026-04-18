import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class BrandKitDto {
  @IsBoolean()
  brandKitEnabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brandLogoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brandColors?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  brandTypography?: string | null;
}
