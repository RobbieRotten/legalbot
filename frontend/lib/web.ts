import { Document } from '@langchain/core/documents';
import FirecrawlApp from '@mendable/firecrawl-js';

/**
 * Fetch a web page using Firecrawl and return its contents as a Document.
 * Requires the FIRECRAWL_API_KEY environment variable to be set.
 */
export async function processUrl(url: string): Promise<Document[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set');
  }
  const app = new FirecrawlApp({ apiKey });
  const result = await app.scrapeUrl(url, { formats: ['markdown'] });
  const content = result?.data?.markdown || '';
  return [
    {
      pageContent: content,
      metadata: { source: url },
    },
  ];
}
