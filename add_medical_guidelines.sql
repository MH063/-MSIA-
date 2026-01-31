-- 创建医学指南表并插入数据
-- 执行时间: 2026-01-30

-- 1. 创建医学指南表
CREATE TABLE IF NOT EXISTS medical_guidelines (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    version VARCHAR(50),
    publish_date DATE,
    source VARCHAR(200),
    summary TEXT,
    key_points JSONB DEFAULT '[]',
    full_content TEXT,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_guidelines_category ON medical_guidelines(category);
CREATE INDEX IF NOT EXISTS idx_guidelines_latest ON medical_guidelines(is_latest);

-- 创建更新时间触发器
DROP TRIGGER IF EXISTS update_guidelines_updated_at ON medical_guidelines;
CREATE TRIGGER update_guidelines_updated_at
    BEFORE UPDATE ON medical_guidelines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. 插入医学指南数据
INSERT INTO medical_guidelines (title, category, version, publish_date, source, summary, key_points, is_latest) VALUES
(
    '中国成人社区获得性肺炎诊断和治疗指南',
    '呼吸系统',
    '2016版',
    '2016-04-15',
    '中华医学会呼吸病学分会',
    '本指南旨在规范我国成人社区获得性肺炎（CAP）的诊断和治疗，提高诊疗水平',
    '[
        "CAP的诊断标准：社区发病、肺炎相关临床表现、影像学显示新出现的斑片状浸润影",
        "病情严重程度评估：CURB-65评分或PSI评分",
        "初始经验性抗感染治疗建议",
        "疗程建议：一般5-7天，视病情调整"
    ]',
    true
)
ON CONFLICT DO NOTHING;

INSERT INTO medical_guidelines (title, category, version, publish_date, source, summary, key_points, is_latest) VALUES
(
    '中国高血压防治指南',
    '心血管系统',
    '2018年修订版',
    '2018-12-01',
    '中国高血压联盟',
    '本指南对高血压的诊断、分级、危险分层及治疗进行了全面更新',
    '[
        "高血压诊断标准：收缩压≥140mmHg和/或舒张压≥90mmHg",
        "血压测量方法：诊室血压、家庭血压、动态血压监测",
        "心血管风险分层：低危、中危、高危、很高危",
        "治疗目标：一般<140/90mmHg，高危患者<130/80mmHg"
    ]',
    true
)
ON CONFLICT DO NOTHING;

INSERT INTO medical_guidelines (title, category, version, publish_date, source, summary, key_points, is_latest) VALUES
(
    '中国2型糖尿病防治指南',
    '内分泌系统',
    '2020版',
    '2020-11-01',
    '中华医学会糖尿病学分会',
    '本指南结合国内外最新研究证据，对2型糖尿病的防治进行了系统阐述',
    '[
        "糖尿病诊断标准：空腹血糖≥7.0mmol/L，或OGTT 2h血糖≥11.1mmol/L",
        "HbA1c控制目标：一般<7%，个体化调整",
        "综合管理：血糖、血压、血脂、体重",
        "并发症筛查：眼底、肾功能、神经病变"
    ]',
    true
)
ON CONFLICT DO NOTHING;

INSERT INTO medical_guidelines (title, category, version, publish_date, source, summary, key_points, is_latest) VALUES
(
    '中国急性脑梗死诊治指南',
    '神经系统',
    '2018版',
    '2018-09-01',
    '中华医学会神经病学分会',
    '本指南对急性脑梗死的早期识别、急诊处理、急性期治疗进行了规范',
    '[
        "早期识别：FAST原则（面部下垂、手臂无力、言语困难、及时就医）",
        "静脉溶栓：发病4.5小时内rt-PA溶栓",
        "血管内治疗：大血管闭塞患者可考虑机械取栓",
        "二级预防：抗血小板、降压、调脂、血糖控制"
    ]',
    true
)
ON CONFLICT DO NOTHING;

INSERT INTO medical_guidelines (title, category, version, publish_date, source, summary, key_points, is_latest) VALUES
(
    '中国胃食管反流病共识意见',
    '消化系统',
    '2020版',
    '2020-06-01',
    '中华医学会消化病学分会',
    '本共识对胃食管反流病的诊断、治疗策略进行了更新',
    '[
        "典型症状：烧心、反流",
        "诊断方法：PPI试验、胃镜检查、24小时食管pH监测",
        "初始治疗：PPI标准剂量，疗程8周",
        "维持治疗：按需治疗或持续低剂量治疗"
    ]',
    true
)
ON CONFLICT DO NOTHING;

-- 3. 验证数据
SELECT '医学指南统计:' as info;
SELECT category, COUNT(*) as count FROM medical_guidelines GROUP BY category ORDER BY count DESC;

SELECT '最新指南列表:' as info;
SELECT title, category, version, source FROM medical_guidelines WHERE is_latest = true ORDER BY category;
