import assert from 'node:assert/strict';
import test from 'node:test';
import { SessionSchemas } from '../validators';

test('SessionSchemas.update 接受 null 的可选字段并不报 400', () => {
  const input = {
    historianRelationship: null,
    pastHistory: null,
    personalHistory: null,
    maritalHistory: null,
    menstrualHistory: null,
    fertilityHistory: null,
    familyHistory: null,
    physicalExam: null,
    specialistExam: null,
    auxiliaryExams: null,
    reviewOfSystems: null,
    chiefComplaint: {
      text: '活动后心悸气促5年',
      symptom: '心悸',
      durationNum: 5,
      durationUnit: '年',
    },
  };

  const parsed = SessionSchemas.update.parse(input);
  assert.ok(parsed);
  assert.equal((parsed as any).historianRelationship, undefined);
  assert.equal((parsed as any).pastHistory, undefined);
});

