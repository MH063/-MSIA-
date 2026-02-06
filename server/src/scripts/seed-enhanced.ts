import prisma from '../prisma';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// 知识库文件目录
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../../knowledge_base');

// 数据校验结果类型
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 同步结果类型
interface SyncResult {
  file: string;
  symptomKey: string;
  displayName: string;
  status: 'created' | 'updated' | 'unchanged' | 'failed';
  changes?: string[];
  error?: string;
}

/**
 * 读取知识库JSON文件
 */
function loadKnowledgeFromFile(filename: string): any | null {
  const filePath = path.join(KNOWLEDGE_BASE_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // 验证必要字段
    if (!data.symptomKey || !data.displayName) {
      console.warn(`[Seed] 文件 ${filename} 缺少必要字段 (symptomKey 或 displayName)`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn(`[Seed] 无法读取文件 ${filename}:`, error);
    return null;
  }
}

/**
 * 验证症状数据
 */
function validateSymptomData(data: any, _filename: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查必要字段
  if (!data.symptomKey || typeof data.symptomKey !== 'string') {
    errors.push('缺少或无效的 symptomKey');
  }
  
  if (!data.displayName || typeof data.displayName !== 'string') {
    errors.push('缺少或无效的 displayName');
  }
  
  // 检查 symptomKey 格式（只允许小写字母、数字和下划线）
  if (data.symptomKey && !/^[a-z][a-z0-9_]*$/.test(data.symptomKey)) {
    warnings.push(`symptomKey '${data.symptomKey}' 建议使用小写字母、数字和下划线，且以小写字母开头`);
  }
  
  // 检查数组字段
  const arrayFields = ['requiredQuestions', 'associatedSymptoms', 'redFlags', 'physicalSigns'];
  for (const field of arrayFields) {
    if (data[field] && !Array.isArray(data[field])) {
      errors.push(`${field} 必须是数组类型`);
    }
  }
  
  // 检查重复项
  if (data.requiredQuestions && Array.isArray(data.requiredQuestions)) {
    const uniqueQuestions = new Set(data.requiredQuestions);
    if (uniqueQuestions.size !== data.requiredQuestions.length) {
      warnings.push('requiredQuestions 中存在重复项');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 比较两个症状数据，找出差异
 */
function findDifferences(oldData: any, newData: any): string[] {
  const changes: string[] = [];
  
  const fieldsToCompare = [
    'displayName',
    'requiredQuestions',
    'associatedSymptoms',
    'redFlags',
    'physicalSigns'
  ];
  
  for (const field of fieldsToCompare) {
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

/**
 * 智能合并数据
 * 保留数据库中可能存在的额外字段，同时更新核心字段
 */
function mergeSymptomData(dbData: any, fileData: any): any {
  return {
    ...dbData,  // 保留数据库中的所有字段
    // 更新核心字段
    displayName: fileData.displayName,
    requiredQuestions: fileData.requiredQuestions || [],
    associatedSymptoms: fileData.associatedSymptoms || [],
    redFlags: fileData.redFlags || [],
    physicalSigns: fileData.physicalSigns || [],
    // 更新时间戳
    updatedAt: new Date()
  };
}

/**
 * 同步单个症状数据
 */
async function syncSymptom(data: any, filename: string): Promise<SyncResult> {
  const result: SyncResult = {
    file: filename,
    symptomKey: data.symptomKey,
    displayName: data.displayName,
    status: 'failed'
  };
  
  try {
    // 检查是否已存在
    const existing = await prisma.symptomKnowledge.findUnique({
      where: { symptomKey: data.symptomKey }
    });
    
    if (existing) {
      // 检查是否有变化
      const changes = findDifferences(existing, data);
      
      if (changes.length === 0) {
        // 数据未变化
        result.status = 'unchanged';
        console.log(`  ⏸ ${data.displayName} (${data.symptomKey}) - 无变化`);
      } else {
        // 数据有变化，执行更新
        const mergedData = mergeSymptomData(existing, data);
        
        await prisma.symptomKnowledge.update({
          where: { symptomKey: data.symptomKey },
          data: mergedData
        });
        
        result.status = 'updated';
        result.changes = changes;
        console.log(`  📝 ${data.displayName} (${data.symptomKey}) - 已更新`);
        changes.forEach(change => console.log(`     - ${change}`));
      }
    } else {
      // 新建记录
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
      console.log(`  ✓ ${data.displayName} (${data.symptomKey}) - 新建`);
    }
    
    return result;
  } catch (error: any) {
    result.status = 'failed';
    result.error = error.message;
    console.error(`  ✗ ${data.displayName} (${data.symptomKey}) - 失败:`, error.message);
    return result;
  }
}

/**
 * 检查 symptomKey 重复
 */
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
  
  // 只返回有重复的记录
  const duplicates = new Map<string, string[]>();
  for (const [key, fileList] of keyToFiles.entries()) {
    if (fileList.length > 1) {
      duplicates.set(key, fileList);
    }
  }
  
  return duplicates;
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('Enhanced Knowledge Base Seeding');
  console.log('========================================\n');
  
  console.log(`Knowledge base directory: ${KNOWLEDGE_BASE_DIR}\n`);
  
  // 获取所有JSON文件
  const files = fs.readdirSync(KNOWLEDGE_BASE_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  console.log(`Found ${files.length} knowledge base files\n`);
  
  // 检查重复的 symptomKey
  console.log('Step 1: Checking for duplicate symptom keys...');
  const duplicates = checkDuplicateKeys(files);
  if (duplicates.size > 0) {
    console.warn('  ⚠️ 发现重复的 symptomKey:');
    for (const [key, fileList] of duplicates.entries()) {
      console.warn(`     - ${key}: ${fileList.join(', ')}`);
    }
    console.warn('');
  } else {
    console.log('  ✓ 未发现重复的 symptomKey\n');
  }
  
  // 验证和同步数据
  console.log('Step 2: Validating and syncing data...\n');
  
  const results: SyncResult[] = [];
  let validCount = 0;
  let invalidCount = 0;
  
  for (const file of files) {
    const data = loadKnowledgeFromFile(file);
    if (!data) {
      invalidCount++;
      continue;
    }
    
    // 验证数据
    const validation = validateSymptomData(data, file);
    
    if (!validation.isValid) {
      console.error(`\n✗ ${file}:`);
      validation.errors.forEach(err => console.error(`   错误: ${err}`));
      validation.warnings.forEach(warn => console.warn(`   警告: ${warn}`));
      invalidCount++;
      continue;
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`\n⚠️  ${file}:`);
      validation.warnings.forEach(warn => console.warn(`   警告: ${warn}`));
    }
    
    // 同步数据
    const result = await syncSymptom(data, file);
    results.push(result);
    validCount++;
  }
  
  // 统计结果
  console.log('\n========================================');
  console.log('Sync Summary');
  console.log('========================================');
  
  const created = results.filter(r => r.status === 'created').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const unchanged = results.filter(r => r.status === 'unchanged').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  console.log(`Total files:     ${files.length}`);
  console.log(`Valid:           ${validCount}`);
  console.log(`Invalid:         ${invalidCount}`);
  console.log(`Created:         ${created}`);
  console.log(`Updated:         ${updated}`);
  console.log(`Unchanged:       ${unchanged}`);
  console.log(`Failed:          ${failed}`);
  console.log('========================================');
  
  // 如果有失败的，显示详细信息
  if (failed > 0) {
    console.log('\nFailed items:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`  - ${r.file}: ${r.error}`));
  }
  
  // 如果有更新的，显示详细信息
  if (updated > 0) {
    console.log('\nUpdated items:');
    results
      .filter(r => r.status === 'updated')
      .forEach(r => {
        console.log(`  - ${r.displayName} (${r.symptomKey})`);
        r.changes?.forEach(change => console.log(`     ${change}`));
      });
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
