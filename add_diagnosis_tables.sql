-- 第一阶段：诊断功能数据库表结构升级
-- 创建时间: 2026-01-30
-- 说明: 为支持动态诊断规则，创建诊断相关的数据库表

-- 1. 诊断表 - 存储所有可能的诊断
CREATE TABLE IF NOT EXISTS diagnoses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50), -- 如: 呼吸系统、消化系统等
    min_age INT, -- 适用最小年龄
    max_age INT, -- 适用最大年龄
    gender_preference VARCHAR(10), -- 性别偏好: male, female, null(无偏好)
    priority INT DEFAULT 0, -- 优先级，用于排序
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 诊断-症状关联表 - 存储诊断与症状的关联关系
CREATE TABLE IF NOT EXISTS diagnosis_symptoms (
    id SERIAL PRIMARY KEY,
    diagnosis_id INT NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    symptom_key VARCHAR(50) NOT NULL, -- 关联 symptom_knowledge.symptom_key
    weight DECIMAL(3,2) DEFAULT 0.10, -- 症状权重，影响置信度计算
    is_required BOOLEAN DEFAULT FALSE, -- 是否为必需症状
    is_excluding BOOLEAN DEFAULT FALSE, -- 是否为排除症状（有此症状则降低该诊断可能性）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(diagnosis_id, symptom_key)
);

-- 3. 诊断-警惕征象关联表
CREATE TABLE IF NOT EXISTS diagnosis_red_flags (
    id SERIAL PRIMARY KEY,
    diagnosis_id INT NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    red_flag_name VARCHAR(100) NOT NULL,
    weight DECIMAL(3,2) DEFAULT 0.15, -- 警惕征象权重
    severity_level INT DEFAULT 1, -- 严重程度 1-5
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(diagnosis_id, red_flag_name)
);

-- 4. 扩展 symptom_knowledge 表，添加更多字段
ALTER TABLE symptom_knowledge 
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS physical_examination JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS differential_points JSONB DEFAULT '[]';

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_diagnosis_symptoms_symptom_key ON diagnosis_symptoms(symptom_key);
CREATE INDEX IF NOT EXISTS idx_diagnosis_symptoms_diagnosis_id ON diagnosis_symptoms(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_red_flags_diagnosis_id ON diagnosis_red_flags(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_category ON diagnoses(category);
CREATE INDEX IF NOT EXISTS idx_diagnoses_active ON diagnoses(is_active);
CREATE INDEX IF NOT EXISTS idx_symptom_knowledge_category ON symptom_knowledge(category);

-- 6. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_diagnoses_updated_at ON diagnoses;
CREATE TRIGGER update_diagnoses_updated_at
    BEFORE UPDATE ON diagnoses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 插入示例诊断数据（从原硬编码数据迁移）
-- 注意: 这些INSERT语句需要在 symptom_knowledge 表中有对应症状数据后才能执行

-- 上呼吸道感染
INSERT INTO diagnoses (name, description, category) VALUES
('上呼吸道感染', '由病毒或细菌引起的上呼吸道炎症', '呼吸系统')
ON CONFLICT (name) DO NOTHING;

-- 肺炎
INSERT INTO diagnoses (name, description, category) VALUES
('肺炎', '肺部实质的急性炎症', '呼吸系统')
ON CONFLICT (name) DO NOTHING;

-- 急性支气管炎
INSERT INTO diagnoses (name, description, category) VALUES
('急性支气管炎', '支气管黏膜的急性炎症', '呼吸系统')
ON CONFLICT (name) DO NOTHING;

-- 慢性阻塞性肺疾病
INSERT INTO diagnoses (name, description, category, min_age) VALUES
('慢性阻塞性肺疾病', '持续性气流受限的肺部疾病', '呼吸系统', 40)
ON CONFLICT (name) DO NOTHING;

-- 支气管哮喘
INSERT INTO diagnoses (name, description, category, max_age) VALUES
('支气管哮喘', '气道慢性炎症性疾病', '呼吸系统', 60)
ON CONFLICT (name) DO NOTHING;

-- 肺结核
INSERT INTO diagnoses (name, description, category) VALUES
('肺结核', '由结核分枝杆菌引起的肺部感染', '呼吸系统')
ON CONFLICT (name) DO NOTHING;

-- 急性胃肠炎
INSERT INTO diagnoses (name, description, category) VALUES
('急性胃肠炎', '胃肠黏膜的急性炎症', '消化系统')
ON CONFLICT (name) DO NOTHING;

-- 消化性溃疡
INSERT INTO diagnoses (name, description, category) VALUES
('消化性溃疡', '胃肠道黏膜被胃酸和胃蛋白酶消化形成的溃疡', '消化系统')
ON CONFLICT (name) DO NOTHING;

-- 急性阑尾炎
INSERT INTO diagnoses (name, description, category) VALUES
('急性阑尾炎', '阑尾的急性炎症', '消化系统')
ON CONFLICT (name) DO NOTHING;

-- 急性胰腺炎
INSERT INTO diagnoses (name, description, category) VALUES
('急性胰腺炎', '胰腺的急性炎症', '消化系统')
ON CONFLICT (name) DO NOTHING;

-- 脑梗死
INSERT INTO diagnoses (name, description, category, min_age) VALUES
('脑梗死', '脑部血液供应障碍导致脑组织缺血缺氧性坏死', '神经系统', 50)
ON CONFLICT (name) DO NOTHING;

-- 脑出血
INSERT INTO diagnoses (name, description, category, min_age) VALUES
('脑出血', '脑实质内血管破裂引起的出血', '神经系统', 40)
ON CONFLICT (name) DO NOTHING;

-- 偏头痛
INSERT INTO diagnoses (name, description, category) VALUES
('偏头痛', '反复发作的原发性头痛', '神经系统')
ON CONFLICT (name) DO NOTHING;

-- 高血压
INSERT INTO diagnoses (name, description, category, min_age) VALUES
('高血压', '动脉血压持续升高', '心血管系统', 35)
ON CONFLICT (name) DO NOTHING;

-- 8. 为诊断添加症状关联（需要在诊断数据插入后执行）
-- 注意: 这些INSERT需要在 symptom_knowledge 表中有对应的症状数据

-- 上呼吸道感染的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.10, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['fever', 'cough', 'sore_throat', 'runny_nose', 'nasal_congestion']) as symptom_key) sk
WHERE d.name = '上呼吸道感染'
ON CONFLICT DO NOTHING;

-- 肺炎的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.12, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['fever', 'cough', 'sputum', 'chest_pain', 'dyspnea']) as symptom_key) sk
WHERE d.name = '肺炎'
ON CONFLICT DO NOTHING;

-- 9. 为诊断添加警惕征象
-- 肺炎的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.20, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('呼吸困难', 4),
        ('紫绀', 5),
        ('意识障碍', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '肺炎'
ON CONFLICT DO NOTHING;

-- 急性胰腺炎的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.25, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('休克', 5),
        ('呼吸困难', 4),
        ('意识障碍', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '急性胰腺炎'
ON CONFLICT DO NOTHING;

-- 脑出血的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.25, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('意识障碍', 5),
        ('瞳孔不等大', 5),
        ('呼吸不规则', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '脑出血'
ON CONFLICT DO NOTHING;

-- 10. 验证数据
SELECT '诊断表数据:' as info;
SELECT name, category, min_age, max_age FROM diagnoses ORDER BY category, name;

SELECT '诊断-症状关联数:' as info;
SELECT d.name, COUNT(ds.id) as symptom_count
FROM diagnoses d
LEFT JOIN diagnosis_symptoms ds ON d.id = ds.diagnosis_id
GROUP BY d.id, d.name
ORDER BY symptom_count DESC;

SELECT '诊断-警惕征象关联数:' as info;
SELECT d.name, COUNT(drf.id) as red_flag_count
FROM diagnoses d
LEFT JOIN diagnosis_red_flags drf ON d.id = drf.diagnosis_id
GROUP BY d.id, d.name
ORDER BY red_flag_count DESC;
