/**
 * Narrative Generator Service
 *
 * Transforms structured evaluation traces into human-readable narratives
 * for clinical quality measure validation results.
 *
 * Follows the specification for verbose, criteria-level explainability.
 */

// ============================================================================
// Date Formatting Utilities
// ============================================================================

/**
 * Format a date as MM/DD/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format measurement period range
 */
function formatMeasurementPeriod(mpStart, mpEnd) {
  return `${formatDate(mpStart)} – ${formatDate(mpEnd)}`;
}

// ============================================================================
// Code System Formatting
// ============================================================================

/**
 * Get human-readable code system prefix
 */
function getCodeSystemPrefix(system) {
  if (!system) return '';
  const lower = system.toLowerCase();
  if (lower.includes('icd') || lower.includes('10-cm')) return 'ICD-10';
  if (lower.includes('snomed') || lower.includes('sct')) return 'SNOMED';
  if (lower.includes('cpt')) return 'CPT';
  if (lower.includes('hcpcs')) return 'HCPCS';
  if (lower.includes('loinc')) return 'LOINC';
  if (lower.includes('rxnorm') || lower.includes('rx')) return 'RxNorm';
  if (lower.includes('cvx')) return 'CVX';
  return system.toUpperCase();
}

// ============================================================================
// Criterion Narrative Templates
// ============================================================================

/**
 * Generate narrative for a satisfied criterion
 */
function generateSatisfiedCriterionNarrative(node, mpStart, mpEnd, mentionedOids) {
  const { title, facts } = node;

  if (!facts || facts.length === 0) {
    return `Patient meets the ${title} criterion.`;
  }

  // Find the most recent matching fact with a date
  const factsWithDates = facts.filter(f => f.date && f.code !== 'NO_MATCH' && f.code !== 'GROUP_MATCH');
  const mostRecentFact = factsWithDates.length > 0
    ? factsWithDates.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : facts.find(f => f.code !== 'NO_MATCH' && f.code !== 'GROUP_MATCH');

  if (!mostRecentFact) {
    return `Patient meets the ${title} criterion.`;
  }

  const { code, display, date, source } = mostRecentFact;
  const codeSystem = getCodeSystemPrefix(source);
  const mpRange = formatMeasurementPeriod(mpStart, mpEnd);

  // Check if this is a demographic/age fact
  if (code === 'AGE' || code === 'AGE_RANGE' || code === 'AGE_TURNS' || code === 'AGE_TURNS_PASS') {
    return `${display}. Meets the ${title} requirement.`;
  }

  // Check if this is a gender fact
  if (code === 'GENDER' || code === 'sex') {
    return display;
  }

  // For clinical data (encounter, diagnosis, procedure, observation, etc.)
  let narrative = '';

  if (date) {
    const formattedDate = formatDate(date);
    if (codeSystem && code && code !== 'DOSE_COUNT') {
      narrative = `Patient had ${display} (${codeSystem}: ${code}) on ${formattedDate}`;
    } else {
      narrative = `Patient had ${display} on ${formattedDate}`;
    }

    // Add timing context
    const mpStartDate = new Date(mpStart);
    const mpEndDate = new Date(mpEnd);
    const eventDate = new Date(date);

    if (eventDate >= mpStartDate && eventDate <= mpEndDate) {
      narrative += `, falling within the measurement period (${mpRange})`;
    }
  } else {
    narrative = `Patient has ${display}`;
  }

  narrative += '.';
  return narrative;
}

/**
 * Generate narrative for a failed criterion
 */
function generateFailedCriterionNarrative(node, mpStart, mpEnd) {
  const { title, facts, description } = node;
  const mpRange = formatMeasurementPeriod(mpStart, mpEnd);

  if (!facts || facts.length === 0) {
    return `No matching data found for: ${title}.`;
  }

  // Check for specific failure types
  const noMatchFact = facts.find(f => f.code === 'NO_MATCH');
  const ageFailFact = facts.find(f => f.code === 'AGE_MIN_FAIL' || f.code === 'AGE_MAX_FAIL' || f.code === 'AGE_RANGE_FAIL' || f.code === 'AGE_TURNS_FAIL');
  const insufficientDoses = facts.find(f => f.code === 'INSUFFICIENT_DOSES');

  if (ageFailFact) {
    return `${ageFailFact.display}. This measure requires ${title}.`;
  }

  if (insufficientDoses) {
    return `${insufficientDoses.display} for ${title}.`;
  }

  if (noMatchFact) {
    // Check if there's historical data outside the measurement period
    const historicalFact = facts.find(f => f.date && f.code !== 'NO_MATCH');

    if (historicalFact) {
      const histDate = formatDate(historicalFact.date);
      return `No ${title} was found during the measurement period (${mpRange}). The most recent on file was on ${histDate}, which falls outside the measurement period.`;
    }

    return `No ${title} was found in the patient record.`;
  }

  // Check for threshold failures (e.g., HbA1c > 9%)
  const valueFact = facts.find(f => f.display && f.display.includes(':'));
  if (valueFact && description?.toLowerCase().includes('≤') || description?.toLowerCase().includes('<=')) {
    const thresholdMatch = description.match(/[≤<>=]+\s*(\d+\.?\d*)/);
    if (thresholdMatch) {
      return `${valueFact.display}. The measure requires a result ≤ ${thresholdMatch[1]}.`;
    }
  }

  return `No matching data found for: ${title}.`;
}

/**
 * Generate narrative for an exclusion trigger
 */
function generateExclusionNarrative(node, mpStart, mpEnd) {
  const { title, facts } = node;
  const mpRange = formatMeasurementPeriod(mpStart, mpEnd);

  if (!facts || facts.length === 0) {
    return `Patient meets exclusion criteria: ${title}. The patient is excluded from the measure.`;
  }

  const matchingFact = facts.find(f => f.code !== 'NO_MATCH');
  if (matchingFact) {
    const { code, display, date, source } = matchingFact;
    const codeSystem = getCodeSystemPrefix(source);
    const formattedDate = date ? formatDate(date) : null;

    let narrative = `Patient had ${display}`;
    if (codeSystem && code) {
      narrative += ` (${codeSystem}: ${code})`;
    }
    if (formattedDate) {
      narrative += ` on ${formattedDate}`;
    }
    narrative += `. This matches the ${title} exclusion criteria. The patient is excluded from the measure.`;
    return narrative;
  }

  return `Patient meets exclusion criteria: ${title}. The patient is excluded from the measure.`;
}

// ============================================================================
// Population Section Generators
// ============================================================================

/**
 * Generate narrative section for a population
 */
function generatePopulationSection(
  populationName,
  populationType,
  populationResult,
  measure,
  mpStart,
  mpEnd,
  mentionedOids,
  isExclusion = false
) {
  const { met, nodes } = populationResult;
  const lines = [];

  // Section header with status
  const statusIcon = met ? '✅' : '❌';
  const statusText = met ? 'Qualifies' : 'Does Not Qualify';
  lines.push(`## ${populationName} — ${statusText} ${statusIcon}`);
  lines.push('');

  // Get operator from measure population
  const population = measure.populations?.find(p => p.type === populationType);
  const operator = population?.criteria?.operator || 'AND';
  const operatorText = operator === 'OR' ? 'any' : 'all';

  // Criteria preamble
  if (nodes && nodes.length > 0) {
    lines.push(`To qualify for the ${populationName}, the patient must meet **${operatorText}** of the following criteria:`);
    lines.push('');

    // Evaluate each criterion
    let metCount = 0;
    const totalCount = nodes.length;
    const gaps = [];

    for (const node of nodes) {
      const criterionMet = node.status === 'pass' || node.status === 'partial';
      const icon = criterionMet ? '✅' : '❌';

      let criterionNarrative;
      if (isExclusion && criterionMet) {
        criterionNarrative = generateExclusionNarrative(node, mpStart, mpEnd);
        // For exclusions that are met, we use warning icon
        lines.push(`⚠️ **${node.title}** — ${criterionNarrative}`);
      } else if (criterionMet) {
        criterionNarrative = generateSatisfiedCriterionNarrative(node, mpStart, mpEnd, mentionedOids);
        lines.push(`${icon} **${node.title}** — ${criterionNarrative}`);
        metCount++;
      } else {
        criterionNarrative = generateFailedCriterionNarrative(node, mpStart, mpEnd);
        lines.push(`${icon} **${node.title}** — ${criterionNarrative}`);
        gaps.push(generateGapStatement(node, mpStart, mpEnd));
      }
      lines.push('');
    }

    // Result line
    const resultVerb = met ? 'qualifies' : 'does not qualify';
    lines.push(`**Result:** Patient ${resultVerb} for the ${populationName} (${metCount} of ${totalCount} criteria met).`);
    lines.push('');

    // Gaps section (only for failing populations)
    if (!met && gaps.length > 0) {
      lines.push('### Gaps');
      for (const gap of gaps) {
        lines.push(`- ${gap}`);
      }
      lines.push('');
    }
  } else {
    // No criteria nodes - might be implied (e.g., Denominator = Initial Population)
    if (met) {
      lines.push(`The ${populationName} includes all patients who meet the prior population criteria.`);
    } else {
      lines.push(`Patient does not qualify for the ${populationName}.`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a gap statement for a failing criterion
 */
function generateGapStatement(node, mpStart, mpEnd) {
  const { title, facts, description } = node;
  const mpRange = formatMeasurementPeriod(mpStart, mpEnd);

  // Check for specific failure types
  const ageFailFact = facts?.find(f =>
    f.code === 'AGE_MIN_FAIL' || f.code === 'AGE_MAX_FAIL' ||
    f.code === 'AGE_RANGE_FAIL' || f.code === 'AGE_TURNS_FAIL'
  );

  if (ageFailFact) {
    return ageFailFact.display;
  }

  const insufficientDoses = facts?.find(f => f.code === 'INSUFFICIENT_DOSES');
  if (insufficientDoses) {
    return insufficientDoses.display;
  }

  // Check for value threshold failures
  const valueFact = facts?.find(f => f.display?.includes(':') && f.date);
  if (valueFact && description) {
    const thresholdMatch = description.match(/[≤<>=]+\s*(\d+\.?\d*)/);
    if (thresholdMatch) {
      return `${valueFact.display.split(':')[0]} result exceeds the required threshold (${thresholdMatch[0]})`;
    }
  }

  // Generic gap statement
  return `No qualifying ${title} found during the measurement period (${mpRange})`;
}

// ============================================================================
// Main Narrative Generator
// ============================================================================

/**
 * Generate complete evaluation narrative for a patient
 *
 * @param {Object} trace - The evaluation trace from measureEvaluator
 * @param {Object} patient - The patient data
 * @param {Object} measure - The measure specification
 * @param {Object} measurementPeriod - { start, end } dates
 * @returns {Object} Narrative object with full text and structured sections
 */
export function generateEvaluationNarrative(trace, patient, measure, measurementPeriod) {
  const mpStart = measurementPeriod?.start || `${new Date().getFullYear()}-01-01`;
  const mpEnd = measurementPeriod?.end || `${new Date().getFullYear()}-12-31`;
  const mpRange = formatMeasurementPeriod(mpStart, mpEnd);

  const mentionedOids = new Set(); // Track which OIDs have been mentioned
  const sections = [];

  // Header
  const header = [
    `# ${measure.metadata?.title || 'Measure'} — Evaluation Summary`,
    '',
    `**Patient:** ${patient.name || trace.patientName} | **DOB:** ${formatDate(patient.demographics?.birthDate)} | **Gender:** ${patient.demographics?.gender || 'Unknown'}`,
    `**Measurement Period:** ${mpRange}`,
    '',
    '---',
    ''
  ].join('\n');

  sections.push({ type: 'header', content: header });

  // Initial Population
  const ipSection = generatePopulationSection(
    'Initial Population',
    'initial_population',
    trace.populations.initialPopulation,
    measure,
    mpStart,
    mpEnd,
    mentionedOids
  );
  sections.push({
    type: 'population',
    name: 'Initial Population',
    met: trace.populations.initialPopulation.met,
    content: ipSection
  });

  // Denominator (only if IP met)
  if (trace.populations.initialPopulation.met) {
    const denomResult = trace.populations.denominator;

    // Check if denominator equals IP (common pattern)
    const denomEqualsIP = !denomResult.nodes || denomResult.nodes.length === 0;

    if (denomEqualsIP) {
      const denomSection = [
        '## Denominator — Qualifies ✅',
        '',
        'The Denominator equals the Initial Population. No additional criteria are required for this measure.',
        ''
      ].join('\n');
      sections.push({
        type: 'population',
        name: 'Denominator',
        met: true,
        content: denomSection
      });
    } else {
      const denomSection = generatePopulationSection(
        'Denominator',
        'denominator',
        denomResult,
        measure,
        mpStart,
        mpEnd,
        mentionedOids
      );
      sections.push({
        type: 'population',
        name: 'Denominator',
        met: denomResult.met,
        content: denomSection
      });
    }
  } else {
    // IP not met - Denominator not evaluated
    const denomSection = [
      '## Denominator — Not Evaluated',
      '',
      'The Denominator was not evaluated because the patient did not qualify for the Initial Population.',
      ''
    ].join('\n');
    sections.push({
      type: 'population',
      name: 'Denominator',
      met: false,
      evaluated: false,
      content: denomSection
    });
  }

  // Denominator Exclusions (only show if triggered)
  if (trace.populations.exclusions?.met) {
    const exclusionSection = generatePopulationSection(
      'Denominator Exclusion',
      'denominator_exclusion',
      trace.populations.exclusions,
      measure,
      mpStart,
      mpEnd,
      mentionedOids,
      true // isExclusion
    );
    sections.push({
      type: 'exclusion',
      name: 'Denominator Exclusion',
      triggered: true,
      content: exclusionSection
    });
  }

  // Numerator (only if in denominator and not excluded)
  if (trace.populations.initialPopulation.met &&
      trace.populations.denominator?.met !== false &&
      !trace.populations.exclusions?.met) {
    const numerSection = generatePopulationSection(
      'Numerator',
      'numerator',
      trace.populations.numerator,
      measure,
      mpStart,
      mpEnd,
      mentionedOids
    );
    sections.push({
      type: 'population',
      name: 'Numerator',
      met: trace.populations.numerator.met,
      content: numerSection
    });
  } else if (trace.populations.exclusions?.met) {
    // Excluded - Numerator not evaluated
    const numerSection = [
      '## Numerator — Not Evaluated',
      '',
      'The Numerator was not evaluated because the patient was excluded from the Denominator.',
      ''
    ].join('\n');
    sections.push({
      type: 'population',
      name: 'Numerator',
      met: false,
      evaluated: false,
      content: numerSection
    });
  } else if (!trace.populations.initialPopulation.met) {
    // IP not met - Numerator not evaluated
    const numerSection = [
      '## Numerator — Not Evaluated',
      '',
      'The Numerator was not evaluated because the patient did not qualify for the Initial Population.',
      ''
    ].join('\n');
    sections.push({
      type: 'population',
      name: 'Numerator',
      met: false,
      evaluated: false,
      content: numerSection
    });
  }

  // Final Outcome Summary
  const outcomeText = getOutcomeSummary(trace.finalOutcome, measure.metadata?.title);
  const outcomeSummary = [
    '---',
    '',
    '## Final Outcome',
    '',
    outcomeText,
    ''
  ].join('\n');
  sections.push({
    type: 'outcome',
    outcome: trace.finalOutcome,
    content: outcomeSummary
  });

  // Compile full narrative
  const fullNarrative = sections.map(s => s.content).join('\n');

  return {
    fullText: fullNarrative,
    sections,
    summary: outcomeText,
    measurementPeriod: { start: mpStart, end: mpEnd }
  };
}

/**
 * Get outcome summary text
 */
function getOutcomeSummary(outcome, measureTitle) {
  const title = measureTitle || 'this measure';

  switch (outcome) {
    case 'in_numerator':
      return `**Patient meets all criteria for ${title} and is included in the performance Numerator.** This patient represents a closed care gap.`;
    case 'not_in_numerator':
      return `**Patient is in the Denominator for ${title} but does not meet Numerator criteria.** This patient represents an open care gap.`;
    case 'excluded':
      return `**Patient meets exclusion criteria and is excluded from ${title} performance calculation.** Excluded patients do not count toward measure performance rates.`;
    case 'not_in_population':
      return `**Patient does not meet the Initial Population criteria for ${title}.** This patient is not included in any measure population.`;
    default:
      return `Evaluation complete for ${title}.`;
  }
}

/**
 * Generate a concise one-line summary for list views
 */
export function generateBriefSummary(trace, measure) {
  const { finalOutcome, populations } = trace;
  const title = measure?.metadata?.title || 'Measure';

  switch (finalOutcome) {
    case 'in_numerator':
      return `Meets all criteria for ${title}. Included in Numerator.`;
    case 'not_in_numerator': {
      // Find what's missing from numerator
      const failedNumerCriteria = populations.numerator?.nodes?.filter(n => n.status === 'fail') || [];
      if (failedNumerCriteria.length > 0) {
        const firstMissing = failedNumerCriteria[0].title;
        return `In Denominator but missing ${firstMissing}. Not in Numerator.`;
      }
      return `In Denominator but does not meet Numerator criteria.`;
    }
    case 'excluded': {
      // Find what triggered exclusion
      const triggeredExclusion = populations.exclusions?.nodes?.find(n => n.status === 'pass');
      if (triggeredExclusion) {
        return `Excluded due to ${triggeredExclusion.title}.`;
      }
      return `Excluded from measure.`;
    }
    case 'not_in_population': {
      // Find what's missing from IP
      const failedIPCriteria = populations.initialPopulation?.nodes?.filter(n => n.status === 'fail') || [];
      if (failedIPCriteria.length > 0) {
        const firstMissing = failedIPCriteria[0].title;
        return `Does not meet Initial Population: missing ${firstMissing}.`;
      }
      return `Does not meet Initial Population criteria.`;
    }
    default:
      return `Evaluation complete.`;
  }
}
