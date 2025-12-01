import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToCoreMessages, streamText } from 'ai';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getLLMText, source } from '@/lib/source';

function extractTextContent(message: { content?: unknown; parts?: unknown }): string {
  // Prefer "parts" (used by UIMessage) then "content" (used by provider messages)
  const segments = Array.isArray(message.parts)
    ? message.parts
    : Array.isArray(message.content)
      ? message.content
      : [];

  if (!Array.isArray(segments)) return '';

  return segments
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        if ('text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        if ('content' in part && typeof (part as { content?: unknown }).content === 'string') {
          return (part as { content: string }).content;
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('');
}

// Anthropic client will be created per request with validated API key

async function getDocsContext() {
  const pages = source.getPages();
  const docsTexts = await Promise.all(pages.map(getLLMText));
  return docsTexts.join('\n\n');
}

export async function POST(req: Request) {
  try {
    // Check for API key and trim whitespace
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key format (should start with sk-ant-)
    if (!apiKey.startsWith('sk-ant-')) {
      console.error('ANTHROPIC_API_KEY appears to be invalid format');
      console.error('Key starts with:', apiKey.substring(0, 10));
      return new Response(
        JSON.stringify({ 
          error: 'Invalid API key format',
          message: 'Anthropic API keys should start with "sk-ant-"'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create anthropic client with validated key
    const anthropicClient = createAnthropic({
      apiKey: apiKey,
    });

    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cookieStore = await cookies();
    let sessionId = cookieStore.get('chat_session_id')?.value;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    const referrer = req.headers.get('referer') ?? undefined;
    let path: string | undefined;
    if (referrer) {
      try {
        path = new URL(referrer).pathname;
      } catch {
        path = undefined;
      }
    }

    const userAgent = req.headers.get('user-agent') ?? undefined;

    const lastUser = messages
      .filter((msg: { role?: string }) => msg.role === 'user')
      .at(-1);

    // Get all documentation content
    let docsContext;
    try {
      docsContext = await getDocsContext();
    } catch (error) {
      console.error('Error getting docs context:', error);
      docsContext = 'Documentation context unavailable.';
    }

    // Use Claude Sonnet model
    const startedAt = Date.now();
    const result = streamText({
      model: anthropicClient('claude-sonnet-4-5-20250929'),
      system: `You are a helpful documentation assistant. Use the following documentation to answer questions accurately and concisely. Always cite specific sections when referencing the documentation.

Documentation:
${docsContext}`,
      messages: convertToCoreMessages(messages),
      onFinish: async () => {
        const userText = (() => {
          if (!lastUser) return '';
          if (typeof (lastUser as { content?: unknown }).content === 'string') {
            return (lastUser as { content?: string }).content ?? '';
          }
          return extractTextContent(lastUser as { content?: unknown; parts?: unknown });
        })();

        try {
          await prisma.chatSession.upsert({
            where: { id: sessionId },
            update: { lastActiveAt: new Date() },
            create: {
              id: sessionId,
              path,
              userAgent,
              referrer,
            },
          });

          const userContent = userText.trim();
          if (userContent.length > 0) {
            await prisma.chatMessage.create({
              data: {
                sessionId,
                role: 'user',
                content: userContent,
                createdAt: new Date(startedAt),
              },
            });
          }
        } catch (error) {
          console.error('Failed to log chat messages:', error);
        }
      },
      onError: (error) => {
        console.error('Stream error:', error);
        // Log specific model error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not_found_error')) {
          console.error('Model not available. Try using: claude-3-sonnet-20240229 or check your API key access.');
        }
      },
    });

    const response = result.toUIMessageStreamResponse();
    if (sessionId) {
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      response.headers.append(
        'Set-Cookie',
        `chat_session_id=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`,
      );
    }

    return response;
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
