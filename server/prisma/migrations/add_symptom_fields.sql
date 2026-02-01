-- 症状知识库扩展字段迁移
-- 创建时间: 2026-02-01

-- 添加症状知识库扩展字段
ALTER TABLE "symptom_knowledge" 
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "common_causes" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "onset_patterns" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "severity_scale" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "related_exams" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "body_systems" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "age_groups" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "prevalence" VARCHAR(20);

-- 添加注释
COMMENT ON COLUMN "symptom_knowledge"."description" IS '症状描述';
COMMENT ON COLUMN "symptom_knowledge"."common_causes" IS '常见病因';
COMMENT ON COLUMN "symptom_knowledge"."onset_patterns" IS '起病形式';
COMMENT ON COLUMN "symptom_knowledge"."severity_scale" IS '严重程度分级';
COMMENT ON COLUMN "symptom_knowledge"."related_exams" IS '相关检查';
COMMENT ON COLUMN "symptom_knowledge"."image_url" IS '症状示意图URL';
COMMENT ON COLUMN "symptom_knowledge"."body_systems" IS '所属人体系统';
COMMENT ON COLUMN "symptom_knowledge"."age_groups" IS '常见年龄组';
COMMENT ON COLUMN "symptom_knowledge"."prevalence" IS '发病率级别';

-- 验证字段是否添加成功
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'symptom_knowledge' 
ORDER BY ordinal_position;
