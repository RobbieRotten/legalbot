// app/api/ingest/route.ts
import { indexConfig } from '@/constants/graphConfigs';
import { langGraphServerClient } from '@/lib/langgraph-server';
import { processPDF } from '@/lib/pdf';
import { processMarkdown } from '@/lib/markdown';
import { processUrl } from '@/lib/web';
import { Document } from '@langchain/core/documents';
import { NextRequest, NextResponse } from 'next/server';

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'text/markdown', 'text/plain'];
const MAX_URLS = 5;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.LANGGRAPH_INGESTION_ASSISTANT_ID) {
      return NextResponse.json(
        {
          error:
            'LANGGRAPH_INGESTION_ASSISTANT_ID is not set in your environment variables',
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
  const files: File[] = [];
  const urls: string[] = [];

    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        files.push(value);
      }
      if (key === 'urls' && typeof value === 'string') {
        urls.push(value);
      }
    }

    if (files.length === 0 && urls.length === 0) {
      return NextResponse.json({ error: 'No files or URLs provided' }, { status: 400 });
    }

    // Validate file count
    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Too many files. Maximum 5 files allowed.' },
        { status: 400 },
      );
    }

    if (urls.length > MAX_URLS) {
      return NextResponse.json(
        { error: 'Too many URLs. Maximum 5 URLs allowed.' },
        { status: 400 },
      );
    }

    // Validate file types and sizes
    const invalidFiles = files.filter((file) => {
      return (
        !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
      );
    });

    if (invalidFiles.length > 0) {
      return NextResponse.json(
        {
          error:
            'Invalid file types or file size exceeds limit',
        },
        { status: 400 },
      );
    }

    // Process all PDFs into Documents
    const allDocs: Document[] = [];
    for (const file of files) {
      try {
        let docs: Document[] = [];
        if (file.type === 'application/pdf') {
          docs = await processPDF(file);
        } else {
          docs = await processMarkdown(file);
        }
        allDocs.push(...docs);
      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        // Continue processing other files; errors are logged
      }
    }

    for (const url of urls) {
      try {
        const docs = await processUrl(url);
        allDocs.push(...docs);
      } catch (error: any) {
        console.error(`Error processing URL ${url}:`, error);
      }
    }

    if (!allDocs.length) {
      return NextResponse.json(
        { error: 'No valid documents extracted from provided data' },
        { status: 500 },
      );
    }

    // Run the ingestion graph
    const thread = await langGraphServerClient.createThread();
    const ingestionRun = await langGraphServerClient.client.runs.wait(
      thread.thread_id,
      'ingestion_graph',
      {
        input: {
          docs: allDocs,
        },
        config: {
          configurable: {
            ...indexConfig,
          },
        },
      },
    );

    return NextResponse.json({
      message: 'Documents ingested successfully',
      threadId: thread.thread_id,
    });
  } catch (error: any) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { error: 'Failed to process files', details: error.message },
      { status: 500 },
    );
  }
}
