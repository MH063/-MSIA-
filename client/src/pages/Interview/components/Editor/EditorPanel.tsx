import React from 'react';
import { Card, Form, Button, Popconfirm, message } from 'antd';
import GeneralSection from './GeneralSection';
import ChiefComplaintSection from './ChiefComplaintSection';
import HPISection from './HPISection';
import PastHistorySection from './PastHistorySection';
import PersonalHistorySection from './PersonalHistorySection';
import MaritalHistorySection from './MaritalHistorySection';
import FamilyHistorySection from './FamilyHistorySection';
import ReviewOfSystemsSection from './ReviewOfSystemsSection';
import PhysicalExamSection from './PhysicalExamSection';
import SpecialistSection from './SpecialistSection';
import AuxiliaryExamSection from './AuxiliaryExamSection';

interface EditorPanelProps {
  currentSection: string;
  disableConfirm?: boolean;
  currentSectionLabel?: string;
  showResetButton?: boolean;
}

const getSectionResetFieldPaths = (sectionKey: string) => {
  const map: Record<string, (string | (string | number)[])[]> = {
    general: [
      'name',
      'gender',
      'age',
      'birthDate',
      'placeOfBirth',
      'ethnicity',
      'nativePlace',
      'occupation',
      'employer',
      'phone',
      'address',
      'historian',
      'reliability',
      'historianRelationship',
      ['generalInfo', 'admissionTime'],
      ['generalInfo', 'recordTime'],
    ],
    chief_complaint: [['chiefComplaint']],
    hpi: [['presentIllness']],
    past_history: [
      ['pastHistory', 'generalHealth'],
      ['pastHistory', 'pmh_diseases'],
      ['pastHistory', 'diseaseDetails'],
      ['pastHistory', 'infectiousHistory'],
      ['pastHistory', 'pmh_other'],
      ['pastHistory', 'illnessHistory'],
      ['pastHistory', 'surgeries'],
      ['pastHistory', 'transfusions'],
      ['pastHistory', 'allergies'],
      ['pastHistory', 'noAllergies'],
      ['pastHistory', 'vaccinationHistory'],
    ],
    personal_history: [
      ['personalHistory', 'birthplace'],
      ['personalHistory', 'residence'],
      ['personalHistory', 'epidemic_contact'],
      ['personalHistory', 'smoking_status'],
      ['personalHistory', 'cigarettesPerDay'],
      ['personalHistory', 'smokingYears'],
      ['personalHistory', 'quitSmokingYears'],
      ['personalHistory', 'smokingHistory'],
      ['personalHistory', 'smokingIndex'],
      ['personalHistory', 'alcohol_status'],
      ['personalHistory', 'drinkVolume'],
      ['personalHistory', 'alcoholDegree'],
      ['personalHistory', 'drinkFreqPerWeek'],
      ['personalHistory', 'weeklyAlcoholGrams'],
      ['personalHistory', 'quitDrinkingYears'],
      ['personalHistory', 'drinkingHistory'],
      ['personalHistory', 'social'],
      ['personalHistory', 'work_cond'],
      ['personalHistory', 'living_habits'],
      ['personalHistory', 'substances'],
      ['personalHistory', 'sexual_history'],
    ],
    marital_history: [['maritalHistory'], ['menstrualHistory'], ['fertilityHistory']],
    family_history: [['familyHistory']],
    physical_exam: [['physicalExam']],
    specialist: [['physicalExam', 'specialist'], ['physicalExam', 'specialistDepartment']],
    auxiliary_exam: [['auxiliaryExams']],
    review_of_systems: [['reviewOfSystems']],
  };
  return map[sectionKey] || [];
};

const EditorPanel: React.FC<EditorPanelProps> = ({
  currentSection,
  disableConfirm = false,
  showResetButton = true,
}) => {
  const form = Form.useFormInstance();
  const handleReset = () => {
    const keys = getSectionResetFieldPaths(currentSection);
    if (keys.length === 0) return;
    form.resetFields(keys as (string | number | (string | number)[])[]);
    message.success('已清空本板块内容');
  };

  const resetButton = showResetButton ? (
    disableConfirm ? (
      <Button danger data-testid="reset-section" onClick={handleReset}>重置本板块</Button>
    ) : (
      <Popconfirm
        title="确定要清空本部分所有已填写内容吗？"
        okText="确定"
        cancelText="取消"
        onConfirm={handleReset}
      >
        <Button danger data-testid="reset-section">重置本板块</Button>
      </Popconfirm>
    )
  ) : null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card
        className="interview-section-card"
        title={null}
        extra={resetButton}
        variant="borderless"
      >
        <div style={{ display: currentSection === 'general' ? 'block' : 'none' }}>
          <GeneralSection />
        </div>
        <div style={{ display: currentSection === 'chief_complaint' ? 'block' : 'none' }}>
          <ChiefComplaintSection form={form} />
        </div>
        <div style={{ display: currentSection === 'hpi' ? 'block' : 'none' }}>
          <HPISection />
        </div>
        <div style={{ display: currentSection === 'past_history' ? 'block' : 'none' }}>
          <PastHistorySection form={form} />
        </div>
        <div style={{ display: currentSection === 'personal_history' ? 'block' : 'none' }}>
          <PersonalHistorySection />
        </div>
        <div style={{ display: currentSection === 'marital_history' ? 'block' : 'none' }}>
          <MaritalHistorySection />
        </div>
        <div style={{ display: currentSection === 'family_history' ? 'block' : 'none' }}>
          <FamilyHistorySection />
        </div>
        <div style={{ display: currentSection === 'physical_exam' ? 'block' : 'none' }}>
          <PhysicalExamSection />
        </div>
        <div style={{ display: currentSection === 'specialist' ? 'block' : 'none' }}>
          <SpecialistSection />
        </div>
        <div style={{ display: currentSection === 'auxiliary_exam' ? 'block' : 'none' }}>
          <AuxiliaryExamSection />
        </div>
        <div style={{ display: currentSection === 'review_of_systems' ? 'block' : 'none' }}>
          <ReviewOfSystemsSection />
        </div>
      </Card>
    </div>
  );
};

export default EditorPanel;
