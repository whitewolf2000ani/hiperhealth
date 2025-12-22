/**
 * ConsultationContext.jsx
 *
 * Global state management for patient consultation workflow.
 * Tracks patient ID, current step, form data, and language across entire app.
 * Data persists to localStorage automatically.
 *
 * Usage:
 *   1. Wrap App with <ConsultationProvider> in main.jsx
 *   2. In any component: const { state, dispatch } = useConsultation();
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';

//Initial state
const initialState = {
  patientId: null,
  language: 'en',
  currentStep: 'language-selection',
  isComplete: false,
  formData: {
    demographics: {
      age: null,
      gender: '',
      weight_kg: null,
      height_cm: null,
    },
    lifestyle: {
      diet: '',
      sleep_hours: null,
      physical_activity: '',
      mental_exercises: '',
    },
    symptoms: {
      symptoms: '',
    },
    mental: {
      mental_health: '',
    },
    medicalReports: {
      files: [],
      skipped: false,
    },
    wearableData: {
      file: null,
      skipped: false,
    },
    diagnosis: {
      suggestions: [],
      selected: [],
      evaluations: {},
    },
    exams: {
      suggestions: [],
      selected: [],
      evaluations: {},
    },
  },
  isLoading: false,
  error: null,
};

//Context Creation
const ConsultationContext = createContext(initialState);


//Action Creators
export const consultationActions = {
  initConsultation: (patientId, language, startStep = 'demographics') => ({
    type: 'INIT_CONSULTATION',
    payload: { patientId, language, startStep },
  }),

  setCurrentStep: (step) => ({
    type: 'SET_CURRENT_STEP',
    payload: step,
  }),

  updateDemographics: (data) => ({
    type: 'UPDATE_DEMOGRAPHICS',
    payload: data,
  }),

  updateLifestyle: (data) => ({
    type: 'UPDATE_LIFESTYLE',
    payload: data,
  }),

  updateSymptoms: (data) => ({
    type: 'UPDATE_SYMPTOMS',
    payload: data,
  }),

  updateMentalHealth: (data) => ({
    type: 'UPDATE_MENTAL_HEALTH',
    payload: data,
  }),

  updateMedicalReports: (data) => ({
    type: 'UPDATE_MEDICAL_REPORTS',
    payload: data,
  }),

  updateWearableData: (data) => ({
    type: 'UPDATE_WEARABLE_DATA',
    payload: data,
  }),

  updateDiagnosisSuggestions: (suggestions) => ({
    type: 'UPDATE_DIAGNOSIS_SUGGESTIONS',
    payload: suggestions,
  }),

  updateSelectedDiagnosis: (selected, evaluations) => ({
    type: 'UPDATE_SELECTED_DIAGNOSIS',
    payload: { selected, evaluations },
  }),

  updateExamSuggestions: (suggestions) => ({
    type: 'UPDATE_EXAM_SUGGESTIONS',
    payload: suggestions,
  }),

  updateSelectedExams: (selected, evaluations) => ({
    type: 'UPDATE_SELECTED_EXAMS',
    payload: { selected, evaluations },
  }),

  setLoading: (isLoading) => ({
    type: 'SET_LOADING',
    payload: isLoading,
  }),

  setError: (error) => ({
    type: 'SET_ERROR',
    payload: error,
  }),

  clearError: () => ({
    type: 'CLEAR_ERROR',
  }),

  completeConsultation: () => ({
    type: 'COMPLETE_CONSULTATION',
  }),

  resetState: () => ({
    type: 'RESET_STATE',
  }),
};


//Reducer
function consultationReducer(state, action) {
  switch (action.type) {
    case 'INIT_CONSULTATION':
      return {
        ...state,
        patientId: action.payload.patientId,
        language: action.payload.language,
        currentStep: action.payload.startStep,
        isLoading: false,
        error: null,
      };

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'UPDATE_DEMOGRAPHICS':
      return {
        ...state,
        formData: {
          ...state.formData,
          demographics: { ...state.formData.demographics, ...action.payload },
        },
      };

    case 'UPDATE_LIFESTYLE':
      return {
        ...state,
        formData: {
          ...state.formData,
          lifestyle: { ...state.formData.lifestyle, ...action.payload },
        },
      };

    case 'UPDATE_SYMPTOMS':
      return {
        ...state,
        formData: {
          ...state.formData,
          symptoms: { ...state.formData.symptoms, ...action.payload },
        },
      };

    case 'UPDATE_MENTAL_HEALTH':
      return {
        ...state,
        formData: {
          ...state.formData,
          mental: { ...state.formData.mental, ...action.payload },
        },
      };

    case 'UPDATE_MEDICAL_REPORTS':
      return {
        ...state,
        formData: {
          ...state.formData,
          medicalReports: {
            ...state.formData.medicalReports,
            ...action.payload,
          },
        },
      };

    case 'UPDATE_WEARABLE_DATA':
      return {
        ...state,
        formData: {
          ...state.formData,
          wearableData: { ...state.formData.wearableData, ...action.payload },
        },
      };

    case 'UPDATE_DIAGNOSIS_SUGGESTIONS':
      return {
        ...state,
        formData: {
          ...state.formData,
          diagnosis: {
            ...state.formData.diagnosis,
            suggestions: action.payload,
          },
        },
      };

    case 'UPDATE_SELECTED_DIAGNOSIS':
      return {
        ...state,
        formData: {
          ...state.formData,
          diagnosis: {
            ...state.formData.diagnosis,
            selected: action.payload.selected,
            evaluations: action.payload.evaluations,
          },
        },
      };

    case 'UPDATE_EXAM_SUGGESTIONS':
      return {
        ...state,
        formData: {
          ...state.formData,
          exams: {
            ...state.formData.exams,
            suggestions: action.payload,
          },
        },
      };

    case 'UPDATE_SELECTED_EXAMS':
      return {
        ...state,
        formData: {
          ...state.formData,
          exams: {
            ...state.formData.exams,
            selected: action.payload.selected,
            evaluations: action.payload.evaluations,
          },
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'COMPLETE_CONSULTATION':
      return {
        ...state,
        isComplete: true,
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}


//Provider Component
export function ConsultationProvider({ children }) {
  const [state, dispatch] = useReducer(
    consultationReducer,
    initialState,
    (initial) => {
      try {
        const saved = localStorage.getItem('consultationState');
        return saved ? JSON.parse(saved) : initial;
      } catch (e) {
        console.error('Failed to load state:', e);
        return initial;
      }
    }
  );

  useEffect(() => {
    localStorage.setItem('consultationState', JSON.stringify(state));
  }, [state]);

  const value = { state, dispatch };

  return (
    <ConsultationContext.Provider value={value}>
      {children}
    </ConsultationContext.Provider>
  );
}


//Custom Hook
export function useConsultation() {
  const context = useContext(ConsultationContext);

  if (!context) {
    throw new Error(
      'useConsultation must be used within a ConsultationProvider. ' +
        'Make sure your App is wrapped with <ConsultationProvider> in main.jsx'
    );
  }

  return context;
}

export default ConsultationContext;
