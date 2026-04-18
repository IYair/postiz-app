import { HttpException, Injectable } from '@nestjs/common';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { Organization } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

@Injectable()
export class MediaService {
  private storage = UploadFactory.createStorage();

  constructor(
    private _mediaRepository: MediaRepository,
    private _openAi: OpenaiService,
    private _subscriptionService: SubscriptionService,
    private _videoManager: VideoManager
  ) {}

  async deleteMedia(org: string, id: string) {
    return this._mediaRepository.deleteMedia(org, id);
  }

  getMediaById(id: string) {
    return this._mediaRepository.getMediaById(id);
  }

  async generateImage(
    prompt: string,
    org: Organization,
    generatePromptFirst?: boolean,
    userId?: string,
    aspectRatio: 'square' | 'landscape' | 'portrait' | 'story' = 'square',
    referenceImages?: { mimeType: string; base64: string }[]
  ) {
    const generating = await this._subscriptionService.useCredit(
      org,
      'ai_images',
      async () => {
        prompt = this.applyBrandContext(prompt, org);

        // When brand kit is enabled and the caller didn't supply references,
        // auto-attach the brand logo so the generator uses it as style anchor.
        let effectiveReferences = referenceImages;
        if (
          org.brandKitEnabled &&
          org.brandLogoUrl &&
          (!effectiveReferences || effectiveReferences.length === 0)
        ) {
          const logoRef = await this.fetchAsReference(org.brandLogoUrl);
          if (logoRef) {
            effectiveReferences = [logoRef];
          }
        }

        if (generatePromptFirst) {
          prompt = await this._openAi.generatePromptForPicture(userId!, prompt);
        }
        return this._openAi.generateImage(
          userId!,
          prompt,
          !!generatePromptFirst,
          aspectRatio,
          effectiveReferences
        );
      }
    );

    return generating;
  }

  async expandImagePrompt(
    userId: string,
    prompt: string,
    org: Organization
  ) {
    const seed = this.applyBrandContext(prompt, org);
    return this._openAi.expandPictureOnly(userId, seed);
  }

  private applyBrandContext(prompt: string, org: Organization) {
    const blocks: string[] = [];

    if (org.imagePromptExtra) {
      blocks.push(
        `<!-- brand style guide -->\n${org.imagePromptExtra}\n<!-- /brand style guide -->`
      );
    }

    if (org.brandKitEnabled) {
      const kit: string[] = [];
      if (org.brandColors) kit.push(`Brand colors: ${org.brandColors}`);
      if (org.brandTypography) kit.push(`Typography: ${org.brandTypography}`);
      if (kit.length) {
        blocks.push(`<!-- brand kit -->\n${kit.join('\n')}\n<!-- /brand kit -->`);
      }
    }

    if (!blocks.length) return prompt;
    return `${prompt}\n\n${blocks.join('\n\n')}`;
  }

  private async fetchAsReference(
    url: string
  ): Promise<{ mimeType: string; base64: string } | null> {
    // The URL is organization-admin configurable, so block SSRF vectors
    // (loopback, private, link-local) via the same guard used for webhooks
    // and cap the request with a timeout so a slow host can't stall gen.
    if (!(await isSafePublicHttpsUrl(url))) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || 'image/png')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!contentType.startsWith('image/')) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 4 * 1024 * 1024) return null;
      return { mimeType: contentType, base64: buffer.toString('base64') };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }


  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._mediaRepository.saveFile(org, fileName, filePath, originalName);
  }

  getMedia(org: string, page: number, search?: string) {
    return this._mediaRepository.getMedia(org, page, search);
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._mediaRepository.saveMediaInformation(org, data);
  }

  getVideoOptions() {
    return this._videoManager.getAllVideos();
  }

  async generateVideoAllowed(org: Organization, type: string) {
    const video = this._videoManager.getVideoByName(type);
    if (!video) {
      throw new Error(`Video type ${type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    return true;
  }

  async generateVideo(org: Organization, body: VideoDto, userId?: string) {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      'ai_videos'
    );

    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.VIDEOS_PER_MONTH,
      });
    }

    const video = this._videoManager.getVideoByName(body.type);
    if (!video) {
      throw new Error(`Video type ${body.type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    console.log(body.customParams);
    await video.instance.processAndValidate(body.customParams);
    console.log('no err');

    const paramsWithUserId = { ...body.customParams, userId };

    return await this._subscriptionService.useCredit(
      org,
      'ai_videos',
      async () => {
        const loadedData = await video.instance.process(
          body.output,
          paramsWithUserId
        );

        const file = await this.storage.uploadSimple(loadedData);
        return this.saveFile(org.id, file.split('/').pop(), file);
      }
    );
  }

  async videoFunction(identifier: string, functionName: string, body: any) {
    const video = this._videoManager.getVideoByName(identifier);
    if (!video) {
      throw new Error(`Video with identifier ${identifier} not found`);
    }

    // @ts-ignore
    const functionToCall = video.instance[functionName];
    if (
      typeof functionToCall !== 'function' ||
      this._videoManager.checkAvailableVideoFunction(functionToCall)
    ) {
      throw new HttpException(
        `Function ${functionName} not found on video instance`,
        400
      );
    }

    return functionToCall(body);
  }
}
