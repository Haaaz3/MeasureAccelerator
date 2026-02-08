/**
 * Component Code Store
 *
 * Zustand store for managing:
 * - Code override states per component
 * - Format selection preferences
 * - Edit notes across all components
 * - Persistence to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type {
  CodeOutputFormat,
  ComponentCodeState,
  CodeEditNote,
} from '../types/componentCode';

import {
  createDefaultComponentCodeState,
  createCodeEditNote,
  createCodeOverride,
  getAllNotesForComponent,
} from '../types/componentCode';

// ============================================================================
// Store Types
// ============================================================================

interface ComponentCodeStore {
  /** Code states keyed by component/element ID */
  codeStates: Record<string, ComponentCodeState>;

  /** Global default format preference */
  defaultFormat: CodeOutputFormat;

  /** Currently inspecting component (for side panel) */
  inspectingComponentId: string | null;

  // ========== Actions ==========

  /** Get existing code state for a component (returns undefined if none) */
  getCodeState: (componentId: string) => ComponentCodeState | undefined;

  /** Get or create code state for a component (creates if not exists) */
  getOrCreateCodeState: (componentId: string) => ComponentCodeState;

  /** Set the selected format for a component */
  setSelectedFormat: (componentId: string, format: CodeOutputFormat) => void;

  /** Set the global default format */
  setDefaultFormat: (format: CodeOutputFormat) => void;

  /** Save a code override with a mandatory note */
  saveCodeOverride: (
    componentId: string,
    format: CodeOutputFormat,
    code: string,
    note: string,
    originalCode: string,
    changeType?: CodeEditNote['changeType']
  ) => void;

  /** Add an additional note to an existing override */
  addNoteToOverride: (
    componentId: string,
    format: CodeOutputFormat,
    note: string,
    changeType?: CodeEditNote['changeType']
  ) => void;

  /** Revert to generated code (remove override) */
  revertToGenerated: (componentId: string, format: CodeOutputFormat) => void;

  /** Revert all overrides for a component */
  revertAllOverrides: (componentId: string) => void;

  /** Set the inspecting component */
  setInspectingComponent: (componentId: string | null) => void;

  /** Get all notes for a component (across all formats) */
  getAllNotes: (componentId: string) => CodeEditNote[];

  /** Get all components with overrides */
  getComponentsWithOverrides: () => string[];

  /** Get all notes across all components */
  getAllNotesGlobal: () => { componentId: string; notes: CodeEditNote[] }[];

  /** Clear all code states (for reset) */
  clearAllCodeStates: () => void;

  /** Import code states (for migration/backup) */
  importCodeStates: (states: Record<string, ComponentCodeState>) => void;

  /** Bulk update format for multiple components */
  bulkSetFormat: (componentIds: string[], format: CodeOutputFormat) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useComponentCodeStore = create<ComponentCodeStore>()(
  persist(
    (set, get) => ({
      codeStates: {},
      defaultFormat: 'cql',
      inspectingComponentId: null,

      // Pure getter - no side effects, returns undefined if not found
      getCodeState: (componentId) => {
        return get().codeStates[componentId];
      },

      // Get or create - has side effects, use for initialization
      getOrCreateCodeState: (componentId) => {
        const existing = get().codeStates[componentId];
        if (existing) return existing;

        // Create default state with global default format
        const newState = createDefaultComponentCodeState(componentId);
        newState.selectedFormat = get().defaultFormat;

        set((prev) => ({
          codeStates: {
            ...prev.codeStates,
            [componentId]: newState,
          },
        }));

        return newState;
      },

      setSelectedFormat: (componentId, format) => {
        set((prev) => {
          const currentState = prev.codeStates[componentId] ||
            createDefaultComponentCodeState(componentId);

          return {
            codeStates: {
              ...prev.codeStates,
              [componentId]: {
                ...currentState,
                selectedFormat: format,
              },
            },
          };
        });
      },

      setDefaultFormat: (format) => {
        set({ defaultFormat: format });
      },

      saveCodeOverride: (componentId, format, code, noteContent, originalCode, changeType) => {
        set((prev) => {
          const currentState = prev.codeStates[componentId] ||
            createDefaultComponentCodeState(componentId);

          const existingOverride = currentState.overrides[format];

          const note = createCodeEditNote(
            noteContent,
            format,
            'User',
            changeType,
            existingOverride?.code || originalCode
          );

          const newOverride = existingOverride
            ? {
                ...existingOverride,
                code,
                updatedAt: new Date().toISOString(),
                notes: [...existingOverride.notes, note],
              }
            : createCodeOverride(format, code, originalCode, note);

          return {
            codeStates: {
              ...prev.codeStates,
              [componentId]: {
                ...currentState,
                overrides: {
                  ...currentState.overrides,
                  [format]: newOverride,
                },
              },
            },
          };
        });
      },

      addNoteToOverride: (componentId, format, noteContent, changeType) => {
        set((prev) => {
          const currentState = prev.codeStates[componentId];
          if (!currentState) return prev;

          const existingOverride = currentState.overrides[format];
          if (!existingOverride) return prev;

          const note = createCodeEditNote(
            noteContent,
            format,
            'User',
            changeType,
            existingOverride.code
          );

          return {
            codeStates: {
              ...prev.codeStates,
              [componentId]: {
                ...currentState,
                overrides: {
                  ...currentState.overrides,
                  [format]: {
                    ...existingOverride,
                    notes: [...existingOverride.notes, note],
                    updatedAt: new Date().toISOString(),
                  },
                },
              },
            },
          };
        });
      },

      revertToGenerated: (componentId, format) => {
        set((prev) => {
          const currentState = prev.codeStates[componentId];
          if (!currentState) return prev;

          const { [format]: _, ...remainingOverrides } = currentState.overrides;

          return {
            codeStates: {
              ...prev.codeStates,
              [componentId]: {
                ...currentState,
                overrides: remainingOverrides,
              },
            },
          };
        });
      },

      revertAllOverrides: (componentId) => {
        set((prev) => {
          const currentState = prev.codeStates[componentId];
          if (!currentState) return prev;

          return {
            codeStates: {
              ...prev.codeStates,
              [componentId]: {
                ...currentState,
                overrides: {},
              },
            },
          };
        });
      },

      setInspectingComponent: (componentId) => {
        set({ inspectingComponentId: componentId });
      },

      getAllNotes: (componentId) => {
        const state = get().codeStates[componentId];
        if (!state) return [];
        return getAllNotesForComponent(state.overrides);
      },

      getComponentsWithOverrides: () => {
        const { codeStates } = get();
        return Object.entries(codeStates)
          .filter(([, state]) =>
            Object.values(state.overrides).some(o => o?.isLocked)
          )
          .map(([id]) => id);
      },

      getAllNotesGlobal: () => {
        const { codeStates } = get();
        return Object.entries(codeStates)
          .map(([componentId, state]) => ({
            componentId,
            notes: getAllNotesForComponent(state.overrides),
          }))
          .filter(({ notes }) => notes.length > 0);
      },

      clearAllCodeStates: () => {
        set({ codeStates: {} });
      },

      importCodeStates: (states) => {
        set((prev) => ({
          codeStates: {
            ...prev.codeStates,
            ...states,
          },
        }));
      },

      bulkSetFormat: (componentIds, format) => {
        set((prev) => {
          const updates: Record<string, ComponentCodeState> = {};

          for (const id of componentIds) {
            const currentState = prev.codeStates[id] ||
              createDefaultComponentCodeState(id);
            updates[id] = {
              ...currentState,
              selectedFormat: format,
            };
          }

          return {
            codeStates: {
              ...prev.codeStates,
              ...updates,
            },
          };
        });
      },
    }),
    {
      name: 'ums-component-code-storage',
      version: 1,
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Hook to get code state for a specific component (may be undefined)
 */
export function useComponentCodeState(componentId: string): ComponentCodeState | undefined {
  return useComponentCodeStore((state) => state.codeStates[componentId]);
}

/**
 * Hook to get all notes for a component
 */
export function useComponentNotes(componentId: string): CodeEditNote[] {
  return useComponentCodeStore((state) => state.getAllNotes(componentId));
}

/**
 * Hook to check if a component has overrides
 */
export function useHasCodeOverride(componentId: string, format?: CodeOutputFormat): boolean {
  return useComponentCodeStore((state) => {
    const codeState = state.codeStates[componentId];
    if (!codeState) return false;

    if (format) {
      return !!codeState.overrides[format]?.isLocked;
    }

    return Object.values(codeState.overrides).some(o => o?.isLocked);
  });
}

/**
 * Hook to get the default format
 */
export function useDefaultCodeFormat(): CodeOutputFormat {
  return useComponentCodeStore((state) => state.defaultFormat);
}

/**
 * Hook to get components with overrides count
 */
export function useOverrideCount(): number {
  return useComponentCodeStore((state) =>
    state.getComponentsWithOverrides().length
  );
}
