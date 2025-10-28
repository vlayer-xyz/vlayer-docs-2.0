import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToCoreMessages, streamText } from 'ai';
import { getLLMText, source } from '@/lib/source';

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

    // Get all documentation content
    let docsContext;
    try {
      docsContext = await getDocsContext();
    } catch (error) {
      console.error('Error getting docs context:', error);
      docsContext = 'Documentation context unavailable.';
    }

    // Use Claude Sonnet model
    const result = streamText({
      model: anthropicClient('claude-sonnet-4-5-20250929'),
      system: `You are a helpful documentation assistant. Use the following documentation to answer questions accurately and concisely. Always cite specific sections when referencing the documentation.

Documentation:
${docsContext}`,
      messages: convertToCoreMessages(messages),
      onError: (error) => {
        console.error('Stream error:', error);
        // Log specific model error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not_found_error')) {
          console.error('Model not available. Try using: claude-3-sonnet-20240229 or check your API key access.');
        }
      },
    });

    return result.toUIMessageStreamResponse();
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
