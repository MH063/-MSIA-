import React from 'react';
import { Card, Form, Button, Space } from 'antd';
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
  loading?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  currentSection,
  form,
  loading
}) => {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>当前编辑: {currentSection}</span>
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
