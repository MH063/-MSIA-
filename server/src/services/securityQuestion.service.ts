/**
 * 安全问题服务
 * 处理用户设置的安全问题（用于密码重置）
 */

import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { secureLogger } from '../utils/secureLogger';

/**
 * 安全问题类型
 */
export interface SecurityQuestion {
  id: number;
  operatorId: number;
  question: string;
  answer: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建安全问题
 */
export async function createSecurityQuestion(
  operatorId: number,
  question: string,
  answer: string
): Promise<SecurityQuestion> {
  return await prisma.securityQuestion.create({
    data: {
      operatorId,
      question,
      answer,
    },
  });
}

/**
 * 验证安全问题答案
 */
export async function verifySecurityQuestion(
  operatorId: number,
  questionId: number,
  answer: string
): Promise<boolean> {
  const securityQuestion = await prisma.securityQuestion.findUnique({
    where: { id: questionId },
  });

  if (!securityQuestion) {
    return false;
  }

  return securityQuestion.answer === answer;
}

/**
 * 获取用户的所有安全问题
 */
export async function getSecurityQuestionsByOperatorId(
  operatorId: number
): Promise<SecurityQuestion[]> {
  return await prisma.securityQuestion.findMany({
    where: { operatorId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * 更新安全问题
 */
export async function updateSecurityQuestion(
  id: number,
  answer: string
): Promise<SecurityQuestion> {
  return await prisma.securityQuestion.update({
    where: { id },
    data: { answer, updatedAt: new Date() },
  });
}

/**
 * 删除安全问题
 */
export async function deleteSecurityQuestion(id: number): Promise<void> {
  await prisma.securityQuestion.delete({
    where: { id },
  });
}

/**
 * 常见安全问题模板
 */
export const SECURITY_QUESTION_TEMPLATES = {
  motherName: '您母亲的姓名是什么？',
  petName: '您宠物的名字是什么？',
  firstSchool: '您第一所学校的名称是什么？',
  favoriteColor: '您最喜欢的颜色是什么？',
  favoriteFood: '您最喜欢的食物是什么？',
  childhoodFriend: '您童年最好的朋友的名字是什么？',
  firstJob: '您的第一份工作的公司名称是什么？',
} as const;
