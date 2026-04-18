import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// 4MB decoded per image. Base64 grows ~33% so the encoded string is ~5.5MB
// worst case; class-validator runs on the encoded payload.
const MAX_BASE64_LEN = 5_700_000;

export class ImageReferenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  mimeType: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BASE64_LEN, {
    message: 'reference image exceeds 4MB decoded',
  })
  base64: string;
}

export class GenerateImageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prompt: string;

  @IsOptional()
  @IsIn(['square', 'landscape', 'portrait', 'story'])
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'story';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ImageReferenceDto)
  referenceImages?: ImageReferenceDto[];

  @IsOptional()
  @IsBoolean()
  skipExpansion?: boolean;
}
