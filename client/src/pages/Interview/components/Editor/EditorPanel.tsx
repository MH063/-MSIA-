import React from 'react';
import { Card, Form, Button, Popconfirm, message } from 'antd';
import type { FormInstance } from 'antd';
import GeneralSection from './GeneralSection';
import ChiefComplaintSection from './ChiefComplaintSection';
import HPISection from './HPISection';
import PastHistorySection from './PastHistorySection';
import PersonalHistorySection from './PersonalHistorySection';
import MaritalHistorySection from './MaritalHistorySection';
import FamilyHistorySection from './FamilyHistorySection';
import ReviewOfSystemsSection from './ReviewOfSystemsSection';

interface EditorPanelProps {
  currentSection: string;
  form: FormInstance;
  disableConfirm?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  currentSection,
  form,
  disableConfirm = false,
}) => {
  const handleReset = () => {
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
      ],
      chief_complaint: [['chiefComplaint']],
      hpi: [['presentIllness']],
      past_history: [
        ['pastHistory', 'pmh_diseases'],
        ['pastHistory', 'diseaseDetails'],
        ['pastHistory', 'pmh_other'],
        ['pastHistory', 'illnessHistory'],
        ['pastHistory', 'hasAllergy'],
        ['pastHistory', 'allergyDetails'],
        ['pastHistory', 'allergyHistory'],
        ['pastHistory', 'surgeryHistory'],
      ],
      personal_history: [
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
      review_of_systems: [['reviewOfSystems']],
    };
    const keys = map[currentSection] || [];
    if (keys.length === 0) return;
    form.resetFields(keys as (string | number | (string | number)[])[]);
    message.success('已清空本板块内容');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>当前编辑: {currentSection}</span>
            {disableConfirm ? (
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
            )}
          </div>
        }
        variant="borderless"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{}}
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
            <MaritalHistorySection form={form} />
          </div>
          <div style={{ display: currentSection === 'family_history' ? 'block' : 'none' }}>
            <FamilyHistorySection />
          </div>
          <div style={{ display: currentSection === 'review_of_systems' ? 'block' : 'none' }}>
            <ReviewOfSystemsSection />
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default EditorPanel;
