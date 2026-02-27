import prisma from '../prisma';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../../knowledge_base');

interface KnowledgeData {
  symptomKey: string;
  displayName: string;
  requiredQuestions?: string[];
  associatedSymptoms?: string[];
  redFlags?: string[];
  physicalSigns?: string[];
}

interface TransformResult extends KnowledgeData {
  requiredQuestions: string[];
  associatedSymptoms: string[];
  redFlags: string[];
  physicalSigns: string[];
}

function loadKnowledgeFromFile(filename: string): KnowledgeData | null {
  const filePath = path.join(KNOWLEDGE_BASE_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as KnowledgeData;
  } catch (error) {
    process.stderr.write(`[Seed] 无法读取文件 ${filename}: ${error}\n`);
    return null;
  }
}

function transformKnowledge(data: KnowledgeData): TransformResult {
  return {
    symptomKey: data.symptomKey,
    displayName: data.displayName,
    requiredQuestions: data.requiredQuestions || [],
    associatedSymptoms: data.associatedSymptoms || [],
    redFlags: data.redFlags || [],
    physicalSigns: data.physicalSigns || [],
  };
}

async function main(): Promise<void> {
  process.stdout.write('Start seeding from knowledge_base files...\n');
  process.stdout.write(`Knowledge base directory: ${KNOWLEDGE_BASE_DIR}\n`);

  const files = fs.readdirSync(KNOWLEDGE_BASE_DIR)
    .filter(f => f.endsWith('.json'));
  
  process.stdout.write(`Found ${files.length} knowledge base files\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const data = loadKnowledgeFromFile(file);
    if (!data) {
      failCount++;
      continue;
    }

    try {
      const transformedData = transformKnowledge(data);
      
      const knowledge = await prisma.symptomKnowledge.upsert({
        where: { symptomKey: transformedData.symptomKey },
        update: transformedData,
        create: transformedData,
      });
      
      process.stdout.write(`✓ Upserted: ${knowledge.displayName} (${knowledge.symptomKey})\n`);
      successCount++;
    } catch (error) {
      process.stderr.write(`✗ Failed to upsert ${file}: ${error}\n`);
      failCount++;
    }
  }

  process.stdout.write('\n========================================\n');
  process.stdout.write('Seeding finished.\n');
  process.stdout.write(`Success: ${successCount}\n`);
  process.stdout.write(`Failed: ${failCount}\n`);
  process.stdout.write('========================================\n');
}

main()
  .catch((e: Error) => {
    process.stderr.write(`${e}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
