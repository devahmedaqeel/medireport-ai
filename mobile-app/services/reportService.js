import { getCurrentUser } from './authService';
import * as api from './api';

// Helper to get active user ID from active Firebase Auth session or fallback
export function getActiveUserId() {
  const user = getCurrentUser();
  return user ? user.id : 'guest';
}


export async function scanAndProcessReport(imageUri) {
  const userId = getActiveUserId();
  return api.scanReport(imageUri, userId);
}

export async function saveCurrentReport(result) {
  const userId = getActiveUserId();
  return api.saveReport(userId, result);
}

export async function fetchUserHistory() {
  const userId = getActiveUserId();
  return api.getReportHistory(userId);
}
