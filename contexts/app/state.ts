import { useState, useEffect } from 'react';
import { 
    User, ServiceItem, Order, Supplier, InventoryItem, MaterialOrder, 
    MaterialItemDefinition, Notification, VariableCost, FixedCostItem, 
    FixedCostUpdateHistoryEntry, ServiceRating, StaffRating, Tip, KPI, StoreProfile,
    StoreUpdateHistoryEntry, Promotion
} from '../../types';
import { loadDataFromLocalStorage, saveDataToLocalStorage } from './utils';
import * as LsKeys from './utils';

// Helper to create a debounced effect for saving state to localStorage
const useDebouncedSave = <T,>(key: string, value: T, delay: number = 1000) => {
  useEffect(() => {
    const handler = setTimeout(() => {
      saveDataToLocalStorage(key, value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [key, value, delay]);
};

export const useAppState = () => {
  const [usersData, setUsersData] = useState<User[]>(() => loadDataFromLocalStorage<User[]>(LsKeys.USERS_KEY, []));
  // FIX: Re-added customersData state as it's still used by some hooks during the refactor.
  const [customersData, setCustomersData] = useState<User[]>(() => loadDataFromLocalStorage<User[]>(LsKeys.USERS_KEY, []).filter(u => u.role === 'Khách hàng'));
  const [servicesData, setServicesData] = useState<ServiceItem[]>(() => loadDataFromLocalStorage<ServiceItem[]>(LsKeys.SERVICES_KEY, []));
  const [allOrdersData, setAllOrdersData] = useState<Order[]>(() => loadDataFromLocalStorage<Order[]>(LsKeys.ORDERS_KEY, [], 'orders'));
  const [suppliersData, setSuppliersData] = useState<Supplier[]>(() => loadDataFromLocalStorage<Supplier[]>(LsKeys.SUPPLIERS_KEY, []));
  const [allInventoryData, setAllInventoryData] = useState<InventoryItem[]>(() => loadDataFromLocalStorage<InventoryItem[]>(LsKeys.INVENTORY_KEY, []));
  const [allMaterialOrdersData, setAllMaterialOrdersData] = useState<MaterialOrder[]>(() => loadDataFromLocalStorage<MaterialOrder[]>(LsKeys.MATERIAL_ORDERS_KEY, [], 'materialOrders'));
  const [materialItemDefinitionsData, setMaterialItemDefinitionsData] = useState<MaterialItemDefinition[]>(() => loadDataFromLocalStorage<MaterialItemDefinition[]>(LsKeys.MATERIAL_DEFINITIONS_KEY, []));
  const [allNotificationsData, setAllNotificationsData] = useState<Notification[]>(() => loadDataFromLocalStorage<Notification[]>(LsKeys.NOTIFICATIONS_KEY, [], 'notifications'));
  const [allVariableCostsData, setAllVariableCostsData] = useState<VariableCost[]>(() => loadDataFromLocalStorage<VariableCost[]>(LsKeys.VARIABLE_COSTS_KEY, [], 'variableCosts'));
  const [allFixedCostsData, setAllFixedCostsData] = useState<FixedCostItem[]>(() => loadDataFromLocalStorage<FixedCostItem[]>(LsKeys.FIXED_COSTS_KEY, []));
  const [fixedCostsUpdateHistoryData, setFixedCostsUpdateHistoryData] = useState<FixedCostUpdateHistoryEntry[]>(() => loadDataFromLocalStorage<FixedCostUpdateHistoryEntry[]>(LsKeys.FIXED_COSTS_HISTORY_KEY, [], 'fixedCostsUpdateHistory'));
  const [serviceRatingsData, setServiceRatingsData] = useState<ServiceRating[]>(() => loadDataFromLocalStorage<ServiceRating[]>(LsKeys.SERVICE_RATINGS_KEY, [], 'serviceRatings'));
  const [staffRatingsData, setStaffRatingsData] = useState<StaffRating[]>(() => loadDataFromLocalStorage<StaffRating[]>(LsKeys.STAFF_RATINGS_KEY, [], 'staffRatings'));
  const [tipsData, setTipsData] = useState<Tip[]>(() => loadDataFromLocalStorage<Tip[]>(LsKeys.TIPS_KEY, [], 'tips'));
  const [allKpisData, setAllKpisData] = useState<KPI[]>(() => loadDataFromLocalStorage<KPI[]>(LsKeys.KPIS_KEY, [], 'kpis'));
  const [storeProfilesData, setStoreProfilesData] = useState<StoreProfile[]>(() => loadDataFromLocalStorage<StoreProfile[]>(LsKeys.STORE_PROFILES_KEY, []));
  const [storeUpdateHistoryData, setStoreUpdateHistoryData] = useState<StoreUpdateHistoryEntry[]>(() => loadDataFromLocalStorage<StoreUpdateHistoryEntry[]>(LsKeys.STORE_UPDATE_HISTORY_KEY, [], 'storeUpdateHistory'));
  const [promotionsData, setPromotionsData] = useState<Promotion[]>(() => loadDataFromLocalStorage<Promotion[]>(LsKeys.PROMOTIONS_KEY, [], 'promotions'));
  const [acknowledgedSystemPromos, setAcknowledgedSystemPromos] = useState<{ [ownerId: string]: string[] }>(() => loadDataFromLocalStorage(LsKeys.ACKNOWLEDGED_SYSTEM_PROMOS_KEY, {}));
  const [acknowledgedCancelRequests, setAcknowledgedCancelRequests] = useState<{ [ownerId: string]: string[] }>(() => loadDataFromLocalStorage(LsKeys.ACKNOWLEDGED_CANCEL_REQUESTS_KEY, {}));
  const [acknowledgedOptOutRequests, setAcknowledgedOptOutRequests] = useState<{ [chairmanId: string]: string[] }>(() => loadDataFromLocalStorage(LsKeys.ACKNOWLEDGED_OPT_OUT_REQUESTS_KEY, {}));
  
  // Granular, debounced effects for saving each piece of state
  useDebouncedSave(LsKeys.USERS_KEY, usersData);
  useDebouncedSave(LsKeys.SERVICES_KEY, servicesData);
  useDebouncedSave(LsKeys.ORDERS_KEY, allOrdersData);
  useDebouncedSave(LsKeys.SUPPLIERS_KEY, suppliersData);
  useDebouncedSave(LsKeys.INVENTORY_KEY, allInventoryData);
  useDebouncedSave(LsKeys.MATERIAL_ORDERS_KEY, allMaterialOrdersData);
  useDebouncedSave(LsKeys.MATERIAL_DEFINITIONS_KEY, materialItemDefinitionsData);
  useDebouncedSave(LsKeys.NOTIFICATIONS_KEY, allNotificationsData);
  useDebouncedSave(LsKeys.VARIABLE_COSTS_KEY, allVariableCostsData);
  useDebouncedSave(LsKeys.FIXED_COSTS_KEY, allFixedCostsData);
  useDebouncedSave(LsKeys.FIXED_COSTS_HISTORY_KEY, fixedCostsUpdateHistoryData);
  useDebouncedSave(LsKeys.SERVICE_RATINGS_KEY, serviceRatingsData);
  useDebouncedSave(LsKeys.STAFF_RATINGS_KEY, staffRatingsData);
  useDebouncedSave(LsKeys.TIPS_KEY, tipsData);
  useDebouncedSave(LsKeys.KPIS_KEY, allKpisData);
  useDebouncedSave(LsKeys.STORE_PROFILES_KEY, storeProfilesData);
  useDebouncedSave(LsKeys.STORE_UPDATE_HISTORY_KEY, storeUpdateHistoryData);
  useDebouncedSave(LsKeys.PROMOTIONS_KEY, promotionsData);
  useDebouncedSave(LsKeys.ACKNOWLEDGED_SYSTEM_PROMOS_KEY, acknowledgedSystemPromos);
  useDebouncedSave(LsKeys.ACKNOWLEDGED_CANCEL_REQUESTS_KEY, acknowledgedCancelRequests);
  useDebouncedSave(LsKeys.ACKNOWLEDGED_OPT_OUT_REQUESTS_KEY, acknowledgedOptOutRequests);

  return {
    usersData, setUsersData,
    // FIX: Expose customersData and its setter.
    customersData, setCustomersData,
    servicesData, setServicesData,
    allOrdersData, setAllOrdersData,
    suppliersData, setSuppliersData,
    allInventoryData, setAllInventoryData,
    allMaterialOrdersData, setAllMaterialOrdersData,
    materialItemDefinitionsData, setMaterialItemDefinitionsData,
    allNotificationsData, setAllNotificationsData,
    allVariableCostsData, setAllVariableCostsData,
    allFixedCostsData, setAllFixedCostsData,
    fixedCostsUpdateHistoryData, setFixedCostsUpdateHistoryData,
    serviceRatingsData, setServiceRatingsData,
    staffRatingsData, setStaffRatingsData,
    tipsData, setTipsData,
    allKpisData, setAllKpisData,
    storeProfilesData, setStoreProfilesData,
    storeUpdateHistoryData, setStoreUpdateHistoryData,
    promotionsData, setPromotionsData,
    acknowledgedSystemPromos, setAcknowledgedSystemPromos,
    acknowledgedCancelRequests, setAcknowledgedCancelRequests,
    acknowledgedOptOutRequests, setAcknowledgedOptOutRequests,
  };
};
