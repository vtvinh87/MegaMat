
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { 
    AppContextType, UserRole, Order, Customer, ServiceItem, Supplier, InventoryItem, Notification, AppData, 
    MaterialOrder, Theme, OrderStatus, OrderItem, ScanHistoryEntry, VariableCost, VariableCostInput, 
    CostHistoryEntry, VariableCostCategory, FixedCostItem, ProfitChartDataPoint, FixedCostUpdateHistoryEntry,
    MaterialItemDefinition, MaterialOrderItemDetail, WashMethod, User, 
    ServiceRating, StaffRating, Tip, StaffRoleInOrder, 
    KPI, KpiPeriodType, StoreProfile // Added StoreProfile
} from '../types';
import { MOCK_SERVICES, PICKUP_LOCATIONS, DEFAULT_PROCESSING_TIME_HOURS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- localStorage Keys ---
const STORAGE_PREFIX = 'laundryApp_';
const USERS_KEY = `${STORAGE_PREFIX}users`;
const CUSTOMERS_KEY = `${STORAGE_PREFIX}customers`;
const SERVICES_KEY = `${STORAGE_PREFIX}services`;
const ORDERS_KEY = `${STORAGE_PREFIX}orders`;
const SUPPLIERS_KEY = `${STORAGE_PREFIX}suppliers`;
const INVENTORY_KEY = `${STORAGE_PREFIX}inventory`;
const MATERIAL_ORDERS_KEY = `${STORAGE_PREFIX}materialOrders`;
const MATERIAL_DEFINITIONS_KEY = `${STORAGE_PREFIX}materialItemDefinitions`;
const NOTIFICATIONS_KEY = `${STORAGE_PREFIX}notifications`;
const VARIABLE_COSTS_KEY = `${STORAGE_PREFIX}variableCosts`;
const FIXED_COSTS_KEY = `${STORAGE_PREFIX}fixedCosts`;
const FIXED_COSTS_HISTORY_KEY = `${STORAGE_PREFIX}fixedCostsHistory`;
const SERVICE_RATINGS_KEY = `${STORAGE_PREFIX}serviceRatings`;
const STAFF_RATINGS_KEY = `${STORAGE_PREFIX}staffRatings`;
const TIPS_KEY = `${STORAGE_PREFIX}tips`;
const KPIS_KEY = `${STORAGE_PREFIX}kpis`;
const STORE_PROFILES_KEY = `${STORAGE_PREFIX}storeProfiles`; // Added
const CURRENT_USER_KEY = `${STORAGE_PREFIX}currentUser`;
const THEME_KEY = `${STORAGE_PREFIX}theme`;


// --- Helper for Date Revival ---
// Add all known date fields here for robust revival
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
};

function reviveDates(key: string, value: any, objectType?: string): any {
  if (objectType && DATE_FIELDS[objectType]?.includes(key) && typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  // For nested objects like scanHistory or costHistory
  if (key === 'scanHistory' && Array.isArray(value)) {
    return value.map(entry => reviveDatesInObject(entry, 'scanHistory'));
  }
  if (key === 'history' && Array.isArray(value) && objectType === 'variableCosts') { // Be specific for 'history'
    return value.map(entry => reviveDatesInObject(entry, 'costHistory'));
  }
  return value;
}

function reviveDatesInObject<T extends Record<string, any>>(obj: T, objectType: string): T {
    const newObj = { ...obj };
    for (const key in newObj) {
        if (Object.prototype.hasOwnProperty.call(newObj, key)) {
            newObj[key] = reviveDates(key, newObj[key], objectType);
        }
    }
    return newObj;
}

function loadDataFromLocalStorage<T>(key: string, defaultValue: T, objectTypeForDateRevival?: string): T {
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

function saveDataToLocalStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving data to localStorage for key "${key}":`, error);
  }
}


const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (start: Date, end: Date): Date => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// --- MOCK USERS (STAFF) ---
const MOCK_USERS: User[] = [
  { id: 'user_chairman_boss', name: 'Chủ tịch Tập đoàn', role: UserRole.CHAIRMAN, phone: '0999999999', username: 'chutich', password: '0' },
  { id: 'user_owner_dung', name: 'Chủ Tiệm Dung (Cửa hàng A)', role: UserRole.OWNER, phone: '0944444444', username: 'ct_dung', password: '0', managedBy: 'user_chairman_boss' },
  { id: 'user_manager_cuong', name: 'Quản Lý Cường (Cửa hàng A)', role: UserRole.MANAGER, phone: '0933333333', username: 'ql_cuong', password: '0', managedBy: 'user_owner_dung' },
  { id: 'user_staff_an', name: 'Nhân Viên An (Cửa hàng A)', role: UserRole.STAFF, phone: '0911111111', username: 'nv_an', password: '0', managedBy: 'user_manager_cuong' },
  { id: 'user_staff_binh', name: 'Nhân Viên Bình (Cửa hàng A)', role: UserRole.STAFF, phone: '0922222222', username: 'nv_binh', password: '0', managedBy: 'user_manager_cuong' },
  
  { id: 'owner001', name: 'Chủ Cửa Hàng B', role: UserRole.OWNER, username: 'chucuahang_b', password: '0', phone: '0987654321', managedBy: 'user_chairman_boss' },
  { id: 'manager001', name: 'Quản Lý Ca 1 (Cửa hàng B)', role: UserRole.MANAGER, username: 'quanly1_b', password: '0', phone: '0987123456', managedBy: 'owner001' },
  { id: 'staff001', name: 'Nhân Viên Ca 1 (Cửa hàng B)', role: UserRole.STAFF, username: 'nhanvien1_b', password: '0', phone: '0912345678', managedBy: 'manager001' },
];
// --- END MOCK USERS ---

const ownerIdDung = 'user_owner_dung';
const ownerIdStoreB = 'owner001';

// --- MOCK STORE PROFILES ---
const MOCK_STORE_PROFILES: StoreProfile[] = [
  { ownerId: ownerIdDung, storeName: 'Giặt Là An Nhiên (Chi nhánh Thủ Đức)', storeLogoUrl: '/logo_store_a.png', storePhone: '0944444444', storeAddress: '123 Đường Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức' },
  { ownerId: ownerIdStoreB, storeName: 'Tiệm Giặt Siêu Tốc (Chi nhánh Quận 9)', storeLogoUrl: '/logo_store_b.png', storePhone: '0987654321', storeAddress: '456 Đường Lê Văn Việt, P. Tăng Nhơn Phú A, Quận 9' },
];
// --- END MOCK STORE PROFILES ---


const createInitialFixedCosts = (ownerId: string, storeName: string): FixedCostItem[] => [
  { id: uuidv4(), name: `Tiền thuê mặt bằng (${storeName})`, amount: getRandomInt(8,15) * 1000000, ownerId },
  { id: uuidv4(), name: `Lương cơ bản QL, NV (${storeName})`, amount: getRandomInt(15,25) * 1000000, ownerId },
  { id: uuidv4(), name: `Internet & Điện thoại (${storeName})`, amount: getRandomInt(4,7) * 100000, ownerId },
];


const INITIAL_MATERIAL_ITEM_DEFINITIONS: MaterialItemDefinition[] = [
    { id: uuidv4(), name: 'Nước giặt Ariel Matic Cửa Trước 3.05kg', unit: 'Chai', price: 250000, notes: "Loại đậm đặc" },
    { id: uuidv4(), name: 'Nước xả Downy Oải Hương 1.5L', unit: 'Chai', price: 120000 },
    { id: uuidv4(), name: 'Túi nilon đựng đồ cỡ lớn (100 cái)', unit: 'Cuộn', price: 50000 },
    { id: uuidv4(), name: 'Móc treo quần áo nhựa (50 cái)', unit: 'Bó', price: 75000 },
    { id: uuidv4(), name: 'Hóa chất giặt khô Perchloroethylene', unit: 'Lít', price: 90000, supplierId: 'sup002' },
];


const createDemoVariableCosts = (ownerId: string): VariableCost[] => {
  const costs: VariableCost[] = [];
  const endDate = new Date();
  const startDate = new Date(); 
  startDate.setMonth(endDate.getMonth() - 6); 

  const categories = Object.values(VariableCostCategory);
  const staffRoles = [UserRole.STAFF, UserRole.MANAGER, UserRole.OWNER];

  for (let i = 0; i < 20; i++) { // Reduced count per owner for demo
    const date = getRandomDate(startDate, endDate);
    const enteredBy = getRandomElement(staffRoles);
    const category = getRandomElement(categories);
    let description = '';
    let amount = 0;

    switch (category) {
        case VariableCostCategory.RAW_MATERIAL: description = `Mua ${getRandomElement(['nước giặt', 'nước xả', 'hóa chất tẩy'])} lô ${i+1}`; amount = getRandomInt(200, 1000) * 1000; break;
        case VariableCostCategory.UTILITIES: description = `Thanh toán tiền ${getRandomElement(['điện', 'nước'])} tháng ${date.getMonth()+1}`; amount = getRandomInt(500, 2000) * 1000; break;
        case VariableCostCategory.MAINTENANCE: description = `Sửa ${getRandomElement(['máy giặt #1', 'máy sấy #2', 'hệ thống điện'])}`; amount = getRandomInt(100, 800) * 1000; break;
        case VariableCostCategory.SUPPLIES: description = `Mua ${getRandomElement(['túi đựng', 'móc quần áo', 'giấy in hóa đơn'])}`; amount = getRandomInt(50, 300) * 1000; break;
        default: description = `Chi phí linh tinh ${i+1}`; amount = getRandomInt(30, 200) * 1000; break;
    }

    costs.push({
        id: uuidv4(), description, amount, date, category, enteredBy, ownerId,
        history: [{ timestamp: date, action: 'created', changedBy: enteredBy }],
        notes: Math.random() > 0.7 ? `Ghi chú demo cho chi phí ${i+1}` : undefined,
    });
  }
   for (let yearOffset = 1; yearOffset <= 2; yearOffset++) { // Reduced past years
    const pastDate = new Date(endDate);
    pastDate.setFullYear(endDate.getFullYear() - yearOffset);
    pastDate.setMonth(getRandomInt(0,11));
     costs.push({
        id: uuidv4(), description: `Chi phí điện nước năm ${pastDate.getFullYear()}`, amount: getRandomInt(1000,3000) * 1000,
        date: pastDate, category: VariableCostCategory.UTILITIES, enteredBy: UserRole.MANAGER, ownerId,
        history: [{ timestamp: pastDate, action: 'created', changedBy: UserRole.MANAGER }],
    });
  }
  return costs.sort((a,b) => b.date.getTime() - a.date.getTime()); 
};


const createDemoOrders = (customers: Customer[], services: ServiceItem[], users: User[], ownerId: string): Order[] => {
  const demoOrders: Order[] = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 180); 

  const allStatuses = Object.values(OrderStatus).filter(s => s !== OrderStatus.DELETED_BY_ADMIN && s !== OrderStatus.CANCELLED);
  // Filter staff for the specific owner
  const staffForThisOwner: User[] = [];
  const ownerUser = users.find(u => u.id === ownerId);
  if (ownerUser) {
    const collectStaff = (managerId: string) => {
        users.forEach(u => {
            if (u.managedBy === managerId) {
                if (u.role === UserRole.STAFF || u.role === UserRole.MANAGER) staffForThisOwner.push(u);
                if (u.role === UserRole.MANAGER || u.role === UserRole.OWNER) collectStaff(u.id); // Recurse for managers under this owner
            }
        });
    };
    collectStaff(ownerId); // Start with staff managed by owner
    if (ownerUser.role === UserRole.STAFF || ownerUser.role === UserRole.MANAGER) staffForThisOwner.push(ownerUser); // Include owner if they are also staff/manager
  }


  for (let i = 0; i < 25; i++) { // Reduced count per owner
    const customer = getRandomElement(customers);
    const orderId = `DH-${ownerId.slice(-3).toUpperCase()}${String(i + 1).padStart(3, '0')}`;
    
    const numItems = getRandomInt(1, 3);
    const items: OrderItem[] = [];
    let maxProcessingTimeHoursForOrder = 0;
    let orderTotalAmount = 0;

    for (let j = 0; j < numItems; j++) {
      const serviceItem = getRandomElement(services);
      const quantity = getRandomInt(1, 3);
      const lineTotal = Math.max(serviceItem.price * quantity, serviceItem.minPrice || 0);
      orderTotalAmount += lineTotal;
      items.push({ serviceItem, selectedWashMethod: serviceItem.washMethod, quantity: quantity, notes: Math.random() > 0.7 ? `Ghi chú demo ${j + 1}` : undefined });
      if (serviceItem.customerReturnTimeHours > maxProcessingTimeHoursForOrder) maxProcessingTimeHoursForOrder = serviceItem.customerReturnTimeHours;
    }
    if(items.length === 0 && services.length > 0) { 
        const serviceItem = getRandomElement(services);
        const quantity = getRandomInt(1, 2);
        const lineTotal = Math.max(serviceItem.price * quantity, serviceItem.minPrice || 0);
        orderTotalAmount += lineTotal;
        items.push({ serviceItem, selectedWashMethod: serviceItem.washMethod, quantity: quantity });
        if (serviceItem.customerReturnTimeHours > maxProcessingTimeHoursForOrder) maxProcessingTimeHoursForOrder = serviceItem.customerReturnTimeHours;
    }
    
    const createdAt = getRandomDate(startDate, endDate);
    let receivedAt: Date | undefined, estimatedCompletionTime: Date | undefined, completedAt: Date | undefined;
    let currentStatus = getRandomElement(allStatuses);
    
    const randomStaffFromStore = () => staffForThisOwner.length > 0 ? getRandomElement(staffForThisOwner) : users.find(u=>u.id === ownerId); // Fallback to owner if no staff
    const creatorStaff = randomStaffFromStore();

    let scanHistory: ScanHistoryEntry[] = [{ 
        timestamp: createdAt, action: 'Đơn hàng được tạo (demo)', 
        scannedBy: creatorStaff?.role || UserRole.OWNER, staffUserId: creatorStaff?.id, staffRoleInAction: 'pickup' 
    }];
    
    if (currentStatus !== OrderStatus.PENDING) {
        receivedAt = new Date(createdAt.getTime() + getRandomInt(1,3) * 60 * 60 * 1000); // Received 1-3 hours after creation
        scanHistory.push({timestamp: receivedAt, action: 'Đã nhận đồ từ khách (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'pickup', scannedBy: randomStaffFromStore()?.role});

        estimatedCompletionTime = new Date(receivedAt.getTime() + (maxProcessingTimeHoursForOrder || DEFAULT_PROCESSING_TIME_HOURS) * 60 * 60 * 1000);
        
        if (currentStatus === OrderStatus.PROCESSING) {
            scanHistory.push({timestamp: new Date(receivedAt.getTime() + getRandomInt(1,2)*60*60*1000), action: 'Bắt đầu xử lý (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'processing', scannedBy: randomStaffFromStore()?.role});
        } else if (currentStatus === OrderStatus.COMPLETED || currentStatus === OrderStatus.RETURNED) {
            scanHistory.push({timestamp: new Date(receivedAt.getTime() + getRandomInt(1,2)*60*60*1000), action: 'Bắt đầu xử lý (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'processing', scannedBy: randomStaffFromStore()?.role});
            completedAt = estimatedCompletionTime; // Assume completed on time for demo
            scanHistory.push({timestamp: completedAt, action: `Hoàn thành xử lý (demo). Vị trí: ${PICKUP_LOCATIONS.length > 0 ? getRandomElement(PICKUP_LOCATIONS) : 'Kệ X'}`, staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'processing', scannedBy: randomStaffFromStore()?.role});
            if (currentStatus === OrderStatus.RETURNED) {
                 const returnedAt = new Date(completedAt.getTime() + getRandomInt(1, 5) * 60 * 60 * 1000); // Returned 1-5 hours after completion
                 scanHistory.push({timestamp: returnedAt, action: 'Đã trả đồ cho khách (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'return', scannedBy: randomStaffFromStore()?.role});
                 // Overwrite completedAt with returnedAt if status is RETURNED, as completedAt usually refers to final transaction time with customer
                 completedAt = returnedAt; 
            }
        }
    } else { // PENDING
        estimatedCompletionTime = new Date(createdAt.getTime() + (maxProcessingTimeHoursForOrder || DEFAULT_PROCESSING_TIME_HOURS) * 60 * 60 * 1000);
    }

    demoOrders.push({
      id: orderId, customer, items, status: currentStatus, createdAt, receivedAt, estimatedCompletionTime, completedAt, ownerId,
      pickupLocation: (currentStatus === OrderStatus.COMPLETED || currentStatus === OrderStatus.RETURNED) && PICKUP_LOCATIONS.length > 0 ? getRandomElement(PICKUP_LOCATIONS) : undefined,
      totalAmount: orderTotalAmount, 
      qrCodePaymentUrl: `https://api.vietqr.io/image/ACB-99998888-z5NqV5g.png?amount=${orderTotalAmount}&addInfo=${orderId.replace("DH-","")}&accountName=TIEM%20GIAT%20LA%20DEMO`,
      scanHistory, notes: Math.random() > 0.6 ? `Ghi chú cho đơn hàng demo ${i + 1}` : undefined,
    });
  }
  return demoOrders;
};

const createDemoInventory = (ownerId: string): InventoryItem[] => {
    const itemNames = ['Nước giặt X', 'Nước xả Y', 'Túi đựng Z', 'Móc treo A', 'Hóa chất B'];
    return itemNames.map((name, idx) => ({
        id: uuidv4(),
        name: `${name} (Cửa hàng ${ownerId.includes('dung') ? 'A' : 'B'})`,
        quantity: getRandomInt(10, 100),
        unit: getRandomElement(['Chai', 'Gói', 'Cuộn', 'Lít']),
        lowStockThreshold: getRandomInt(5,15),
        ownerId
    }));
};

const createDemoMaterialOrders = (ownerId: string, materialDefs: MaterialItemDefinition[]): MaterialOrder[] => {
    if (materialDefs.length === 0) return [];
    const orders: MaterialOrder[] = [];
    const createdByRoles = [UserRole.STAFF, UserRole.MANAGER];
    for(let i=0; i<2; i++) {
        const def = getRandomElement(materialDefs);
        orders.push({
            id: `MAT-${ownerId.slice(-3).toUpperCase()}${String(i+1).padStart(3,'0')}`,
            items: [{
                id: uuidv4(),
                materialItemDefinitionId: def.id,
                nameSnapshot: def.name,
                unitSnapshot: def.unit,
                unitPriceSnapshot: def.price,
                quantity: getRandomInt(1,5),
            }],
            createdBy: getRandomElement(createdByRoles),
            status: getRandomElement(['Chờ duyệt', 'Đã duyệt', 'Đã hủy']),
            createdAt: getRandomDate(new Date(new Date().setDate(new Date().getDate() - 30)), new Date()),
            totalAmount: def.price * getRandomInt(1,5), // Simplified
            ownerId,
            notes: Math.random() > 0.5 ? `Đơn NVL mẫu ${i+1} cho cửa hàng ${ownerId.includes('dung') ? 'A' : 'B'}` : undefined
        });
    }
    return orders;
}


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUserInternal, setCurrentUserInternal] = useState<User | null>(() => loadDataFromLocalStorage<User | null>(CURRENT_USER_KEY, null));
  const [theme, setThemeState] = useState<Theme>(() => loadDataFromLocalStorage<Theme>(THEME_KEY, 'light'));
  
  const [usersData, setUsersData] = useState<User[]>(() => loadDataFromLocalStorage<User[]>(USERS_KEY, MOCK_USERS));
  const [customersData, setCustomersData] = useState<Customer[]>(() => loadDataFromLocalStorage<Customer[]>(CUSTOMERS_KEY, []));
  const [servicesData, setServicesData] = useState<ServiceItem[]>(() => loadDataFromLocalStorage<ServiceItem[]>(SERVICES_KEY, MOCK_SERVICES));
  const [allOrdersData, setAllOrdersData] = useState<Order[]>(() => loadDataFromLocalStorage<Order[]>(ORDERS_KEY, [], 'orders'));
  const [suppliersData, setSuppliersData] = useState<Supplier[]>(() => loadDataFromLocalStorage<Supplier[]>(SUPPLIERS_KEY, []));
  const [allInventoryData, setAllInventoryData] = useState<InventoryItem[]>(() => loadDataFromLocalStorage<InventoryItem[]>(INVENTORY_KEY, []));
  const [allMaterialOrdersData, setAllMaterialOrdersData] = useState<MaterialOrder[]>(() => loadDataFromLocalStorage<MaterialOrder[]>(MATERIAL_ORDERS_KEY, [], 'materialOrders'));
  const [materialItemDefinitionsData, setMaterialItemDefinitionsData] = useState<MaterialItemDefinition[]>(() => loadDataFromLocalStorage<MaterialItemDefinition[]>(MATERIAL_DEFINITIONS_KEY, INITIAL_MATERIAL_ITEM_DEFINITIONS));
  const [allNotificationsData, setAllNotificationsData] = useState<Notification[]>(() => loadDataFromLocalStorage<Notification[]>(NOTIFICATIONS_KEY, [], 'notifications'));
  const [allVariableCostsData, setAllVariableCostsData] = useState<VariableCost[]>(() => loadDataFromLocalStorage<VariableCost[]>(VARIABLE_COSTS_KEY, [], 'variableCosts'));
  const [allFixedCostsData, setAllFixedCostsData] = useState<FixedCostItem[]>(() => loadDataFromLocalStorage<FixedCostItem[]>(FIXED_COSTS_KEY, []));
  const [fixedCostsUpdateHistoryData, setFixedCostsUpdateHistoryData] = useState<FixedCostUpdateHistoryEntry[]>(() => loadDataFromLocalStorage<FixedCostUpdateHistoryEntry[]>(FIXED_COSTS_HISTORY_KEY, [], 'fixedCostsUpdateHistory'));
  
  const [serviceRatingsData, setServiceRatingsData] = useState<ServiceRating[]>(() => loadDataFromLocalStorage<ServiceRating[]>(SERVICE_RATINGS_KEY, [], 'serviceRatings'));
  const [staffRatingsData, setStaffRatingsData] = useState<StaffRating[]>(() => loadDataFromLocalStorage<StaffRating[]>(STAFF_RATINGS_KEY, [], 'staffRatings'));
  const [tipsData, setTipsData] = useState<Tip[]>(() => loadDataFromLocalStorage<Tip[]>(TIPS_KEY, [], 'tips'));
  const [allKpisData, setAllKpisData] = useState<KPI[]>(() => loadDataFromLocalStorage<KPI[]>(KPIS_KEY, [], 'kpis'));
  const [storeProfilesData, setStoreProfilesData] = useState<StoreProfile[]>(() => loadDataFromLocalStorage<StoreProfile[]>(STORE_PROFILES_KEY, MOCK_STORE_PROFILES)); // Added
  
  const [activePublicCustomerId, setActivePublicCustomerIdState] = useState<string | null>(null);


  // Effect for seeding initial data if localStorage is empty
   useEffect(() => {
    const isUsersEmpty = localStorage.getItem(USERS_KEY) === null;
    if (isUsersEmpty) saveDataToLocalStorage(USERS_KEY, MOCK_USERS);

    const isServicesEmpty = localStorage.getItem(SERVICES_KEY) === null;
    if (isServicesEmpty) saveDataToLocalStorage(SERVICES_KEY, MOCK_SERVICES);
    
    const isMaterialDefsEmpty = localStorage.getItem(MATERIAL_DEFINITIONS_KEY) === null;
    if (isMaterialDefsEmpty) saveDataToLocalStorage(MATERIAL_DEFINITIONS_KEY, INITIAL_MATERIAL_ITEM_DEFINITIONS);

    const isStoreProfilesEmpty = localStorage.getItem(STORE_PROFILES_KEY) === null; // Added
    if (isStoreProfilesEmpty) saveDataToLocalStorage(STORE_PROFILES_KEY, MOCK_STORE_PROFILES); // Added

    const isCustomersEmpty = localStorage.getItem(CUSTOMERS_KEY) === null;
    const isOrdersEmpty = localStorage.getItem(ORDERS_KEY) === null;
    const isNotificationsEmpty = localStorage.getItem(NOTIFICATIONS_KEY) === null;
    const isVariableCostsEmpty = localStorage.getItem(VARIABLE_COSTS_KEY) === null;
    const isInventoryEmpty = localStorage.getItem(INVENTORY_KEY) === null;
    const isMaterialOrdersEmpty = localStorage.getItem(MATERIAL_ORDERS_KEY) === null;
    const isFixedCostsEmpty = localStorage.getItem(FIXED_COSTS_KEY) === null;

    const currentUsers = loadDataFromLocalStorage<User[]>(USERS_KEY, MOCK_USERS);
    const currentServices = loadDataFromLocalStorage<ServiceItem[]>(SERVICES_KEY, MOCK_SERVICES);
    let currentCustomers = loadDataFromLocalStorage<Customer[]>(CUSTOMERS_KEY, []);
    const currentMaterialDefs = loadDataFromLocalStorage<MaterialItemDefinition[]>(MATERIAL_DEFINITIONS_KEY, INITIAL_MATERIAL_ITEM_DEFINITIONS);


    if (isCustomersEmpty) {
        const demoCustomers: Customer[] = [
          { id: 'cus001', name: 'Nguyễn Văn A (Khách mặc định)', phone: '0901234567', address: '123 Đường ABC, Quận 1, TP.HCM' },
          { id: 'cus002', name: 'Trần Thị B', phone: '0908765432', address: '456 Đường XYZ, Quận 3, TP.HCM' },
        ];
        setCustomersData(demoCustomers); 
        saveDataToLocalStorage(CUSTOMERS_KEY, demoCustomers); 
        currentCustomers = demoCustomers; // Update for subsequent seeding
    }
    
    if (isFixedCostsEmpty) {
        const demoFixedCosts = [
            ...createInitialFixedCosts(ownerIdDung, "Cửa hàng A"),
            ...createInitialFixedCosts(ownerIdStoreB, "Cửa hàng B")
        ];
        setAllFixedCostsData(demoFixedCosts);
        saveDataToLocalStorage(FIXED_COSTS_KEY, demoFixedCosts);
    }

    if (isOrdersEmpty && currentCustomers.length > 0 && currentServices.length > 0) {
        const demoOrders = [
            ...createDemoOrders(currentCustomers, currentServices, currentUsers, ownerIdDung),
            ...createDemoOrders(currentCustomers, currentServices, currentUsers, ownerIdStoreB)
        ];
        setAllOrdersData(demoOrders.map(o => reviveDatesInObject(o, 'orders'))); 
        saveDataToLocalStorage(ORDERS_KEY, demoOrders); 
    }
    
    if(isVariableCostsEmpty){
        const demoVariableCosts = [
            ...createDemoVariableCosts(ownerIdDung),
            ...createDemoVariableCosts(ownerIdStoreB)
        ];
        setAllVariableCostsData(demoVariableCosts.map(vc => reviveDatesInObject(vc, 'variableCosts')));
        saveDataToLocalStorage(VARIABLE_COSTS_KEY, demoVariableCosts);
    }

    if (isInventoryEmpty) {
        const demoInventory = [
            ...createDemoInventory(ownerIdDung),
            ...createDemoInventory(ownerIdStoreB)
        ];
        setAllInventoryData(demoInventory);
        saveDataToLocalStorage(INVENTORY_KEY, demoInventory);
    }
    if (isMaterialOrdersEmpty && currentMaterialDefs.length > 0) {
        const demoMaterialOrders = [
            ...createDemoMaterialOrders(ownerIdDung, currentMaterialDefs),
            ...createDemoMaterialOrders(ownerIdStoreB, currentMaterialDefs)
        ];
        setAllMaterialOrdersData(demoMaterialOrders.map(mo => reviveDatesInObject(mo, 'materialOrders')));
        saveDataToLocalStorage(MATERIAL_ORDERS_KEY, demoMaterialOrders);
    }


    if (isNotificationsEmpty) {
        const ownerUserA = currentUsers.find(u => u.id === ownerIdDung);
        const managerUserA = currentUsers.find(u => u.managedBy === ownerIdDung && u.role === UserRole.MANAGER);
        const staffUserA = currentUsers.find(u => u.managedBy === managerUserA?.id && u.role === UserRole.STAFF);
        const currentOrdersForOwnerA = loadDataFromLocalStorage<Order[]>(ORDERS_KEY, [], 'orders').filter(o => o.ownerId === ownerIdDung);
        const currentInventoryForOwnerA = loadDataFromLocalStorage<InventoryItem[]>(INVENTORY_KEY, []).filter(i => i.ownerId === ownerIdDung);

        const initialDemoNotifications: Array<Omit<Notification, 'id' | 'createdAt' | 'read'>> = [];
         if (ownerUserA) initialDemoNotifications.push({ message: `Hệ thống CH A đã khởi động.`, type: 'info', userId: ownerUserA.id, userRole: ownerUserA.role, ownerId: ownerIdDung });
         if (managerUserA && currentOrdersForOwnerA.length > 0) {
             const orderForManagerUpdate = currentOrdersForOwnerA.find(o => o.items.length > 0);
             if (orderForManagerUpdate) initialDemoNotifications.push({ message: `${managerUserA.name} đã cập nhật đơn hàng ${orderForManagerUpdate.id}.`, type: 'info', userId: managerUserA.id, userRole: managerUserA.role, orderId: orderForManagerUpdate.id, ownerId: ownerIdDung });
         }
         if (staffUserA && currentOrdersForOwnerA.length > 1) {
            const orderForStaffUpdate = currentOrdersForOwnerA.find(o => o.id.startsWith(`DH-${ownerIdDung.slice(-3).toUpperCase()}`)); // Find an order of store A
            if (orderForStaffUpdate) initialDemoNotifications.push({ message: `Đơn hàng ${orderForStaffUpdate.id} được ${staffUserA.name} chuyển sang "Đang xử lý".`, type: 'success', orderId: orderForStaffUpdate.id, userId: staffUserA.id, userRole: staffUserA.role, ownerId: ownerIdDung });
         }
        const lowStockItemA = currentInventoryForOwnerA.find(i => i.quantity <= i.lowStockThreshold);
        if (lowStockItemA && managerUserA) initialDemoNotifications.push({ message: `Cảnh báo tồn kho thấp cho "${lowStockItemA.name}" tại CH A.`, type: 'warning', userId: managerUserA.id, userRole: managerUserA.role, ownerId: ownerIdDung });
        
        const processedNotifications = initialDemoNotifications.map(n => ({
            ...n,
            id: uuidv4(),
            createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 120),
            read: Math.random() > 0.6, 
        })).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());

        setAllNotificationsData(processedNotifications.map(n => reviveDatesInObject(n, 'notifications')));
        saveDataToLocalStorage(NOTIFICATIONS_KEY, processedNotifications);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
  // Effects for saving data to localStorage when state changes
  useEffect(() => { saveDataToLocalStorage(USERS_KEY, usersData); }, [usersData]);
  useEffect(() => { saveDataToLocalStorage(CUSTOMERS_KEY, customersData); }, [customersData]);
  useEffect(() => { saveDataToLocalStorage(SERVICES_KEY, servicesData); }, [servicesData]);
  useEffect(() => { saveDataToLocalStorage(ORDERS_KEY, allOrdersData); }, [allOrdersData]);
  useEffect(() => { saveDataToLocalStorage(SUPPLIERS_KEY, suppliersData); }, [suppliersData]);
  useEffect(() => { saveDataToLocalStorage(INVENTORY_KEY, allInventoryData); }, [allInventoryData]);
  useEffect(() => { saveDataToLocalStorage(MATERIAL_ORDERS_KEY, allMaterialOrdersData); }, [allMaterialOrdersData]);
  useEffect(() => { saveDataToLocalStorage(MATERIAL_DEFINITIONS_KEY, materialItemDefinitionsData); }, [materialItemDefinitionsData]);
  useEffect(() => { saveDataToLocalStorage(NOTIFICATIONS_KEY, allNotificationsData); }, [allNotificationsData]);
  useEffect(() => { saveDataToLocalStorage(VARIABLE_COSTS_KEY, allVariableCostsData); }, [allVariableCostsData]);
  useEffect(() => { saveDataToLocalStorage(FIXED_COSTS_KEY, allFixedCostsData); }, [allFixedCostsData]);
  useEffect(() => { saveDataToLocalStorage(FIXED_COSTS_HISTORY_KEY, fixedCostsUpdateHistoryData); }, [fixedCostsUpdateHistoryData]);
  useEffect(() => { saveDataToLocalStorage(SERVICE_RATINGS_KEY, serviceRatingsData); }, [serviceRatingsData]);
  useEffect(() => { saveDataToLocalStorage(STAFF_RATINGS_KEY, staffRatingsData); }, [staffRatingsData]);
  useEffect(() => { saveDataToLocalStorage(TIPS_KEY, tipsData); }, [tipsData]);
  useEffect(() => { saveDataToLocalStorage(KPIS_KEY, allKpisData); }, [allKpisData]);
  useEffect(() => { saveDataToLocalStorage(STORE_PROFILES_KEY, storeProfilesData); }, [storeProfilesData]); // Added


  const setCurrentUser = (user: User | null) => {
    setCurrentUserInternal(user);
    if (user) {
      saveDataToLocalStorage(CURRENT_USER_KEY, user);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveDataToLocalStorage(THEME_KEY, newTheme);
  };

  useEffect(() => { 
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) setTheme(storedTheme);
    else setTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  const getOwnerIdForUser = useCallback((userId: string, allUsers: User[]): string | null => {
    let currentUserToCheck = allUsers.find(u => u.id === userId);
    if (!currentUserToCheck) return null;

    if (currentUserToCheck.role === UserRole.CHAIRMAN) return null; // Chairman has global view / no specific ownerId context
    if (currentUserToCheck.role === UserRole.OWNER) return currentUserToCheck.id;

    while (currentUserToCheck && currentUserToCheck.managedBy) {
      const manager = allUsers.find(u => u.id === currentUserToCheck!.managedBy);
      if (!manager) return null; // Should not happen in a well-formed hierarchy
      if (manager.role === UserRole.OWNER) return manager.id;
      if (manager.role === UserRole.CHAIRMAN) return null; // Managed by Chairman means effectively global or part of Chairman's direct reports
      currentUserToCheck = manager;
    }
    return null; // Should not be reached if users are correctly structured under an Owner or Chairman
  }, []);
  
  const currentUserOwnerId = useMemo(() => {
      if (!currentUserInternal) return null;
      return getOwnerIdForUser(currentUserInternal.id, usersData);
  }, [currentUserInternal, usersData, getOwnerIdForUser]);


  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'createdAt' | 'read' | 'ownerId'>) => {
    let ownerIdForNotification: string | undefined = undefined;
    if (notificationData.orderId) {
        const order = allOrdersData.find(o => o.id === notificationData.orderId);
        if (order) ownerIdForNotification = order.ownerId;
    } else if (notificationData.userId) {
        ownerIdForNotification = getOwnerIdForUser(notificationData.userId, usersData) || undefined;
    } else if (currentUserOwnerId) { // Fallback to current user's store if directly related
        ownerIdForNotification = currentUserOwnerId;
    }

    const newNotification: Notification = {
      ...notificationData,
      id: uuidv4(),
      createdAt: new Date(),
      read: false,
      userId: notificationData.userId || currentUserInternal?.id, 
      userRole: notificationData.userRole || currentUserInternal?.role, 
      ownerId: ownerIdForNotification,
    };
    setAllNotificationsData(prev => [newNotification, ...prev.slice(0, 49)].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }, [currentUserInternal, allOrdersData, getOwnerIdForUser, usersData, currentUserOwnerId]);

  const login = useCallback((username: string, password?: string): boolean => {
    const user = usersData.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      addNotification({ message: `Chào mừng ${user.name} (${user.role}) đã đăng nhập.`, type: 'success', userId: user.id, userRole: user.role });
      return true;
    }
    // Generic login fail, no ownerId needed.
    setAllNotificationsData(prev => [{ id: uuidv4(), createdAt: new Date(), read: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.', type: 'error' }, ...prev.slice(0,49)]);
    return false;
  }, [usersData, addNotification]); 

  const logout = useCallback(() => {
    const loggingOutUser = currentUserInternal;
    setCurrentUser(null);
    setActivePublicCustomerIdState(null); 
    if (loggingOutUser) {
        addNotification({ message: `${loggingOutUser.name || 'Bạn'} đã đăng xuất.`, type: 'info', userId: loggingOutUser.id, userRole: loggingOutUser.role });
    }
  }, [currentUserInternal, addNotification]);

  const markNotificationAsRead = useCallback((id: string) => {
    setAllNotificationsData(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearNotifications = useCallback(() => { 
    setAllNotificationsData(prev => prev.map(n => ({ ...n, read: true })));
  }, []);
  
  const findUserById = useCallback((userId: string): User | undefined => {
    return usersData.find(u => u.id === userId);
  }, [usersData]);

  const findUsersByManagerId = useCallback((managerId: string | null): User[] => {
    if (managerId === null) { 
      if (currentUserInternal?.role === UserRole.CHAIRMAN) {
        return usersData.filter(u => u.role === UserRole.OWNER && u.managedBy === currentUserInternal.id);
      } else if (currentUserInternal && (currentUserInternal.role === UserRole.OWNER || currentUserInternal.role === UserRole.MANAGER)) {
        const self = usersData.find(u => u.id === currentUserInternal!.id);
        return self ? [self] : [];
      }
      return usersData.filter(u => !u.managedBy && u.role !== UserRole.CUSTOMER && u.role !== UserRole.CHAIRMAN);
    }
    return usersData.filter(u => u.managedBy === managerId && u.role !== UserRole.CUSTOMER);
  }, [usersData, currentUserInternal]);


  const addOrder = useCallback((orderData: Order) => {
    let finalOwnerId = orderData.ownerId; 

    if (!finalOwnerId) { // Fallback if ownerId is not explicitly provided in orderData
        if (!currentUserOwnerId && currentUserInternal?.role !== UserRole.CHAIRMAN) {
            addNotification({message: "Không thể xác định cửa hàng cho đơn hàng này (lỗi hệ thống).", type: 'error'});
            return;
        }
        finalOwnerId = currentUserOwnerId || ''; // Assign if current user has an owner context
    }
    
    if (!finalOwnerId && !orderData.id.startsWith("CUS-REQ-")) { // Stricter check: only allow empty ownerId if it's a customer request
        addNotification({ message: `Lỗi: Không thể xác định cửa hàng chủ quản cho đơn hàng ${orderData.id}.`, type: "error"});
        return;
    }
     if (!finalOwnerId && orderData.id.startsWith("CUS-REQ-")) { // AI/Customer direct order without store selected by AI
        addNotification({ message: `Lỗi: AI chưa chọn cửa hàng cho đơn ${orderData.id}. Vui lòng yêu cầu AI chọn cửa hàng.`, type: "error"});
        return;
    }


    const newOrderWithOwner: Order = { ...orderData, ownerId: finalOwnerId };
    setAllOrdersData(prev => [newOrderWithOwner, ...prev]);
    if (currentUserInternal) { 
        addNotification({ message: `Đơn hàng mới ${orderData.id} đã được tạo.`, type: 'success', orderId: orderData.id, userId: currentUserInternal.id, userRole: currentUserInternal.role });
    } else if (orderData.id.startsWith("CUS-REQ-") || orderData.id.startsWith("AI-")) {
         addNotification({ message: `Yêu cầu đặt lịch ${orderData.id} đã được nhận.`, type: 'success', orderId: orderData.id, userId: orderData.customer.id });
    }
  }, [addNotification, currentUserInternal, currentUserOwnerId, setAllOrdersData]);

  const updateOrder = useCallback((updatedOrder: Order) => {
    setAllOrdersData(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    if (currentUserInternal) {
        addNotification({ message: `Đơn hàng ${updatedOrder.id} đã được cập nhật.`, type: 'info', orderId: updatedOrder.id, userId: currentUserInternal.id, userRole: currentUserInternal.role});
    }
  }, [addNotification, currentUserInternal]);

  const deleteOrder = useCallback((orderId: string, reason: string, deletedBy: UserRole) => {
    const orderBeingDeleted = allOrdersData.find(o => o.id === orderId);
    setAllOrdersData(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId
          ? { 
              ...order, status: OrderStatus.DELETED_BY_ADMIN,
              scanHistory: [ ...(order.scanHistory || []), { timestamp: new Date(), action: 'Đơn hàng đã bị xóa', reason, scannedBy: deletedBy, staffUserId: currentUserInternal?.id } ]
            }
          : order
      )
    );
    if (currentUserInternal && orderBeingDeleted) {
        addNotification({ message: `Đơn hàng ${orderId} (${orderBeingDeleted.customer.name}) đã được xóa. Lý do: ${reason}`, type: 'warning', orderId, userId: currentUserInternal.id, userRole: currentUserInternal.role });
    }
  }, [addNotification, currentUserInternal, allOrdersData]);

  const findOrder = useCallback((idOrPhone: string): Order | undefined => {
    const foundById = allOrdersData.find(o => o.id.toUpperCase() === idOrPhone.toUpperCase());
    if (foundById) return foundById;
    return allOrdersData.find(o => o.customer.phone === idOrPhone);
  }, [allOrdersData]);
  
  const addCustomer = useCallback((customer: Customer) => {
    setCustomersData(prev => {
      if (prev.some(c => c.phone === customer.phone)) {
        addNotification({message: `Khách hàng với SĐT ${customer.phone} đã tồn tại.`, type: 'warning'}); 
        return prev;
      }
      addNotification({message: `Đã thêm khách hàng mới: ${customer.name}.`, type: 'success'}); 
      return [customer, ...prev];
    });
  }, [addNotification]);

  const updateCustomer = useCallback((customerToUpdate: Customer) => {
    setCustomersData(prev => prev.map(c => c.id === customerToUpdate.id ? customerToUpdate : c));
    addNotification({message: `Thông tin khách hàng ${customerToUpdate.name} đã được cập nhật.`, type: 'info'}); 
  }, [addNotification]);

  const addService = useCallback((serviceData: Omit<ServiceItem, 'id'>) => {
    const newService = { ...serviceData, id: uuidv4() };
    setServicesData(prev => [newService, ...prev]);
    addNotification({ message: `Đã thêm dịch vụ mới: ${newService.name}`, type: 'success' }); 
  }, [addNotification]);

  const updateService = useCallback((serviceToUpdate: ServiceItem) => {
    setServicesData(prev => prev.map(s => s.id === serviceToUpdate.id ? serviceToUpdate : s));
    addNotification({ message: `Dịch vụ ${serviceToUpdate.name} đã được cập nhật.`, type: 'info' }); 
  }, [addNotification]);

  const deleteService = useCallback((serviceId: string) => {
    setServicesData(prev => prev.filter(s => s.id !== serviceId));
    addNotification({ message: `Dịch vụ đã được xóa.`, type: 'warning' }); 
  }, [addNotification]);

  const addSupplier = useCallback((supplier: Supplier) => {
    setSuppliersData(prev => [supplier, ...prev]);
    addNotification({ message: `Nhà cung cấp ${supplier.name} đã được thêm.`, type: 'success' }); 
  }, [addNotification]);

  const updateSupplier = useCallback((supplierToUpdate: Supplier) => {
    setSuppliersData(prev => prev.map(s => s.id === supplierToUpdate.id ? supplierToUpdate : s));
    addNotification({ message: `Thông tin NCC ${supplierToUpdate.name} đã được cập nhật.`, type: 'info' }); 
  }, [addNotification]);
  
  const addInventoryItem = useCallback((itemData: Omit<InventoryItem, 'id' | 'ownerId'>) => {
    if (!currentUserOwnerId) {
         addNotification({message: "Không thể xác định cửa hàng cho vật tư này.", type: 'error'});
         return;
    }
    const newItemWithOwner: InventoryItem = { ...itemData, id: uuidv4(), ownerId: currentUserOwnerId };
    setAllInventoryData(prev => [newItemWithOwner, ...prev]);
    addNotification({ message: `Vật tư "${itemData.name}" đã được thêm vào kho.`, type: 'success' });
  }, [addNotification, currentUserOwnerId]);

  const updateInventoryItem = useCallback((itemToUpdate: InventoryItem) => {
    const oldItem = allInventoryData.find(i => i.id === itemToUpdate.id && i.ownerId === itemToUpdate.ownerId); 
    setAllInventoryData(prev => prev.map(i => i.id === itemToUpdate.id ? itemToUpdate : i));
    addNotification({ message: `Thông tin vật tư "${itemToUpdate.name}" đã cập nhật.`, type: 'info' });
    if (oldItem && oldItem.quantity > oldItem.lowStockThreshold && itemToUpdate.quantity <= itemToUpdate.lowStockThreshold) {
        addNotification({message: `Cảnh báo tồn kho thấp cho "${itemToUpdate.name}". Hiện còn ${itemToUpdate.quantity} ${itemToUpdate.unit}.`, type: 'warning' });
    }
  }, [addNotification, allInventoryData]);

  const addMaterialOrder = useCallback((orderData: { items: Array<{ materialItemDefinitionId: string; quantity: number; itemNotes?: string }>; createdBy: UserRole; notes?: string; }) => {
    if (!currentUserOwnerId) {
         addNotification({message: "Không thể xác định cửa hàng cho đơn đặt NVL.", type: 'error'});
         return;
    }
    const resolvedItems: (MaterialOrderItemDetail | null)[] = orderData.items.map((itemInput): MaterialOrderItemDetail | null => { 
      const definition = materialItemDefinitionsData.find(d => d.id === itemInput.materialItemDefinitionId);
      if (!definition) {
        addNotification({ message: `Lỗi: Không tìm thấy định nghĩa NVL cho ID ${itemInput.materialItemDefinitionId}. Bỏ qua mục này.`, type: 'error' });
        return null; 
      }
      return {
        id: uuidv4(), 
        materialItemDefinitionId: definition.id,
        nameSnapshot: definition.name,
        unitSnapshot: definition.unit,
        unitPriceSnapshot: definition.price,
        quantity: itemInput.quantity,
        itemNotes: itemInput.itemNotes,
      };
    });
    const validResolvedItems = resolvedItems.filter((item): item is MaterialOrderItemDetail => item !== null);


    if (validResolvedItems.length === 0 && orderData.items.length > 0) {
        addNotification({message: "Không thể tạo đơn đặt NVL do không tìm thấy định nghĩa cho các mục đã chọn.", type: 'error'});
        return;
    }
    if (validResolvedItems.length === 0) {
        addNotification({message: "Vui lòng thêm ít nhất một mục vào đơn đặt NVL.", type: 'warning'});
        return;
    }

    const newMaterialOrder: MaterialOrder = {
      id: `MAT-ORD-${uuidv4().slice(0,6).toUpperCase()}`, items: validResolvedItems, createdBy: orderData.createdBy,
      status: 'Chờ duyệt', createdAt: new Date(), notes: orderData.notes, ownerId: currentUserOwnerId,
      totalAmount: validResolvedItems.reduce((sum, item) => sum + (item.unitPriceSnapshot * item.quantity), 0),
    };
    setAllMaterialOrdersData(prev => [newMaterialOrder, ...prev]);
    addNotification({ message: `Đơn đặt NVL ${newMaterialOrder.id} đã được tạo, chờ duyệt.`, type: 'success', userId: currentUserInternal?.id, userRole: currentUserInternal?.role });
  }, [materialItemDefinitionsData, addNotification, currentUserInternal, currentUserOwnerId]);

  const approveMaterialOrder = useCallback((orderId: string, approvedBy: UserRole, notes?: string) => { 
    setAllMaterialOrdersData(prev => prev.map(o => {
        if (o.id === orderId && o.status === 'Chờ duyệt') {
            const updatedOrder = { ...o, status: 'Đã duyệt' as const, approvedBy, notes: notes || o.notes };
            addNotification({ message: `Đơn đặt NVL ${orderId} đã được duyệt.`, type: 'success', userId: currentUserInternal?.id, userRole: currentUserInternal?.role });
            return updatedOrder;
        }
        return o;
    }));
   }, [addNotification, currentUserInternal]);

  const rejectMaterialOrder = useCallback((orderId: string, rejectedBy: UserRole, reason: string) => { 
     setAllMaterialOrdersData(prev => prev.map(o => {
        if (o.id === orderId && o.status === 'Chờ duyệt') {
            const updatedOrder = { ...o, status: 'Đã hủy' as const, approvedBy: rejectedBy, notes: `Lý do hủy: ${reason}. ${o.notes ? `(Ghi chú gốc: ${o.notes})` : ''}` };
            addNotification({ message: `Đơn đặt NVL ${orderId} đã bị từ chối/hủy. Lý do: ${reason}`, type: 'warning', userId: currentUserInternal?.id, userRole: currentUserInternal?.role });
            return updatedOrder;
        }
        return o;
    }));
  }, [addNotification, currentUserInternal]);

  const addMaterialItemDefinition = useCallback((definition: Omit<MaterialItemDefinition, 'id'>) => { 
    const newDef = { ...definition, id: uuidv4() };
    setMaterialItemDefinitionsData(prev => [newDef, ...prev]);
    addNotification({ message: `Đã thêm định nghĩa NVL mới: ${newDef.name}`, type: 'success' });
  }, [addNotification]);

  const updateMaterialItemDefinition = useCallback((definitionToUpdate: MaterialItemDefinition) => { 
    setMaterialItemDefinitionsData(prev => prev.map(d => d.id === definitionToUpdate.id ? definitionToUpdate : d));
    addNotification({ message: `Định nghĩa NVL "${definitionToUpdate.name}" đã được cập nhật.`, type: 'info' });
   }, [addNotification]);

  const deleteMaterialItemDefinition = useCallback((definitionId: string) => { 
    const defToDelete = materialItemDefinitionsData.find(d => d.id === definitionId);
    setMaterialItemDefinitionsData(prev => prev.filter(d => d.id !== definitionId));
    if (defToDelete) {
      addNotification({ message: `Định nghĩa NVL "${defToDelete.name}" đã được xóa.`, type: 'warning' });
    }
  }, [addNotification, materialItemDefinitionsData]);

  const addVariableCost = useCallback((costData: VariableCostInput) => {
    if (!currentUserInternal?.role) { addNotification({message: "Không thể xác định người dùng.", type: 'error'}); return; }
    if (!currentUserOwnerId) {
        addNotification({message: "Không thể xác định cửa hàng cho chi phí này.", type: 'error'});
        return;
    }
    const newCost: VariableCost = {
      ...costData, id: uuidv4(), enteredBy: currentUserInternal.role, ownerId: currentUserOwnerId,
      history: [{ timestamp: new Date(), action: 'created', changedBy: currentUserInternal.role }],
    };
    setAllVariableCostsData(prev => [newCost, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    addNotification({ message: `Chi phí "${newCost.description}" đã được thêm.`, type: 'success', userId: currentUserInternal.id, userRole: currentUserInternal.role });
  }, [currentUserInternal, addNotification, currentUserOwnerId]);

  const updateVariableCost = useCallback((costId: string, updates: Partial<VariableCostInput>, reason: string, updatedBy: UserRole) => {
    setAllVariableCostsData(prev => prev.map(cost => {
      if (cost.id === costId) { 
        const previousValues: Partial<Omit<VariableCost, 'history' | 'id'>> = {
            description: cost.description, amount: cost.amount, date: cost.date, category: cost.category, notes: cost.notes
        };
        const newHistoryEntry: CostHistoryEntry = { timestamp: new Date(), action: 'updated', changedBy: updatedBy, reason, previousValues };
        return { ...cost, ...updates, lastUpdatedBy: updatedBy, history: [...cost.history, newHistoryEntry]};
      }
      return cost;
    }));
    addNotification({ message: `Chi phí đã được cập nhật. Lý do: ${reason}`, type: 'info', userId: currentUserInternal?.id, userRole: currentUserInternal?.role });
  }, [addNotification, currentUserInternal]);

  const deleteVariableCost = useCallback((costId: string, reason: string, deletedBy: UserRole) => {
    const costToDelete = allVariableCostsData.find(c => c.id === costId);
    if (!costToDelete) return;
    setAllVariableCostsData(prev => prev.filter(cost => cost.id !== costId));
    addNotification({ message: `Chi phí "${costToDelete.description}" đã được xóa. Lý do: ${reason}`, type: 'warning', userId: currentUserInternal?.id, userRole: currentUserInternal?.role });
  }, [allVariableCostsData, addNotification, currentUserInternal]);

  const updateFixedCosts = useCallback((updatedFixedCostItems: Omit<FixedCostItem, 'ownerId'>[], reason: string, changedBy: UserRole, targetOwnerIdParam?: string) => {
    const effectiveTargetOwnerId = (currentUserInternal?.role === UserRole.CHAIRMAN && targetOwnerIdParam) 
        ? targetOwnerIdParam 
        : currentUserOwnerId;

    if (!effectiveTargetOwnerId) { 
        addNotification({message: "Không thể xác định cửa hàng để cập nhật chi phí cố định.", type: "error"});
        return;
    }

    const newFixedCostsForOwner = updatedFixedCostItems.map(fc => ({...fc, id: fc.id || uuidv4(), ownerId: effectiveTargetOwnerId })); 
    
    setAllFixedCostsData(prevAllFixedCosts => {
        const otherOwnersCosts = prevAllFixedCosts.filter(fc => fc.ownerId !== effectiveTargetOwnerId);
        return [...otherOwnersCosts, ...newFixedCostsForOwner];
    });

    const historyEntry: FixedCostUpdateHistoryEntry = {
      timestamp: new Date(), reason, changedBy, ownerId: effectiveTargetOwnerId, 
      previousValues: allFixedCostsData.filter(fc => fc.ownerId === effectiveTargetOwnerId) 
    };
    setFixedCostsUpdateHistoryData(prev => [historyEntry, ...prev.slice(0,19)]);
    addNotification({ message: `Chi phí cố định cho cửa hàng đã được cập nhật. Lý do: ${reason}`, type: 'success', userId: currentUserInternal?.id, userRole: currentUserInternal?.role });
  }, [currentUserOwnerId, currentUserInternal, addNotification, allFixedCostsData]);

  const addServiceRating = useCallback((ratingData: Omit<ServiceRating, 'id' | 'createdAt' | 'ownerId'>) => { 
    const order = allOrdersData.find(o => o.id === ratingData.orderId);
    if (!order || !order.ownerId) {
        addNotification({message: `Lỗi: Không tìm thấy đơn hàng hoặc ownerId cho đánh giá dịch vụ. Order ID: ${ratingData.orderId}`, type: "error"});
        return;
    }
    const newRating: ServiceRating = {...ratingData, id: uuidv4(), createdAt: new Date(), ownerId: order.ownerId };
    setServiceRatingsData(prev => [newRating, ...prev]);
   }, [allOrdersData, addNotification]);

  const addStaffRating = useCallback((ratingData: Omit<StaffRating, 'id' | 'createdAt' | 'ownerId'>) => { 
    const order = allOrdersData.find(o => o.id === ratingData.orderId);
    if (!order || !order.ownerId) {
        addNotification({message: `Lỗi: Không tìm thấy đơn hàng hoặc ownerId cho đánh giá nhân viên. Order ID: ${ratingData.orderId}`, type: "error"});
        return;
    }
    const newRating: StaffRating = {...ratingData, id: uuidv4(), createdAt: new Date(), ownerId: order.ownerId };
    setStaffRatingsData(prev => [newRating, ...prev]);
   }, [allOrdersData, addNotification]);

  const createTip = useCallback((tipData: Omit<Tip, 'id' | 'createdAt' | 'status' | 'ownerId'>): Tip | null => { 
    const order = allOrdersData.find(o => o.id === tipData.orderId);
    if (!order || !order.ownerId) {
        addNotification({message: `Lỗi: Không tìm thấy đơn hàng hoặc ownerId cho tiền tip. Order ID: ${tipData.orderId}`, type: "error"});
        return null;
    }

    const newTip: Tip = { ...tipData, id: uuidv4(), createdAt: new Date(), status: 'pending', ownerId: order.ownerId };
    if (Math.random() > 0.1) { 
        newTip.status = 'completed';
        newTip.qrCodeUrl = `https://api.vietqr.io/image/ACB-000111222-qr_template.png?amount=${newTip.amount}&addInfo=TIP_${newTip.id.slice(0,8)}&accountName=TEAM_GIAT_LA`;
    } else {
        newTip.status = 'failed';
    }
    setTipsData(prev => [newTip, ...prev]);
    return newTip;
   }, [allOrdersData, addNotification]);
  
  const getStaffForOrderActions = useCallback((orderIdToFind: string): { pickupStaff?: User, returnStaff?: User, processingStaff?: User[] } => { 
    const order = allOrdersData.find(o => o.id === orderIdToFind);
    if (!order || !order.scanHistory) return {};

    let pickupStaff: User | undefined;
    let returnStaff: User | undefined;
    const processingStaffIds = new Set<string>();

    order.scanHistory.forEach(entry => {
        if (entry.staffUserId) {
            if (entry.staffRoleInAction === 'pickup' && !pickupStaff) {
                pickupStaff = findUserById(entry.staffUserId);
            } else if (entry.staffRoleInAction === 'return' && !returnStaff) {
                returnStaff = findUserById(entry.staffUserId);
            } else if (entry.staffRoleInAction === 'processing') {
                processingStaffIds.add(entry.staffUserId);
            }
        }
    });
    
    const processingStaffList = Array.from(processingStaffIds).map(id => findUserById(id)).filter(Boolean) as User[];
    return { pickupStaff, returnStaff, processingStaff: processingStaffList };
  }, [allOrdersData, findUserById]);

  const calculateAndStoreKPIsForAllStaff = useCallback(async (periodType: KpiPeriodType, referenceDate: Date) => {
    const staffToProcess = usersData.filter(u => u.role === UserRole.STAFF || u.role === UserRole.MANAGER);
    const newKpiRecords: KPI[] = [];

    for (const staff of staffToProcess) {
        const staffOwnerId = getOwnerIdForUser(staff.id, usersData);
        if (!staffOwnerId) continue; 
        
        let startDate: Date, endDate: Date, periodDisplay: string;
        const ref = new Date(referenceDate); 
        switch (periodType) {
            case 'daily':
                startDate = new Date(ref.setHours(0,0,0,0));
                endDate = new Date(ref.setHours(23,59,59,999));
                periodDisplay = `Ngày ${startDate.toLocaleDateString('vi-VN')}`;
                break;
            case 'weekly':
                const firstDayOfWeek = new Date(ref);
                firstDayOfWeek.setDate(ref.getDate() - ref.getDay() + (ref.getDay() === 0 ? -6 : 1)); 
                startDate = new Date(firstDayOfWeek.setHours(0,0,0,0));
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23,59,59,999);
                const weekNumber = Math.ceil(( ( (startDate.getTime() - new Date(startDate.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(startDate.getFullYear(), 0, 1).getDay() + 1) / 7);
                periodDisplay = `Tuần ${weekNumber}/${startDate.getFullYear()}`;
                break;
            case 'monthly':
                startDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
                endDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23,59,59,999);
                periodDisplay = `Tháng ${startDate.getMonth()+1}/${startDate.getFullYear()}`;
                break;
        }
        
        const relevantOrders = allOrdersData.filter(o => {
            if (o.ownerId !== staffOwnerId) return false;
            const orderCompletedOrReturnedTime = o.completedAt || o.createdAt; 
            if (!(new Date(orderCompletedOrReturnedTime) >= startDate && new Date(orderCompletedOrReturnedTime) <= endDate)) return false;

            const staffInvolvement = getStaffForOrderActions(o.id);
            return staffInvolvement.processingStaff?.some(s => s.id === staff.id) || staffInvolvement.returnStaff?.id === staff.id;
        });

        const ordersProcessed = relevantOrders.length;
        const onTimeOrders = relevantOrders.filter(o => {
            if (!o.estimatedCompletionTime || !o.completedAt) return false; 
            return new Date(o.completedAt) <= new Date(o.estimatedCompletionTime);
        }).length;
        const onTimeRate = ordersProcessed > 0 ? (onTimeOrders / ordersProcessed) * 100 : 0;

        const relevantStaffRatings = staffRatingsData.filter(r => 
            r.staffUserId === staff.id && 
            r.ownerId === staffOwnerId && // Filter by ownerId
            new Date(r.createdAt) >= startDate && new Date(r.createdAt) <= endDate &&
            relevantOrders.some(ro => ro.id === r.orderId) 
        );
        const avgRating = relevantStaffRatings.length > 0 
            ? relevantStaffRatings.reduce((sum, r) => sum + r.rating, 0) / relevantStaffRatings.length 
            : 0;

        const relevantTips = tipsData.filter(t => 
            new Date(t.createdAt) >= startDate && new Date(t.createdAt) <= endDate &&
            t.status === 'completed' &&
            t.ownerId === staffOwnerId && // Filter by ownerId
            relevantOrders.some(ro => ro.id === t.orderId) && 
            ( (t.targetStaffUserId === staff.id) || (t.targetTeam && t.ownerId === staffOwnerId ) ) 
        );
        const totalTipAmount = relevantTips.reduce((sum, t) => sum + t.amount, 0);


        newKpiRecords.push({
            id: uuidv4(), userId: staff.id, user: staff, periodType, periodDisplay, startDate, endDate, ownerId: staffOwnerId,
            ordersProcessed, onTimeRate, avgRating, totalTipAmount,
            createdAt: new Date(),
        });
        
        if (avgRating > 0 && avgRating < 3.5 && ordersProcessed > 2) {
             addNotification({
                message: `${staff.name} có đánh giá trung bình thấp (${avgRating.toFixed(1)} sao) trong ${periodDisplay}.`,
                type: 'warning', userId: staff.managedBy || staffOwnerId, 
            });
        }
    }

    setAllKpisData(prevKpis => {
        const updatedKpis = [...prevKpis];
        newKpiRecords.forEach(newKpi => {
            const index = updatedKpis.findIndex(k => k.userId === newKpi.userId && k.periodDisplay === newKpi.periodDisplay && k.periodType === newKpi.periodType);
            if (index !== -1) updatedKpis[index] = newKpi; 
            else updatedKpis.push(newKpi); 
        });
        return updatedKpis.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    });
  }, [usersData, allOrdersData, staffRatingsData, tipsData, getStaffForOrderActions, addNotification, getOwnerIdForUser]);

 const getKPIs = useCallback((filters: { userId?: string; periodType?: KpiPeriodType; startDate?: Date; endDate?: Date; ownerIdFilter?: string }): KPI[] => {
    let filteredKpis = allKpisData;

    if (currentUserInternal?.role === UserRole.CHAIRMAN) {
        if (filters.ownerIdFilter && filters.ownerIdFilter !== 'all') {
            filteredKpis = filteredKpis.filter(kpi => kpi.ownerId === filters.ownerIdFilter);
        }
    } else if (currentUserOwnerId) { 
        filteredKpis = filteredKpis.filter(kpi => kpi.ownerId === currentUserOwnerId);
    } else { 
        return [];
    }
    
    return filteredKpis.filter(kpi => 
        (!filters.userId || kpi.userId === filters.userId) &&
        (!filters.periodType || kpi.periodType === filters.periodType) &&
        (!filters.startDate || new Date(kpi.startDate) >= filters.startDate) &&
        (!filters.endDate || new Date(kpi.endDate) <= filters.endDate)
    );
  }, [allKpisData, currentUserInternal, currentUserOwnerId]);

  const addUser = useCallback((userData: Omit<User, 'id'> & { managedBy?: string }, storeProfileData?: Omit<StoreProfile, 'ownerId'> ): boolean => { 
    if (usersData.some(u => u.username === userData.username)) {
        addNotification({ message: `Tên đăng nhập "${userData.username}" đã tồn tại.`, type: 'error', userId: currentUserInternal?.id });
        return false;
    }
    const manager = userData.managedBy ? usersData.find(u => u.id === userData.managedBy) : null;
    if (manager && manager.role === UserRole.STAFF && (userData.role === UserRole.MANAGER || userData.role === UserRole.OWNER)) {
         addNotification({ message: `Nhân viên không thể quản lý ${userData.role}.`, type: 'error', userId: currentUserInternal?.id });
         return false;
    }
    if (manager && manager.role === UserRole.MANAGER && userData.role === UserRole.OWNER) {
         addNotification({ message: `Quản lý không thể quản lý Chủ cửa hàng.`, type: 'error', userId: currentUserInternal?.id });
         return false;
    }
     if (userData.role === UserRole.CHAIRMAN && userData.managedBy) {
        addNotification({ message: `Chủ tịch không thể bị quản lý bởi người khác.`, type: 'error', userId: currentUserInternal?.id });
        return false;
    }

    const newUser: User = { ...userData, id: uuidv4() };
    setUsersData(prev => [newUser, ...prev]);
    addNotification({ message: `Người dùng ${newUser.name} (${newUser.role}) đã được thêm.`, type: 'success', userId: currentUserInternal?.id });
    
    // If adding an Owner, create their store profile
    if (newUser.role === UserRole.OWNER && storeProfileData) {
        const newStoreProfile: StoreProfile = {
            ownerId: newUser.id,
            storeName: storeProfileData.storeName || `${newUser.name}'s Store`,
            storeLogoUrl: storeProfileData.storeLogoUrl || '/default_logo.png', // Provide a default
            storePhone: storeProfileData.storePhone || newUser.phone || '',
            storeAddress: storeProfileData.storeAddress || '',
        };
        setStoreProfilesData(prev => [newStoreProfile, ...prev]);
        addNotification({message: `Hồ sơ cho cửa hàng "${newStoreProfile.storeName}" đã được tạo.`, type: 'info'});
    } else if (newUser.role === UserRole.OWNER && !storeProfileData) {
        // Create a very basic default profile if none provided
        const defaultStoreProfile: StoreProfile = {
            ownerId: newUser.id,
            storeName: `${newUser.name}'s Store (Mặc định)`,
            storeLogoUrl: '/default_logo.png',
            storePhone: newUser.phone || 'Chưa có',
            storeAddress: 'Chưa có',
        };
        setStoreProfilesData(prev => [defaultStoreProfile, ...prev]);
        addNotification({message: `Hồ sơ cửa hàng mặc định đã được tạo cho ${newUser.name}.`, type: 'info'});
    }

    return true;
   }, [usersData, addNotification, currentUserInternal, setStoreProfilesData]);

  const updateUser = useCallback((updatedUser: User, storeProfileData?: Partial<Omit<StoreProfile, 'ownerId'>>): boolean => { 
    const existingUserIndex = usersData.findIndex(u => u.id === updatedUser.id);
    if (existingUserIndex === -1) {
        addNotification({ message: `Không tìm thấy người dùng để cập nhật.`, type: 'error', userId: currentUserInternal?.id });
        return false;
    }
    if (usersData.some(u => u.username === updatedUser.username && u.id !== updatedUser.id)) {
      addNotification({ message: `Tên đăng nhập "${updatedUser.username}" đã được sử dụng bởi người dùng khác.`, type: 'error', userId: currentUserInternal?.id });
      return false;
    }
    
    const manager = updatedUser.managedBy ? usersData.find(u => u.id === updatedUser.managedBy) : null;
    if (manager && manager.role === UserRole.STAFF && (updatedUser.role === UserRole.MANAGER || updatedUser.role === UserRole.OWNER)) {
         addNotification({ message: `Nhân viên không thể quản lý ${updatedUser.role}.`, type: 'error', userId: currentUserInternal?.id });
         return false;
    }
    if (manager && manager.role === UserRole.MANAGER && updatedUser.role === UserRole.OWNER) {
         addNotification({ message: `Quản lý không thể quản lý Chủ cửa hàng.`, type: 'error', userId: currentUserInternal?.id });
         return false;
    }
     if (updatedUser.role === UserRole.CHAIRMAN && updatedUser.managedBy) {
        addNotification({ message: `Chủ tịch không thể bị quản lý bởi người khác.`, type: 'error', userId: currentUserInternal?.id });
        return false;
    }

    setUsersData(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    addNotification({ message: `Thông tin người dùng ${updatedUser.name} đã được cập nhật.`, type: 'info', userId: currentUserInternal?.id });
    if (currentUserInternal && updatedUser.id === currentUserInternal.id) {
        setCurrentUser(updatedUser); 
    }
    
    // Update store profile if this user is an Owner and profile data is provided
    if (updatedUser.role === UserRole.OWNER && storeProfileData) {
        setStoreProfilesData(prevProfiles => {
            const existingProfileIndex = prevProfiles.findIndex(p => p.ownerId === updatedUser.id);
            if (existingProfileIndex !== -1) {
                const updatedProfile = { ...prevProfiles[existingProfileIndex], ...storeProfileData };
                const newProfiles = [...prevProfiles];
                newProfiles[existingProfileIndex] = updatedProfile;
                addNotification({message: `Thông tin cửa hàng "${updatedProfile.storeName}" đã được cập nhật.`, type: 'info'});
                return newProfiles;
            } else { // Should ideally not happen if profile is created with user, but handle defensively
                const newProfile: StoreProfile = {
                    ownerId: updatedUser.id,
                    storeName: storeProfileData.storeName || `${updatedUser.name}'s Store`,
                    storeLogoUrl: storeProfileData.storeLogoUrl,
                    storePhone: storeProfileData.storePhone,
                    storeAddress: storeProfileData.storeAddress,
                };
                addNotification({message: `Đã tạo mới thông tin cho cửa hàng "${newProfile.storeName}".`, type: 'info'});
                return [...prevProfiles, newProfile];
            }
        });
    }

    return true;
  }, [usersData, addNotification, currentUserInternal, setCurrentUser, setStoreProfilesData]);

  const deleteUser = useCallback((userId: string) => { 
    const userToDelete = findUserById(userId);
    if (!userToDelete) return;

    const subordinates = usersData.filter(u => u.managedBy === userId);
    let newManagerId: string | undefined = userToDelete.managedBy || undefined; 
    
    if (userToDelete.role === UserRole.OWNER) {
        const chairman = usersData.find(u => u.role === UserRole.CHAIRMAN);
        newManagerId = chairman ? chairman.id : undefined; 
        // Also remove store profile
        setStoreProfilesData(prev => prev.filter(p => p.ownerId !== userId));
        addNotification({message: `Hồ sơ cửa hàng của ${userToDelete.name} đã được xóa.`, type: 'info'});
    }

    const updatedUsers = usersData.map(u => {
        if (u.managedBy === userId) {
            return { ...u, managedBy: newManagerId };
        }
        return u;
    }).filter(u => u.id !== userId);

    setUsersData(updatedUsers);
    addNotification({ message: `Người dùng ${userToDelete.name} đã được xóa.`, type: 'warning', userId: currentUserInternal?.id });
  }, [usersData, addNotification, currentUserInternal, findUserById, setStoreProfilesData]);

  const updateStoreProfile = useCallback((profileData: Partial<StoreProfile> & { ownerId: string }) => {
    setStoreProfilesData(prevProfiles => {
        const index = prevProfiles.findIndex(p => p.ownerId === profileData.ownerId);
        if (index !== -1) {
            const updatedProfiles = [...prevProfiles];
            updatedProfiles[index] = { ...updatedProfiles[index], ...profileData };
            addNotification({message: `Thông tin cửa hàng "${updatedProfiles[index].storeName}" đã được cập nhật.`, type: 'success'});
            return updatedProfiles;
        }
        // If profile not found, create a new one (should ideally be handled by addUser for Owners)
        const ownerUser = usersData.find(u => u.id === profileData.ownerId && u.role === UserRole.OWNER);
        if(ownerUser) {
            const newProfile: StoreProfile = {
                ownerId: profileData.ownerId,
                storeName: profileData.storeName || `${ownerUser.name}'s Store`,
                storeLogoUrl: profileData.storeLogoUrl,
                storePhone: profileData.storePhone,
                storeAddress: profileData.storeAddress,
            };
            addNotification({message: `Đã tạo và cập nhật thông tin cho cửa hàng "${newProfile.storeName}".`, type: 'success'});
            return [...prevProfiles, newProfile];
        }
        addNotification({message: `Không tìm thấy Chủ cửa hàng với ID ${profileData.ownerId} để cập nhật hồ sơ cửa hàng.`, type: 'error'});
        return prevProfiles;
    });
  }, [usersData, addNotification, setStoreProfilesData]);

  const findStoreProfileByOwnerId = useCallback((ownerId: string): StoreProfile | undefined => {
    return storeProfilesData.find(p => p.ownerId === ownerId);
  }, [storeProfilesData]);

  const setActivePublicCustomerId = useCallback((customerId: string | null) => { setActivePublicCustomerIdState(customerId); }, []);

  const getCurrentUserOwnerId = useCallback(() => {
    if (!currentUserInternal) return null;
    return getOwnerIdForUser(currentUserInternal.id, usersData);
  }, [currentUserInternal, usersData, getOwnerIdForUser]);


  // Filtered data for context consumers
  const ordersForCurrentUserStore = useMemo(() => {
    if (!currentUserInternal || currentUserInternal.role === UserRole.CUSTOMER) {
        return allOrdersData;
    }
    if (currentUserInternal.role === UserRole.CHAIRMAN) {
        return allOrdersData; 
    }
    if (currentUserOwnerId) {
        return allOrdersData.filter(o => o.ownerId === currentUserOwnerId);
    }
    return [];
  }, [allOrdersData, currentUserInternal, currentUserOwnerId]);

  const inventoryForCurrentUserStore = useMemo(() => {
    if (currentUserInternal?.role === UserRole.CHAIRMAN) return allInventoryData;
    if (!currentUserOwnerId) return [];
    return allInventoryData.filter(i => i.ownerId === currentUserOwnerId);
  }, [allInventoryData, currentUserInternal, currentUserOwnerId]);

  const materialOrdersForCurrentUserStore = useMemo(() => {
    if (currentUserInternal?.role === UserRole.CHAIRMAN) return allMaterialOrdersData;
    if (!currentUserOwnerId) return [];
    return allMaterialOrdersData.filter(mo => mo.ownerId === currentUserOwnerId);
  }, [allMaterialOrdersData, currentUserInternal, currentUserOwnerId]);
  
  const variableCostsForCurrentUserStore = useMemo(() => {
    if (currentUserInternal?.role === UserRole.CHAIRMAN) return allVariableCostsData;
    if (!currentUserOwnerId) return [];
    return allVariableCostsData.filter(vc => vc.ownerId === currentUserOwnerId);
  }, [allVariableCostsData, currentUserInternal, currentUserOwnerId]);

  const fixedCostsForCurrentUserStore = useMemo(() => {
    if (currentUserInternal?.role === UserRole.CHAIRMAN) return allFixedCostsData; 
    if (!currentUserOwnerId) return [];
    return allFixedCostsData.filter(fc => fc.ownerId === currentUserOwnerId);
  }, [allFixedCostsData, currentUserInternal, currentUserOwnerId]);

   const notificationsForCurrentUser = useMemo(() => {
    let filteredNots: Notification[] = [];

    if (activePublicCustomerId) {
      // For public customer page: filter by their orders
      filteredNots = allNotificationsData.filter(n => {
        if (n.orderId) {
          const order = allOrdersData.find(o => o.id === n.orderId);
          return order?.customer.id === activePublicCustomerId;
        }
        return false; // Only show order-related notifications for public customer
      });
    } else if (!currentUserInternal) {
      // Not logged in, not on public customer page: show only true system-wide notifications
      filteredNots = allNotificationsData.filter(n => !n.ownerId && !n.userId && !n.orderId && n.type !== 'rating_prompt');
    } else {
      // Admin user is logged in
      if (currentUserInternal.role === UserRole.CHAIRMAN) {
        filteredNots = allNotificationsData; // Chairman sees all
      } else {
        const userOwnerId = getCurrentUserOwnerId();
        if (!userOwnerId) {
          // Admin user not under an owner (e.g., a global admin if such role existed)
          // For now, this means they see their own notifications and system-wide ones.
          filteredNots = allNotificationsData.filter(n => {
            if (n.userId === currentUserInternal.id) return true;
            // Include system-wide notifications
            if (!n.ownerId && !n.userId && !n.orderId && n.type !== 'rating_prompt') return true; 
            return false;
          });
        } else {
          // User is Owner, Manager, or Staff within a specific store
          filteredNots = allNotificationsData.filter(n => {
            // Notification explicitly for this store
            if (n.ownerId && n.ownerId === userOwnerId) return true;
            
            // Notification for a user within this store
            const notificationUserOwner = n.userId ? getOwnerIdForUser(n.userId, usersData) : null;
            if (notificationUserOwner && notificationUserOwner === userOwnerId) return true;
            
            // Notification related to an order of this store
            if (n.orderId) {
              const order = allOrdersData.find(o => o.id === n.orderId);
              if (order && order.ownerId === userOwnerId) return true;
            }
            
            // Include system-wide notifications for all logged-in admin users as well
            if (!n.ownerId && !n.userId && !n.orderId && n.type !== 'rating_prompt') return true;
            
            return false;
          });
        }
      }
    }
    return filteredNots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    allNotificationsData, 
    currentUserInternal, 
    activePublicCustomerId, 
    allOrdersData, 
    getCurrentUserOwnerId, 
    getOwnerIdForUser, 
    usersData
  ]);



  const contextValue: AppContextType = {
    currentUser: currentUserInternal, setCurrentUser, login, logout,
    theme, setTheme,
    users: usersData,
    customers: customersData, 
    services: servicesData,   
    suppliers: suppliersData, 
    materialItemDefinitions: materialItemDefinitionsData, 
    storeProfiles: storeProfilesData, // Added

    orders: ordersForCurrentUserStore,
    inventory: inventoryForCurrentUserStore,
    materialOrders: materialOrdersForCurrentUserStore,
    notifications: notificationsForCurrentUser,
    variableCosts: variableCostsForCurrentUserStore,
    fixedCosts: fixedCostsForCurrentUserStore, 
    kpis: getKPIs({}), 

    fixedCostsUpdateHistory: fixedCostsUpdateHistoryData.filter(h => currentUserInternal?.role === UserRole.CHAIRMAN || h.ownerId === currentUserOwnerId), 
    serviceRatings: serviceRatingsData, 
    staffRatings: staffRatingsData,     
    tips: tipsData,                     
    
    addOrder, updateOrder, deleteOrder, findOrder, findUserById, findUsersByManagerId,
    addCustomer, updateCustomer,
    addService, updateService, deleteService,
    addSupplier, updateSupplier,
    addInventoryItem, updateInventoryItem,
    addNotification, markNotificationAsRead, clearNotifications,
    addMaterialOrder, approveMaterialOrder, rejectMaterialOrder,
    addMaterialItemDefinition, updateMaterialItemDefinition, deleteMaterialItemDefinition,
    addVariableCost, updateVariableCost, deleteVariableCost,
    updateFixedCosts,
    addServiceRating, addStaffRating, createTip, getStaffForOrderActions,
    calculateAndStoreKPIsForAllStaff, getKPIs,
    addUser, updateUser, deleteUser,
    updateStoreProfile, findStoreProfileByOwnerId, // Added
    activePublicCustomerId, setActivePublicCustomerId,
    getCurrentUserOwnerId,
    getOwnerIdForUser,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
