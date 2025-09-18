

// FIX: Removed self-import of WashMethodDefinition.
export interface LoyaltyTier {
  name: string; // 'Bronze', 'Silver', 'Gold'
  minSpend: number; // Minimum lifetime value to reach this tier
  discountPercentage: number; // e.g. 5 for 5%
  benefits: string[];
}
export interface WashMethodDefinition {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
}

export enum UserRole {
  CUSTOMER = 'Khách hàng',
  STAFF = 'Nhân viên',
  MANAGER = 'Quản lý',
  OWNER = 'Chủ cửa hàng',
  CHAIRMAN = 'Chủ tịch', // Added new role
  SYSTEM = 'Hệ thống', // For automated actions
}

export enum OrderStatus {
  WAITING_FOR_CONFIRMATION = 'Chờ xác nhận', // New status for customer-created orders
  PENDING = 'Chưa xử lý',
  PROCESSING = 'Đang xử lý',
  COMPLETED = 'Đã xử lý',
  CANCELLED = 'Đã hủy',
  RETURNED = 'Đã trả', // Trạng thái mới
  DELETED_BY_ADMIN = 'Đã Xóa (Admin)', // New status for soft delete
}

export enum PaymentStatus {
  UNPAID = 'Chưa thanh toán',
  PAID = 'Đã thanh toán',
  REFUNDED = 'Đã hoàn tiền',
}

export enum PaymentMethod {
  CASH = 'Tiền mặt',
  CARD = 'Thẻ',
  QR_CODE = 'Chuyển khoản QR',
}


export type Theme = 'light' | 'dark';

export interface Address {
  id: string;
  label: string; // e.g., "Nhà riêng", "Văn phòng"
  street: string;
  isDefault: boolean;
}

export interface LoyaltyHistoryEntry {
  timestamp: Date;
  orderId?: string;
  pointsChange: number; // Positive for earning, negative for spending
  reason: string; // "Tích điểm từ đơn hàng", "Đổi điểm trừ vào đơn hàng", "Quà sinh nhật"
}

// --- New CRM Interfaces ---

export interface InteractionHistoryEntry {
  timestamp: Date;
  staffUserId: string; // ID of the User (staff) who interacted
  channel: 'phone' | 'in-person' | 'sms' | 'email' | 'other';
  summary: string; // A summary of the interaction
}

export interface CrmTask {
  id: string;
  customerId: string; // Links to User.id
  assignedToUserId: string; // Links to staff/manager User.id
  title: string;
  description: string;
  dueDate: Date;
  status: 'pending' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  ownerId: string; // To scope tasks to a store
}

// --- End of New CRM Interfaces ---

// --- New Churn Prediction Interface ---
export interface ChurnPrediction {
  probability: number; // 0 to 1
  reasons: string[];
  lastAnalyzed: Date;
}
// --- End of New Churn Prediction Interface ---


// Core User type for ALL individuals, including customers
export interface User {
  id: string; 
  name: string;
  role: UserRole; 
  phone: string; // Phone is now mandatory for all users
  username: string; // For staff/admin, this is their login. For customers, it's their phone.
  password?: string; // Hashed password
  avatarUrl?: string; // URL for user's profile picture
  
  // Staff/Admin specific
  managedBy?: string; // ID of the user who manages this user
  kpiTargets?: {
    onTimeRate?: number; // Target percentage, e.g., 98 for 98%
    avgRating?: number; // Target average rating, e.g., 4.8
    ordersProcessed?: number; // Target number of orders per period
    totalTipAmount?: number; // Target tip amount in VND per period
  };

  // Customer specific
  addresses?: Address[];
  dob?: Date; // Date of Birth
  loyaltyPoints?: number;
  loyaltyHistory?: LoyaltyHistoryEntry[];
  loyaltyTier?: string; // e.g., 'Bronze', 'Silver'
  lifetimeValue?: number; // Total amount spent by the customer
  
  // --- NEW CRM Fields for Customers ---
  interactionHistory?: InteractionHistoryEntry[];
  tags?: string[];
  notes?: string; // General, persistent notes about the customer
  customerSince?: Date;
  communicationPreferences?: ('sms' | 'phone_call' | 'email')[];
  churnPrediction?: ChurnPrediction; // New field for AI analysis

  // --- NEW Phase 7 Fields ---
  referralCode?: string; // Unique code for this user to share
  referredByCode?: string; // The code of the user who referred them
  hasReceivedReferralBonus?: boolean; // To prevent awarding bonus multiple times
  successfulReferrals?: {
      userId: string;
      name: string;
      firstOrderCompletedAt: Date;
      pointsAwarded: number;
  }[];
}


export interface ServiceItem {
  id: string;
  name: string; 
  unit: string; 
  washMethodId: string; 
  price: number;
  minPrice?: number; // Giá tối thiểu, có thể không áp dụng cho tất cả
  estimatedTimeHours: number; // Đây là "TG Xử lý (giờ)"
  customerReturnTimeHours: number; // Đây là "Dự kiến thời gian trả (giờ)"
  requiredMaterials?: {
    inventoryItemId: string;
    quantityUsedPerUnit: number; // e.g., 0.05 liters of detergent per 'Kg' of washing
  }[];
}

export interface OrderItem {
  serviceItem: ServiceItem;
  selectedWashMethodId: string; 
  quantity: number;
  notes?: string;
}

export interface ScanHistoryEntry {
  timestamp: Date;
  action: string; // e.g., "Đã nhận đồ từ khách", "Đã trả đồ cho khách"
  staffUserId?: string; // ID of the User (staff) who performed the action
  staffRoleInAction?: 'pickup' | 'return' | 'processing'; // Role of staff in this specific action
  reason?: string; 
  scannedBy?: UserRole | string; 
}

export interface Order {
  id: string;
  customer: User; // Changed from Customer to User
  items: OrderItem[];
  status: OrderStatus;
  createdAt: Date;
  receivedAt?: Date; 
  estimatedCompletionTime?: Date; // Thời gian hoàn thành xử lý dự kiến của TOÀN BỘ đơn hàng
  completedAt?: Date; 
  pickupLocation?: string; 
  totalAmount: number;
  qrCodePaymentUrl?: string; 
  scanHistory?: ScanHistoryEntry[];
  notes?: string; 
  ownerId: string; // ID of the Owner user for this store branch
  loyaltyPointsRedeemed?: number; // New field for loyalty
  loyaltyDiscountAmount?: number; // New field for loyalty
  appliedPromotionId?: string; // New field for promotions
  promotionDiscountAmount?: number; // New field for promotions
  paymentStatus: PaymentStatus; // New field for payment tracking
  paymentMethod?: PaymentMethod; // New field for payment tracking
  
  // --- NEW Phase 7 Field ---
  referralCodeUsed?: string; // The referral code applied to this order (if it's the first)
}

export interface Supplier {
  id: string;
  name: string;
  type: 'Đối tác giặt khô' | 'Nguyên vật liệu' | 'Bảo trì';
  phone: string;
  email?: string;
  address?: string;
  transactionHistory?: string[]; 
}

export interface InventoryUpdateHistoryEntry {
  timestamp?: Date; // Deprecated, use respondedAt
  requestedAt?: Date;
  respondedAt: Date;
  requestedByUserId: string;
  respondedByUserId: string;
  reason: string; // Reason for the request
  previousQuantity: number;
  newQuantity: number; // The requested quantity
  status: 'approved' | 'rejected';
  rejectionReason?: string; // Only if status is 'rejected'
}

export interface InventoryItem {
  id: string;
  name: string; 
  quantity: number;
  unit: string; 
  lowStockThreshold: number;
  ownerId: string; // ID of the Owner user for this store branch
  history?: InventoryUpdateHistoryEntry[];
}

export interface InventoryAdjustmentRequest {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string; // Snapshot for easy display
  requestedByUserId: string;
  reason: string;
  currentQuantity: number; // Quantity at the time of request
  requestedQuantity: number; // The new quantity being requested
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  respondedByUserId?: string;
  respondedAt?: Date;
  rejectionReason?: string;
  ownerId: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'rating_prompt'; // Added rating_prompt
  createdAt: Date;
  read: boolean;
  orderId?: string; // Optional: to link notification to a specific order (for rating)
  userId?: string; // ID of the user who triggered or is related to the notification
  userRole?: UserRole; // Role of the user related to the notification
  ownerId?: string; // Optional: ID of the Owner if this notification pertains to a specific store's data
}

export interface MaterialItemDefinition {
  id: string;
  name: string; 
  unit: string; 
  price: number; 
  supplierId?: string; 
  notes?: string;
}

export interface MaterialOrderItemDetail {
  id: string; 
  materialItemDefinitionId: string; 
  nameSnapshot: string; 
  unitSnapshot: string; 
  unitPriceSnapshot: number; 
  quantity: number;
  itemNotes?: string; 
}

export interface MaterialOrder {
  id: string;
  items: MaterialOrderItemDetail[];
  createdBy: UserRole; 
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Đã hủy';
  createdAt: Date;
  approvedBy?: UserRole; 
  notes?: string; 
  totalAmount: number; 
  ownerId: string; // ID of the Owner user for this store branch
}

export enum VariableCostCategory {
  RAW_MATERIAL = 'Nguyên vật liệu', 
  UTILITIES = 'Tiện ích (Điện, Nước)', 
  MAINTENANCE = 'Sửa chữa & Bảo trì',
  SUPPLIES = 'Vật tư tiêu hao', 
  MARKETING = 'Tiếp thị & Quảng cáo',
  OTHER = 'Chi phí khác',
}

export interface CostHistoryEntry {
  timestamp: Date;
  action: 'created' | 'updated' | 'deleted_log'; 
  changedBy: UserRole;
  reason?: string;
  previousValues?: Partial<Omit<VariableCost, 'history' | 'id'>>;
}

export interface VariableCost {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: VariableCostCategory;
  enteredBy: UserRole; 
  lastUpdatedBy?: UserRole; 
  notes?: string;
  history: CostHistoryEntry[];
  ownerId: string; // ID of the Owner user for this store branch
}

export type VariableCostInput = Omit<VariableCost, 'id' | 'history' | 'enteredBy' | 'lastUpdatedBy' | 'ownerId'> & {
  enteredBy: UserRole; 
};

export interface FixedCostItem {
  id: string;
  name: string;
  amount: number;
  ownerId: string; // ID of the Owner user for this store branch
}

export interface FixedCostUpdateHistoryEntry {
  timestamp: Date;
  reason: string;
  changedBy: UserRole;
  previousValues: FixedCostItem[]; 
  ownerId: string; // ID of the Owner whose fixed costs were updated
}

export type ReportPeriod = 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all_time';


// --- New Rating and Tip Interfaces ---
export interface ServiceRating {
  id: string;
  orderId: string;
  customerUserId: string; // Changed from customerId
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: Date;
  ownerId: string; // Added ownerId
}

export type StaffRoleInOrder = 'pickup' | 'return' | 'processor'; // Example roles

export interface StaffRating {
  id: string;
  orderId: string;
  customerUserId: string; // Changed from customerId
  staffUserId: string; // ID of the User (staff) being rated
  staffRoleInOrder?: StaffRoleInOrder; // Role of staff for this specific rating
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  isAnonymous: boolean;
  createdAt: Date;
  ownerId: string; // Added ownerId
}

export interface Tip {
  id: string;
  orderId: string;
  customerUserId: string; // Changed from customerId
  amount: number;
  targetStaffUserId?: string; // ID of the User (staff) receiving the tip
  targetTeam: boolean; // True if tip is for the whole team
  paymentMethodNotes?: string; // e.g., "QR Code Scan", "Cash"
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  qrCodeUrl?: string; // For QR payment of tip
  bankAccount?: string; // Bank account for tip (if applicable)
  ownerId: string; // Added ownerId
}
// --- End of New Rating and Tip Interfaces ---

// --- KPI Interface ---
export type KpiPeriodType = 'daily' | 'weekly' | 'monthly';

export interface KPI {
  id: string;
  userId: string; // staff User ID
  user?: User; // For display convenience
  periodType: KpiPeriodType;
  periodDisplay: string; // e.g., "Ngày 20/07/2024", "Tuần 29/2024", "Tháng 07/2024"
  startDate: Date;
  endDate: Date;
  ordersProcessed: number;
  onTimeRate: number; // Percentage, e.g., 95 for 95%
  avgRating: number; // Average star rating, e.g., 4.5
  totalTipAmount: number; // Added total tip amount
  createdAt: Date; // When this KPI record was generated
  ownerId: string; // ID of the Owner user for this staff's store branch
}
// --- End of KPI Interface ---

// --- Store Profile Interface ---
export interface StoreProfile {
  ownerId: string; // Links to User.id of the Owner
  storeName: string;
  storeLogoUrl?: string;
  storePhone?: string;
  storeAddress?: string;
  pickupLocations?: string[];
  defaultProcessingTimeHours?: number;
  // New: Loyalty Program Settings
  loyaltySettings?: {
    enabled: boolean;
    accrualRate: number; // How many VND to earn 1 point (e.g., 10000)
    redemptionRate: number; // How many VND 1 point is worth (e.g., 1000)
    tiers?: LoyaltyTier[];
  };
  // New: Payment Settings
  paymentSettings?: {
    policy: 'prepay' | 'postpay'; // 'Yêu cầu thanh toán trước' | 'Thanh toán khi trả đồ'
  };
}
// --- End of Store Profile Interface ---

// --- Store Update History ---
export interface StoreUpdateHistoryEntry {
  timestamp: Date;
  reason: string;
  changedBy: UserRole;
  ownerId: string;
  previousValues: Partial<Omit<StoreProfile, 'ownerId'>>;
}
// --- End of Store Update History ---

// --- Chat Message Interface ---
export interface OrderSummaryForAI {
  id: string;
  status: OrderStatus;
  createdAt: Date;
  totalAmount: number;
  items: { name: string; quantity: number }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  structuredContent?: {
    type: 'orderSummary';
    orders: OrderSummaryForAI[];
  };
}
// --- End of Chat Message Interface ---

// --- AI Order Details Structure ---
export interface AIServiceItemInput {
  serviceName: string;
  quantity: number;
  notes?: string;
}

// Replaced AICustomerInput with a partial User type for consistency
export type AICustomerInput = Partial<Pick<User, 'name' | 'phone' | 'addresses'>>;

export interface OrderDetailsFromAI {
  customer: AICustomerInput;
  items: AIServiceItemInput[];
  pickupAddress?: string;
  pickupTime?: string; 
  deliveryAddress?: string;
  deliveryTime?: string; 
  orderNotes?: string;
  targetStoreOwnerId?: string; // Added to specify target store for AI orders
  referralCodeUsed?: string; // New field for AI to pass referral codes
}
// --- End of AI Order Details Structure ---


// --- Promotion Interface ---
export interface ManagerReport {
  id: string;
  reportedBy: string; // Manager's User ID
  reason: string;
  timestamp: Date;
  status: 'pending' | 'resolved';
}

export interface Promotion {
  id: string;
  name: string;
  code: string; // Unique code for vouchers
  type: 'discount_voucher'; // Start with just this type
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  maxDiscountAmount?: number; // Maximum discount amount in VND for percentage-based promotions
  status: 'pending' | 'active' | 'inactive' | 'rejected'; // Replaces isActive
  createdBy?: string; // ID of the user who created it (especially for managers)
  approvedBy?: string; // ID of the user who approved it
  approvedAt?: Date;
  rejectionReason?: string;
  startDate?: Date;
  endDate?: Date;
  applicableDaysOfWeek?: number[]; // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  usageLimit?: number; // Total uses allowed
  timesUsed: number;
  minOrderAmount?: number; // Minimum order total to apply
  applicableServiceIds?: string[]; // Limit to specific services
  applicableWashMethodIds?: string[]; // Limit to specific wash methods
  applicableChannels?: ('online' | 'instore')[]; // Limit to online or in-store orders
  ownerId: string; // The user ID of the creator (Owner or Chairman)
  usageLimitPerCustomer?: number; // Max uses per customer
  usedByCustomerIds?: string[]; // Array of customer User IDs that have used this
  
  // --- Chairman/System-wide Promotion Fields ---
  isSystemWide?: boolean; // True if created by Chairman for all stores
  
  // For system-wide promotions: Stores can request to opt-out
  optOutRequests?: {
    storeOwnerId: string; // The Owner ID of the store requesting to opt-out
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    respondedBy?: string; // Chairman's ID
    respondedAt?: Date;
    rejectionReason?: string; // Chairman's reason for rejection
  }[];

  // For store-specific promotions: Chairman can request cancellation
  cancellationRequest?: {
    requestedBy: string; // Chairman's ID
    reason: string;
    status: 'pending' | 'approved'; // Store owner must approve
    respondedAt?: Date;
  };
  
  // For any promotion: Managers can report issues
  managerReports?: ManagerReport[];
}
// --- End of Promotion Interface ---


export interface AppData {
  users: User[]; 
  services: ServiceItem[];
  orders: Order[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  inventoryAdjustmentRequests: InventoryAdjustmentRequest[];
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
  acknowledgedRejectedRequests: string[];
  washMethods: WashMethodDefinition[];
  crmTasks: CrmTask[];
}

export interface AppContextType extends AppData {
  currentUser: User | null; 
  setCurrentUser: (user: User | null) => void; 
  login: (username: string, password?: string) => Promise<User | null>; 
  logout: () => void; 

  theme: Theme;
  setTheme: (theme: Theme) => void;
  addOrder: (order: Order) => void; // Changed: Expects full Order object (with ownerId)
  updateOrder: (order: Order) => void; 
  deleteOrder: (orderId: string, reason: string, deletedBy: UserRole) => void;
  findOrder: (idOrPhone: string) => Order | undefined;
  findUserById: (userId: string) => User | undefined; 
  findUsersByManagerId: (managerId: string | null) => User[];
  
  addService: (serviceData: Omit<ServiceItem, 'id'>) => void;
  updateService: (service: ServiceItem) => void;
  deleteService: (serviceId: string) => void;

  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'ownerId'>) => void; // ownerId will be set by context
  updateInventoryItem: (item: InventoryItem, reason: string) => void; // Will be deprecated
  requestInventoryAdjustment: (itemId: string, requestedQuantity: number, reason: string) => void;
  approveInventoryAdjustment: (requestId: string) => void;
  rejectInventoryAdjustment: (requestId: string, rejectionReason?: string) => void;
  acknowledgeRejectedRequest: (requestId: string) => void;
  acknowledgeAllRejectedRequestsForItem: (itemId: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'ownerId'> & { showToast?: boolean }) => void; // ownerId will be set by context
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void; // This might be removed if only "mark all read" is used by tray
  
  addMaterialOrder: (orderData: { 
    items: Array<{ materialItemDefinitionId: string; quantity: number; itemNotes?: string }>; 
    createdBy: UserRole; 
    notes?: string;
  }, forOwnerId?: string) => void;
  approveMaterialOrder: (orderId: string, approvedBy: UserRole, notes?: string) => void;
  rejectMaterialOrder: (orderId: string, rejectedBy: UserRole, reason: string) => void;
  
  addMaterialItemDefinition: (definition: Omit<MaterialItemDefinition, 'id'>) => void;
  updateMaterialItemDefinition: (definition: MaterialItemDefinition) => void;
  deleteMaterialItemDefinition: (definitionId: string) => void;

  addVariableCost: (costData: VariableCostInput) => void; // ownerId will be set by context
  updateVariableCost: (costId: string, updates: Partial<VariableCostInput>, reason: string, updatedBy: UserRole) => void;
  deleteVariableCost: (costId: string, reason: string, deletedBy: UserRole) => void;

  updateFixedCosts: (updatedFixedCosts: Omit<FixedCostItem, 'ownerId'>[], reason: string, changedBy: UserRole, targetOwnerIdParam?: string) => void; // ownerId set by context

  addServiceRating: (ratingData: Omit<ServiceRating, 'id' | 'createdAt' | 'ownerId'>) => void; // ownerId will be set by context
  addStaffRating: (ratingData: Omit<StaffRating, 'id' | 'createdAt' | 'ownerId'>) => void; // ownerId will be set by context
  createTip: (tipData: Omit<Tip, 'id' | 'createdAt' | 'status' | 'ownerId'>) => Tip | null; // ownerId will be set by context
  getStaffForOrderActions: (orderId: string) => { pickupStaff?: User, returnStaff?: User, processingStaff?: User[] };

  calculateAndStoreKPIsForAllStaff: (periodType: KpiPeriodType, referenceDate: Date) => Promise<void>;
  getKPIs: (filters: { userId?: string; periodType?: KpiPeriodType; startDate?: Date; endDate?: Date; ownerIdFilter?: string }) => KPI[];

  // User Management
  addUser: (userData: Omit<User, 'id'> & { managedBy?: string }, storeProfileData?: Omit<StoreProfile, 'ownerId'>) => Promise<User | null>; // Returns created User on success
  updateUser: (userData: Partial<User> & { id: string }, storeProfileData?: Partial<Omit<StoreProfile, 'ownerId'>>) => Promise<boolean>; // Updated
  deleteUser: (userId: string) => void;
  addUserInteraction: (customerId: string, interaction: Omit<InteractionHistoryEntry, 'timestamp' | 'staffUserId'> & { staffUserId?: string }) => void;
  analyzeAndSetChurnRisk: (customerId: string) => Promise<void>; // New AI function

  // Store Profile Management
  updateStoreProfile: (profileData: Partial<StoreProfile> & { ownerId: string }, reason: string) => void;
  findStoreProfileByOwnerId: (ownerId: string) => StoreProfile | undefined;
  deleteStoreAndOwner: (ownerId: string, reason: string) => void;

  // Promotion Management
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

  // Wash Method Management
  addWashMethod: (methodData: Omit<WashMethodDefinition, 'id' | 'ownerId'>) => void;
  updateWashMethod: (method: WashMethodDefinition) => void;
  deleteWashMethod: (methodId: string) => void;
  
  // CRM Task Management
  addCrmTask: (taskData: Omit<CrmTask, 'id' | 'createdAt' | 'ownerId'>) => void;
  updateCrmTask: (taskData: Partial<CrmTask> & { id: string }) => void;
  deleteCrmTask: (taskId: string) => void;

  // Helper to get ownerId for the current user's store context
  getCurrentUserOwnerId: () => string | null; 
  getOwnerIdForUser: (userId: string, allUsers: User[]) => string | null;
}


export interface ProfitChartDataPoint {
  name: string; 
  revenue: number;
  totalCosts: number;
  profit: number;
  variableCosts?: number;
  fixedCosts?: number;
}