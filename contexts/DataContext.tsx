

import { createContext, useContext } from 'react';
import { 
    User, ServiceItem, Order, Supplier, InventoryItem, MaterialOrder, 
    Notification, VariableCost, FixedCostItem, FixedCostUpdateHistoryEntry, 
    ServiceRating, StaffRating, Tip, KPI, StoreProfile, StoreUpdateHistoryEntry, Promotion,
    // FIX: Imported missing MaterialItemDefinition type and removed Customer
    Theme, UserRole, VariableCostInput, KpiPeriodType, MaterialItemDefinition, WashMethodDefinition
} from '../types';

// This mirrors the AppContextType but without auth fields
export interface DataContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  users: User[];
  // FIX: Removed deprecated `customers` data.
  services: ServiceItem[];
  orders: Order[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  materialOrders: MaterialOrder[];
  materialItemDefinitions: MaterialItemDefinition[];
  notifications: Notification[];
  variableCosts: VariableCost[];
  fixedCosts: FixedCostItem[];
  fixedCostsUpdateHistory: FixedCostUpdateHistoryEntry[];
  serviceRatings: ServiceRating[];
  staffRatings: StaffRating[];
  tips: Tip[];
  kpis: KPI[];
  storeProfiles: StoreProfile[];
  storeUpdateHistory: StoreUpdateHistoryEntry[];
  promotions: Promotion[];
  acknowledgedSystemPromos: { [ownerId: string]: string[] };
  acknowledgedCancelRequests: { [ownerId: string]: string[] };
  acknowledgedOptOutRequests: { [chairmanId: string]: string[] };
  washMethods: WashMethodDefinition[];
  activePublicCustomerId: string | null;
  setActivePublicCustomerId: (customerId: string | null) => void;

  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  deleteOrder: (orderId: string, reason: string, deletedBy: UserRole) => void;
  findOrder: (idOrPhone: string) => Order | undefined;
  findUserById: (userId: string) => User | undefined;
  findUsersByManagerId: (managerId: string | null) => User[];
  // FIX: Removed deprecated customer management functions. User management is handled by addUser/updateUser.
  addService: (serviceData: Omit<ServiceItem, 'id'>) => void;
  updateService: (service: ServiceItem) => void;
  deleteService: (serviceId: string) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'ownerId'>) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  // FIX: Added `& { showToast?: boolean }` to the addNotification type definition to allow passing the showToast property.
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'ownerId'> & { showToast?: boolean }) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  addMaterialOrder: (orderData: { items: Array<{ materialItemDefinitionId: string; quantity: number; itemNotes?: string; }>; createdBy: UserRole; notes?: string; }) => void;
  approveMaterialOrder: (orderId: string, approvedBy: UserRole, notes?: string) => void;
  rejectMaterialOrder: (orderId: string, rejectedBy: UserRole, reason: string) => void;
  addMaterialItemDefinition: (definition: Omit<MaterialItemDefinition, 'id'>) => void;
  updateMaterialItemDefinition: (definition: MaterialItemDefinition) => void;
  deleteMaterialItemDefinition: (definitionId: string) => void;
  addVariableCost: (costData: VariableCostInput) => void;
  updateVariableCost: (costId: string, updates: Partial<VariableCostInput>, reason: string, updatedBy: UserRole) => void;
  deleteVariableCost: (costId: string, reason: string, deletedBy: UserRole) => void;
  updateFixedCosts: (updatedFixedCosts: Omit<FixedCostItem, 'ownerId'>[], reason: string, changedBy: UserRole, targetOwnerIdParam?: string) => void;
  addServiceRating: (ratingData: Omit<ServiceRating, 'id' | 'createdAt' | 'ownerId'>) => void;
  addStaffRating: (ratingData: Omit<StaffRating, 'id' | 'createdAt' | 'ownerId'>) => void;
  createTip: (tipData: Omit<Tip, 'id' | 'createdAt' | 'status' | 'ownerId'>) => Tip | null;
  getStaffForOrderActions: (orderId: string) => { pickupStaff?: User; returnStaff?: User; processingStaff?: User[]; };
  calculateAndStoreKPIsForAllStaff: (periodType: KpiPeriodType, referenceDate: Date) => Promise<void>;
  getKPIs: (filters: { userId?: string; periodType?: KpiPeriodType; startDate?: Date; endDate?: Date; ownerIdFilter?: string; }) => KPI[];
  addUser: (userData: Omit<User, 'id'> & { managedBy?: string; }, storeProfileData?: Omit<StoreProfile, 'ownerId'>) => Promise<User | null>;
  updateUser: (userData: Partial<User> & { id: string }, storeProfileData?: Partial<Omit<StoreProfile, 'ownerId'>>) => Promise<boolean>;
  deleteUser: (userId: string) => void;
  updateStoreProfile: (profileData: Partial<StoreProfile> & { ownerId: string; }, reason: string) => void;
  findStoreProfileByOwnerId: (ownerId: string) => StoreProfile | undefined;
  deleteStoreAndOwner: (ownerId: string, reason: string) => void;
  addPromotion: (promotionData: Omit<Promotion, 'id' | 'timesUsed' | 'ownerId' | 'status' | 'createdBy' | 'approvedBy' | 'approvedAt' | 'rejectionReason' | 'managerReports'> & { isSystemWide?: boolean, isActive?: boolean }) => void;
  updatePromotion: (promotionData: Promotion) => void;
  deletePromotion: (promotionId: string) => void;
  approvePromotion: (promotionId: string) => void;
  rejectPromotion: (promotionId: string, reason: string) => void;
  findPromotionByCode: (code: string, forStoreOwnerId?: string, channel?: 'online' | 'instore') => Promotion | undefined;
  requestPromotionOptOut: (promotionId: string, reason: string) => void;
  respondToOptOutRequest: (promotionId: string, storeOwnerId: string, response: 'approved' | 'rejected', rejectionReason?: string) => void;
  requestPromotionCancellation: (promotionId: string, reason: string) => void;
  respondToCancellationRequest: (promotionId: string, response: 'approved') => void;
  acknowledgeSystemPromo: (promotionId: string) => void;
  acknowledgeCancelRequest: (promotionId: string) => void;
  acknowledgeOptOutRequest: (promotionId: string, storeOwnerId: string) => void;
  addManagerReport: (promotionId: string, reason: string) => void;
  resolveManagerReport: (promotionId: string, reportId: string) => void;
  addWashMethod: (methodData: Omit<WashMethodDefinition, 'id' | 'ownerId'>) => void;
  updateWashMethod: (method: WashMethodDefinition) => void;
  deleteWashMethod: (methodId: string) => void;
  getCurrentUserOwnerId: () => string | null;
  getOwnerIdForUser: (userId: string, allUsers: User[]) => string | null;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within an AppProvider');
  }
  return context;
};