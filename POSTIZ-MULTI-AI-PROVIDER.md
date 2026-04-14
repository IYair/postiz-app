> **SUPERSEDED:** This document is historical reference only. The implementation spec is at
> `docs/superpowers/specs/2026-04-13-postiz-multi-ai-provider-design.md`.
> Do not use this document for implementation guidance.

# Postiz Multi-AI Provider Integration

## Contexto

Fork de [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) en [IYair/postiz-app](https://github.com/IYair/postiz-app) para integrar Claude (texto) y Gemini Imagen (imagenes) como proveedores nativos de IA.

**Motivacion:** Postiz hardcodea OpenAI en 11 archivos. No hay abstraccion de proveedor. Hay 2 PRs abiertos (#1075, #1167) pidiendo soporte para custom base URL pero llevan meses sin review del mantenedor. Licencia AGPL-3.0 (fork debe ser publico).

**Instancia actual:** Desplegado en Dokploy (king.alianzadev.codes), accesible en postiz.alianzadev.codes. Actualmente usa LiteLLM como proxy temporal para traducir llamadas OpenAI a Claude/Gemini.

---

## Arquitectura actual de IA en Postiz

### SDKs utilizados

| SDK | Donde se usa |
|-----|-------------|
| `openai` (nativo) | openai.service.ts, copilot.controller.ts |
| `@ai-sdk/openai` (Vercel AI SDK) | load.tools.service.ts (Mastra agent) |
| `@langchain/openai` (LangChain) | autopost.service.ts, agent.graph.service.ts, agent.graph.insert.service.ts |

### Modelos hardcodeados

| Modelo | Archivo | Proposito |
|--------|---------|-----------|
| `dall-e-3` | `openai.service.ts` | Generacion de imagenes principal |
| `dall-e-3` | `agent.graph.service.ts` | Pipeline de contenido (LangChain DallEAPIWrapper) |
| `gpt-image-1` | `autopost.service.ts` | Autopost RSS (LangChain DallEAPIWrapper) |
| `gpt-4.1` | `openai.service.ts` (5 metodos) | Prompt expansion, voz, posts, slides, website extraction |
| `gpt-4.1` | `copilot.controller.ts` | CopilotKit adapter (x2: chat y agent) |
| `gpt-4.1` | `autopost.service.ts` | Generacion de descripcion (LangChain ChatOpenAI) |
| `gpt-4.1` | `agent.graph.service.ts` | Pipeline completo (LangChain ChatOpenAI) |
| `gpt-4o-2024-08-06` | `agent.graph.insert.service.ts` | Clasificacion de posts (LangChain ChatOpenAI) |
| `gpt-5.2` | `load.tools.service.ts` | Mastra agent (Vercel AI SDK) |

---

## Archivos a modificar (por prioridad)

### Prioridad 1 - Core (generacion de imagenes y texto)

1. **`libraries/nestjs-libraries/src/openai/openai.service.ts`**
   - Servicio principal singleton. Instancia `new OpenAI()` a nivel de modulo.
   - 7 metodos: `generateImage`, `generatePromptForPicture`, `generateVoiceFromText`, `generatePosts`, `extractWebsiteText`, `separatePosts`, `generateSlidesFromText`
   - Todos usan `gpt-4.1` para texto y `dall-e-3` para imagenes
   - `generateImage()` retorna URL o b64_json segun parametro `isUrl`

2. **`apps/backend/src/api/routes/media.controller.ts`**
   - `generateImage()`: retorna `data:image/png;base64,` + b64 (no guarda en storage)
   - `generateImageFromText()`: genera prompt mejorado, genera imagen, sube a storage via `uploadSimple(url)`
   - **Bug con proveedores no-OpenAI:** `uploadSimple` espera una URL pero Gemini devuelve b64. Necesita manejar ambos formatos.

3. **`libraries/nestjs-libraries/src/upload/local.storage.ts`**
   - `uploadSimple(path)`: hace `fetch(path)` asumiendo que es URL. No maneja b64.

### Prioridad 2 - Copilot y Agente

4. **`apps/backend/src/api/routes/copilot.controller.ts`**
   - Usa `OpenAIAdapter({ model: 'gpt-4.1' })` de CopilotKit
   - Endpoint `/copilot/chat` (simple) y `/copilot/agent` (Mastra)

5. **`libraries/nestjs-libraries/src/chat/load.tools.service.ts`**
   - Mastra agent con `openai('gpt-5.2')` via `@ai-sdk/openai`
   - Cambiar a `@ai-sdk/anthropic` con `anthropic('claude-sonnet-4-20250514')` es directo

### Prioridad 3 - Pipelines LangChain

6. **`libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts`**
   - `ChatOpenAI({ model: 'gpt-4.1' })` y `DallEAPIWrapper({ model: 'gpt-image-1' })`
   - Usar `ChatGoogleGenerativeAI` de `@langchain/google-genai` y wrapper custom para Imagen

7. **`libraries/nestjs-libraries/src/agent/agent.graph.service.ts`**
   - Pipeline de contenido con LangChain: `ChatOpenAI` + `DallEAPIWrapper({ model: 'dall-e-3' })`
   - Mismo approach que autopost

8. **`libraries/nestjs-libraries/src/agent/agent.graph.insert.service.ts`**
   - Solo texto: `ChatOpenAI({ model: 'gpt-4o-2024-08-06' })`

### Prioridad 4 - Secundarios

9. **`libraries/nestjs-libraries/src/videos/images-slides/images.slides.ts`**
   - Usa `OpenaiService.generateSlidesFromText()` (ya cubierto por P1)
   - Tambien usa `FalService` para imagenes (no OpenAI)

10. **`libraries/nestjs-libraries/src/3rdparties/heygen/heygen.provider.ts`**
    - Usa `OpenaiService.generateVoiceFromText()` (ya cubierto por P1)

---

## Plan de implementacion

### Fase 1: Abstraccion de proveedor

Crear una interfaz `AIProviderService` con metodos:

```typescript
interface TextProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  structuredOutput<T>(messages: Message[], schema: ZodSchema<T>): Promise<T>;
}

interface ImageProvider {
  generate(prompt: string, options?: ImageOptions): Promise<{ url?: string; b64?: string }>;
}
```

### Fase 2: Implementaciones

- `OpenAITextProvider` (existente, refactorizado)
- `AnthropicTextProvider` (nuevo, usa `@anthropic-ai/sdk`)
- `GeminiTextProvider` (nuevo, usa `@google/generative-ai`)
- `OpenAIImageProvider` (existente, refactorizado)
- `GeminiImageProvider` (nuevo, usa Imagen API)

### Fase 3: Variables de entorno

```env
# Seleccion de proveedor (default: openai para backward compat)
AI_TEXT_PROVIDER=anthropic    # openai | anthropic | gemini
AI_IMAGE_PROVIDER=gemini      # openai | gemini

# Modelos (opcionales, con defaults sensatos)
AI_TEXT_MODEL=claude-sonnet-4-20250514
AI_IMAGE_MODEL=imagen-4.0-generate-001

# API Keys (solo las del proveedor seleccionado)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

### Fase 4: Refactor de LangChain paths

Reemplazar `ChatOpenAI` y `DallEAPIWrapper` con los equivalentes de LangChain:
- `@langchain/anthropic` -> `ChatAnthropic`
- `@langchain/google-genai` -> `ChatGoogleGenerativeAI`

### Fase 5: Fix de uploadSimple

Modificar `local.storage.ts` para manejar tanto URLs como b64:

```typescript
async uploadSimple(input: string) {
  let buffer: Buffer;
  let contentType: string;
  
  if (input.startsWith('http')) {
    const response = await fetch(input);
    buffer = Buffer.from(await response.arrayBuffer());
    contentType = response.headers.get('content-type');
  } else {
    // b64 data
    buffer = Buffer.from(input, 'base64');
    contentType = 'image/png';
  }
  // ... rest of save logic
}
```

---

## Infraestructura actual

- **Servidor:** Homelab via Tailscale (100.91.144.24), SSH user `sleeping_king`
- **Dokploy:** king.alianzadev.codes (API key en env vars del proyecto)
- **Postiz:** postiz.alianzadev.codes (v2.21.6)
- **Compose ID:** VsKEKfZcIEq_4ND6wxrB6
- **LiteLLM:** Corriendo como servicio en el mismo compose, config en /opt/litellm/config.yaml
- **DB:** PostgreSQL 17-alpine, user postiz
- **Temporal:** temporalio/auto-setup:1.28.2

### Cuentas conectadas

| Plataforma | Cuenta | Estado |
|-----------|--------|--------|
| Facebook | Alianza Dev | Conectado |
| Facebook | M&S Solucion | Conectado |
| Instagram | mssolucionoficial | Conectado |
| Instagram | IYair CC | Conectado |
| LinkedIn | Yair Chan | Conectado |
| X (Twitter) | @AlianzaDev | Pendiente (necesita creditos API) |
| TikTok | AlianzaDev | En review por TikTok |

### API Keys configuradas

Todas las keys estan en las env vars del compose en Dokploy:
- FACEBOOK_APP_ID / FACEBOOK_APP_SECRET
- INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
- LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
- X_API_KEY / X_API_SECRET
- TIKTOK_CLIENT_ID / TIKTOK_CLIENT_SECRET
- GEMINI_API_KEY
- ANTHROPIC_API_KEY
- LITELLM_MASTER_KEY

---

## Issues y PRs relacionados en upstream

| # | Tipo | Titulo | Estado | Nota |
|---|------|--------|--------|------|
| #1074 | Issue | Support ENV Variables for Custom OpenAI Base URL & Model | Abierto | Sin respuesta del mantenedor |
| #1075 | PR | feat: add support for custom OpenAI configurations | Abierto (draft) | Sin review en 5 meses |
| #1167 | PR | feat: add openai compatible baseURL endpoint | Abierto | Sin review en 2 meses |
| #256 | Issue | Support custom openAI endpoints for AI selfhosters | Cerrado (stale) | Mantenedor dijo "No posible por CopilotKit" (2024) |
| #1197 | Issue | LinkedIn NotEnoughScopes error | Abierto | Fix en PR #1134 (mergeado) |
