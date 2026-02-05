import prisma from '../prisma';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// 知识库文件目录
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../../knowledge_base');

// 读取知识库JSON文件
function loadKnowledgeFromFile(filename: string): any | null {
  const filePath = path.join(KNOWLEDGE_BASE_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[Seed] 无法读取文件 ${filename}:`, error);
    return null;
  }
}

// 将知识库数据转换为数据库格式
function transformKnowledge(data: any): any {
  return {
    symptomKey: data.symptomKey,
    displayName: data.displayName,
    // 保持原始格式，不进行转换
    requiredQuestions: data.requiredQuestions || [],
    associatedSymptoms: data.associatedSymptoms || [],
    redFlags: data.redFlags || [],
    physicalSigns: data.physicalSigns || [],
  };
}

async function main() {
  console.log('Start seeding from knowledge_base files...');
  console.log(`Knowledge base directory: ${KNOWLEDGE_BASE_DIR}`);

  // 获取所有JSON文件
  const files = fs.readdirSync(KNOWLEDGE_BASE_DIR)
    .filter(f => f.endsWith('.json'));
  
  console.log(`Found ${files.length} knowledge base files`);

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
      
      console.log(`✓ Upserted: ${knowledge.displayName} (${knowledge.symptomKey})`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to upsert ${file}:`, error);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`Seeding finished.`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
