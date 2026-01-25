import prisma from '../prisma';
import dotenv from 'dotenv';

dotenv.config();

const abdominalPain = {
  symptomKey: 'abdominal_pain',
  displayName: '腹痛',
  requiredQuestions: [
    {
      id: 'ap_location',
      text: '疼痛的具体部位是哪里？',
      type: 'single_choice',
      options: ['右上腹', '右下腹', '左上腹', '左下腹', '脐周', '全腹'],
    },
    {
      id: 'ap_onset',
      text: '疼痛是如何开始的？',
      type: 'single_choice',
      options: ['突然开始', '逐渐加重'],
    },
    {
      id: 'ap_duration',
      text: '疼痛持续了多久？',
      type: 'text',
    },
    {
      id: 'ap_character',
      text: '疼痛的性质是什么？',
      type: 'multi_choice',
      options: ['胀痛', '绞痛', '烧灼痛', '刺痛', '隐痛'],
    },
  ],
  associatedSymptoms: ['nausea', 'vomiting', 'fever', 'diarrhea'],
  redFlags: ['severe_pain', 'bloody_stool', 'hypotension'],
};

const chestPain = {
  symptomKey: 'chest_pain',
  displayName: '胸痛',
  requiredQuestions: [
    {
      id: 'cp_location',
      text: '胸痛的具体位置？',
      type: 'single_choice',
      options: ['胸骨后', '心前区', '侧胸部'],
    },
    {
      id: 'cp_radiation',
      text: '疼痛是否有放射？',
      type: 'multi_choice',
      options: ['左肩', '左臂', '下颌', '背部', '无放射'],
    },
    {
      id: 'cp_trigger',
      text: '什么情况下疼痛会加重？',
      type: 'multi_choice',
      options: ['活动', '情绪激动', '深呼吸', '进食', '按压'],
    },
  ],
  associatedSymptoms: ['dyspnea', 'palpitation', 'sweating'],
  redFlags: ['syncope', 'sudden_onset', 'tearing_pain'],
};

const headache = {
  symptomKey: 'headache',
  displayName: '头痛',
  requiredQuestions: [
    { id: 'ha_location', text: '头痛部位？', type: 'single_choice', options: ['全头痛', '偏侧头痛', '前额痛', '枕部痛', '眼眶后痛'] },
    { id: 'ha_quality', text: '头痛性质？', type: 'single_choice', options: ['搏动性', '压迫感', '电击样', '炸裂样'] },
    { id: 'ha_duration', text: '发作时长？', type: 'text' },
    { id: 'ha_aggravating', text: '加重因素？', type: 'multi_choice', options: ['强光', '噪音', '活动', '体位改变'] }
  ],
  associatedSymptoms: ['nausea', 'vomiting', 'photophobia', 'phonophobia', 'visual_changes'],
  redFlags: ['thunderclap', 'fever_neck_stiffness', 'neurological_deficit', 'onset_after_50']
};

const fever = {
  symptomKey: 'fever',
  displayName: '发热',
  requiredQuestions: [
    { id: 'fe_temp', text: '最高体温是多少？', type: 'text' },
    { id: 'fe_pattern', text: '热型特点？', type: 'single_choice', options: ['持续高热', '弛张热', '间歇热', '不规则热'] },
    { id: 'fe_duration', text: '发热持续时间？', type: 'text' },
    { id: 'fe_chills', text: '是否伴有寒战？', type: 'single_choice', options: ['是', '否'] }
  ],
  associatedSymptoms: ['cough', 'headache', 'abdominal_pain', 'dysuria', 'rash'],
  redFlags: ['altered_mental_status', 'shock', 'petechiae', 'recent_travel']
};

const cough = {
  symptomKey: 'cough',
  displayName: '咳嗽',
  requiredQuestions: [
    { id: 'co_duration', text: '咳嗽持续时间？', type: 'text' },
    { id: 'co_sputum', text: '是否有痰？', type: 'single_choice', options: ['干咳', '白粘痰', '黄脓痰', '铁锈色痰', '血痰'] },
    { id: 'co_timing', text: '咳嗽发生的时间？', type: 'multi_choice', options: ['夜间', '清晨', '饭后', '全天'] },
    { id: 'co_trigger', text: '诱发因素？', type: 'multi_choice', options: ['冷空气', '异味', '运动', '体位改变'] }
  ],
  associatedSymptoms: ['fever', 'chest_pain', 'dyspnea', 'wheezing'],
  redFlags: ['hemoptysis', 'weight_loss', 'night_sweats', 'chest_pain']
};

const fatigue = {
  symptomKey: 'fatigue',
  displayName: '乏力',
  requiredQuestions: [
    { id: 'ft_duration', text: '乏力持续了多久？', type: 'text' },
    { id: 'ft_severity', text: '乏力程度如何？', type: 'single_choice', options: ['轻度（不影响工作）', '中度（影响工作但能自理）', '重度（需卧床）'] },
    { id: 'ft_pattern', text: '乏力的规律？', type: 'single_choice', options: ['晨起重午后轻', '午后重晨起轻', '全天持续', '活动后加重'] },
    { id: 'ft_sleep', text: '近期睡眠情况如何？', type: 'single_choice', options: ['正常', '入睡困难', '早醒', '多梦易醒'] }
  ],
  associatedSymptoms: ['fever', 'weight_loss', 'depression', 'anemia'],
  redFlags: ['sudden_onset', 'focal_weakness', 'significant_weight_loss']
};

const palpitations = {
  symptomKey: 'palpitations',
  displayName: '心悸',
  requiredQuestions: [
    { id: 'pl_pattern', text: '心跳的感觉是怎样的？', type: 'single_choice', options: ['心跳过快', '心跳过强', '心跳不齐', '心跳漏拍'] },
    { id: 'pl_trigger', text: '发作诱因？', type: 'multi_choice', options: ['运动', '情绪激动', '饮浓茶/咖啡', '休息时', '体位改变'] },
    { id: 'pl_duration', text: '每次持续多久？', type: 'text' },
    { id: 'pl_relief', text: '如何缓解？', type: 'text' }
  ],
  associatedSymptoms: ['chest_pain', 'dyspnea', 'dizziness', 'syncope'],
  redFlags: ['syncope', 'chest_pain', 'history_of_heart_disease']
};

const dyspnea = {
  symptomKey: 'dyspnea',
  displayName: '呼吸困难',
  requiredQuestions: [
    { id: 'dy_onset', text: '呼吸困难是如何开始的？', type: 'single_choice', options: ['突发', '逐渐加重'] },
    { id: 'dy_severity', text: '严重程度？', type: 'single_choice', options: ['剧烈运动后', '轻微活动后', '休息时'] },
    { id: 'dy_orthopnea', text: '平躺时是否加重？', type: 'single_choice', options: ['是', '否'] },
    { id: 'dy_nocturnal', text: '是否曾夜间憋醒？', type: 'single_choice', options: ['是', '否'] }
  ],
  associatedSymptoms: ['cough', 'chest_pain', 'wheezing', 'edema'],
  redFlags: ['cyanosis', 'stridor', 'unable_to_speak', 'altered_mental_status']
};

const dizziness = {
  symptomKey: 'dizziness',
  displayName: '头晕',
  requiredQuestions: [
    { id: 'dz_type', text: '头晕的感觉？', type: 'single_choice', options: ['天旋地转(眩晕)', '头重脚轻', '眼前发黑', '行走不稳'] },
    { id: 'dz_trigger', text: '诱发因素？', type: 'multi_choice', options: ['转头', '起床/站起', '劳累', '噪音'] },
    { id: 'dz_duration', text: '持续时间？', type: 'text' },
    { id: 'dz_hearing', text: '是否伴有听力下降或耳鸣？', type: 'single_choice', options: ['是', '否'] }
  ],
  associatedSymptoms: ['nausea', 'vomiting', 'tinnitus', 'headache'],
  redFlags: ['slurred_speech', 'limb_weakness', 'double_vision', 'severe_headache']
};

const insomnia = {
  symptomKey: 'insomnia',
  displayName: '失眠',
  requiredQuestions: [
    { id: 'in_type', text: '主要表现？', type: 'multi_choice', options: ['入睡困难', '维持睡眠困难', '早醒', '睡眠质量差'] },
    { id: 'in_duration', text: '持续多久了？', type: 'text' },
    { id: 'in_impact', text: '对日间功能的影响？', type: 'multi_choice', options: ['疲乏', '注意力不集中', '情绪低落', '无明显影响'] },
    { id: 'in_habits', text: '睡前习惯？', type: 'multi_choice', options: ['看手机/电视', '饮酒/咖啡', '剧烈运动', '无特殊'] }
  ],
  associatedSymptoms: ['anxiety', 'depression', 'fatigue', 'headache'],
  redFlags: ['snoring_with_apnea', 'restless_legs', 'acting_out_dreams']
};

async function main() {
  console.log('Start seeding...');

  for (const data of [abdominalPain, chestPain, headache, fever, dyspnea]) {
    const knowledge = await prisma.symptomKnowledge.upsert({
      where: { symptomKey: data.symptomKey },
      update: data,
      create: data,
    });
    console.log(`Upserted knowledge for: ${knowledge.displayName}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
