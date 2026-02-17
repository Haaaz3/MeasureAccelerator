/**
 * Component Library API client.
 */

import { get, post, put, del } from './client';

// Response types matching backend DTOs

export interface ComponentSummary {
  id: string;
  type: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  complexityLevel: string | null;
  usageCount: number;
  updatedAt: string | null;
}

export interface ComponentDto {
  id: string;
  name: string;
  type: string;
  description: string | null;
  cqlExpression: string | null;
  sqlTemplate: string | null;
  valueSet: {
    oid: string | null;
    name: string | null;
    codes: Array<{
      code: string;
      system: string;
      display: string;
    }>;
  } | null;
  timing: {
    type: string;
    duration: number | null;
    unit: string | null;
  } | null;
  complexity: {
    level: string;
    score: number;
    factors: string[];
  } | null;
  versionInfo: {
    versionId: string;
    status: string;
    versionHistory: Array<{
      versionId: string;
      status: string;
      createdAt: string;
      createdBy: string;
      changeDescription: string;
    }>;
    approvedBy: string | null;
    approvedAt: string | null;
    reviewNotes: string | null;
  } | null;
  usage: {
    usageCount: number;
    measureIds: string[];
    lastUsedAt: string | null;
  } | null;
  metadata: {
    category: string | null;
    categoryAutoAssigned: boolean;
    tags: string[];
  } | null;
  childComponents: ComponentSummary[] | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CreateAtomicComponentRequest {
  /** Optional client-provided ID. If not provided, backend generates one. */
  id?: string;
  name: string;
  category: string;
  description?: string;
  cqlExpression?: string;
  sqlTemplate?: string;
  valueSet?: {
    oid?: string;
    name?: string;
    codes?: Array<{
      code: string;
      system: string;
      display?: string;
    }>;
  };
  timing?: {
    type: string;
    duration?: number;
    unit?: string;
  };
  tags?: string[];
}

export interface CreateCompositeComponentRequest {
  name: string;
  category: string;
  description?: string;
  componentIds: string[];
  tags?: string[];
}

export interface UpdateComponentRequest {
  name?: string;
  description?: string;
  cqlExpression?: string;
  sqlTemplate?: string;
  valueSet?: {
    oid?: string;
    name?: string;
    codes?: Array<{
      code: string;
      system: string;
      display?: string;
    }>;
  };
  timing?: {
    type: string;
    duration?: number;
    unit?: string;
  };
  tags?: string[];
}

export interface MatchResult {
  componentId: string;
  componentName: string;
  matchType: 'exact' | 'fuzzy' | 'partial';
  confidence: number;
  warnings: string[];
  isValid: boolean;
}

export interface ComponentStats {
  totalComponents: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  recentlyUsed: ComponentSummary[];
  topUsed: ComponentSummary[];
}

// API functions

/**
 * Get all components.
 */
export async function getComponents(params?: {
  category?: string;
  status?: string;
  search?: string;
  type?: string;
}): Promise<ComponentSummary[]> {
  return get<ComponentSummary[]>('/components', params);
}

/**
 * Get a component by ID.
 */
export async function getComponent(id: string): Promise<ComponentDto> {
  return get<ComponentDto>(`/components/${id}`);
}

/**
 * Create an atomic component.
 */
export async function createAtomicComponent(
  request: CreateAtomicComponentRequest
): Promise<ComponentDto> {
  return post<ComponentDto>('/components/atomic', request);
}

/**
 * Create a composite component.
 */
export async function createCompositeComponent(
  request: CreateCompositeComponentRequest
): Promise<ComponentDto> {
  return post<ComponentDto>('/components/composite', request);
}

/**
 * Update a component.
 */
export async function updateComponent(
  id: string,
  request: UpdateComponentRequest
): Promise<ComponentDto> {
  return put<ComponentDto>(`/components/${id}`, request);
}

/**
 * Delete a component.
 */
export async function deleteComponent(id: string): Promise<void> {
  return del<void>(`/components/${id}`);
}

/**
 * Set component category.
 */
export async function setComponentCategory(
  id: string,
  category: string
): Promise<ComponentDto> {
  return post<ComponentDto>(`/components/${id}/category`, { category });
}

/**
 * Create a new version of a component.
 */
export async function createComponentVersion(
  id: string,
  changes: string
): Promise<ComponentDto> {
  return post<ComponentDto>(`/components/${id}/version`, { changes });
}

/**
 * Approve a component.
 */
export async function approveComponent(
  id: string,
  approvedBy: string
): Promise<ComponentDto> {
  return post<ComponentDto>(`/components/${id}/approve`, { approvedBy });
}

/**
 * Find matching components for a description.
 */
export async function findMatches(description: string): Promise<MatchResult[]> {
  return post<MatchResult[]>('/components/match', { description });
}

/**
 * Record component usage.
 */
export async function recordUsage(
  componentId: string,
  measureId: string
): Promise<void> {
  return post<void>(`/components/${componentId}/usage`, { measureId });
}

/**
 * Get component statistics.
 */
export async function getComponentStats(): Promise<ComponentStats> {
  return get<ComponentStats>('/components/stats');
}
