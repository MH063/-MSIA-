import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import prisma from '../prisma';
import { createHash } from 'crypto';
import { eventBus } from './eventBus.service';

export class FileProcessorService {
  private static readonly PROCESSOR_VERSION = '2026-02-01-2';
  private queue: Array<{ filePath: string; rootDir: string }> = [];
  private processing = 0;
  private maxConcurrency = 2;

  public enqueue(filePath: string, rootDir: string) {
    this.queue.push({ filePath, rootDir });
    this.schedule();
  }

  private schedule() {
    while (this.processing < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.processing++;
      this.processFile(task.filePath, task.rootDir)
        .catch((error) => {
          console.error(`[FileProcessor] Task error:`, error);
        })
        .finally(() => {
          this.processing--;
          this.schedule();
        });
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const hash = createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

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
      const hash = await this.computeFileHash(filePath);

      // Check if file exists in DB
      const existingSource = await prisma.knowledgeSource.findUnique({
        where: { filePath: relativePath }
      });

      const sourceMeta = (existingSource?.metadata || null) as Record<string, unknown> | null;
      const metaVersion = sourceMeta ? String(sourceMeta['processorVersion'] || '') : '';
      const canSkip =
        existingSource &&
        existingSource.hash === hash &&
        existingSource.status === 'processed' &&
        metaVersion === FileProcessorService.PROCESSOR_VERSION;

      if (canSkip) {
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
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
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
        eventBus.broadcast('knowledge_updated', { at: new Date().toISOString() });

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
      eventBus.broadcast('knowledge_updated', { at: new Date().toISOString() });
    }
  }

  private async processMarkdown(sourceId: number, content: string) {
    const { data, content: body } = matter(content);
    
    // Check if it's a symptom definition
    if (data.symptomKey && data.displayName) {
      const sections = this.parseMarkdownSections(body);
      const requiredQuestions = this.toStringArray(sections.requiredQuestions);
      const associatedSymptoms = this.toStringArray(sections.associatedSymptoms);
      const redFlags = this.toStringArray(sections.redFlags);
      const physicalSigns = this.toStringArray(sections.physicalSigns);
      
      await prisma.symptomKnowledge.upsert({
        where: { symptomKey: data.symptomKey },
        update: {
          displayName: data.displayName,
          requiredQuestions,
          associatedSymptoms,
          redFlags,
          physicalSigns,
          category: (data as any).category || undefined,
          priority: (data as any).priority || undefined,
          questions: requiredQuestions,
          physicalExamination: physicalSigns,
          differentialPoints: this.toStringArray((data as any).differentialPoints),
          sourceFileId: sourceId,
          version: { increment: 1 }
        },
        create: {
          symptomKey: data.symptomKey,
          displayName: data.displayName,
          requiredQuestions,
          associatedSymptoms,
          redFlags,
          physicalSigns,
          category: (data as any).category || undefined,
          priority: (data as any).priority || undefined,
          questions: requiredQuestions,
          physicalExamination: physicalSigns,
          differentialPoints: this.toStringArray((data as any).differentialPoints),
          sourceFileId: sourceId
        }
      });

      console.log(`[FileProcessor] Markdown upserted: ${String(data.symptomKey)}`, {
        requiredQuestions: requiredQuestions.length,
        associatedSymptoms: associatedSymptoms.length,
        redFlags: redFlags.length,
        physicalSigns: physicalSigns.length,
      });
      
      // Update metadata in source
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { metadata: { ...(data as any), processorVersion: FileProcessorService.PROCESSOR_VERSION } as any }
      });
    }
  }

  private async processJson(sourceId: number, content: string) {
    const data = JSON.parse(String(content || '').replace(/^\uFEFF/, ''));
    
    if (Array.isArray(data)) {
        // Bulk import
        let imported = 0;
        for (const item of data) {
            if (item.symptomKey && item.displayName) {
                await this.upsertSymptom(sourceId, item);
                imported += 1;
            }
        }
        await prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: {
            metadata: {
              processorVersion: FileProcessorService.PROCESSOR_VERSION,
              importedCount: imported,
              mode: 'bulk',
            } as any
          }
        });
        console.log(`[FileProcessor] JSON bulk imported`, { sourceId, importedCount: imported });
    } else if (data.symptomKey && data.displayName) {
        // Single import
        await this.upsertSymptom(sourceId, data);
        await prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: {
            metadata: {
              processorVersion: FileProcessorService.PROCESSOR_VERSION,
              symptomKey: String(data.symptomKey),
              displayName: String(data.displayName),
              mode: 'single',
            } as any
          }
        });
        console.log(`[FileProcessor] JSON single imported`, {
          sourceId,
          symptomKey: String(data.symptomKey),
          displayName: String(data.displayName),
        });
    }
  }

  private async upsertSymptom(sourceId: number, data: any) {
      const symptomKey = String(data?.symptomKey || '').trim();
      const displayName = String(data?.displayName || '').trim();
      if (!symptomKey || !displayName) return;

      const requiredQuestions = this.toStringArray(
        data?.requiredQuestions ?? data?.questions ?? []
      );
      const questions = this.toStringArray(data?.questions ?? data?.requiredQuestions ?? []);

      const associatedSymptoms = this.toStringArray(data?.associatedSymptoms);
      const redFlags = this.toStringArray(data?.redFlags);

      const physicalSigns = this.toStringArray(
        data?.physicalSigns ?? data?.physicalExamination ?? []
      );
      const physicalExamination = this.toStringArray(
        data?.physicalExamination ?? data?.physicalSigns ?? []
      );

      const differentialPoints = this.toStringArray(
        data?.differentialPoints ?? data?.differentialDiagnosis ?? []
      );

      const commonCauses = this.toStringArray(data?.commonCauses);
      const onsetPatterns = this.toStringArray(data?.onsetPatterns);
      const relatedExams = this.toStringArray(data?.relatedExams);
      const bodySystems = this.toStringArray(data?.bodySystems);
      const ageGroups = this.toStringArray(data?.ageGroups);

      await prisma.symptomKnowledge.upsert({
        where: { symptomKey },
        update: {
          displayName,
          requiredQuestions,
          associatedSymptoms,
          redFlags,
          physicalSigns,
          category: typeof data?.category === 'string' ? data.category : undefined,
          priority: typeof data?.priority === 'string' ? data.priority : undefined,
          questions,
          physicalExamination,
          differentialPoints,
          description: typeof data?.description === 'string' ? data.description : undefined,
          commonCauses,
          onsetPatterns,
          severityScale: Array.isArray(data?.severityScale) ? data.severityScale : undefined,
          relatedExams,
          imageUrl: typeof data?.imageUrl === 'string' ? data.imageUrl : undefined,
          bodySystems,
          ageGroups,
          prevalence: typeof data?.prevalence === 'string' ? data.prevalence : undefined,
          sourceFileId: sourceId,
          version: { increment: 1 }
        },
        create: {
          symptomKey,
          displayName,
          requiredQuestions,
          associatedSymptoms,
          redFlags,
          physicalSigns,
          category: typeof data?.category === 'string' ? data.category : undefined,
          priority: typeof data?.priority === 'string' ? data.priority : undefined,
          questions,
          physicalExamination,
          differentialPoints,
          description: typeof data?.description === 'string' ? data.description : undefined,
          commonCauses,
          onsetPatterns,
          severityScale: Array.isArray(data?.severityScale) ? data.severityScale : undefined,
          relatedExams,
          imageUrl: typeof data?.imageUrl === 'string' ? data.imageUrl : undefined,
          bodySystems,
          ageGroups,
          prevalence: typeof data?.prevalence === 'string' ? data.prevalence : undefined,
          sourceFileId: sourceId
        }
      });
  }

  private toStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((v) => String(v ?? '').trim())
        .filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      const s = value.trim();
      return s ? [s] : [];
    }
    return [];
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
