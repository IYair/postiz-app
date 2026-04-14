import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageProvider, ImageOptions } from '../../ai.interfaces';
import { GEMINI_ASPECT_MAP } from '../../ai.types';

export class GeminiImageAdapter implements ImageProvider {
  private genAI: GoogleGenerativeAI;

  constructor(private apiKey: string, private model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<Buffer> {
    const aspectRatio = GEMINI_ASPECT_MAP[options?.aspectRatio ?? 'square'] ?? '1:1';

    const model = this.genAI.getGenerativeModel({ model: this.model });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'image/png',
        imageGenerationConfig: { aspectRatio },
      } as any,
    });

    const imagePart = result.response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error('Gemini returned no image data');
    }

    // Normalize: base64 -> Buffer
    return Buffer.from(imagePart.inlineData.data, 'base64');
  }
}
