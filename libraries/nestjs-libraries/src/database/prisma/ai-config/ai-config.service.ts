import { Injectable } from '@nestjs/common';
import { AiConfigRepository } from '@gitroom/nestjs-libraries/database/prisma/ai-config/ai-config.repository';
import { encryptApiKey, decryptApiKey } from '@gitroom/nestjs-libraries/ai/ai.encryption';
import {
  EncryptedKeysSchema,
  TextProviderType,
  ImageProviderType,
} from '@gitroom/nestjs-libraries/ai/ai.types';

export interface UserAiConfigDto {
  textProvider: TextProviderType;
  imageProvider?: ImageProviderType | null;
  textModel?: string | null;
  imageModel?: string | null;
  keys: { anthropic?: string; openai?: string; gemini?: string };
}

export interface UserAiConfigResponse {
  textProvider: TextProviderType;
  imageProvider?: ImageProviderType | null;
  textModel?: string | null;
  imageModel?: string | null;
  keyHints: { anthropic?: string; openai?: string; gemini?: string };
}

@Injectable()
export class AiConfigService {
  constructor(private _aiConfigRepository: AiConfigRepository) {}

  async getConfig(userId: string): Promise<UserAiConfigResponse | null> {
    const config = await this._aiConfigRepository.findByUserId(userId);
    if (!config) return null;

    const parsed = EncryptedKeysSchema.parse(config.encryptedKeys);
    const keyHints: Record<string, string> = {};

    for (const [provider, encKey] of Object.entries(parsed)) {
      if (encKey) {
        const decrypted = decryptApiKey(encKey);
        keyHints[provider] = '****' + decrypted.slice(-4);
      }
    }

    return {
      textProvider: config.textProvider as TextProviderType,
      imageProvider: config.imageProvider as ImageProviderType | null,
      textModel: config.textModel,
      imageModel: config.imageModel,
      keyHints,
    };
  }

  async getDecryptedKeys(userId: string) {
    const row = await this._aiConfigRepository.findByUserId(userId);
    if (!row) return null;

    const parsed = EncryptedKeysSchema.parse(row.encryptedKeys);
    const keys: Record<string, string> = {};

    for (const [provider, encKey] of Object.entries(parsed)) {
      if (encKey) keys[provider] = decryptApiKey(encKey);
    }

    return {
      config: {
        textProvider: row.textProvider as TextProviderType,
        imageProvider: row.imageProvider as ImageProviderType | null,
        textModel: row.textModel,
        imageModel: row.imageModel,
      },
      keys,
    };
  }

  async saveConfig(userId: string, dto: UserAiConfigDto) {
    const encryptedKeys: Record<string, string> = {};

    for (const [provider, key] of Object.entries(dto.keys)) {
      if (key) encryptedKeys[provider] = encryptApiKey(key);
    }

    return this._aiConfigRepository.upsert(userId, {
      textProvider: dto.textProvider,
      imageProvider: dto.imageProvider,
      textModel: dto.textModel,
      imageModel: dto.imageModel,
      encryptedKeys,
    });
  }

  async deleteConfig(userId: string) {
    return this._aiConfigRepository.deleteByUserId(userId);
  }
}
