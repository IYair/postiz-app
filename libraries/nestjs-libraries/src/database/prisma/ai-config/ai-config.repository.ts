import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiConfigRepository {
  constructor(private _aiConfig: PrismaRepository<'userAiConfig'>) {}

  async findByUserId(userId: string) {
    return this._aiConfig.model.userAiConfig.findUnique({
      where: { userId },
    });
  }

  async upsert(
    userId: string,
    data: {
      textProvider: string;
      imageProvider?: string | null;
      textModel?: string | null;
      imageModel?: string | null;
      encryptedKeys: Record<string, string>;
    }
  ) {
    return this._aiConfig.model.userAiConfig.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async deleteByUserId(userId: string) {
    return this._aiConfig.model.userAiConfig.delete({
      where: { userId },
    });
  }
}
