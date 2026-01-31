-- 为所有诊断补充完整的症状关联数据
-- 执行时间: 2026-01-30

-- 清除现有的症状关联（保留上呼吸道感染和肺炎的）
-- DELETE FROM diagnosis_symptoms WHERE diagnosis_id > 2;

-- 1. 急性支气管炎的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.10, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['cough', 'sputum', 'fever', 'chest_tightness']) as symptom_key) sk
WHERE d.name = '急性支气管炎'
ON CONFLICT DO NOTHING;

-- 2. 慢性阻塞性肺疾病的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.12, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['cough', 'sputum', 'dyspnea', 'wheezing']) as symptom_key) sk
WHERE d.name = '慢性阻塞性肺疾病'
ON CONFLICT DO NOTHING;

-- 3. 支气管哮喘的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.12, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['wheezing', 'dyspnea', 'cough', 'chest_tightness']) as symptom_key) sk
WHERE d.name = '支气管哮喘'
ON CONFLICT DO NOTHING;

-- 4. 肺结核的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.11, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['fever', 'night_sweats', 'cough', 'hemoptysis', 'weight_loss']) as symptom_key) sk
WHERE d.name = '肺结核'
ON CONFLICT DO NOTHING;

-- 5. 急性胃肠炎的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.10, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['abdominal_pain', 'diarrhea', 'nausea', 'vomiting', 'fever']) as symptom_key) sk
WHERE d.name = '急性胃肠炎'
ON CONFLICT DO NOTHING;

-- 6. 消化性溃疡的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.11, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['upper_abdominal_pain', 'nausea', 'vomiting', 'melena']) as symptom_key) sk
WHERE d.name = '消化性溃疡'
ON CONFLICT DO NOTHING;

-- 7. 急性阑尾炎的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.12, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['right_lower_abdominal_pain', 'fever', 'nausea', 'vomiting']) as symptom_key) sk
WHERE d.name = '急性阑尾炎'
ON CONFLICT DO NOTHING;

-- 8. 急性胰腺炎的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.12, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['upper_abdominal_pain', 'nausea', 'vomiting', 'fever']) as symptom_key) sk
WHERE d.name = '急性胰腺炎'
ON CONFLICT DO NOTHING;

-- 9. 脑梗死的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.13, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['hemiplegia', 'slurred_speech', 'headache', 'vertigo']) as symptom_key) sk
WHERE d.name = '脑梗死'
ON CONFLICT DO NOTHING;

-- 10. 脑出血的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.13, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['headache', 'vomiting', 'altered_consciousness', 'hemiplegia']) as symptom_key) sk
WHERE d.name = '脑出血'
ON CONFLICT DO NOTHING;

-- 11. 偏头痛的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.11, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['headache', 'nausea', 'vomiting', 'photophobia']) as symptom_key) sk
WHERE d.name = '偏头痛'
ON CONFLICT DO NOTHING;

-- 12. 高血压的症状
INSERT INTO diagnosis_symptoms (diagnosis_id, symptom_key, weight, is_required)
SELECT d.id, sk.symptom_key, 0.10, false
FROM diagnoses d
CROSS JOIN (SELECT unnest(ARRAY['headache', 'vertigo', 'palpitation', 'chest_tightness']) as symptom_key) sk
WHERE d.name = '高血压'
ON CONFLICT DO NOTHING;

-- 为所有诊断补充警惕征象

-- 1. 上呼吸道感染的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.15, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('高热不退', 4),
        ('意识障碍', 5),
        ('呼吸困难', 4),
        ('血压下降', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '上呼吸道感染'
ON CONFLICT DO NOTHING;

-- 2. 急性支气管炎的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.18, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('持续高热', 4),
        ('呼吸困难', 4),
        ('紫绀', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '急性支气管炎'
ON CONFLICT DO NOTHING;

-- 3. 慢性阻塞性肺疾病的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.20, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('严重呼吸困难', 5),
        ('紫绀', 5),
        ('意识模糊', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '慢性阻塞性肺疾病'
ON CONFLICT DO NOTHING;

-- 4. 支气管哮喘的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.20, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('严重呼吸困难', 5),
        ('无法平卧', 4),
        ('紫绀', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '支气管哮喘'
ON CONFLICT DO NOTHING;

-- 5. 肺结核的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.18, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('大咯血', 5),
        ('严重呼吸困难', 5),
        ('持续高热', 4)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '肺结核'
ON CONFLICT DO NOTHING;

-- 6. 急性胃肠炎的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.18, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('严重脱水', 4),
        ('血便', 5),
        ('持续呕吐', 4),
        ('高热不退', 4)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '急性胃肠炎'
ON CONFLICT DO NOTHING;

-- 7. 消化性溃疡的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.20, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('呕血', 5),
        ('黑便', 5),
        ('剧烈腹痛', 4)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '消化性溃疡'
ON CONFLICT DO NOTHING;

-- 8. 急性阑尾炎的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.20, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('腹膜刺激征', 5),
        ('高热', 4),
        ('休克', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '急性阑尾炎'
ON CONFLICT DO NOTHING;

-- 9. 脑梗死的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.22, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('意识障碍', 5),
        ('瞳孔不等大', 5),
        ('呼吸不规则', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '脑梗死'
ON CONFLICT DO NOTHING;

-- 10. 偏头痛的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.15, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('剧烈头痛', 4),
        ('意识改变', 5)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '偏头痛'
ON CONFLICT DO NOTHING;

-- 11. 高血压的警惕征象
INSERT INTO diagnosis_red_flags (diagnosis_id, red_flag_name, weight, severity_level)
SELECT d.id, rf.red_flag, 0.18, rf.severity
FROM diagnoses d
CROSS JOIN (
    SELECT * FROM (VALUES 
        ('血压急剧升高', 4),
        ('意识障碍', 5),
        ('剧烈头痛', 4)
    ) AS t(red_flag, severity)
) rf
WHERE d.name = '高血压'
ON CONFLICT DO NOTHING;

-- 验证数据
SELECT '诊断症状关联统计:' as info;
SELECT d.name, COUNT(ds.id) as symptom_count
FROM diagnoses d
LEFT JOIN diagnosis_symptoms ds ON d.id = ds.diagnosis_id
GROUP BY d.id, d.name
ORDER BY symptom_count DESC;

SELECT '诊断警惕征象统计:' as info;
SELECT d.name, COUNT(drf.id) as red_flag_count
FROM diagnoses d
LEFT JOIN diagnosis_red_flags drf ON d.id = drf.diagnosis_id
GROUP BY d.id, d.name
ORDER BY red_flag_count DESC;
