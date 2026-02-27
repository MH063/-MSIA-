import React, { useState, useEffect, useCallback } from 'react';
import { 
  App as AntdApp,
  Card, 
  Tabs, 
  Tag, 
  Typography, 
  Button, 
  Input, 
  Space, 
  Badge,
  Collapse,
  Empty,
  Spin,
  Divider,
  Alert,
  Tooltip,
  Popover,
  Row,
  Col,
  theme,
  Skeleton
} from 'antd';
import logger from '../../../../utils/logger';
import { 
  BookOutlined, 
  MedicineBoxOutlined, 
  LinkOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  FireOutlined,
  StarOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import api, { unwrapData } from '../../../../utils/api';
import type { ApiResponse } from '../../../../utils/api';
import { useThemeStore } from '../../../../store/theme.store';

const { Text, Paragraph } = Typography;
const { Search } = Input;
const { useToken } = theme;

/**
 * 症状问诊要点映射类型
 */
interface SymptomQuestionPoint {
  id: string;
  symptomKey: string;
  symptomName: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  questions: string[];
  physicalExamination: string[];
  differentialPoints: string[];
  relatedSymptoms: string[];
  redFlags: string[];
  updatedAt: string;
}

/**
 * 疾病百科类型
 */
interface DiseaseEncyclopedia {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  definition: string;
  etiology: string;
  clinicalManifestations: string[];
  diagnosisCriteria: string[];
  treatment: string;
  prognosis: string;
  relatedDiseases: string[];
  references: string[];
  updatedAt: string;
}

/**
 * 智能知识库属性
 */
interface IntelligentKnowledgeBaseProps {
  currentSymptom?: string;
  sessionId?: number;
  onQuestionSelect?: (question: string) => void;
  onDiseaseSelect?: (diseaseName: string) => void;
}

/**
 * IntelligentKnowledgeBase
 * 智能知识库组件（优化美化）；包含症状问诊要点映射、疾病百科等功能
 */
const IntelligentKnowledgeBase: React.FC<IntelligentKnowledgeBaseProps> = ({
  currentSymptom,
  onQuestionSelect,
  onDiseaseSelect
}) => {
  const { token } = useToken();
  const { message } = AntdApp.useApp();
  const { mode } = useThemeStore();
  
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { 
          color: token.colorError, 
          bgColor: token.colorErrorBg, 
          borderColor: token.colorErrorBorder, 
          label: '高优先级', 
          icon: <FireOutlined /> 
        };
      case 'medium':
        return { 
          color: token.colorWarning, 
          bgColor: token.colorWarningBg, 
          borderColor: token.colorWarningBorder, 
          label: '中优先级', 
          icon: <StarOutlined /> 
        };
      case 'low':
      default:
        return { 
          color: token.colorTextSecondary, 
          bgColor: token.colorFillQuaternary, 
          borderColor: token.colorBorder, 
          label: '低优先级', 
          icon: <InfoCircleOutlined /> 
        };
    }
  };

  const [activeTab, setActiveTab] = useState('symptomMap');
  const [loading, setLoading] = useState<Record<string, boolean>>({
    symptomMap: false,
    diseases: false
  });
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // 症状问诊要点数据
  const [symptomMappings, setSymptomMappings] = useState<SymptomQuestionPoint[]>([]);
  const [currentMapping, setCurrentMapping] = useState<SymptomQuestionPoint | null>(null);
  
  // 疾病百科数据
  const [diseaseEncyclopedia, setDiseaseEncyclopedia] = useState<DiseaseEncyclopedia[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseEncyclopedia | null>(null);
  const [relatedDiseases, setRelatedDiseases] = useState<DiseaseEncyclopedia[]>([]);
  const [diseaseSearchLoading, setDiseaseSearchLoading] = useState(false);

  /**
   * 获取症状问诊要点映射
   */
  const fetchSymptomMappings = useCallback(async () => {
    setLoading(prev => ({ ...prev, symptomMap: true }));
    try {
      const res = await api.get('/knowledge/symptom-mappings') as ApiResponse<SymptomQuestionPoint[]>;
      const data = unwrapData<SymptomQuestionPoint[]>(res);
      if (data) {
        setSymptomMappings(data);
        
      }
    } catch (error) {
      logger.error('[知识库] 获取症状映射失败:', error);
      message.error('症状问诊要点加载失败，请稍后重试');
    } finally {
      setLoading(prev => ({ ...prev, symptomMap: false }));
    }
  }, [message]);

  /**
   * 获取当前症状的问诊要点
   */
  const fetchCurrentSymptomMapping = useCallback(async () => {
    if (!currentSymptom) {
      setCurrentMapping(null);
      return;
    }
    
    try {
      const res = await api.get(`/knowledge/symptom-mapping/${encodeURIComponent(currentSymptom)}`) as ApiResponse<SymptomQuestionPoint>;
      const data = unwrapData<SymptomQuestionPoint>(res);
      if (data) {
        setCurrentMapping(data);
        
      } else {
        // 如果没有精确匹配，尝试模糊匹配
        const fuzzyMatch = symptomMappings.find(m => 
          m.symptomName.includes(currentSymptom) || 
          currentSymptom.includes(m.symptomName)
        );
        if (fuzzyMatch) {
          setCurrentMapping(fuzzyMatch);
        }
      }
    } catch (error) {
      logger.error('[知识库] 获取当前症状映射失败:', error);
    }
  }, [currentSymptom, symptomMappings]);

  /**
   * 获取疾病百科列表
   */
  const fetchDiseaseEncyclopedia = useCallback(async () => {
    setLoading(prev => ({ ...prev, diseases: true }));
    try {
      const res = await api.get('/knowledge/diseases') as ApiResponse<DiseaseEncyclopedia[]>;
      const data = unwrapData<DiseaseEncyclopedia[]>(res);
      if (data) {
        setDiseaseEncyclopedia(data);
        
      }
    } catch (error) {
      logger.error('[知识库] 获取疾病百科失败:', error);
      message.error('疾病百科加载失败，请稍后重试');
    } finally {
      setLoading(prev => ({ ...prev, diseases: false }));
    }
  }, [message]);

  /**
   * 获取疾病详情
   */
  const fetchDiseaseDetail = useCallback(async (diseaseName: string) => {
    setDiseaseSearchLoading(true);
    try {
      const res = await api.get(`/knowledge/disease/${encodeURIComponent(diseaseName)}`) as ApiResponse<DiseaseEncyclopedia>;
      const data = unwrapData<DiseaseEncyclopedia>(res);
      if (data) {
        setSelectedDisease(data);
        if (data.relatedDiseases && data.relatedDiseases.length > 0) {
          const related = diseaseEncyclopedia.filter(d => 
            data.relatedDiseases.includes(d.name)
          );
          setRelatedDiseases(related);
        }
        
      }
    } catch (error) {
      logger.error('[知识库] 获取疾病详情失败:', error);
      message.error('获取疾病详情失败');
    } finally {
      setDiseaseSearchLoading(false);
    }
  }, [diseaseEncyclopedia, message]);

  /**
   * 刷新知识库数据
   */
  const handleRefresh = async () => {
    message.info({
      content: '正在更新知识库...',
      icon: <ReloadOutlined spin />
    });
    await Promise.all([
      fetchSymptomMappings(),
      fetchDiseaseEncyclopedia()
    ]);
    message.success('知识库更新完成');
  };

  // 初始化加载数据
  useEffect(() => {
    fetchSymptomMappings();
    fetchDiseaseEncyclopedia();
  }, [fetchSymptomMappings, fetchDiseaseEncyclopedia]);

  // 当前症状变化时更新映射
  useEffect(() => {
    fetchCurrentSymptomMapping();
  }, [fetchCurrentSymptomMapping]);

  /**
   * 渲染症状问诊要点映射
   */
  const renderSymptomMapping = () => {
    if (loading.symptomMap) {
      return (
        <div style={{ padding: 24 }}>
          <Skeleton paragraph={{ rows: 6 }} />
        </div>
      );
    }

    const displayMapping = currentMapping || symptomMappings.find(m => 
      m.symptomName.toLowerCase().includes(searchKeyword.toLowerCase())
    );

    if (!displayMapping) {
      return (
        <Empty 
          description={
            currentSymptom 
              ? (
                <span>
                  暂无 <Text type="warning" strong>"{currentSymptom}"</Text> 的问诊要点
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    系统将尽快补充该症状的相关知识
                  </Text>
                </span>
              )
              : '请输入症状或选择已有症状查看问诊要点'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {currentSymptom && (
            <Button type="primary" icon={<SearchOutlined />} className="msia-action-button">
              搜索相似症状
            </Button>
          )}
        </Empty>
      );
    }

    const priorityConfig = getPriorityConfig(displayMapping.priority);

    return (
      <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
        <Card
          className="msia-card"
          title={
            <Space>
              <MedicineBoxOutlined style={{ color: priorityConfig.color }} />
              <span style={{ fontSize: 16, fontWeight: 500, color: token.colorTextHeading }}>{displayMapping.symptomName}</span>
              <Tag 
                color={priorityConfig.color}
                className="msia-tag"
                style={{ 
                  backgroundColor: priorityConfig.bgColor,
                  borderColor: priorityConfig.borderColor,
                  fontWeight: 500,
                  color: priorityConfig.color
                }}
                icon={priorityConfig.icon}
              >
                {priorityConfig.label}
              </Tag>
            </Space>
          }
          style={{ 
            marginBottom: 16,
            background: token.colorBgContainer,
            borderColor: token.colorBorderSecondary
          }}
          headStyle={{ 
            background: `linear-gradient(135deg, ${priorityConfig.bgColor} 0%, ${token.colorBgContainer} 100%)`,
            borderBottom: `2px solid ${priorityConfig.borderColor}`
          }}
        >
          <Collapse
            defaultActiveKey={['questions', 'physical', 'differential']}
            style={{ backgroundColor: 'transparent', border: 'none' }}
            items={[
              {
                key: 'questions',
                label: (
                  <Space>
                    <ExclamationCircleOutlined style={{ color: token.colorPrimary }} />
                    <Text strong style={{ color: token.colorTextHeading }}>必问问题</Text>
                    <Badge count={displayMapping.questions.length} style={{ backgroundColor: token.colorPrimary }} />
                  </Space>
                ),
                children: (
                  <div>
                    {displayMapping.questions.map((question, index) => (
                      <div
                        key={`${index}-${question}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 16px',
                          backgroundColor: index % 2 === 0 ? token.colorFillAlter : token.colorBgContainer,
                          borderRadius: 4,
                          marginBottom: 4,
                          border: `1px solid ${token.colorBorderSecondary}`
                        }}
                      >
                        <Space>
                          <Badge
                            count={index + 1}
                            style={{
                              backgroundColor: token.colorFillContent,
                              color: token.colorTextSecondary,
                              fontSize: 12,
                              boxShadow: 'none'
                            }}
                          />
                          <Text style={{ color: token.colorText }}>{question}</Text>
                        </Space>
                        <Tooltip title="使用此问题">
                          <Button
                            type="primary"
                            ghost
                            size="small"
                            icon={<ArrowRightOutlined />}
                            className="msia-action-button"
                            onClick={() => onQuestionSelect?.(question)}
                          >
                            使用
                          </Button>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                )
              },
              {
                key: 'physical',
                label: (
                  <Space>
                    <MedicineBoxOutlined style={{ color: token.colorSuccess }} />
                    <Text strong style={{ color: token.colorTextHeading }}>体格检查要点</Text>
                    <Badge count={displayMapping.physicalExamination.length} style={{ backgroundColor: token.colorSuccess }} />
                  </Space>
                ),
                children: (
                  <div>
                    {displayMapping.physicalExamination.map((item, index) => (
                      <div
                        key={`${index}-${item}`}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: index % 2 === 0 ? token.colorSuccessBg : token.colorBgContainer,
                          borderRadius: 4,
                          marginBottom: 4
                        }}
                      >
                        <Space>
                          <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                          <Text style={{ color: token.colorText }}>{item}</Text>
                        </Space>
                      </div>
                    ))}
                  </div>
                )
              },
              {
                key: 'differential',
                label: (
                  <Space>
                    <CheckCircleOutlined style={{ color: token.colorPrimary }} />
                    <Text strong style={{ color: token.colorText }}>鉴别诊断要点</Text>
                    <Badge count={displayMapping.differentialPoints.length} style={{ backgroundColor: token.colorPrimary }} />
                  </Space>
                ),
                children: (
                  <div>
                    {displayMapping.differentialPoints.map((item, index) => (
                      <div
                        key={`${index}-${item}`}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: index % 2 === 0 ? token.colorFillTertiary : token.colorBgContainer,
                          borderRadius: 4,
                          marginBottom: 4
                        }}
                      >
                        <Space>
                          <Badge
                            count={index + 1}
                            style={{
                              backgroundColor: token.colorPrimary,
                              fontSize: 11
                            }}
                          />
                          <Text style={{ color: token.colorText }}>{item}</Text>
                        </Space>
                      </div>
                    ))}
                  </div>
                )
              },
              ...(displayMapping.redFlags.length > 0 ? [{
                key: 'redflags',
                label: (
                  <Space>
                    <FireOutlined style={{ color: token.colorError }} />
                    <Text strong style={{ color: token.colorError }}>警惕征象</Text>
                    <Badge count={displayMapping.redFlags.length} style={{ backgroundColor: token.colorError }} />
                  </Space>
                ),
                children: (
                  <div style={{ border: `1px solid ${token.colorErrorBorder}`, borderRadius: 6, overflow: 'hidden', padding: 12 }}>
                    <Alert
                      title="以下情况需要特别关注，可能提示严重疾病"
                      type="warning"
                      showIcon
                      style={{ marginBottom: 12 }}
                    />
                    {displayMapping.redFlags.map((item) => (
                      <div
                        key={item}
                        style={{
                          padding: '12px 16px',
                          backgroundColor: token.colorErrorBg,
                          borderRadius: 4,
                          marginBottom: 4,
                          borderLeft: `3px solid ${token.colorError}`
                        }}
                      >
                        <Space>
                          <ExclamationCircleOutlined style={{ color: token.colorError, fontSize: 16 }} />
                          <Text type="danger" strong>{item}</Text>
                        </Space>
                      </div>
                    ))}
                  </div>
                )
              }] : [])
            ]}
          />
          
          <Divider style={{ margin: '16px 0' }} />
          
          <Row justify="space-between" align="middle">
            <Col>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ClockCircleOutlined /> 更新时间: {new Date(displayMapping.updatedAt).toLocaleString()}
              </Text>
            </Col>
            <Col>
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>相关症状:</Text>
                {[...new Set(displayMapping.relatedSymptoms)].slice(0, 3).map(symptom => (
                  <Tag key={symptom} style={{ fontSize: 11 }}>{symptom}</Tag>
                ))}
                {displayMapping.relatedSymptoms.length > 3 && (
                  <Popover 
                    content={
                      <div style={{ maxWidth: 200 }}>
                        {[...new Set(displayMapping.relatedSymptoms)].slice(3).map(s => (
                          <Tag key={s} style={{ marginBottom: 4 }}>{s}</Tag>
                        ))}
                      </div>
                    }
                    title="更多相关症状"
                  >
                    <Tag style={{ fontSize: 11, cursor: 'pointer' }}>
                      +{[...new Set(displayMapping.relatedSymptoms)].length - 3}
                    </Tag>
                  </Popover>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  /**
   * 渲染疾病百科
   */
  const renderDiseaseEncyclopedia = () => {
    const isDark = mode === 'dark';
    const purpleColor = isDark ? '#d3adf7' : '#722ed1';
    const purpleBg = isDark ? '#22075e' : '#f9f0ff';
    const purpleBorder = isDark ? '#722ed1' : '#d3adf7';

    if (loading.diseases) {
      return (
        <div style={{ padding: 24 }}>
          <Skeleton paragraph={{ rows: 3 }} />
          <Divider />
          <Skeleton paragraph={{ rows: 3 }} />
        </div>
      );
    }

    const filteredDiseases = (() => {
      if (!searchKeyword) return diseaseEncyclopedia;
      return diseaseEncyclopedia.filter(d => 
        d.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        d.aliases.some(alias => alias.toLowerCase().includes(searchKeyword.toLowerCase()))
      );
    })();

    if (selectedDisease) {
      return (
        <Spin spinning={diseaseSearchLoading}>
          <div>
            <Button 
              onClick={() => setSelectedDisease(null)}
              style={{ marginBottom: 16 }}
              icon={<ArrowRightOutlined rotate={180} />}
            >
              返回列表
            </Button>

            <Card
              title={
                <Space>
                  <BookOutlined style={{ color: purpleColor, fontSize: 20 }} />
                  <span style={{ fontSize: 18, fontWeight: 600, color: token.colorTextHeading }}>{selectedDisease.name}</span>
                  <Tag color={purpleColor} style={{ fontSize: 13, color: isDark ? token.colorText : '#fff' }}>{selectedDisease.category}</Tag>
                </Space>
              }
              extra={
                <Button 
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={() => onDiseaseSelect?.(selectedDisease.name)}
                >
                  关联到当前问诊
                </Button>
              }
              style={{ 
                borderRadius: 8,
                boxShadow: token.boxShadow,
                background: token.colorBgContainer,
                borderColor: token.colorBorderSecondary
              }}
            >
              {selectedDisease.aliases.length > 0 && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: purpleBg, borderRadius: 6, border: `1px solid ${purpleBorder}` }}>
                  <Text type="secondary">别名: </Text>
                  {selectedDisease.aliases.map(alias => (
                    <Tag key={alias} color={purpleColor} style={{ marginBottom: 4 }}>{alias}</Tag>
                  ))}
                </div>
              )}

              <Collapse 
                defaultActiveKey={['definition', 'manifestations', 'diagnosis']}
                style={{ backgroundColor: 'transparent', border: 'none' }}
                items={[
                  {
                    key: 'definition',
                    label: <Text strong style={{ fontSize: 14, color: token.colorTextHeading }}>疾病定义</Text>,
                    children: (
                      <div>
                        <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: token.colorText }}>
                          {selectedDisease.definition}
                        </Paragraph>
                        <Alert
                          title={<Text strong>病因</Text>}
                          description={selectedDisease.etiology}
                          type="info"
                          showIcon
                          style={{ marginTop: 12 }}
                        />
                      </div>
                    )
                  },
                  {
                    key: 'manifestations',
                    label: (
                      <Space>
                        <Text strong style={{ fontSize: 14, color: token.colorTextHeading }}>临床表现</Text>
                        <Badge count={selectedDisease.clinicalManifestations.length} style={{ backgroundColor: token.colorPrimary }} />
                      </Space>
                    ),
                    children: (
                      <div>
                        {selectedDisease.clinicalManifestations.map((item, index) => (
                          <div key={`${index}-${item}`} style={{ padding: '8px 0' }}>
                            <Space>
                              <Badge 
                                count={index + 1} 
                                style={{ backgroundColor: token.colorPrimary }} 
                              />
                              <Text style={{ color: token.colorText }}>{item}</Text>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )
                  },
                  {
                    key: 'diagnosis',
                    label: (
                      <Space>
                        <Text strong style={{ fontSize: 14, color: token.colorTextHeading }}>诊断标准</Text>
                        <Badge count={selectedDisease.diagnosisCriteria.length} style={{ backgroundColor: token.colorSuccess }} />
                      </Space>
                    ),
                    children: (
                      <div>
                        {selectedDisease.diagnosisCriteria.map((item, index) => (
                          <div key={`${index}-${item}`} style={{ padding: '8px 0' }}>
                            <Space>
                              <Badge 
                                count={index + 1} 
                                style={{ backgroundColor: token.colorSuccess }} 
                              />
                              <Text style={{ color: token.colorText }}>{item}</Text>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )
                  },
                  {
                    key: 'treatment',
                    label: <Text strong style={{ fontSize: 14, color: token.colorTextHeading }}>治疗方案</Text>,
                    children: (
                      <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: token.colorText }}>
                        {selectedDisease.treatment}
                      </Paragraph>
                    )
                  },
                  {
                    key: 'prognosis',
                    label: <Text strong style={{ fontSize: 14, color: token.colorTextHeading }}>预后</Text>,
                    children: (
                      <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: token.colorText }}>
                        {selectedDisease.prognosis}
                      </Paragraph>
                    )
                  }
                ]}
              />

              {relatedDiseases.length > 0 && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 16, 
                  backgroundColor: token.colorInfoBg, 
                  borderRadius: 6,
                  border: `1px solid ${token.colorInfoBorder}`
                }}>
                  <Text strong style={{ color: token.colorInfoText }}>
                    <LinkOutlined /> 相关疾病
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    {relatedDiseases.map(disease => (
                      <Tag 
                        key={disease.id} 
                        color="blue"
                        style={{ cursor: 'pointer', marginBottom: 4, fontSize: 13 }}
                        onClick={() => fetchDiseaseDetail(disease.name)}
                      >
                        {disease.name}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              <Divider style={{ borderColor: token.colorBorderSecondary }} />

              <div style={{ backgroundColor: token.colorSuccessBg, padding: 12, borderRadius: 6, border: `1px solid ${token.colorSuccessBorder}` }}>
                <Text strong style={{ color: token.colorSuccessText }}>
                  <BookOutlined /> 参考文献
                </Text>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                  {selectedDisease.references.map((ref, index) => (
                    <li key={index}>
                      <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>{ref}</Text>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <ClockCircleOutlined /> 更新时间: {new Date(selectedDisease.updatedAt).toLocaleString()}
                </Text>
              </div>
            </Card>
          </div>
        </Spin>
      );
    }

    return (
      <div>
        <Search
          placeholder="搜索疾病名称或别名"
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={setSearchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={{ marginBottom: 16 }}
          size="large"
        />

        {filteredDiseases.length === 0 ? (
          <Empty
            description="未找到匹配的疾病"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredDiseases.map((disease) => (
              <Col key={disease.id} xs={24} md={12}>
                <Card
                  hoverable
                  onClick={() => fetchDiseaseDetail(disease.name)}
                  style={{ 
                    borderRadius: 8,
                    transition: 'all 0.3s ease',
                    height: '100%',
                    background: token.colorBgContainer,
                    borderColor: token.colorBorderSecondary
                  }}
                  title={
                    <Space>
                      <BookOutlined style={{ color: purpleColor }} />
                      <span style={{ fontWeight: 500, color: token.colorTextHeading }}>{disease.name}</span>
                    </Space>
                  }
                  extra={<Tag color="purple">{disease.category}</Tag>}
                >
                  <Paragraph 
                    ellipsis={{ rows: 2 }} 
                    style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 8 }}
                  >
                    {disease.definition}
                  </Paragraph>
                  {disease.aliases.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        别名: {disease.aliases.slice(0, 2).join(', ')}
                        {disease.aliases.length > 2 && '...'}
                      </Text>
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    );
  };

  const isDark = mode === 'dark';
  const gradientStart = isDark ? token.colorFillAlter : '#f0f5ff';
  const gradientEnd = isDark ? token.colorBgContainer : '#fff';
  const borderColor = isDark ? token.colorBorderSecondary : '#d6e4ff';
  const purpleColor = isDark ? '#d3adf7' : '#722ed1';

  return (
    <Card
      className="msia-card"
      title={
        <Space>
          <BookOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: token.colorTextHeading }}>智能知识库</span>
          {currentSymptom && (
            <Tag color="processing" className="msia-tag" style={{ fontSize: 12 }}>
              当前: {currentSymptom}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Tooltip title="刷新知识库数据">
          <Button 
            icon={<ReloadOutlined />} 
            size="small"
            onClick={handleRefresh}
            type="dashed"
            className="msia-action-button"
          >
            刷新
          </Button>
        </Tooltip>
      }
      style={{ 
        height: '100%',
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary
      }}
      headStyle={{
        background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
        borderBottom: `2px solid ${borderColor}`
      }}
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        style={{ marginTop: -16 }}
        items={[
          {
            key: 'symptomMap',
            label: (
              <span>
                <MedicineBoxOutlined />
                症状问诊要点
                {currentMapping && <Badge dot style={{ marginLeft: 4, backgroundColor: token.colorPrimary }} />}
              </span>
            ),
            children: renderSymptomMapping(),
          },
          {
            key: 'diseases',
            label: (
              <span>
                <BookOutlined />
                疾病百科
                <Badge 
                  count={diseaseEncyclopedia.length} 
                  style={{ 
                    marginLeft: 4, 
                    backgroundColor: purpleColor,
                    fontSize: 10,
                    color: isDark ? token.colorBgContainer : '#fff'
                  }} 
                />
              </span>
            ),
            children: renderDiseaseEncyclopedia(),
          },
        ]}
      />
    </Card>
  );
};

export default IntelligentKnowledgeBase;
