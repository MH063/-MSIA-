import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Tabs, 
  Tag, 
  Typography, 
  Button, 
  Space, 
  Badge, 
  List,
  Progress,
  Empty,
  Skeleton,
  message,
  Alert,
  Tooltip
} from 'antd';
import { 
  MedicineBoxOutlined, 
  BranchesOutlined, 
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  StarOutlined,
  FireOutlined
} from '@ant-design/icons';
import api, { unwrapData } from '../../../../utils/api';
import type { ApiResponse } from '../../../../utils/api';
import SymptomGraph from './SymptomGraph';

const { Text } = Typography;
const { TabPane } = Tabs;

interface DiagnosisConfidenceDetail {
  diagnosis: string;
  confidence: number;
  supportingEvidence: string[];
  conflictingEvidence: string[];
  missingEvidence: string[];
  redFlags: string[];
  recommendation: string;
}

interface SymptomAssociation {
  symptom: string;
  associatedSymptoms: string[];
  relatedDiagnoses: string[];
  strength: number;
}

interface EnhancedDiagnosisPanelProps {
  currentSymptom: string;
  associatedSymptoms: string[];
  redFlags: string[];
  patientInfo?: {
    age?: number;
    gender?: string;
  };
  sessionId?: number;
  onDiagnosisSelect?: (diagnosis: string) => void;
  onAddAssociatedSymptom?: (symptom: string) => void;
}

const PRIORITY_CONFIG = {
  high: { color: '#ff4d4f', bgColor: '#fff2f0', borderColor: '#ffccc7', label: '高优先级', icon: <FireOutlined /> },
  medium: { color: '#faad14', bgColor: '#fffbe6', borderColor: '#ffe58f', label: '中优先级', icon: <StarOutlined /> },
  low: { color: '#8c8c8c', bgColor: '#f5f5f5', borderColor: '#d9d9d9', label: '低优先级', icon: <InfoCircleOutlined /> }
};

const CONFIDENCE_CONFIG = {
  high: { color: '#52c41a', bgColor: '#f6ffed', borderColor: '#b7eb8f', label: '高置信度', threshold: 0.8 },
  medium: { color: '#faad14', bgColor: '#fffbe6', borderColor: '#ffe58f', label: '中等置信度', threshold: 0.6 },
  low: { color: '#fa8c16', bgColor: '#fff7e6', borderColor: '#ffd591', label: '低置信度', threshold: 0.4 },
  veryLow: { color: '#bfbfbf', bgColor: '#f5f5f5', borderColor: '#d9d9d9', label: '需进一步检查', threshold: 0 }
};

const EnhancedDiagnosisPanel: React.FC<EnhancedDiagnosisPanelProps> = ({
  currentSymptom,
  associatedSymptoms,
  redFlags,
  patientInfo,
  sessionId,
  onDiagnosisSelect,
  onAddAssociatedSymptom
}) => {
  const [activeTab, setActiveTab] = useState('graph');
  const [loading, setLoading] = useState(false);
  
  const [diagnoses, setDiagnoses] = useState<Array<{
    name: string;
    confidence: number;
    supportingSymptoms: string[];
    excludingSymptoms: string[];
    redFlags: string[];
  }>>([]);
  
  const [confidenceDetails, setConfidenceDetails] = useState<DiagnosisConfidenceDetail[]>([]);
  const [excludedDiagnoses, setExcludedDiagnoses] = useState<Set<string>>(new Set());
  const [prioritizedDiagnosis, setPrioritizedDiagnosis] = useState<string | null>(null);
  const [symptomAssociations, setSymptomAssociations] = useState<SymptomAssociation[]>([]);

  const fetchEnhancedDiagnoses = useCallback(async () => {
    if (!currentSymptom || !sessionId) return;
    
    setLoading(true);
    try {
      const res = await api.post('/diagnosis/enhanced-suggest', {
        sessionId,
        currentSymptom,
        associatedSymptoms,
        redFlags,
        age: patientInfo?.age,
        gender: patientInfo?.gender
      }) as ApiResponse<{
        diagnoses: Array<{
          name: string;
          confidence: number;
          supportingSymptoms: string[];
          excludingSymptoms: string[];
          redFlags: string[];
        }>;
        confidenceDetails: DiagnosisConfidenceDetail[];
        symptomAssociations: SymptomAssociation[];
      }>;
      
      const data = unwrapData<{
        diagnoses: Array<{
          name: string;
          confidence: number;
          supportingSymptoms: string[];
          excludingSymptoms: string[];
          redFlags: string[];
        }>;
        confidenceDetails: DiagnosisConfidenceDetail[];
        symptomAssociations: SymptomAssociation[];
      }>(res);
      
      if (data) {
        setDiagnoses(data.diagnoses);
        setConfidenceDetails(data.confidenceDetails);
        setSymptomAssociations(data.symptomAssociations);
        console.log('[增强诊断] 诊断建议加载成功', { 
          count: data.diagnoses.length,
          topConfidence: data.diagnoses[0]?.confidence 
        });
      }
    } catch (error) {
      console.error('[增强诊断] 获取诊断建议失败:', error);
      message.error('诊断建议加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentSymptom, associatedSymptoms, redFlags, patientInfo, sessionId]);

  useEffect(() => {
    fetchEnhancedDiagnoses();
  }, [fetchEnhancedDiagnoses]);

  const handleExcludeDiagnosis = (diagnosisName: string) => {
    setExcludedDiagnoses(prev => {
      const newSet = new Set(prev);
      newSet.add(diagnosisName);
      return newSet;
    });
    message.info(`已将 "${diagnosisName}" 排除`);
  };

  const handlePrioritizeDiagnosis = (diagnosisName: string) => {
    setPrioritizedDiagnosis(diagnosisName);
    message.success(`已将 "${diagnosisName}" 设为优先诊断`);
    onDiagnosisSelect?.(diagnosisName);
  };

  const handleRestoreDiagnosis = (diagnosisName: string) => {
    setExcludedDiagnoses(prev => {
      const newSet = new Set(prev);
      newSet.delete(diagnosisName);
      return newSet;
    });
    message.success(`已恢复 "${diagnosisName}"`);
  };

  const getConfidenceConfig = (confidence: number) => {
    if (confidence >= CONFIDENCE_CONFIG.high.threshold) return CONFIDENCE_CONFIG.high;
    if (confidence >= CONFIDENCE_CONFIG.medium.threshold) return CONFIDENCE_CONFIG.medium;
    if (confidence >= CONFIDENCE_CONFIG.low.threshold) return CONFIDENCE_CONFIG.low;
    return CONFIDENCE_CONFIG.veryLow;
  };

  const getPriorityFromConfidence = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  };

  const renderLoadingSkeleton = () => (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );

  const renderSymptomGraph = () => {
    const filteredDiagnoses = diagnoses.filter(d => !excludedDiagnoses.has(d.name));
    
    return (
      <SymptomGraph
        currentSymptom={currentSymptom}
        associatedSymptoms={associatedSymptoms}
        differentialDiagnoses={filteredDiagnoses}
        redFlags={redFlags}
        onNodeClick={(node) => {
          console.log('[图谱] 节点点击', node);
        }}
        onExcludeDiagnosis={handleExcludeDiagnosis}
        onPrioritizeDiagnosis={handlePrioritizeDiagnosis}
        loading={loading}
      />
    );
  };

  const renderConfidenceAnalysis = () => {
    if (loading) {
      return renderLoadingSkeleton();
    }

    const activeDiagnoses = diagnoses.filter(d => !excludedDiagnoses.has(d.name));
    
    if (activeDiagnoses.length === 0) {
      return (
        <Empty 
          description={
            <div>
              <Text type="secondary">暂无诊断建议数据</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>请确保已输入症状信息并刷新</Text>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 48 }}
        />
      );
    }

    return (
      <div>
        <Alert
          message="置信度评分说明"
          description="基于症状匹配度、患者特征、医学知识库等多维度计算得出，数值越高表示诊断可能性越大"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeDiagnoses.map((diagnosis, index) => {
            const detail = confidenceDetails.find(d => d.diagnosis === diagnosis.name);
            const isPrioritized = prioritizedDiagnosis === diagnosis.name;
            const confidenceConfig = getConfidenceConfig(diagnosis.confidence);
            const priority = getPriorityFromConfidence(diagnosis.confidence);
            const priorityConfig = PRIORITY_CONFIG[priority];
            
            return (
              <div
                key={diagnosis.name}
                style={{ 
                  background: isPrioritized ? confidenceConfig.bgColor : '#fff',
                  border: `1px solid ${isPrioritized ? confidenceConfig.borderColor : '#f0f0f0'}`,
                  borderRadius: 12,
                  padding: 16,
                  transition: 'all 0.3s ease',
                  boxShadow: isPrioritized ? `0 4px 12px ${confidenceConfig.color}20` : '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <Space align="center">
                    <div style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: 8, 
                      background: `linear-gradient(135deg, ${confidenceConfig.color} 0%, ${confidenceConfig.color}99 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: `0 2px 8px ${confidenceConfig.color}40`
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <Text strong style={{ fontSize: 15 }}>{diagnosis.name}</Text>
                      {isPrioritized && (
                        <div style={{ marginTop: 2 }}>
                          <Tag color="success" style={{ margin: 0 }}>
                            <StarOutlined /> 优先诊断
                          </Tag>
                        </div>
                      )}
                    </div>
                  </Space>
                  <Space align="center">
                    <Tag 
                      style={{ 
                        background: confidenceConfig.bgColor,
                        borderColor: confidenceConfig.borderColor,
                        color: confidenceConfig.color,
                        borderRadius: 4
                      }}
                    >
                      {confidenceConfig.label}
                    </Tag>
                    <Text strong style={{ fontSize: 20, color: confidenceConfig.color }}>
                      {(diagnosis.confidence * 100).toFixed(1)}%
                    </Text>
                  </Space>
                </div>

                <Progress 
                  percent={diagnosis.confidence * 100} 
                  strokeColor={confidenceConfig.color}
                  showInfo={false}
                  trailColor="#f0f0f0"
                  strokeLinecap="round"
                  style={{ marginBottom: 16 }}
                />

                <Row gutter={12}>
                  <Col span={8}>
                    <div style={{ 
                      background: '#f6ffed', 
                      borderRadius: 8, 
                      padding: 12,
                      height: '100%'
                    }}>
                      <Text strong style={{ color: '#52c41a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircleOutlined /> 支持证据
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        {diagnosis.supportingSymptoms.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {diagnosis.supportingSymptoms.slice(0, 3).map((symptom, idx) => (
                              <li key={idx}>
                                <Text style={{ fontSize: 12, color: '#333' }}>{symptom}</Text>
                              </li>
                            ))}
                            {diagnosis.supportingSymptoms.length > 3 && (
                              <Text type="secondary" style={{ fontSize: 11 }}>...等{diagnosis.supportingSymptoms.length}项</Text>
                            )}
                          </ul>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>暂无支持证据</Text>
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ 
                      background: '#fff2f0', 
                      borderRadius: 8, 
                      padding: 12,
                      height: '100%'
                    }}>
                      <Text strong style={{ color: '#ff4d4f', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CloseCircleOutlined /> 排除证据
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        {diagnosis.excludingSymptoms.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {diagnosis.excludingSymptoms.slice(0, 3).map((symptom, idx) => (
                              <li key={idx}>
                                <Text style={{ fontSize: 12, color: '#333' }}>{symptom}</Text>
                              </li>
                            ))}
                            {diagnosis.excludingSymptoms.length > 3 && (
                              <Text type="secondary" style={{ fontSize: 11 }}>...等{diagnosis.excludingSymptoms.length}项</Text>
                            )}
                          </ul>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>暂无排除证据</Text>
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ 
                      background: '#fff7e6', 
                      borderRadius: 8, 
                      padding: 12,
                      height: '100%'
                    }}>
                      <Text strong style={{ color: '#ff7a45', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <WarningOutlined /> 警惕征象
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        {diagnosis.redFlags.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {diagnosis.redFlags.slice(0, 3).map((flag, idx) => (
                              <li key={idx}>
                                <Text type="danger" style={{ fontSize: 12 }}>{flag}</Text>
                              </li>
                            ))}
                            {diagnosis.redFlags.length > 3 && (
                              <Text type="secondary" style={{ fontSize: 11 }}>...等{diagnosis.redFlags.length}项</Text>
                            )}
                          </ul>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>暂无警惕征象</Text>
                        )}
                      </div>
                    </div>
                  </Col>
                </Row>

                {detail && (
                  <div style={{ marginTop: 12, padding: 12, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
                    <Text style={{ fontSize: 12 }}>
                      <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                      <strong>建议:</strong> {detail.recommendation}
                    </Text>
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <Space>
                    <Tooltip title={`标记为${priorityConfig.label}`}>
                      <Button 
                        type={isPrioritized ? 'primary' : 'default'}
                        size="small"
                        icon={priorityConfig.icon}
                        onClick={() => handlePrioritizeDiagnosis(diagnosis.name)}
                        disabled={isPrioritized}
                        style={{ 
                          background: isPrioritized ? priorityConfig.bgColor : undefined,
                          borderColor: isPrioritized ? priorityConfig.borderColor : undefined
                        }}
                      >
                        {isPrioritized ? `${priorityConfig.label}` : `设为${priorityConfig.label}`}
                      </Button>
                    </Tooltip>
                    <Button 
                      danger
                      type="text"
                      size="small"
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleExcludeDiagnosis(diagnosis.name)}
                    >
                      排除
                    </Button>
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSymptomAssociation = () => {
    if (loading) {
      return renderLoadingSkeleton();
    }

    if (symptomAssociations.length === 0) {
      return (
        <Empty 
          description={
            <div>
              <Text type="secondary">暂无症状关联数据</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>系统正在分析症状间的关联关系</Text>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 48 }}
        />
      );
    }

    return (
      <div>
        <Alert
          message="症状关联分析"
          description="基于医学知识库和临床数据，展示症状之间的关联强度和可能的鉴别诊断"
          type="info"
          showIcon
          icon={<BranchesOutlined />}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />

        <List
          grid={{ gutter: 16, column: 2 }}
          dataSource={symptomAssociations}
          renderItem={association => (
            <List.Item>
              <Card 
                size="small" 
                title={
                  <Space>
                    <div style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: 6, 
                      background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <BranchesOutlined style={{ color: '#fff', fontSize: 12 }} />
                    </div>
                    <span style={{ fontWeight: 500 }}>{association.symptom}</span>
                  </Space>
                }
                style={{ 
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 12 }}>关联强度</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{(association.strength * 100).toFixed(0)}%</Text>
                  </div>
                  <Progress 
                    percent={association.strength * 100} 
                    size="small" 
                    showInfo={false}
                    strokeColor="#1890ff"
                    trailColor="#f0f0f0"
                  />
                </div>

                {association.associatedSymptoms.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 12, color: '#333' }}>常见伴随症状:</Text>
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {association.associatedSymptoms.map(symptom => (
                        <Tag 
                          key={symptom}
                          style={{ 
                            marginBottom: 2, 
                            cursor: 'pointer',
                            borderRadius: 4,
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => onAddAssociatedSymptom?.(symptom)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e6f7ff';
                            e.currentTarget.style.borderColor = '#1890ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '';
                            e.currentTarget.style.borderColor = '';
                          }}
                        >
                          + {symptom}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {association.relatedDiagnoses.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#333' }}>相关诊断:</Text>
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {association.relatedDiagnoses.map(diagnosis => (
                        <Tag 
                          key={diagnosis} 
                          color="purple"
                          style={{ marginBottom: 2, borderRadius: 4 }}
                        >
                          {diagnosis}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </List.Item>
          )}
        />
      </div>
    );
  };

  const renderExcludedList = () => {
    if (excludedDiagnoses.size === 0) {
      return (
        <Empty 
          description={
            <div>
              <Text type="secondary">暂无排除的诊断</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>点击诊断卡片上的"排除"按钮可排除不需要的诊断</Text>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 48 }}
        />
      );
    }

    return (
      <div style={{ background: '#fafafa', borderRadius: 8, padding: 8 }}>
        <Alert
          message="已排除的诊断"
          description="被排除的诊断将不会显示在症状关联图谱和置信度分析中，可以随时恢复"
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <List
          dataSource={Array.from(excludedDiagnoses)}
          renderItem={diagnosisName => (
            <List.Item
              actions={[
                <Button 
                  key="restore"
                  type="link"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => handleRestoreDiagnosis(diagnosisName)}
                >
                  恢复
                </Button>
              ]}
              style={{ 
                background: '#fff',
                borderRadius: 6,
                marginBottom: 4,
                padding: '8px 12px'
              }}
            >
              <Space>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <Text delete type="secondary">{diagnosisName}</Text>
              </Space>
            </List.Item>
          )}
        />
      </div>
    );
  };

  return (
    <Card
      title={
        <Space>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 10, 
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)'
          }}>
            <MedicineBoxOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <Space orientation="vertical" size={0}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>智能诊断引擎</span>
            {prioritizedDiagnosis && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                优先诊断: <Text strong style={{ color: '#52c41a' }}>{prioritizedDiagnosis}</Text>
              </Text>
            )}
          </Space>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="刷新诊断数据">
            <Button 
              icon={<ReloadOutlined />} 
              size="small"
              onClick={fetchEnhancedDiagnoses}
              loading={loading}
              shape="circle"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
          </Tooltip>
        </Space>
      }
      style={{ 
        height: '100%',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}
      bodyStyle={{ padding: 16 }}
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        style={{ marginTop: -8 }}
      >
        <TabPane 
          tab={
            <span>
              <BranchesOutlined /> 症状关联图谱
            </span>
          } 
          key="graph"
        >
          {renderSymptomGraph()}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <BarChartOutlined /> 置信度分析
              {diagnoses.length > 0 && (
                <Badge count={diagnoses.length} style={{ marginLeft: 8, backgroundColor: '#722ed1' }} />
              )}
            </span>
          } 
          key="confidence"
        >
          {renderConfidenceAnalysis()}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <FileTextOutlined /> 症状关联
            </span>
          } 
          key="association"
        >
          {renderSymptomAssociation()}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <CloseCircleOutlined /> 已排除
              {excludedDiagnoses.size > 0 && (
                <Badge count={excludedDiagnoses.size} style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} />
              )}
            </span>
          } 
          key="excluded"
        >
          {renderExcludedList()}
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default EnhancedDiagnosisPanel;
