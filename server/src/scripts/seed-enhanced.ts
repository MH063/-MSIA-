import prisma from '../prisma';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../../knowledge_base');

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface SyncResult {
  file: string;
  symptomKey: string;
  displayName: string;
  status: 'created' | 'updated' | 'unchanged' | 'failed';
  changes?: string[];
  error?: string;
}

interface SymptomData {
  symptomKey: string;
  displayName: string;
  requiredQuestions?: string[];
  associatedSymptoms?: string[];
  redFlags?: string[];
  physicalSigns?: string[];
  category?: string;
  priority?: string;
  questions?: unknown[];
  physicalExamination?: unknown[];
}

interface DbSymptomData extends SymptomData {
  updatedAt: Date;
}

const FIELDS_TO_COMPARE = [
  'displayName',
  'requiredQuestions',
  'associatedSymptoms',
  'redFlags',
  'physicalSigns'
] as const;

function loadKnowledgeFromFile(filename: string): SymptomData | null {
  const filePath = path.join(KNOWLEDGE_BASE_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    
    if (!data || typeof data !== 'object') {
      process.stderr.write(`[Seed] 文件 ${filename} 内容无效\n`);
      return null;
    }
    
    const typedData = data as Record<string, unknown>;
    if (!typedData.symptomKey || !typedData.displayName) {
      process.stderr.write(`[Seed] 文件 ${filename} 缺少必要字段 (symptomKey 或 displayName)\n`);
      return null;
    }
    
    return typedData as SymptomData;
  } catch (error) {
    process.stderr.write(`[Seed] 无法读取文件 ${filename}: ${error}\n`);
    return null;
  }
}

function validateSymptomData(data: SymptomData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data.symptomKey || typeof data.symptomKey !== 'string') {
    errors.push('缺少或无效的 symptomKey');
  }
  
  if (!data.displayName || typeof data.displayName !== 'string') {
    errors.push('缺少或无效的 displayName');
  }
  
  if (data.symptomKey && !/^[a-z][a-z0-9_]*$/.test(data.symptomKey)) {
    warnings.push(`symptomKey '${data.symptomKey}' 建议使用小写字母、数字和下划线，且以小写字母开头`);
  }
  
  const arrayFields = ['requiredQuestions', 'associatedSymptoms', 'redFlags', 'physicalSigns'] as const;
  for (const field of arrayFields) {
    const value = data[field];
    if (value !== undefined && !Array.isArray(value)) {
      errors.push(`${field} 必须是数组类型`);
    }
  }
  
  if (data.requiredQuestions && Array.isArray(data.requiredQuestions)) {
    const uniqueQuestions = new Set(data.requiredQuestions);
    if (uniqueQuestions.size !== data.requiredQuestions.length) {
      warnings.push('requiredQuestions 中存在重复项');
    }
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}

function findDifferences(oldData: SymptomData, newData: SymptomData): string[] {
  const changes: string[] = [];
  
  for (const field of FIELDS_TO_COMPARE) {
    const oldValue = JSON.stringify(oldData[field]);
    const newValue = JSON.stringify(newData[field]);
    
    if (oldValue !== newValue) {
      if (field === 'requiredQuestions') {
        const oldLen = oldData[field]?.length || 0;
        const newLen = newData[field]?.length || 0;
        changes.push(`${field}: ${oldLen} 条 -> ${newLen} 条`);
      } else if (field === 'displayName') {
        changes.push(`${field}: "${oldData[field]}" -> "${newData[field]}"`);
      } else {
        changes.push(`${field} 已更新`);
      }
    }
  }
  
  return changes;
}

function mergeSymptomData(dbData: SymptomData, fileData: SymptomData): DbSymptomData {
  return {
    ...dbData,
    displayName: fileData.displayName,
    requiredQuestions: fileData.requiredQuestions || [],
    associatedSymptoms: fileData.associatedSymptoms || [],
    redFlags: fileData.redFlags || [],
    physicalSigns: fileData.physicalSigns || [],
    updatedAt: new Date()
  };
}

async function syncSymptom(data: SymptomData, filename: string): Promise<SyncResult> {
  const result: SyncResult = {
    file: filename,
    symptomKey: data.symptomKey,
    displayName: data.displayName,
    status: 'failed'
  };
  
  try {
    const existing = await prisma.symptomKnowledge.findUnique({
      where: { symptomKey: data.symptomKey }
    });
    
    if (existing) {
      const changes = findDifferences(existing as unknown as SymptomData, data);
      
      if (changes.length === 0) {
        result.status = 'unchanged';
        process.stdout.write(`  ⏸ ${data.displayName} (${data.symptomKey}) - 无变化\n`);
      } else {
        const mergedData = mergeSymptomData(existing as unknown as SymptomData, data);
        
        await prisma.symptomKnowledge.update({
          where: { symptomKey: data.symptomKey },
          data: mergedData
        });
        
        result.status = 'updated';
        result.changes = changes;
        process.stdout.write(`  📝 ${data.displayName} (${data.symptomKey}) - 已更新\n`);
        changes.forEach(change => process.stdout.write(`     - ${change}\n`));
      }
    } else {
      await prisma.symptomKnowledge.create({
        data: {
          symptomKey: data.symptomKey,
          displayName: data.displayName,
          requiredQuestions: data.requiredQuestions || [],
          associatedSymptoms: data.associatedSymptoms || [],
          redFlags: data.redFlags || [],
          physicalSigns: data.physicalSigns || [],
          category: data.category || null,
          priority: data.priority || 'medium',
          questions: data.questions || data.requiredQuestions || [],
          physicalExamination: data.physicalExamination || data.physicalSigns || []
        }
      });
      
      result.status = 'created';
      process.stdout.write(`  ✓ ${data.displayName} (${data.symptomKey}) - 新建\n`);
    }
    
    return result;
  } catch (error) {
    const err = error as Error;
    result.status = 'failed';
    result.error = err.message;
    process.stderr.write(`  ✗ ${data.displayName} (${data.symptomKey}) - 失败: ${err.message}\n`);
    return result;
  }
}

function checkDuplicateKeys(files: string[]): Map<string, string[]> {
  const keyToFiles = new Map<string, string[]>();
  
  for (const file of files) {
    const data = loadKnowledgeFromFile(file);
    if (data && data.symptomKey) {
      const existing = keyToFiles.get(data.symptomKey) || [];
      existing.push(file);
      keyToFiles.set(data.symptomKey, existing);
    }
  }
  
  const duplicates = new Map<string, string[]>();
  for (const [key, fileList] of keyToFiles.entries()) {
    if (fileList.length > 1) {
      duplicates.set(key, fileList);
    }
  }
  
  return duplicates;
}

async function main(): Promise<void> {
  process.stdout.write('========================================\n');
  process.stdout.write('Enhanced Knowledge Base Seeding\n');
  process.stdout.write('========================================\n\n');
  
  process.stdout.write(`Knowledge base directory: ${KNOWLEDGE_BASE_DIR}\n\n`);
  
  const files = fs.readdirSync(KNOWLEDGE_BASE_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  process.stdout.write(`Found ${files.length} knowledge base files\n\n`);
  
  process.stdout.write('Step 1: Checking for duplicate symptom keys...\n');
  const duplicates = checkDuplicateKeys(files);
  if (duplicates.size > 0) {
    process.stderr.write('  ⚠️ 发现重复的 symptomKey:\n');
    for (const [key, fileList] of duplicates.entries()) {
      process.stderr.write(`     - ${key}: ${fileList.join(', ')}\n`);
    }
    process.stderr.write('\n');
  } else {
    process.stdout.write('  ✓ 未发现重复的 symptomKey\n\n');
  }
  
  process.stdout.write('Step 2: Validating and syncing data...\n\n');
  
  const results: SyncResult[] = [];
  let validCount = 0;
  let invalidCount = 0;
  
  for (const file of files) {
    const data = loadKnowledgeFromFile(file);
    if (!data) {
      invalidCount++;
      continue;
    }
    
    const validation = validateSymptomData(data);
    
    if (!validation.isValid) {
      process.stderr.write(`\n✗ ${file}:\n`);
      validation.errors.forEach(err => process.stderr.write(`   错误: ${err}\n`));
      validation.warnings.forEach(warn => process.stderr.write(`   警告: ${warn}\n`));
      invalidCount++;
      continue;
    }
    
    if (validation.warnings.length > 0) {
      process.stderr.write(`\n⚠️  ${file}:\n`);
      validation.warnings.forEach(warn => process.stderr.write(`   警告: ${warn}\n`));
    }
    
    const result = await syncSymptom(data, file);
    results.push(result);
    validCount++;
  }
  
  process.stdout.write('\n========================================\n');
  process.stdout.write('Sync Summary\n');
  process.stdout.write('========================================\n');
  
  const created = results.filter(r => r.status === 'created').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const unchanged = results.filter(r => r.status === 'unchanged').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  process.stdout.write(`Total files:     ${files.length}\n`);
  process.stdout.write(`Valid:           ${validCount}\n`);
  process.stdout.write(`Invalid:         ${invalidCount}\n`);
  process.stdout.write(`Created:         ${created}\n`);
  process.stdout.write(`Updated:         ${updated}\n`);
  process.stdout.write(`Unchanged:       ${unchanged}\n`);
  process.stdout.write(`Failed:          ${failed}\n`);
  process.stdout.write('========================================\n');
  
  if (failed > 0) {
    process.stdout.write('\nFailed items:\n');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => process.stdout.write(`  - ${r.file}: ${r.error}\n`));
  }
  
  if (updated > 0) {
    process.stdout.write('\nUpdated items:\n');
    results
      .filter(r => r.status === 'updated')
      .forEach(r => {
        process.stdout.write(`  - ${r.displayName} (${r.symptomKey})\n`);
        r.changes?.forEach(change => process.stdout.write(`     ${change}\n`));
      });
  }
}

main()
  .catch((e: Error) => {
    process.stderr.write(`Fatal error: ${e}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
