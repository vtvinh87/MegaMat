import { useMemo } from 'react';
import { User, UserRole, Order, InventoryItem, MaterialOrder, VariableCost, FixedCostItem, Notification, KPI, Promotion, WashMethodDefinition } from '../../../types';

type Props = {
  currentUser: User | null;
  currentUserOwnerId: string | null;
  findUsersByManagerId: (managerId: string | null) => User[];
  allOrdersData: Order[];
  allInventoryData: InventoryItem[];
  allMaterialOrdersData: MaterialOrder[];
  allVariableCostsData: VariableCost[];
  allFixedCostsData: FixedCostItem[];
  allNotificationsData: Notification[];
  allKpisData: KPI[];
  promotionsData: Promotion[];
  washMethodsData: WashMethodDefinition[];
};

export const useDataFiltering = ({
  currentUser,
  currentUserOwnerId,
  findUsersByManagerId,
  allOrdersData,
  allInventoryData,
  allMaterialOrdersData,
  allVariableCostsData,
  allFixedCostsData,
  allNotificationsData,
  allKpisData,
  promotionsData,
  washMethodsData,
}: Props) => {
  const filteredData = useMemo(() => {
    if (!currentUser) {
      // Public view: Needs all orders for lookup, but only generic notifications.
      return { 
        orders: allOrdersData, 
        inventory: [], 
        materialOrders: [], 
        variableCosts: [], 
        fixedCosts: [], 
        notifications: allNotificationsData.filter(n => !n.userId && !n.ownerId), 
        kpis: [], 
        promotions: promotionsData, // FIX: Allow public homepage to display active promotions
        washMethods: [],
      };
    }

    if (currentUser.role === UserRole.CUSTOMER) {
      // Customer view: Sees only their own orders.
      return {
        orders: allOrdersData.filter(o => o.customer.id === currentUser.id),
        // Customers don't need access to admin-level data
        inventory: [], 
        materialOrders: [], 
        variableCosts: [], 
        fixedCosts: [], 
        // Notification filtering is handled in NotificationTray, but this pre-filters for context
        notifications: allNotificationsData.filter(n => {
            if (!n.orderId) return false;
            const order = allOrdersData.find(o => o.id === n.orderId);
            return order?.customer.id === currentUser.id;
        }), 
        kpis: [], 
        promotions: [],
        washMethods: [],
      };
    }

    if (currentUser.role === UserRole.CHAIRMAN) {
      // Chairman sees all data
      return { orders: allOrdersData, inventory: allInventoryData, materialOrders: allMaterialOrdersData, variableCosts: allVariableCostsData, fixedCosts: allFixedCostsData, notifications: allNotificationsData, kpis: allKpisData, promotions: promotionsData, washMethods: washMethodsData };
    }
    
    // Owner, Manager, Staff view (data scoped to their store)
    const relevantOwnerId = currentUserOwnerId;
    
    // Correctly get all subordinates recursively for notification filtering
    const allSubordinateIds = new Set<string>();
    const getSubordinatesRecursively = (managerId: string) => {
      const directSubs = findUsersByManagerId(managerId);
      directSubs.forEach(sub => {
        if (!allSubordinateIds.has(sub.id)) {
          allSubordinateIds.add(sub.id);
          getSubordinatesRecursively(sub.id);
        }
      });
    };
    getSubordinatesRecursively(currentUser.id);
    
    const relevantUserIds = new Set<string>([currentUser.id, ...Array.from(allSubordinateIds)]);

    const filteredNotifications = allNotificationsData.filter(n => {
        if (n.userId && relevantUserIds.has(n.userId)) return true;
        if (!n.userId && n.ownerId === relevantOwnerId) return true; // System notification for their store
        if (!n.userId && !n.ownerId && currentUser.role === UserRole.OWNER) return true; // Generic system notification for owner
        return false;
    });

    if (!relevantOwnerId) {
      // User who is not associated with any store yet
      return { orders: [], inventory: [], materialOrders: [], variableCosts: [], fixedCosts: [], notifications: filteredNotifications, kpis: [], promotions: [], washMethods: [] };
    }
    
    return {
        orders: allOrdersData.filter(o => o.ownerId === relevantOwnerId),
        inventory: allInventoryData.filter(i => i.ownerId === relevantOwnerId),
        materialOrders: allMaterialOrdersData.filter(mo => mo.ownerId === relevantOwnerId),
        variableCosts: allVariableCostsData.filter(vc => vc.ownerId === relevantOwnerId),
        fixedCosts: allFixedCostsData.filter(fc => fc.ownerId === relevantOwnerId),
        notifications: filteredNotifications,
        kpis: allKpisData.filter(k => k.ownerId === relevantOwnerId),
        promotions: promotionsData.filter(p => p.ownerId === relevantOwnerId || p.isSystemWide),
        washMethods: washMethodsData.filter(wm => wm.ownerId === relevantOwnerId),
    };
  }, [currentUser, currentUserOwnerId, allOrdersData, allInventoryData, allMaterialOrdersData, allVariableCostsData, allFixedCostsData, allNotificationsData, allKpisData, promotionsData, washMethodsData, findUsersByManagerId]);

  return filteredData;
};
