import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { unwrapData } from '../utils/api';
import type { ApiResponse } from '../utils/api';

// 症状问诊要点类型
export interface SymptomQuestionPoint {
  symptomName: string;
  keyPoints: string[];
  followUpQuestions: string[];
  redFlags: string[];
}

// 疾病百科类型
export interface DiseaseEncyclopedia {
  name: string;
  description: string;
  symptoms: string[];
  treatments: string[];
  prevention: string[];
}

// 缓存配置
const CACHE_CONFIG = {
  symptomMappings: {
    staleTime: 5 * 60 * 1000, // 5分钟
    cacheTime: 10 * 60 * 1000, // 10分钟
  },
  diseaseEncyclopedia: {
    staleTime: 10 * 60 * 1000, // 10分钟
    cacheTime: 30 * 60 * 1000, // 30分钟
  },
  diseaseDetail: {
    staleTime: 5 * 60 * 1000, // 5分钟
    cacheTime: 15 * 60 * 1000, // 15分钟
  },
  symptomMapping: {
    staleTime: 2 * 60 * 1000, // 2分钟
    cacheTime: 5 * 60 * 1000, // 5分钟
  },
};

// 获取症状问诊要点映射
export const useSymptomMappings = () => {
  return useQuery({
    queryKey: ['knowledge', 'symptom-mappings'],
    queryFn: async () => {
      const res = await api.get('/knowledge/symptom-mappings') as ApiResponse<SymptomQuestionPoint[]>;
      return unwrapData<SymptomQuestionPoint[]>(res) || [];
    },
    staleTime: CACHE_CONFIG.symptomMappings.staleTime,
    gcTime: CACHE_CONFIG.symptomMappings.cacheTime,
    retry: 2,
  });
};

// 获取疾病百科列表
export const useDiseaseEncyclopedia = () => {
  return useQuery({
    queryKey: ['knowledge', 'diseases'],
    queryFn: async () => {
      const res = await api.get('/knowledge/diseases') as ApiResponse<DiseaseEncyclopedia[]>;
      return unwrapData<DiseaseEncyclopedia[]>(res) || [];
    },
    staleTime: CACHE_CONFIG.diseaseEncyclopedia.staleTime,
    gcTime: CACHE_CONFIG.diseaseEncyclopedia.cacheTime,
    retry: 2,
  });
};

// 获取特定症状的问诊要点
export const useSymptomMapping = (symptomName: string | null) => {
  return useQuery({
    queryKey: ['knowledge', 'symptom-mapping', symptomName],
    queryFn: async () => {
      if (!symptomName) return null;
      const res = await api.get(`/knowledge/symptom-mapping/${encodeURIComponent(symptomName)}`) as ApiResponse<SymptomQuestionPoint>;
      return unwrapData<SymptomQuestionPoint>(res);
    },
    enabled: !!symptomName,
    staleTime: CACHE_CONFIG.symptomMapping.staleTime,
    gcTime: CACHE_CONFIG.symptomMapping.cacheTime,
    retry: 1,
  });
};

// 获取疾病详情
export const useDiseaseDetail = (diseaseName: string | null) => {
  return useQuery({
    queryKey: ['knowledge', 'disease', diseaseName],
    queryFn: async () => {
      if (!diseaseName) return null;
      const res = await api.get(`/knowledge/disease/${encodeURIComponent(diseaseName)}`) as ApiResponse<DiseaseEncyclopedia>;
      return unwrapData<DiseaseEncyclopedia>(res);
    },
    enabled: !!diseaseName,
    staleTime: CACHE_CONFIG.diseaseDetail.staleTime,
    gcTime: CACHE_CONFIG.diseaseDetail.cacheTime,
    retry: 1,
  });
};

// 预加载数据
export const usePreloadKnowledge = () => {
  const queryClient = useQueryClient();

  const preloadSymptomMappings = () => {
    queryClient.prefetchQuery({
      queryKey: ['knowledge', 'symptom-mappings'],
      queryFn: async () => {
        const res = await api.get('/knowledge/symptom-mappings') as ApiResponse<SymptomQuestionPoint[]>;
        return unwrapData<SymptomQuestionPoint[]>(res) || [];
      },
      staleTime: CACHE_CONFIG.symptomMappings.staleTime,
    });
  };

  const preloadDiseaseEncyclopedia = () => {
    queryClient.prefetchQuery({
      queryKey: ['knowledge', 'diseases'],
      queryFn: async () => {
        const res = await api.get('/knowledge/diseases') as ApiResponse<DiseaseEncyclopedia[]>;
        return unwrapData<DiseaseEncyclopedia[]>(res) || [];
      },
      staleTime: CACHE_CONFIG.diseaseEncyclopedia.staleTime,
    });
  };

  return {
    preloadSymptomMappings,
    preloadDiseaseEncyclopedia,
  };
};
