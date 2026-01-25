import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { sync as md5File } from 'md5-file';
import prisma from '../prisma';

export class FileProcessorService {
  /**
   * Process a file:
   * 1. Calculate hash to check if it really changed.
   * 2. Update/Create KnowledgeSource record.
   * 3. Parse content based on file type.
   * 4. Update SymptomKnowledge if applicable.
   */
  async processFile(filePath: string, rootDir: string) {
    try {
      if (!fs.existsSync(filePath)) {
        await this.handleFileDelete(filePath, rootDir);
        return;
      }

      const relativePath = path.relative(rootDir, filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const hash = md5File(filePath);

      // Check if file exists in DB
      const existingSource = await prisma.knowledgeSource.findUnique({
        where: { filePath: relativePath }
      });

      if (existingSource && existingSource.hash === hash && existingSource.status === 'processed') {
        // No change
        console.log(`[FileProcessor] Skipping unchanged file: ${relativePath}`);
        return;
      }

      console.log(`[FileProcessor] Processing file: ${relativePath}`);

      // Upsert KnowledgeSource
      const source = await prisma.knowledgeSource.upsert({
        where: { filePath: relativePath },
        update: {
          hash,
          status: 'processing',
          lastProcessedAt: new Date(),
          errorMessage: null
        },
        create: {
          filePath: relativePath,
          fileName,
          fileType: ext.replace('.', ''),
          hash,
          status: 'processing',
          lastProcessedAt: new Date()
        }
      });

      // Parse content
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        if (ext === '.md') {
          await this.processMarkdown(source.id, content);
        } else if (ext === '.json') {
          await this.processJson(source.id, content);
        } else {
          // For other files, just mark as processed but do not update SymptomKnowledge
          console.log(`[FileProcessor] File type ${ext} stored but not parsed into symptoms.`);
        }

        // Mark success
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: { status: 'processed' }
        });

      } catch (parseError: any) {
        console.error(`[FileProcessor] Error parsing ${relativePath}:`, parseError);
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: { 
            status: 'error', 
            errorMessage: parseError.message 
          }
        });
      }

    } catch (error) {
      console.error(`[FileProcessor] System error processing ${filePath}:`, error);
    }
  }

  async handleFileDelete(filePath: string, rootDir: string) {
    const relativePath = path.relative(rootDir, filePath);
    console.log(`[FileProcessor] File deleted: ${relativePath}`);
    
    // Find the source record
    const source = await prisma.knowledgeSource.findUnique({
      where: { filePath: relativePath },
      include: { symptoms: true }
    });

    if (source) {
      // Disconnect symptoms (set sourceFileId to null) or delete them?
      // Since this system manages the KB, maybe we should delete the symptoms if they were created by this file.
      // But symptoms might be valuable. Let's just unlink for now or check if we want strict sync.
      // Strict sync: if file is gone, the knowledge provided by it is gone.
      
      // Let's go with strict sync for now: Delete connected symptoms if they rely solely on this file.
      // Actually, Prisma relation `SymptomKnowledge` -> `KnowledgeSource` is optional.
      // We will set sourceFileId to null, or delete the symptom if appropriate.
      // For now, let's just delete the source record, and set the foreign key to null (onDelete: SetNull is not explicitly defined in schema but default behavior depends on DB).
      // Let's explicitly delete symptoms that are linked to this source file, assuming 1:1 or 1:N mapping where the file is the authority.
      
      await prisma.symptomKnowledge.deleteMany({
        where: { sourceFileId: source.id }
      });

      await prisma.knowledgeSource.delete({
        where: { id: source.id }
      });
    }
  }

  private async processMarkdown(sourceId: number, content: string) {
    const { data, content: body } = matter(content);
    
    // Check if it's a symptom definition
    if (data.symptomKey && data.displayName) {
      const sections = this.parseMarkdownSections(body);
      
      await prisma.symptomKnowledge.upsert({
        where: { symptomKey: data.symptomKey },
        update: {
          displayName: data.displayName,
          requiredQuestions: sections.requiredQuestions || [],
          associatedSymptoms: sections.associatedSymptoms || [],
          redFlags: sections.redFlags || [],
          physicalSigns: sections.physicalSigns || [],
          sourceFileId: sourceId,
          version: { increment: 1 }
        },
        create: {
          symptomKey: data.symptomKey,
          displayName: data.displayName,
          requiredQuestions: sections.requiredQuestions || [],
          associatedSymptoms: sections.associatedSymptoms || [],
          redFlags: sections.redFlags || [],
          physicalSigns: sections.physicalSigns || [],
          sourceFileId: sourceId
        }
      });
      
      // Update metadata in source
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { metadata: data as any }
      });
    }
  }

  private async processJson(sourceId: number, content: string) {
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
        // Bulk import
        for (const item of data) {
            if (item.symptomKey && item.displayName) {
                await this.upsertSymptom(sourceId, item);
            }
        }
    } else if (data.symptomKey && data.displayName) {
        // Single import
        await this.upsertSymptom(sourceId, data);
    }
  }

  private async upsertSymptom(sourceId: number, data: any) {
      await prisma.symptomKnowledge.upsert({
        where: { symptomKey: data.symptomKey },
        update: {
          displayName: data.displayName,
          requiredQuestions: data.requiredQuestions || [],
          associatedSymptoms: data.associatedSymptoms || [],
          redFlags: data.redFlags || [],
          physicalSigns: data.physicalSigns || [],
          sourceFileId: sourceId,
          version: { increment: 1 }
        },
        create: {
          symptomKey: data.symptomKey,
          displayName: data.displayName,
          requiredQuestions: data.requiredQuestions || [],
          associatedSymptoms: data.associatedSymptoms || [],
          redFlags: data.redFlags || [],
          physicalSigns: data.physicalSigns || [],
          sourceFileId: sourceId
        }
      });
  }

  private parseMarkdownSections(body: string) {
    const lines = body.split('\n');
    const result: any = {
      requiredQuestions: [],
      associatedSymptoms: [],
      redFlags: [],
      physicalSigns: []
    };
    
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        // H1 ignore or title
      } else if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        const title = trimmed.replace(/^#+\s+/, '').toLowerCase();
        if (title.includes('question') || title.includes('问题')) currentSection = 'requiredQuestions';
        else if (title.includes('associated') || title.includes('symptom') || title.includes('伴随')) currentSection = 'associatedSymptoms';
        else if (title.includes('red flag') || title.includes('警惕') || title.includes('危重')) currentSection = 'redFlags';
        else if (title.includes('physical') || title.includes('sign') || title.includes('体征')) currentSection = 'physicalSigns';
        else currentSection = '';
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const item = trimmed.substring(2).trim();
        if (currentSection && result[currentSection]) {
          result[currentSection].push(item);
        }
      }
    }
    
    return result;
  }
}

export const fileProcessor = new FileProcessorService();
