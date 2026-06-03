/**
 * Health Score Utility Helper Functions
 */

/**
 * Calculates health score based on parsed test markers.
 * Good (>80): Green
 * Warning (>50): Amber
 * Critical (<=50): Red
 */
export const calculateHealthScore = (report) => {
  if (!report) return null;
  
  // Use pre-calculated backend score if available
  const backendScore = report.health_score !== undefined ? report.health_score : report.healthScore;
  if (backendScore !== undefined && backendScore !== null) {
    return backendScore;
  }
  
  const tests = report.report?.tests || report.tests || [];
  if (!tests || tests.length === 0) return null;
  
  const validTests = tests.filter(t => t.status && t.status.toLowerCase() !== 'unknown' && t.status.toLowerCase() !== 'needs_review');
  if (validTests.length === 0) return null;

  let score = 100;
  validTests.forEach(t => {
    const s = (t.status || '').toLowerCase().trim();
    const val = parseFloat(t.value);
    const low = parseFloat(t.min_range !== undefined ? t.min_range : t.rangeLow);
    const high = parseFloat(t.max_range !== undefined ? t.max_range : t.rangeHigh);
    
    if (s === 'low' || s === 'high') {
      let isCritical = false;
      if (!isNaN(val)) {
        if (s === 'low' && !isNaN(low) && val < low * 0.7) isCritical = true;
        if (s === 'high' && !isNaN(high) && val > high * 1.4) isCritical = true;
      }
      score -= isCritical ? 25 : 10;
    }
  });

  return Math.max(10, score);
};

/**
 * Returns solid color code matching the health score
 */
export const getScoreColor = (score) => {
  if (score === null) return '#0ea5e9'; // Vibrant Blue for empty/No Data state
  if (score > 80) return '#10b981';    // Green for good/optimal health
  if (score > 50) return '#f59e0b';    // Amber for caution
  return '#ef4444';                    // Red for bad/critical
};

/**
 * Returns soft translucent color matching the health score
 */
export const getScoreColorLight = (score) => {
  if (score === null) return 'rgba(14, 165, 233, 0.12)'; // Light blue for empty state
  if (score > 80) return 'rgba(16, 185, 129, 0.12)';
  if (score > 50) return 'rgba(245, 158, 11, 0.12)';
  return 'rgba(239, 68, 68, 0.12)';
};

/**
 * Returns text representing health score classification
 */
export const getScoreStatusText = (score) => {
  if (score === null) return 'No Data';
  if (score > 80) return 'Optimal';
  if (score > 50) return 'Caution';
  return 'Critical';
};
