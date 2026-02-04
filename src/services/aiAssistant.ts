/**
 * AI Assistant Service
 *
 * Provides AI-powered editing assistance for UMS components.
 * Uses the same LLM configuration as the measure parsing engine.
 */

import type {
  DataElement,
  LogicalClause,
  PopulationDefinition,
  ValueSetReference,
  TimingWindow,
  TimingWindowOverride,
  ReviewStatus,
} from '../types/ums';
import type { LLMProvider } from '../stores/settingsStore';

// API URLs (same as aiExtractor.ts)
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// =============================================================================
// TYPES
// =============================================================================

export interface AIAssistantContext {
  currentComponent: {
    id: string;
    category: string;
    description: string;
    valueSet: {
      name: string;
      oid?: string;
      codeCount: number;
    } | null;
    timing: TimingWindowOverride | null;
    status: ReviewStatus;
    ageRange?: { min: number; max: number };
    additionalRequirements?: string[];
  };
  populationBlock: {
    id: string;
    label: string;
    description: string;
    allCriteria: Array<{
      id: string;
      text: string;
      isCurrent: boolean;
    }>;
    logicOperator: string;
  };
  measure: {
    id: string;
    name: string;
    title: string;
    measurementPeriod: {
      start: string;
      end: string;
    };
    allPopulationBlocks: Array<{
      label: string;
      criteriaCount: number;
    }>;
  };
  availableValueSets: Array<{
    name: string;
    oid?: string;
    codeCount: number;
  }>;
  availableCategories: string[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIAssistantResponse {
  action: 'edit' | 'answer' | 'clarify' | 'error';
  changes?: {
    description?: string;
    category?: string;
    timing?: TimingWindow;
    valueSet?: { name: string; oid?: string };
    status?: ReviewStatus;
    ageRange?: { min: number; max: number };
    additionalRequirements?: string[];
  };
  explanation?: string;
  response?: string;
  error?: string;
}

export interface CustomLLMConfig {
  baseUrl: string;
  modelName: string;
}

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

/**
 * Build the AI assistant context from the current application state
 */
export function buildAssistantContext(
  component: DataElement,
  population: PopulationDefinition,
  measure: {
    id: string;
    metadata: {
      measureId: string;
      title: string;
      measurementPeriod?: { start: string; end: string };
    };
    populations: PopulationDefinition[];
    valueSets: ValueSetReference[];
  },
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): AIAssistantContext {
  // Extract all criteria from the population
  const allCriteria: AIAssistantContext['populationBlock']['allCriteria'] = [];

  const extractCriteria = (node: DataElement | LogicalClause, depth = 0) => {
    if ('type' in node && node.type !== undefined) {
      // It's a DataElement
      allCriteria.push({
        id: node.id,
        text: node.description || `${node.type} component`,
        isCurrent: node.id === component.id,
      });
    }
    if ('children' in node && node.children) {
      for (const child of node.children) {
        extractCriteria(child, depth + 1);
      }
    }
  };

  if (population.criteria) {
    extractCriteria(population.criteria);
  }

  // Format population label
  const populationLabels: Record<string, string> = {
    'initial_population': 'Initial Population',
    'denominator': 'Denominator',
    'denominator_exclusion': 'Denominator Exclusion',
    'denominator_exception': 'Denominator Exception',
    'numerator': 'Numerator',
    'numerator_exclusion': 'Numerator Exclusion',
  };

  return {
    currentComponent: {
      id: component.id,
      category: component.type || 'unknown',
      description: component.description || '',
      valueSet: component.valueSet ? {
        name: component.valueSet.name,
        oid: component.valueSet.oid,
        codeCount: component.valueSet.codes?.length || component.valueSet.totalCodeCount || 0,
      } : null,
      timing: component.timingWindow || null,
      status: component.reviewStatus || 'pending',
      ageRange: component.thresholds?.ageMin !== undefined && component.thresholds?.ageMax !== undefined
        ? { min: component.thresholds.ageMin, max: component.thresholds.ageMax }
        : undefined,
      additionalRequirements: component.additionalRequirements,
    },
    populationBlock: {
      id: population.id,
      label: populationLabels[population.type] || population.type,
      description: population.description || '',
      allCriteria,
      logicOperator: population.criteria?.operator || 'AND',
    },
    measure: {
      id: measure.id,
      name: measure.metadata.measureId,
      title: measure.metadata.title,
      measurementPeriod: {
        start: measure.metadata.measurementPeriod?.start || `${new Date().getFullYear()}-01-01`,
        end: measure.metadata.measurementPeriod?.end || `${new Date().getFullYear()}-12-31`,
      },
      allPopulationBlocks: measure.populations.map(p => ({
        label: populationLabels[p.type] || p.type,
        criteriaCount: countCriteria(p.criteria),
      })),
    },
    availableValueSets: measure.valueSets.map(vs => ({
      name: vs.name,
      oid: vs.oid,
      codeCount: vs.codes?.length || vs.totalCodeCount || 0,
    })),
    availableCategories: [
      'demographic',
      'encounter',
      'diagnosis',
      'procedure',
      'observation',
      'medication',
      'assessment',
      'immunization',
    ],
    conversationHistory,
  };
}

function countCriteria(node: LogicalClause | undefined): number {
  if (!node) return 0;
  let count = 0;
  if (node.children) {
    for (const child of node.children) {
      if ('type' in child && child.type !== undefined) {
        count++;
      } else if ('children' in child) {
        count += countCriteria(child as LogicalClause);
      }
    }
  }
  return count;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

function formatTimingForPrompt(timing: TimingWindowOverride): string {
  const window = timing.modified || timing.original;
  if (!window) return 'None';

  const formatBoundary = (b: typeof window.start) => {
    let str = b.anchor;
    if (b.offsetValue !== null && b.offsetUnit !== null && b.offsetDirection !== null) {
      str += ` ${b.offsetValue} ${b.offsetUnit} ${b.offsetDirection}`;
    }
    return str;
  };

  return `From ${formatBoundary(window.start)} through ${formatBoundary(window.end)}`;
}

export function buildSystemPrompt(context: AIAssistantContext): string {
  return `You are an AI assistant embedded in MeasureAccelerator, a healthcare quality measure authoring tool. You help users edit and refine UMS (Unified Measure Schema) components.

## Current Context

The user is editing a component in the measure "${context.measure.name} — ${context.measure.title}".

**Current Component:**
- ID: ${context.currentComponent.id}
- Category: ${context.currentComponent.category}
- Description: ${context.currentComponent.description}
- Value Set: ${context.currentComponent.valueSet ? `${context.currentComponent.valueSet.name}${context.currentComponent.valueSet.oid ? ` (${context.currentComponent.valueSet.oid})` : ''}, ${context.currentComponent.valueSet.codeCount} codes` : "None"}
- Timing: ${context.currentComponent.timing ? formatTimingForPrompt(context.currentComponent.timing) : "None"}
- Status: ${context.currentComponent.status}${context.currentComponent.ageRange ? `\n- Age Range: ${context.currentComponent.ageRange.min}-${context.currentComponent.ageRange.max} years` : ''}${context.currentComponent.additionalRequirements?.length ? `\n- Additional Requirements: ${context.currentComponent.additionalRequirements.join('; ')}` : ''}

**This component is in the "${context.populationBlock.label}" block:**
${context.populationBlock.description || 'No description available.'}

**All criteria in this block (${context.populationBlock.logicOperator} logic):**
${context.populationBlock.allCriteria.map((c, i) => `${i + 1}. ${c.isCurrent ? '→ ' : '  '}${c.text}`).join("\n")}

**Measure structure:**
${context.measure.allPopulationBlocks.map(b => `- ${b.label}: ${b.criteriaCount} criteria`).join("\n")}

**Measurement Period:** ${context.measure.measurementPeriod.start} to ${context.measure.measurementPeriod.end}

**Available Value Sets:**
${context.availableValueSets.slice(0, 10).map(vs => `- ${vs.name}${vs.oid ? ` (${vs.oid})` : ''}: ${vs.codeCount} codes`).join("\n")}${context.availableValueSets.length > 10 ? `\n... and ${context.availableValueSets.length - 10} more` : ''}

**Available Categories:** ${context.availableCategories.join(', ')}

## How to Respond

When the user asks you to make a change, respond with a JSON block containing the proposed edits:

\`\`\`json
{
  "action": "edit",
  "changes": {
    "description": "new description if changed",
    "category": "new category if changed",
    "timing": {
      "start": { "anchor": "IPSD", "offsetValue": null, "offsetUnit": null, "offsetDirection": null },
      "end": { "anchor": "IPSD", "offsetValue": 231, "offsetUnit": "days", "offsetDirection": "after" }
    },
    "valueSet": { "name": "Value Set Name", "oid": "2.16.840.1..." },
    "status": "approved",
    "ageRange": { "min": 50, "max": 75 },
    "additionalRequirements": ["Requirement 1", "Requirement 2"]
  },
  "explanation": "Brief explanation of what you changed and why"
}
\`\`\`

**Timing anchors you can use:** Measurement Period, Measurement Period End, Measurement Period Start, IPSD (Index Prescription Start Date), IPED, Encounter Start, Encounter End, Procedure Date, Discharge Date

**Timing structure:** Each boundary has:
- anchor: one of the anchors above
- offsetValue: number or null (if no offset)
- offsetUnit: "days", "months", or "years" (or null)
- offsetDirection: "before" or "after" (or null)

Only include fields that are actually changing. If the user asks a question rather than requesting a change, respond with:

\`\`\`json
{
  "action": "answer",
  "response": "Your answer here"
}
\`\`\`

If the user's request is ambiguous, respond with:

\`\`\`json
{
  "action": "clarify",
  "response": "Your clarifying question here"
}
\`\`\`

Be concise. Use clinical terminology accurately. Reference specific value sets, codes, and measure logic when relevant.`;
}

// =============================================================================
// API CALLS
// =============================================================================

async function callAnthropicAPI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAIAPI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGoogleAPI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const url = `${GOOGLE_API_URL}/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...contents,
      ],
      generationConfig: {
        maxOutputTokens: 4000,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callCustomAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Custom LLM API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

function parseAIResponse(content: string): AIAssistantResponse {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonContent = jsonMatch ? jsonMatch[1] : content;

  try {
    // Try to find JSON object in the content
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]);

      if (parsed.action === 'edit' && parsed.changes) {
        return {
          action: 'edit',
          changes: parsed.changes,
          explanation: parsed.explanation,
        };
      } else if (parsed.action === 'answer') {
        return {
          action: 'answer',
          response: parsed.response,
        };
      } else if (parsed.action === 'clarify') {
        return {
          action: 'clarify',
          response: parsed.response,
        };
      }
    }
  } catch {
    // JSON parsing failed
  }

  // If we couldn't parse JSON, treat it as a plain text answer
  return {
    action: 'answer',
    response: content,
  };
}

// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================

export async function handleAIAssistantRequest(
  userMessage: string,
  context: AIAssistantContext,
  provider: LLMProvider,
  apiKey: string,
  model: string,
  customConfig?: CustomLLMConfig
): Promise<AIAssistantResponse> {
  // Validate API key
  if (provider === 'custom') {
    if (!customConfig?.baseUrl) {
      return {
        action: 'error',
        error: 'Custom LLM base URL is not configured. Go to Settings to set up your LLM.',
      };
    }
  } else if (!apiKey) {
    return {
      action: 'error',
      error: 'API key not configured. Go to Settings to add your API key.',
    };
  }

  const systemPrompt = buildSystemPrompt(context);

  // Build messages array with conversation history + new message
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...context.conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    let responseContent: string;

    if (provider === 'anthropic') {
      responseContent = await callAnthropicAPI(apiKey, model, systemPrompt, messages);
    } else if (provider === 'openai') {
      responseContent = await callOpenAIAPI(apiKey, model, systemPrompt, messages);
    } else if (provider === 'google') {
      responseContent = await callGoogleAPI(apiKey, model, systemPrompt, messages);
    } else if (provider === 'custom' && customConfig) {
      responseContent = await callCustomAPI(customConfig.baseUrl, apiKey, model, systemPrompt, messages);
    } else {
      return {
        action: 'error',
        error: `Unsupported LLM provider: ${provider}`,
      };
    }

    return parseAIResponse(responseContent);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      action: 'error',
      error: errorMessage,
    };
  }
}

// =============================================================================
// CHANGE APPLICATION
// =============================================================================

/**
 * Apply AI-proposed changes to a component
 */
export function applyAIChanges(
  component: DataElement,
  changes: NonNullable<AIAssistantResponse['changes']>
): Partial<DataElement> {
  const updates: Partial<DataElement> = {};

  if (changes.description !== undefined) {
    updates.description = changes.description;
  }

  if (changes.category !== undefined) {
    updates.type = changes.category as DataElement['type'];
  }

  if (changes.timing !== undefined) {
    // Create a TimingWindowOverride structure
    const original = component.timingWindow?.original || changes.timing;
    updates.timingWindow = {
      original,
      modified: changes.timing,
      sourceText: component.timingWindow?.sourceText || '',
      modifiedAt: new Date().toISOString(),
      modifiedBy: 'ai-assistant',
    };
  }

  if (changes.status !== undefined) {
    updates.reviewStatus = changes.status;
  }

  if (changes.ageRange !== undefined) {
    updates.thresholds = {
      ...component.thresholds,
      ageMin: changes.ageRange.min,
      ageMax: changes.ageRange.max,
    };
  }

  if (changes.additionalRequirements !== undefined) {
    updates.additionalRequirements = changes.additionalRequirements;
  }

  // Note: valueSet changes need to be handled separately since they may
  // require looking up the full value set from the measure's value sets

  return updates;
}

/**
 * Format proposed changes for display in the UI
 */
export function formatChangesForDisplay(
  currentComponent: AIAssistantContext['currentComponent'],
  changes: NonNullable<AIAssistantResponse['changes']>,
  mpStart: string,
  mpEnd: string
): Array<{ field: string; from: string; to: string }> {
  const displayChanges: Array<{ field: string; from: string; to: string }> = [];

  if (changes.description !== undefined) {
    displayChanges.push({
      field: 'Description',
      from: currentComponent.description || '(none)',
      to: changes.description,
    });
  }

  if (changes.category !== undefined) {
    displayChanges.push({
      field: 'Category',
      from: currentComponent.category,
      to: changes.category,
    });
  }

  if (changes.timing !== undefined) {
    const formatBoundary = (b: typeof changes.timing.start) => {
      let str = b.anchor;
      if (b.offsetValue !== null && b.offsetUnit !== null && b.offsetDirection !== null) {
        str += ` + ${b.offsetValue} ${b.offsetUnit} ${b.offsetDirection}`;
      }
      return str;
    };

    const currentTiming = currentComponent.timing
      ? formatTimingForPrompt(currentComponent.timing)
      : '(none)';

    const newTiming = `From ${formatBoundary(changes.timing.start)} through ${formatBoundary(changes.timing.end)}`;

    displayChanges.push({
      field: 'Timing',
      from: currentTiming,
      to: newTiming,
    });
  }

  if (changes.valueSet !== undefined) {
    const currentVS = currentComponent.valueSet
      ? `${currentComponent.valueSet.name}${currentComponent.valueSet.oid ? ` (${currentComponent.valueSet.oid})` : ''}`
      : '(none)';

    const newVS = `${changes.valueSet.name}${changes.valueSet.oid ? ` (${changes.valueSet.oid})` : ''}`;

    displayChanges.push({
      field: 'Value Set',
      from: currentVS,
      to: newVS,
    });
  }

  if (changes.status !== undefined) {
    displayChanges.push({
      field: 'Status',
      from: currentComponent.status,
      to: changes.status,
    });
  }

  if (changes.ageRange !== undefined) {
    const currentAge = currentComponent.ageRange
      ? `${currentComponent.ageRange.min}-${currentComponent.ageRange.max} years`
      : '(none)';

    displayChanges.push({
      field: 'Age Range',
      from: currentAge,
      to: `${changes.ageRange.min}-${changes.ageRange.max} years`,
    });
  }

  return displayChanges;
}
