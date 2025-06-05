import { Document } from '@langchain/core/documents';

/**
 * Convert a Markdown file into a list of LangChain Documents.
 * The entire text of the file is used as a single document with
 * basic metadata about the filename.
 */
export async function processMarkdown(file: File): Promise<Document[]> {
  const text = await file.text();
  return [
    {
      pageContent: text,
      metadata: { filename: file.name },
    },
  ];
}
