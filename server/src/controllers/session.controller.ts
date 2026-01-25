import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import * as knowledgeService from '../services/knowledge.service';
import prisma from '../prisma';

/**
 * 创建会话
 */
export const createSession = async (req: Request, res: Response) => {
  try {
    const { patientId, historian, reliability, historianRelationship } = req.body;
    if (!patientId) {
      res.status(400).json({ success: false, message: 'Patient ID is required' });
      return;
    }
    const session = await sessionService.createSession(Number(patientId), {
        historian, reliability, historianRelationship
    });
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
};

/**
 * 获取会话详情
 */
export const getSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionService.getSessionById(Number(id));
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
};

/**
 * 更新会话
 */
export const updateSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // 1. Separate Patient data and Session data
    const patientFields = [
        'name', 'gender', 'birthDate', 'nativePlace', 'placeOfBirth', 
        'ethnicity', 'address', 'occupation', 'employer', 'phone'
    ];

    const sessionFields = [
        'historian', 'reliability', 'historianRelationship',
        'generalInfo', 'chiefComplaint', 'presentIllness',
        'pastHistory', 'personalHistory', 'maritalHistory',
        'menstrualHistory', 'fertilityHistory', 'familyHistory',
        'reviewOfSystems', 'status'
    ];

    const patientData: any = {};
    const sessionData: any = {};

    Object.keys(body).forEach(key => {
        if (patientFields.includes(key)) {
            if (key === 'phone') {
                patientData.contactInfo = { phone: body[key] };
            } else {
                patientData[key] = body[key];
            }
        } else if (sessionFields.includes(key)) {
            sessionData[key] = body[key];
        }
    });

    // 2. Update Session
    const session = await sessionService.updateSession(Number(id), sessionData);

    // 3. Update Patient if there is patient data
    if (Object.keys(patientData).length > 0) {
        await prisma.patient.update({
            where: { id: session.patientId },
            data: patientData
        });
    }

    // 4. Return updated session with patient info
    const updatedSession = await sessionService.getSessionById(Number(id));
    res.json({ success: true, data: updatedSession });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, message: 'Failed to update session' });
  }
};

/**
 * 生成病历报告
 */
export const generateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionService.getSessionById(Number(id));

    if (!session || !session.patient) {
      res.status(404).json({ success: false, message: 'Session or patient not found' });
      return;
    }

    const { patient, chiefComplaint, presentIllness } = session;
    const cp = chiefComplaint as any;
    const pi = presentIllness as any;

    // 简单的模板生成逻辑
    let report = `【一般项目 (General Data)】\n`;
    report += `姓名：${patient.name}  性别：${patient.gender || '未知'}  年龄：${patient.birthDate ? Math.floor((new Date().getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + '岁' : '未知'}\n`;
    report += `籍贯：${(patient as any).nativePlace || '未记录'}  出生地：${(patient as any).placeOfBirth || '未记录'}  民族：${(patient as any).ethnicity || '未记录'}\n`;
    report += `婚姻：${(session.maritalHistory as any)?.status || '未记录'}  职业：${(patient as any).occupation || '未记录'}  工作单位：${(patient as any).employer || '未记录'}\n`;
    report += `通信地址：${(patient as any).address || '未记录'}  电话号码：${(patient as any).contactInfo?.phone || '未记录'}\n`;
    
    report += `入院日期：${new Date(session.createdAt).toLocaleDateString()}  记录日期：${new Date().toLocaleDateString()}\n`;
    report += `病史陈述者：${(session as any).historian || '本人'}  可靠程度：${(session as any).reliability || '可靠'}\n`;
    if ((session as any).historianRelationship) {
        report += `与病人关系：${(session as any).historianRelationship}\n`;
    }
    report += `\n`;

    report += `【主诉】\n`;
    report += `${cp?.text || '未记录'}\n\n`;

    report += `【现病史】\n`;
    if (pi && typeof pi === 'object') {
        // 1. 起病情况与患病时间
        if (pi.hpi_onset) report += `1. 起病情况：${pi.hpi_onset}\n`;
        if (pi.hpi_duration) report += `   患病时间：${pi.hpi_duration}\n`;
        
        // 2. 主要症状特点
        report += `2. 主要症状特点：\n`;
        if (cp?.symptomKey) {
             const knowledge = await prisma.symptomKnowledge.findUnique({
                where: { symptomKey: cp.symptomKey }
            });
            
            if (knowledge) {
                const questions = knowledge.requiredQuestions as any[];
                for (const key in pi) {
                    if (key.startsWith('hpi_')) continue; // Skip general HPI fields
                    const question = questions.find(q => q.id === key);
                    const answer = Array.isArray(pi[key]) ? pi[key].join(', ') : pi[key];
                    if (question) {
                        report += `   - ${question.text.replace('？', '')}: ${answer}\n`;
                    } else {
                        // Avoid printing hpi_ fields again
                         if (!key.startsWith('hpi_')) {
                            report += `   - ${key}: ${answer}\n`;
                         }
                    }
                }
            } else {
                 for (const key in pi) {
                    if (key.startsWith('hpi_')) continue;
                    const answer = Array.isArray(pi[key]) ? pi[key].join(', ') : pi[key];
                    report += `   - ${key}: ${answer}\n`;
                }
            }
        } else {
             // 通用模式下的症状详情
             if (pi.hpi_symptom_details) report += `   ${pi.hpi_symptom_details}\n`;
        }

        // 3. 病因与诱因
        if (pi.hpi_causes || pi.hpi_triggers) {
            report += `3. 病因与诱因：\n`;
            if (pi.hpi_causes) report += `   病因：${pi.hpi_causes}\n`;
            if (pi.hpi_triggers) report += `   诱因：${pi.hpi_triggers}\n`;
        }

        // 4. 病情的发展与演变
        if (pi.hpi_evolution) report += `4. 病情发展与演变：${pi.hpi_evolution}\n`;

        // 5. 伴随症状
        if (pi.hpi_associated_symptoms) report += `5. 伴随症状：${pi.hpi_associated_symptoms}\n`;

        // 6. 诊治经过
        if (pi.hpi_treatment_history) report += `6. 诊治经过：${pi.hpi_treatment_history}\n`;

        // 7. 病程中的一般情况
        if (pi.hpi_general_spirit || pi.hpi_general_diet || pi.hpi_general_sleep || pi.hpi_general_excretion) {
            report += `7. 一般情况：\n`;
            if (pi.hpi_general_spirit) report += `   精神/体力：${pi.hpi_general_spirit}\n`;
            if (pi.hpi_general_diet) report += `   食欲/食量：${pi.hpi_general_diet}\n`;
            if (pi.hpi_general_sleep) report += `   睡眠：${pi.hpi_general_sleep}\n`;
            if (pi.hpi_general_excretion) report += `   大小便：${pi.hpi_general_excretion}\n`;
        }

    } else {
        report += `未记录详细现病史\n`;
    }

    report += `\n【既往史】\n`;
    const pmh = session.pastHistory as any;
    if (pmh && typeof pmh === 'object' && Object.keys(pmh).length > 0) {
        // 1. 既往疾病
        if (pmh.pmh_diseases) report += `1. 既往疾病：${pmh.pmh_diseases}\n`;
        // 2. 传染病/地方病
        if (pmh.pmh_infectious) report += `2. 传染病/地方病：${pmh.pmh_infectious}\n`;
        // 3. 外伤/手术
        if (pmh.pmh_trauma_surgery) report += `3. 外伤/手术：${pmh.pmh_trauma_surgery}\n`;
        // 4. 预防接种
        if (pmh.pmh_vaccination) report += `4. 预防接种：${pmh.pmh_vaccination}\n`;
        // 5. 过敏史
        if (pmh.pmh_allergies) report += `5. 过敏史：${pmh.pmh_allergies}\n`;

        // 兼容旧数据
        if (pmh.ph_conditions && Array.isArray(pmh.ph_conditions) && pmh.ph_conditions.length > 0) {
            report += `既往疾病(旧)：${pmh.ph_conditions.join(', ')}\n`;
        }
        if (pmh.ph_other) report += `其他说明(旧)：${pmh.ph_other}\n`;
    } else {
        report += `无特殊记载\n`;
    }

    report += `\n【系统回顾】\n`;
      const ros = session.reviewOfSystems as any;
      
      const rosConfig = [
        { key: 'respiratory', label: '1. 呼吸系统' },
        { key: 'cardiovascular', label: '2. 循环系统' },
        { key: 'digestive', label: '3. 消化系统' },
        { key: 'urinary', label: '4. 泌尿系统' },
        { key: 'hematologic', label: '5. 血液系统' },
        { key: 'endocrine', label: '6. 内分泌及代谢系统' },
        { key: 'neurological', label: '7. 神经精神系统' },
        { key: 'musculoskeletal', label: '8. 肌肉骨骼系统' }
      ];

      if (ros && typeof ros === 'object') {
          let hasRos = false;
          
          for (const item of rosConfig) {
              const data = ros[item.key];
              if (!data) continue;

              let content = '';
              // Handle new structure { symptoms: [], details: '' }
              if (typeof data === 'object' && !Array.isArray(data)) {
                  const parts = [];
                  if (data.symptoms && Array.isArray(data.symptoms) && data.symptoms.length > 0) {
                      parts.push(`症状：${data.symptoms.join(', ')}`);
                  }
                  if (data.details) {
                      parts.push(`详情：${data.details}`);
                  }
                  if (parts.length > 0) {
                      content = parts.join('；');
                  }
              } 
              // Handle old structure string[]
              else if (Array.isArray(data) && data.length > 0) {
                  content = data.join(', ');
              }

              if (content) {
                  report += `${item.label}：${content}\n`;
                  hasRos = true;
              }
          }
          
          if (!hasRos) report += "无特殊异常\n";
      } else {
          report += "未记录\n";
      }
      
      report += `\n【个人史】\n`;
     const personal = session.personalHistory as any;
     if (personal && typeof personal === 'object') {
         // 1. 社会经历
         if (personal.social) {
             report += `1. 社会经历：${personal.social}\n`;
         }

         // 2. 职业及工作条件
         const occupation = (session as any).occupation || '未记录';
         const employer = (session as any).employer || '未记录';
         if (personal.work_cond || occupation !== '未记录' || employer !== '未记录') {
             report += `2. 职业及工作条件：\n`;
             if (occupation !== '未记录') report += `   职业：${occupation}  `;
             if (employer !== '未记录') report += `单位：${employer}`;
             if (occupation !== '未记录' || employer !== '未记录') report += '\n';
             if (personal.work_cond) report += `   工作环境/接触史：${personal.work_cond}\n`;
         }

         // 3. 习惯与嗜好
         let habits = [];
         if (personal.living_habits) habits.push(`起居饮食：${personal.living_habits}`);
         
         // Smoking
         const smokingStatus = personal.smoking_status || personal.smoking;
         if (smokingStatus) {
             let s = `吸烟：${smokingStatus}`;
             if (personal.smoking_details) s += ` (${personal.smoking_details})`;
             habits.push(s);
         }

         // Alcohol
         const alcoholStatus = personal.alcohol_status || personal.alcohol;
         if (alcoholStatus) {
             let a = `饮酒：${alcoholStatus}`;
             if (personal.alcohol_details) a += ` (${personal.alcohol_details})`;
             habits.push(a);
         }

         if (personal.substances) habits.push(`其他嗜好：${personal.substances}`);
         
         if (habits.length > 0) {
             report += `3. 习惯与嗜好：\n   ${habits.join('\n   ')}\n`;
         }

         // 4. 冶游史
         if (personal.sexual_history) {
             report += `4. 冶游史：${personal.sexual_history}\n`;
         }

         // Legacy 'other'
         if (personal.other && !personal.work_cond && !personal.living_habits) {
             report += `其他说明(旧)：${personal.other}\n`;
         }

     } else {
         report += "未记录\n";
     }

     report += `\n【婚姻史】\n`;
     const marital = session.maritalHistory as any;
     if (marital) {
         let mContent = `婚姻状况：${marital.status || '未记录'}`;
         if (marital.marriage_age) mContent += `，结婚年龄：${marital.marriage_age}岁`;
         if (marital.spouse_health) mContent += `，配偶健康状况：${marital.spouse_health}`;
         if (marital.children) mContent += `，子女情况：${marital.children}`; // In case added to marital structure
         report += `${mContent}\n`;
         
         if (marital.other) report += `说明：${marital.other}\n`;
     } else {
         report += "未记录\n";
     }

     const menstrual = session.menstrualHistory as any;
     const fertility = session.fertilityHistory as any;
     
     if (menstrual || fertility) {
         report += `\n【月经与生育史】\n`;
         
         if (menstrual) {
             // Format: Age Duration/Cycle LMP/Menopause
             const age = menstrual.age || '?';
             const duration = menstrual.duration || '?';
             const cycle = menstrual.cycle || '?';
             const lmpOrMenopause = menstrual.menopause_age 
                ? `${menstrual.menopause_age}岁(绝经)` 
                : (menstrual.lmp || '未知');
             
             // Formula style line
             report += `月经史：${age}  ${duration}/${cycle}  ${lmpOrMenopause}\n`;
             
             // Details line
             let details = [];
             if (menstrual.flow) details.push(`经量：${menstrual.flow}`);
             if (menstrual.color) details.push(`经色：${menstrual.color}`);
             if (menstrual.pain) details.push(`痛经/白带：${menstrual.pain}`);
             
             if (details.length > 0) {
                 report += `      ${details.join('，')}\n`;
             }
         }

         if (fertility) {
              let fLine = `生育史：G${fertility.gravida || '0'}P${fertility.para || '0'}`;
              if (fertility.abortion_artificial) fLine += `，人工流产${fertility.abortion_artificial}次`;
              if (fertility.abortion_natural) fLine += `，自然流产${fertility.abortion_natural}次`;
              report += `${fLine}\n`;
              
              if (fertility.stillbirth) report += `      死产/早产：${fertility.stillbirth}\n`;
              if (fertility.premature) report += `      早产：${fertility.premature}\n`;
              if (fertility.contraception) report += `      避孕措施：${fertility.contraception}\n`;
         }
     }

     report += `\n【家族史】\n`;
     const family = session.familyHistory as any;
     if (family) {
         let hasFamily = false;
         // 1. Relatives status
         if (family.parents) { report += `父母：${family.parents}\n`; hasFamily = true; }
         if (family.siblings) { report += `兄弟姐妹：${family.siblings}\n`; hasFamily = true; }
         if (family.children) { report += `子女：${family.children}\n`; hasFamily = true; }
         
         // 2. Genetic diseases
         let genetic = [];
         if (family.conditions && Array.isArray(family.conditions) && family.conditions.length > 0) {
             genetic.push(...family.conditions);
         }
         if (family.genetic_disease) {
             genetic.push(family.genetic_disease);
         }
         
         if (genetic.length > 0) {
             report += `家族遗传病史：${genetic.join('；')}\n`;
             hasFamily = true;
         } else if (!hasFamily) {
              // Only print "None" if nothing else was printed
             report += `家族遗传病史：无特殊记载\n`;
         }

         // 3. Deceased (if stored in separate field, currently maybe in parents/siblings text)
         if (family.deceased) {
             report += `已故亲属：${family.deceased}\n`;
             hasFamily = true;
         }

         if (family.other) {
             report += `说明：${family.other}\n`;
             hasFamily = true;
         }
         
         if (!hasFamily && !genetic.length) {
              report += "未记录\n";
         }
     } else {
         report += "未记录\n";
     }

     report += `\n【初步建议】\n`;
    report += `建议进行进一步体格检查及相关辅助检查。`;

    res.json({ success: true, data: { report } });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

/**
 * 获取会话列表
 */
export const getAllSessions = async (req: Request, res: Response) => {
    try {
        // 支持 limit/offset 与 page/pageSize
        const { limit, offset, page, pageSize, status, search } = req.query as Record<string, string>;
        let take = 10;
        let skip = 0;
        if (typeof limit === 'string') {
            take = Number(limit);
        } else if (typeof pageSize === 'string') {
            take = Number(pageSize);
        }
        if (typeof offset === 'string') {
            skip = Number(offset);
        } else if (typeof page === 'string') {
            const p = Number(page) || 1;
            skip = (p - 1) * take;
        }

        const where: any = {};
        
        // Status filtering
        if (status) {
            if (status === 'incomplete') {
                where.status = { notIn: ['archived', 'completed'] };
            } else if (status === 'completed') {
                where.status = { in: ['archived', 'completed'] };
            } else {
                where.status = status;
            }
        }

        // Search by patient name
        if (search) {
            where.patient = {
                name: {
                    contains: search,
                    mode: 'insensitive'
                }
            };
        }

        const sessions = await sessionService.getSessions({
            take,
            skip,
            where,
            orderBy: { createdAt: 'desc' }
        });
        const total = await sessionService.countSessions(where);
        res.json({ success: true, data: { items: sessions, total } });
    } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({ success: false, message: 'Failed to get sessions' });
    }
};

/**
 * 获取仪表盘统计数据
 */
export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayCount = await sessionService.countSessions({
            createdAt: { gte: today }
        });

        const completedCount = await sessionService.countSessions({
            status: 'completed'
        });
        const archivedCount = await sessionService.countSessions({
            status: 'archived'
        });

        const recentSessions = await sessionService.getSessions({
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        const knowledgeCount = await knowledgeService.countKnowledge();
        const recentKnowledge = await knowledgeService.getRecentKnowledge(3);

        res.json({
            success: true,
            data: {
                todayCount,
                completedCount,
                archivedCount,
                recentSessions,
                knowledgeCount,
                recentKnowledge
            }
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
    }
};

/**
 * 删除会话
 */
export const deleteSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await sessionService.deleteSession(Number(id));
        res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ success: false, message: 'Failed to delete session' });
    }
};

/**
 * 批量删除会话
 */
export const deleteSessionsBulk = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body as { ids: number[] };
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, message: '缺少有效的ID列表' });
            return;
        }
        const normalizedIds = ids.map(Number).filter(id => Number.isFinite(id));
        console.log('[Controller] Bulk delete sessions ids:', normalizedIds);
        const result = await sessionService.deleteSessionsBulk(normalizedIds);
        res.json({ success: true, data: { deletedCount: result.count } });
    } catch (error) {
        console.error('Error bulk deleting sessions:', error);
        res.status(500).json({ success: false, message: 'Failed to bulk delete sessions' });
    }
};
