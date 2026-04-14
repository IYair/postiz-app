// libraries/nestjs-libraries/src/ai/ai.types.ts
import { z } from 'zod';

export const TEXT_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export const IMAGE_PROVIDERS = ['openai', 'gemini'] as const;

export type TextProviderType = (typeof TEXT_PROVIDERS)[number];
export type ImageProviderType = (typeof IMAGE_PROVIDERS)[number];

export const EncryptedKeysSchema = z.object({
  anthropic: z.string().optional(),
  openai: z.string().optional(),
  gemini: z.string().optional(),
});

export type EncryptedKeys = z.infer<typeof EncryptedKeysSchema>;

// DALL-E size mapping
export const DALLE_SIZE_MAP: Record<string, string> = {
  square: '1024x1024',
  landscape: '1792x1024',
  portrait: '1024x1792',
};

// Gemini Imagen aspect ratio mapping
export const GEMINI_ASPECT_MAP: Record<string, string> = {
  square: '1:1',
  landscape: '16:9',
  portrait: '9:16',
};

// Default models per provider
export const DEFAULT_TEXT_MODELS: Record<TextProviderType, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4.1',
  gemini: 'gemini-2.5-flash',
};

export const DEFAULT_IMAGE_MODELS: Record<ImageProviderType, string> = {
  openai: 'dall-e-3',
  gemini: 'gemini-3.1-flash-image-preview',
};
