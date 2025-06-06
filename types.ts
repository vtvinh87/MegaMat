
export enum UserRole {
  CUSTOMER = 'Khách hàng',
  STAFF = 'Nhân viên',
  MANAGER = 'Quản lý',
  OWNER = 'Chủ cửa hàng',
  CHAIRMAN = 'Chủ tịch', // Added new role
}

export enum OrderStatus {
  PENDING = 'Chưa xử lý',
  PROCESSING = 'Đang xử lý',
  COMPLETED = 'Đã xử lý',
  CANCELLED = 'Đã hủy',
  RETURNED = 'Đã trả', // Trạng thái mới
  DELETED_BY_ADMIN = 'Đã Xóa (Admin)', // New status for soft delete
}

export type Theme = 'light' | 'dark';

// Core User type for staff members
export interface User {
  id: string; 
  name: string;
  role: UserRole; 
  phone?: string; 
  username: string; // Added for login
  password?: string; // Added for login (plain text for demo)
  managedBy?: string; // ID of the user who manages this user
}


export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

export enum WashMethod {
  WET_WASH = "Giặt ướt",
  DRY_CLEAN = "Giặt khô",
  STEAM_IRON = "Là hơi",
  DRY_ONLY = "Chỉ sấy",
  IRON_ONLY = "Chỉ ủi",
}

export interface ServiceItem {
  id: string;
  name: string; 
  unit: string; 
  washMethod: WashMethod; 
  price: number;
  minPrice?: number; // Giá tối thiểu, có thể không áp dụng cho tất cả
  estimatedTimeHours: number; // Đây là "TG Xử lý (giờ)"
  customerReturnTimeHours: number; // Đây là "Dự kiến thời gian trả (giờ)"
}

export interface OrderItem {
  serviceItem: ServiceItem;
  selectedWashMethod: WashMethod; 
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
  customer: Customer;
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

export interface InventoryItem {
  id: string;
  name: string; 
  quantity: number;
  unit: string; 
  lowStockThreshold: number;
  ownerId: string; // ID of the Owner user for this store branch
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
  customerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: Date;
  ownerId: string; // Added ownerId
}

export type StaffRoleInOrder = 'pickup' | 'return' | 'processor'; // Example roles

export interface StaffRating {
  id: string;
  orderId: string;
  customerId: string;
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
  customerId: string;
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
}
// --- End of Store Profile Interface ---

// --- Chat Message Interface ---
export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}
// --- End of Chat Message Interface ---

// --- AI Order Details Structure ---
export interface AIServiceItemInput {
  serviceName: string;
  quantity: number;
  notes?: string;
}

export interface AICustomerInput {
  name?: string; 
  phone: string; 
  address?: string;
}

export interface OrderDetailsFromAI {
  customer: AICustomerInput;
  items: AIServiceItemInput[];
  pickupAddress?: string;
  pickupTime?: string; 
  deliveryAddress?: string;
  deliveryTime?: string; 
  orderNotes?: string;
  targetStoreOwnerId?: string; // Added to specify target store for AI orders
}
// --- End of AI Order Details Structure ---


export interface AppData {
  users: User[]; 
  customers: Customer[];
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
  storeProfiles: StoreProfile[]; // Added StoreProfiles
}

export interface AppContextType extends AppData {
  currentUser: User | null; 
  setCurrentUser: (user: User | null) => void; 
  login: (username: string, password?: string) => boolean; 
  logout: () => void; 

  theme: Theme;
  setTheme: (theme: Theme) => void;
  addOrder: (order: Order) => void; // Changed: Expects full Order object (with ownerId)
  updateOrder: (order: Order) => void; 
  deleteOrder: (orderId: string, reason: string, deletedBy: UserRole) => void;
  findOrder: (idOrPhone: string) => Order | undefined;
  findUserById: (userId: string) => User | undefined; 
  findUsersByManagerId: (managerId: string | null) => User[];
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  
  addService: (serviceData: Omit<ServiceItem, 'id'>) => void;
  updateService: (service: ServiceItem) => void;
  deleteService: (serviceId: string) => void;

  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'ownerId'>) => void; // ownerId will be set by context
  updateInventoryItem: (item: InventoryItem) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'ownerId'>) => void; // ownerId will be set by context if applicable
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void; // This might be removed if only "mark all read" is used by tray
  
  addMaterialOrder: (orderData: { 
    items: Array<{ materialItemDefinitionId: string; quantity: number; itemNotes?: string }>; 
    createdBy: UserRole; 
    notes?: string;
  }) => void; // ownerId will be set by context
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
  addUser: (userData: Omit<User, 'id'> & { managedBy?: string }, storeProfileData?: Omit<StoreProfile, 'ownerId'>) => boolean; // Updated to include storeProfileData
  updateUser: (userData: User, storeProfileData?: Partial<Omit<StoreProfile, 'ownerId'>>) => boolean; // Updated
  deleteUser: (userId: string) => void;

  // Store Profile Management
  updateStoreProfile: (profileData: Partial<StoreProfile> & { ownerId: string }) => void; // Added
  findStoreProfileByOwnerId: (ownerId: string) => StoreProfile | undefined; // Added


  // For public customer context in NotificationTray
  activePublicCustomerId: string | null;
  setActivePublicCustomerId: (customerId: string | null) => void;

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
