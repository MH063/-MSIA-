-- 更新医学指南到最新版本
-- 更新时间: 2026-01-30
-- 注意: 以下信息基于网络搜索获取的最新版本信息

-- 1. 更新肺炎指南到2024版
UPDATE medical_guidelines SET
    title = '中国成人社区获得性肺炎诊断和治疗指南',
    version = '2024年修订版',
    publish_date = '2024-06-01',
    source = '中华医学会呼吸病学分会',
    summary = '本指南对2016年版进行了更新和修订，结合最新的临床研究证据，对成人社区获得性肺炎的诊断、病情评估、抗感染治疗等进行了规范',
    key_points = '[
        "诊断标准：社区发病、肺炎相关临床表现、影像学显示新出现的斑片状浸润影",
        "病情严重程度评估：CURB-65评分或PSI评分",
        "经验性抗感染治疗：根据病情严重程度和耐药风险选择抗生素",
        "疗程建议：一般5-7天，根据病情调整",
        "重视病原学检查：在用药前采集标本进行培养"
    ]',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE '%社区获得性肺炎%';

-- 2. 更新高血压指南到2024版
UPDATE medical_guidelines SET
    title = '中国高血压防治指南',
    version = '2024年修订版',
    publish_date = '2024-08-11',
    source = '中国高血压防治指南修订委员会、高血压联盟(中国)等',
    summary = '2024年8月正式发布，时隔6年的重大更新。充分体现近年高血压领域的防治理念、现行政策与防治方法的进展，新增血管紧张素受体脑啡肽酶抑制剂(ARNI)作为常用降压药',
    key_points = '[
        "高血压诊断标准：收缩压≥140mmHg和/或舒张压≥90mmHg",
        "血压测量方法：诊室血压、家庭血压、动态血压监测",
        "心血管风险分层：低危、中危、高危、很高危",
        "治疗目标：一般<140/90mmHg，高危患者<130/80mmHg",
        "新增ARNI类药物：沙库巴曲缬沙坦作为一线降压药",
        "大部分患者需使用2种或以上降压药联合治疗"
    ]',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE '%高血压%';

-- 3. 更新糖尿病指南到2024版
UPDATE medical_guidelines SET
    title = '中国糖尿病防治指南',
    version = '2024版',
    publish_date = '2024-12-31',
    source = '中华医学会糖尿病学分会',
    summary = '2024年12月31日发布，时隔四年的大更新。突破既往"2型糖尿病"单一聚焦，升级为涵盖全类型糖尿病的综合性防治指南，进一步明确中医药在糖尿病防治中的重要地位',
    key_points = '[
        "糖尿病诊断标准：空腹血糖≥7.0mmol/L，或OGTT 2h血糖≥11.1mmol/L，或HbA1c≥6.5%",
        "HbA1c控制目标：一般<7%，个体化调整",
        "综合管理：血糖、血压、血脂、体重",
        "并发症筛查：眼底、肾功能、神经病变",
        "新增中医药治疗推荐：津力达、通络明目等",
        "心肾保护优先：选择具有心肾获益的降糖药物"
    ]',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE '%糖尿病%';

-- 4. 更新脑梗死指南到最新版
UPDATE medical_guidelines SET
    title = '中国急性缺血性脑卒中诊治指南',
    version = '2024版',
    publish_date = '2024-01-01',
    source = '中华医学会神经病学分会脑血管病学组',
    summary = '2024年最新版本，对急性缺血性脑卒中的早期识别、急诊处理、急性期治疗进行了规范更新。强调静脉溶栓时间窗和血管内治疗适应证的优化',
    key_points = '[
        "早期识别：FAST原则（面部下垂、手臂无力、言语困难、及时就医）",
        "静脉溶栓：发病4.5小时内rt-PA溶栓，部分患者可延长至9小时",
        "血管内治疗：大血管闭塞患者可考虑机械取栓，时间窗延长至24小时",
        "二级预防：抗血小板、降压、调脂、血糖控制",
        "影像学评估：CT平扫+CTA或MRI-DWI",
        "血压管理：急性期血压控制目标个体化"
    ]',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE '%脑梗%' OR title LIKE '%脑卒中%';

-- 5. 更新胃食管反流指南到2024版
UPDATE medical_guidelines SET
    title = '中国胃食管反流病共识意见',
    version = '2024版（西安）',
    publish_date = '2024-10-01',
    source = '中华医学会消化病学分会胃肠动力学组',
    summary = '2024年西安共识，对胃食管反流病的诊断、治疗策略进行了更新。强调PPI治疗的疗程和维持治疗的重要性',
    key_points = '[
        "典型症状：烧心、反流",
        "诊断方法：PPI试验、胃镜检查、24小时食管pH监测",
        "初始治疗：PPI标准剂量，疗程8周",
        "维持治疗：按需治疗或持续低剂量治疗",
        "生活方式干预：减重、戒烟、避免睡前进食",
        "难治性GERD：优化PPI治疗或考虑内镜/手术治疗"
    ]',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE '%胃食管反流%';

-- 验证更新结果
SELECT '更新后的医学指南:' as info;
SELECT title, version, publish_date::text, source 
FROM medical_guidelines 
ORDER BY id;
