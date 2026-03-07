/**
 * Classifier Feedback API client.
 * Sends user confirmation/override feedback to the backend for training signal storage.
 */

import { post } from './client';

/**
 * Record classifier feedback.
 * This is a fire-and-forget call - errors are logged but don't block the import flow.
 *
 * @param {Object} feedback
 * @param {string} feedback.documentName - Original filename
 * @param {string|null} feedback.detectedType - Classifier's detected type
 * @param {string} feedback.confirmedType - User's confirmed type
 * @param {boolean} feedback.wasOverridden - Whether user changed the detection
 * @param {string} feedback.confidence - Detection confidence level
 * @param {string[]} feedback.signals - Human-readable signals that fired
 * @returns {Promise<{recorded: boolean}>}
 */
export async function recordClassifierFeedback(feedback) {
  try {
    const response = await post('/classifier/feedback', {
      documentName: feedback.documentName,
      detectedType: feedback.detectedType,
      confirmedType: feedback.confirmedType,
      wasOverridden: feedback.wasOverridden,
      confidence: feedback.confidence,
      signals: feedback.signals,
      timestamp: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    // Log error but don't throw - this is non-blocking
    console.warn('[classifierFeedback] Failed to record feedback:', error);
    return { recorded: false };
  }
}

/**
 * Fire-and-forget version that doesn't await the response.
 * Use this in the import flow to avoid blocking.
 *
 * @param {Object} feedback - Same as recordClassifierFeedback
 */
export function recordClassifierFeedbackAsync(feedback) {
  recordClassifierFeedback(feedback).catch((err) => {
    console.warn('[classifierFeedback] Background feedback failed:', err);
  });
}
