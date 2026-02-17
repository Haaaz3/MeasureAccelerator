/**
 * Measure Store
 *
 * Manages measure state - fetches data from API, keeps UI state in memory.
 */

import { create } from 'zustand';
import * as measureApi from '../api/measures.js';
import * as validationApi from '../api/validation.js';

export const useMeasureStore = create((set, get) => ({
  // Measures data (fetched from API)
  measures: [],
  activeMeasureId: null,
  activeMeasure: null,
  isLoading: false,
  error: null,

  // UI state
  activeTab: 'library',
  editorSection: null,
  isUploading: false,
  uploadProgress: 0,

  // Code generation
  selectedCodeFormat: 'cql',

  // Validation
  validationTraces: [],
  activeTraceId: null,

  // Fetch all measures from API
  fetchMeasures: async () => {
    set({ isLoading: true, error: null });
    try {
      const measures = await measureApi.getMeasures();
      set({ measures, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch measures:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch a single measure with full details
  fetchMeasure: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const measure = await measureApi.getMeasure(id);
      set({ activeMeasure: measure, activeMeasureId: id, isLoading: false });
      return measure;
    } catch (error) {
      console.error('Failed to fetch measure:', error);
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Create a new measure
  createMeasure: async (measureData) => {
    set({ isLoading: true, error: null });
    try {
      const measure = await measureApi.createMeasure(measureData);
      set((state) => ({
        measures: [...state.measures, measure],
        activeMeasureId: measure.id,
        activeMeasure: measure,
        activeTab: 'editor',
        isLoading: false,
      }));
      return measure;
    } catch (error) {
      console.error('Failed to create measure:', error);
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Update a measure
  updateMeasure: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const measure = await measureApi.updateMeasure(id, updates);
      set((state) => ({
        measures: state.measures.map((m) => (m.id === id ? measure : m)),
        activeMeasure: state.activeMeasureId === id ? measure : state.activeMeasure,
        isLoading: false,
      }));
      return measure;
    } catch (error) {
      console.error('Failed to update measure:', error);
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Delete a measure
  deleteMeasure: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await measureApi.deleteMeasure(id);
      set((state) => ({
        measures: state.measures.filter((m) => m.id !== id),
        activeMeasureId: state.activeMeasureId === id ? null : state.activeMeasureId,
        activeMeasure: state.activeMeasureId === id ? null : state.activeMeasure,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      console.error('Failed to delete measure:', error);
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  // Import a full measure with populations
  importMeasure: async (measureData) => {
    set({ isLoading: true, error: null });
    try {
      const measure = await measureApi.importMeasure(measureData);
      set((state) => ({
        measures: [...state.measures, measure],
        activeMeasureId: measure.id,
        activeMeasure: measure,
        activeTab: 'editor',
        isLoading: false,
      }));
      return measure;
    } catch (error) {
      console.error('Failed to import measure:', error);
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // UI actions
  setActiveMeasure: (id) => {
    set({ activeMeasureId: id, activeTab: id ? 'editor' : 'library' });
    if (id) {
      get().fetchMeasure(id);
    } else {
      set({ activeMeasure: null });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setEditorSection: (section) => set({ editorSection: section }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setIsUploading: (uploading) => set({ isUploading: uploading }),
  setSelectedCodeFormat: (format) => set({ selectedCodeFormat: format }),

  // Lock/unlock measure
  lockMeasure: async (measureId) => {
    try {
      const measure = await measureApi.lockMeasure(measureId, 'current-user');
      set((state) => ({
        measures: state.measures.map((m) => (m.id === measureId ? measure : m)),
        activeMeasure: state.activeMeasureId === measureId ? measure : state.activeMeasure,
      }));
      return true;
    } catch (error) {
      console.error('Failed to lock measure:', error);
      return false;
    }
  },

  unlockMeasure: async (measureId) => {
    try {
      const measure = await measureApi.unlockMeasure(measureId);
      set((state) => ({
        measures: state.measures.map((m) => (m.id === measureId ? measure : m)),
        activeMeasure: state.activeMeasureId === measureId ? measure : state.activeMeasure,
      }));
      return true;
    } catch (error) {
      console.error('Failed to unlock measure:', error);
      return false;
    }
  },

  isMeasureLocked: (measureId) => {
    const state = get();
    const measure = state.measures.find((m) => m.id === measureId) || state.activeMeasure;
    return !!measure?.lockedAt;
  },

  // Code generation
  generateCql: async (measureId) => {
    try {
      const result = await measureApi.generateCql(measureId);
      return result.cql || result;
    } catch (error) {
      console.error('Failed to generate CQL:', error);
      return null;
    }
  },

  generateSql: async (measureId) => {
    try {
      const result = await measureApi.generateSql(measureId);
      return result.sql || result;
    } catch (error) {
      console.error('Failed to generate SQL:', error);
      return null;
    }
  },

  // Validation
  fetchValidationResults: async (measureId) => {
    try {
      const results = await validationApi.evaluateAllPatients(measureId);
      set({ validationTraces: results.traces || [] });
      return results;
    } catch (error) {
      console.error('Failed to fetch validation results:', error);
      return null;
    }
  },

  setActiveTrace: (id) => set({ activeTraceId: id }),

  // Computed
  getActiveMeasure: () => {
    const state = get();
    return state.activeMeasure;
  },

  getReviewProgress: (measureId) => {
    const state = get();
    const measure = state.measures.find((m) => m.id === measureId) || state.activeMeasure;
    if (!measure) return { total: 0, approved: 0, pending: 0, flagged: 0 };

    let total = 0, approved = 0, pending = 0, flagged = 0;

    const countStatus = (obj) => {
      if (!obj) return;
      if (obj.reviewStatus) {
        total++;
        if (obj.reviewStatus === 'approved') approved++;
        else if (obj.reviewStatus === 'pending') pending++;
        else if (obj.reviewStatus === 'flagged' || obj.reviewStatus === 'needs_revision') flagged++;
      }
      if (obj.rootClause) countStatus(obj.rootClause);
      if (obj.children) obj.children.forEach(countStatus);
      if (obj.dataElements) obj.dataElements.forEach(countStatus);
    };

    if (measure.populations) {
      measure.populations.forEach(countStatus);
    }

    return { total, approved, pending, flagged };
  },
}));
