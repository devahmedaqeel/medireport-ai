import { Platform } from 'react-native';

// Try EXPO_PUBLIC_API_BASE_URL first, otherwise fall back to host IP
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.100.11:8000'; 
console.log("MediReport API_BASE:", API_BASE);

// Reusable fetch wrapper with timeout, retries, and friendly errors
async function fetchWithTimeoutAndRetry(url, options = {}, retries = 1, timeout = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const config = {
    ...options,
    signal: controller.signal
  };
  
  try {
    console.log(`[DEBUG] Fetching: ${url}`);
    const response = await fetch(url, config);
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    
    // Check if we should retry
    if (retries > 0 && (err.name === 'TypeError' || err.name === 'AbortError')) {
      console.log(`[DEBUG] Retrying fetch to ${url}... (${retries} attempts left)`);
      return fetchWithTimeoutAndRetry(url, options, retries - 1, timeout);
    }
    
    // Throw friendly errors with diagnostic help
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out (${timeout/1000}s). The backend at ${API_BASE} is not responding fast enough.`);
    } else {
      console.error(`[NETWORK ERROR] URL: ${url}`, err);
      const isLocalhost = API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1');
      let helpMsg = `Could not connect to backend at ${API_BASE}. `;
      
      if (isLocalhost) {
        helpMsg += "You are using 'localhost' which doesn't work on real phones. Change API_BASE to your computer's IP address (e.g., 192.168.x.x).";
      } else {
        helpMsg += "1. Make sure backend is running. 2. Ensure Phone & Laptop are on SAME Wi-Fi. 3. Check if your IP has changed.";
      }
      
      throw new Error(helpMsg);
    }
  }
}

let healthCache = {
  data: null,
  timestamp: 0
};

export async function checkBackendHealth() {
  const now = Date.now();
  if (healthCache.data && (now - healthCache.timestamp < 30000)) {
    return healthCache.data;
  }

  try {
    console.log("[DEBUG] Checking health at:", `${API_BASE}/api/health`);
    const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/health`, { method: 'GET' }, 0, 8000);
    const data = await res.json();
    healthCache = { data, timestamp: now };
    return data;
  } catch (err) {
    console.warn("Backend health check failed at:", API_BASE, err.message);
    const errorData = { 
      status: "error", 
      message: "Backend not reachable. Scan/analyze will not work until backend is running.", 
      url: API_BASE 
    };
    // Don't cache error for long, maybe 5s
    healthCache = { data: errorData, timestamp: now - 25000 }; 
    return errorData;
  }
}

export async function scanReport(uri, userId = 'guest') {
  const formData = new FormData();
  
  // Extract filename and extension from URI
  const uriParts = uri.split('.');
  const fileType = uriParts[uriParts.length - 1];
  const fileName = uri.split('/').pop();

  formData.append('file', {
    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
    name: fileName || `report.${fileType || 'jpg'}`,
    type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`,
  });
  
  formData.append('userId', userId);

  console.log(`[DEBUG-API] Uploading image to: ${API_BASE}/api/reports/scan`);
  console.log(`[DEBUG-API] FormData 'file' name: ${fileName}`);
  console.log(`[DEBUG-API] FormData 'file' type: image/${fileType === 'png' ? 'png' : 'jpeg'}`);
  console.log(`[DEBUG-API] FormData 'userId': ${userId}`);
  
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/scan`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
    },
  }, 1, 60000); // 60s timeout for OCR

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Server responded with ${res.status}: ${errorText}`);
  }

  return res.json();
}

export async function parseReport(ocr_text) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/parse`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ ocr_text })
  }, 1, 60000);
  return res.json();
}

export async function analyzeReport(report) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/analyze`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ report })
  }, 1, 60000);
  return res.json();
}

export async function explainReport(report) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/explain`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ report })
  }, 1, 60000);
  return res.json();
}

export async function saveReport(userId, report) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/save`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ userId, report })
  }, 1, 60000);
  return res.json();
}

export async function getReportHistory(userId) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/history/${userId}`, {}, 1, 60000);
  return res.json();
}

export async function getReportTrends(userId) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/trends/${userId}`, {}, 1, 60000);
  return res.json();
}

export async function getDailyTips() {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/daily-tips`, {}, 1, 30000);
  return res.json();
}

export async function analyzeTextDirect(text) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/analyze-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }, 1, 60000);
  return res.json();
}

export async function clearReportHistory(userId) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/clear/${userId}`, {
    method: 'DELETE'
  }, 1, 30000);
  return res.json();
}

export async function searchWikiOnline(query) {
  const res = await fetchWithTimeoutAndRetry(`${API_BASE}/api/reports/wiki-search?q=${encodeURIComponent(query)}`, {
    method: 'GET'
  }, 1, 8000); // 8s timeout
  return res.json();
}

export { API_BASE };
