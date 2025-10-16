import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToCoreMessages, streamText } from 'ai';
import { getLLMText, source } from '@/lib/source';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getDocsContext() {
  const pages = source.getPages();
  const docsTexts = await Promise.all(pages.map(getLLMText));
  return docsTexts.join('\n\n');
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Get all documentation content
  const docsContext = await getDocsContext();

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: `You are a helpful documentation assistant. Use the following documentation to answer questions accurately and concisely. Always cite specific sections when referencing the documentation.

Documentation:
${docsContext}`,
    messages: convertToCoreMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
