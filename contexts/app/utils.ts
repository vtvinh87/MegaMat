// --- localStorage Keys ---
export const STORAGE_PREFIX = 'laundryApp_';
export const USERS_KEY = `${STORAGE_PREFIX}users`;
export const SERVICES_KEY = `${STORAGE_PREFIX}services`;
export const ORDERS_KEY = `${STORAGE_PREFIX}orders`;
export const SUPPLIERS_KEY = `${STORAGE_PREFIX}suppliers`;
export const INVENTORY_KEY = `${STORAGE_PREFIX}inventory`;
export const MATERIAL_ORDERS_KEY = `${STORAGE_PREFIX}materialOrders`;
export const MATERIAL_DEFINITIONS_KEY = `${STORAGE_PREFIX}materialItemDefinitions`;
export const NOTIFICATIONS_KEY = `${STORAGE_PREFIX}notifications`;
export const VARIABLE_COSTS_KEY = `${STORAGE_PREFIX}variableCosts`;
export const FIXED_COSTS_KEY = `${STORAGE_PREFIX}fixedCosts`;
export const FIXED_COSTS_HISTORY_KEY = `${STORAGE_PREFIX}fixedCostsHistory`;
export const SERVICE_RATINGS_KEY = `${STORAGE_PREFIX}serviceRatings`;
export const STAFF_RATINGS_KEY = `${STORAGE_PREFIX}staffRatings`;
export const TIPS_KEY = `${STORAGE_PREFIX}tips`;
export const KPIS_KEY = `${STORAGE_PREFIX}kpis`;
export const STORE_PROFILES_KEY = `${STORAGE_PREFIX}storeProfiles`;
export const STORE_UPDATE_HISTORY_KEY = `${STORAGE_PREFIX}storeUpdateHistory`;
export const PROMOTIONS_KEY = `${STORAGE_PREFIX}promotions`;
export const ACKNOWLEDGED_SYSTEM_PROMOS_KEY = `${STORAGE_PREFIX}acknowledgedSystemPromos`;
export const ACKNOWLEDGED_CANCEL_REQUESTS_KEY = `${STORAGE_PREFIX}acknowledgedCancelRequests`;
export const ACKNOWLEDGED_OPT_OUT_REQUESTS_KEY = `${STORAGE_PREFIX}acknowledgedOptOutRequests`;
export const CURRENT_USER_KEY = `${STORAGE_PREFIX}currentUser`;
export const THEME_KEY = `${STORAGE_PREFIX}theme`;


// --- Helper for Date Revival ---
const DATE_FIELDS: Record<string, string[]> = {
    orders: ['createdAt', 'receivedAt', 'estimatedCompletionTime', 'completedAt'],
    scanHistory: ['timestamp'], // Nested in orders
    notifications: ['createdAt'],
    variableCosts: ['date'],
    costHistory: ['timestamp'], // Nested in variableCosts
    fixedCostsUpdateHistory: ['timestamp'],
    serviceRatings: ['createdAt'],
    staffRatings: ['createdAt'],
    tips: ['createdAt'],
    kpis: ['startDate', 'endDate', 'createdAt'],
    materialOrders: ['createdAt'], // Added missing
    storeUpdateHistory: ['timestamp'],
    promotions: ['startDate', 'endDate', 'respondedAt'], // Added respondedAt for optOuts
    optOutRequests: ['respondedAt'], // Nested in promotions
    cancellationRequest: ['respondedAt'], // Nested in promotions
};

function reviveDates(key: string, value: any, objectType?: string): any {
  if (objectType && DATE_FIELDS[objectType]?.includes(key) && typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  // Handle nested objects that need date revival
  if (key === 'scanHistory' && Array.isArray(value)) {
    return value.map(entry => reviveDatesInObject(entry, 'scanHistory'));
  }
  if (key === 'history' && Array.isArray(value) && objectType === 'variableCosts') { 
    return value.map(entry => reviveDatesInObject(entry, 'costHistory'));
  }
  if (key === 'optOutRequests' && Array.isArray(value)) {
    return value.map(entry => reviveDatesInObject(entry, 'optOutRequests'));
  }
  if (key === 'cancellationRequest' && typeof value === 'object' && value !== null) {
      return reviveDatesInObject(value, 'cancellationRequest');
  }
  return value;
}

export function reviveDatesInObject<T extends Record<string, any>>(obj: T, objectType: string): T {
    const newObj = { ...obj };
    for (const key in newObj) {
        if (Object.prototype.hasOwnProperty.call(newObj, key)) {
            newObj[key] = reviveDates(key, newObj[key], objectType);
        }
    }
    return newObj;
}

export function loadDataFromLocalStorage<T>(key: string, defaultValue: T, objectTypeForDateRevival?: string): T {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      const parsed = JSON.parse(storedValue);
      if (objectTypeForDateRevival && Array.isArray(parsed)) {
          return parsed.map(item => reviveDatesInObject(item, objectTypeForDateRevival)) as T;
      } else if (objectTypeForDateRevival && typeof parsed === 'object' && parsed !== null) {
          return reviveDatesInObject(parsed, objectTypeForDateRevival) as T;
      }
      return parsed;
    }
  } catch (error) {
    console.error(`Error loading data from localStorage for key "${key}":`, error);
  }
  return defaultValue;
}

export function saveDataToLocalStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving data to localStorage for key "${key}":`, error);
  }
}

// A secure hashing function using the browser's built-in Crypto API (SHA-256).
// This is now an async function.
export const simpleHash = async (s: string | undefined): Promise<string | undefined> => {
  if (!s) return undefined;
  // Use SubtleCrypto for SHA-256 hashing in browser environments
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(s);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
  } else {
      // Fallback for environments without crypto.subtle (e.g., old browsers, some test environments)
      // This is an insecure hash and should be avoided in production.
      console.warn("SubtleCrypto API not available. Falling back to insecure hash. This is not recommended for production.");
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
      }
      return 'insecure_hashed_' + hash.toString();
  }
};
