// FIX: Removed deprecated Customer type. User is now used for all individuals.
import { UserRole, User, StoreProfile, FixedCostItem, MaterialItemDefinition, VariableCost, VariableCostCategory, Order, ServiceItem, OrderItem, ScanHistoryEntry, InventoryItem, MaterialOrder, Notification, OrderStatus, Promotion, PaymentStatus, PaymentMethod, Supplier, FixedCostUpdateHistoryEntry, ServiceRating, StaffRating, Tip, KPI, StoreUpdateHistoryEntry, WashMethodDefinition } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { MOCK_SERVICES } from '../../constants';
import * as LsKeys from './utils';
import { simpleHash } from './utils';

const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (start: Date, end: Date): Date => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// Default settings data for seeding
export const SEED_PICKUP_LOCATIONS = ['Kệ A1', 'Kệ A2', 'Kệ B1', 'Kệ B2', 'Kệ C1'];
export const SEED_DEFAULT_PROCESSING_TIME_HOURS = 5;

// --- MOCK USERS (STAFF & CUSTOMERS) ---
// Passwords are now in plain text and will be hashed on first seed.
export const MOCK_USERS: User[] = [
  // Admins & Staff
  { id: 'user_chairman_boss', name: 'Chủ tịch Tập đoàn', role: UserRole.CHAIRMAN, phone: '0999999999', username: 'chutich', password: '000000' },
  { id: 'user_owner_dung', name: 'Chủ Tiệm Dung (Cửa hàng A)', role: UserRole.OWNER, phone: '0944444444', username: 'ct_dung', password: '000000', managedBy: 'user_chairman_boss' },
  { id: 'user_manager_cuong', name: 'Quản Lý Cường (Cửa hàng A)', role: UserRole.MANAGER, phone: '0933333333', username: 'ql_cuong', password: '000000', managedBy: 'user_owner_dung' },
  { id: 'user_staff_an', name: 'Nhân Viên An (Cửa hàng A)', role: UserRole.STAFF, phone: '0911111111', username: 'nv_an', password: '000000', managedBy: 'user_manager_cuong' },
  { id: 'user_staff_binh', name: 'Nhân Viên Bình (Cửa hàng A)', role: UserRole.STAFF, phone: '0922222222', username: 'nv_binh', password: '000000', managedBy: 'user_manager_cuong' },
  { id: 'owner001', name: 'Chủ Cửa Hàng B', role: UserRole.OWNER, username: 'chucuahang_b', password: '000000', phone: '0987654321', managedBy: 'user_chairman_boss' },
  { id: 'manager001', name: 'Quản Lý Ca 1 (Cửa hàng B)', role: UserRole.MANAGER, username: 'quanly1_b', password: '000000', phone: '0987123456', managedBy: 'owner001' },
  { id: 'staff001', name: 'Nhân Viên Ca 1 (Cửa hàng B)', role: UserRole.STAFF, username: 'nhanvien1_b', password: '000000', phone: '0912345678', managedBy: 'manager001' },
  
  // Customers
  { id: 'cus002', name: 'Trần Thị B', role: UserRole.CUSTOMER, phone: '0908765432', username: '0908765432', password: '123123', address: '456 Đường XYZ, Quận 3, TP.HCM', loyaltyPoints: 120 },
  { id: 'cus_binhminh', name: 'Bình Minh', role: UserRole.CUSTOMER, phone: '0901234567', username: '0901234567', password: '123123', address: '789 Đường GHI, Quận 5, TP.HCM', loyaltyPoints: 50 },
];

const ownerIdDung = 'user_owner_dung';
const ownerIdStoreB = 'owner001';

// --- MOCK STORE PROFILES ---
export const MOCK_STORE_PROFILES: StoreProfile[] = [
  { 
    ownerId: ownerIdDung, 
    storeName: 'Giặt Là An Nhiên (Chi nhánh Thủ Đức)', 
    storeLogoUrl: '/logo_store_a.png', 
    storePhone: '0944444444', 
    storeAddress: '123 Đường Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức',
    pickupLocations: SEED_PICKUP_LOCATIONS,
    defaultProcessingTimeHours: SEED_DEFAULT_PROCESSING_TIME_HOURS,
    loyaltySettings: {
      enabled: true,
      accrualRate: 10000, // 10,000 VND = 1 point
      redemptionRate: 1000, // 1 point = 1,000 VND
    },
  },
  { 
    ownerId: ownerIdStoreB, 
    storeName: 'Tiệm Giặt Siêu Tốc (Chi nhánh Quận 9)', 
    storeLogoUrl: '/logo_store_b.png', 
    storePhone: '0987654321', 
    storeAddress: '456 Đường Lê Văn Việt, P. Tăng Nhơn Phú A, Quận 9',
    pickupLocations: ['Tủ 1', 'Tủ 2', 'Tủ 3', 'Tủ 4'],
    defaultProcessingTimeHours: 4,
    loyaltySettings: {
      enabled: false,
      accrualRate: 20000,
      redemptionRate: 500,
    },
  },
];

const createInitialFixedCosts = (ownerId: string, storeName: string): FixedCostItem[] => [
  { id: uuidv4(), name: `Tiền thuê mặt bằng (${storeName})`, amount: getRandomInt(8, 15) * 1000000, ownerId },
  { id: uuidv4(), name: `Lương cơ bản QL, NV (${storeName})`, amount: getRandomInt(15, 25) * 1000000, ownerId },
  { id: uuidv4(), name: `Internet & Điện thoại (${storeName})`, amount: getRandomInt(4, 7) * 100000, ownerId },
];

export const INITIAL_MATERIAL_ITEM_DEFINITIONS: MaterialItemDefinition[] = [
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

  for (let i = 0; i < 20; i++) {
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
   for (let yearOffset = 1; yearOffset <= 2; yearOffset++) {
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

// FIX: Changed `customers` parameter type from Customer[] to User[].
const createDemoOrders = (customers: User[], services: ServiceItem[], users: User[], ownerId: string): Order[] => {
    const demoOrders: Omit<Order, 'paymentStatus' | 'paymentMethod'>[] = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 180); 

  const allStatuses = Object.values(OrderStatus).filter(s => s !== OrderStatus.DELETED_BY_ADMIN && s !== OrderStatus.CANCELLED);
  const staffForThisOwner: User[] = [];
  const ownerUser = users.find(u => u.id === ownerId);
  if (ownerUser) {
    const collectStaff = (managerId: string) => {
        users.forEach(u => {
            if (u.managedBy === managerId) {
                if (u.role === UserRole.STAFF || u.role === UserRole.MANAGER) staffForThisOwner.push(u);
                if (u.role === UserRole.MANAGER || u.role === UserRole.OWNER) collectStaff(u.id);
            }
        });
    };
    collectStaff(ownerId);
    if (ownerUser.role === UserRole.STAFF || ownerUser.role === UserRole.MANAGER) staffForThisOwner.push(ownerUser);
  }

  for (let i = 0; i < 25; i++) {
    const customer = getRandomElement(customers);
    if (!customer) continue;
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
      items.push({ serviceItem, selectedWashMethodId: serviceItem.washMethodId, quantity: quantity, notes: Math.random() > 0.7 ? `Ghi chú demo ${j + 1}` : undefined });
      if (serviceItem.customerReturnTimeHours > maxProcessingTimeHoursForOrder) maxProcessingTimeHoursForOrder = serviceItem.customerReturnTimeHours;
    }
    if(items.length === 0 && services.length > 0) { 
        const serviceItem = getRandomElement(services);
        const quantity = getRandomInt(1, 2);
        const lineTotal = Math.max(serviceItem.price * quantity, serviceItem.minPrice || 0);
        orderTotalAmount += lineTotal;
        items.push({ serviceItem, selectedWashMethodId: serviceItem.washMethodId, quantity: quantity });
        if (serviceItem.customerReturnTimeHours > maxProcessingTimeHoursForOrder) maxProcessingTimeHoursForOrder = serviceItem.customerReturnTimeHours;
    }
    
    const createdAt = getRandomDate(startDate, endDate);
    let receivedAt: Date | undefined, estimatedCompletionTime: Date | undefined, completedAt: Date | undefined;
    let currentStatus = getRandomElement(allStatuses);
    
    const randomStaffFromStore = () => staffForThisOwner.length > 0 ? getRandomElement(staffForThisOwner) : users.find(u=>u.id === ownerId);
    const creatorStaff = randomStaffFromStore();

    let scanHistory: ScanHistoryEntry[] = [{ 
        timestamp: createdAt, action: 'Đơn hàng được tạo (demo)', 
        scannedBy: creatorStaff?.role || UserRole.OWNER, staffUserId: creatorStaff?.id, staffRoleInAction: 'pickup' 
    }];
    
    if (currentStatus !== OrderStatus.PENDING) {
        receivedAt = new Date(createdAt.getTime() + getRandomInt(1,3) * 60 * 60 * 1000);
        scanHistory.push({timestamp: receivedAt, action: 'Đã nhận đồ từ khách (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'pickup', scannedBy: randomStaffFromStore()?.role});

        estimatedCompletionTime = new Date(receivedAt.getTime() + (maxProcessingTimeHoursForOrder || SEED_DEFAULT_PROCESSING_TIME_HOURS) * 60 * 60 * 1000);
        
        if (currentStatus === OrderStatus.PROCESSING) {
            scanHistory.push({timestamp: new Date(receivedAt.getTime() + getRandomInt(1,2)*60*60*1000), action: 'Bắt đầu xử lý (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'processing', scannedBy: randomStaffFromStore()?.role});
        } else if (currentStatus === OrderStatus.COMPLETED || currentStatus === OrderStatus.RETURNED) {
            scanHistory.push({timestamp: new Date(receivedAt.getTime() + getRandomInt(1,2)*60*60*1000), action: 'Bắt đầu xử lý (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'processing', scannedBy: randomStaffFromStore()?.role});
            completedAt = estimatedCompletionTime;
            scanHistory.push({timestamp: completedAt, action: `Hoàn thành xử lý (demo). Vị trí: ${SEED_PICKUP_LOCATIONS.length > 0 ? getRandomElement(SEED_PICKUP_LOCATIONS) : 'Kệ X'}`, staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'processing', scannedBy: randomStaffFromStore()?.role});
            if (currentStatus === OrderStatus.RETURNED) {
                 const returnedAt = new Date(completedAt.getTime() + getRandomInt(1, 5) * 60 * 60 * 1000);
                 scanHistory.push({timestamp: returnedAt, action: 'Đã trả đồ cho khách (demo)', staffUserId: randomStaffFromStore()?.id, staffRoleInAction:'return', scannedBy: randomStaffFromStore()?.role});
                 completedAt = returnedAt; 
            }
        }
    } else {
        estimatedCompletionTime = new Date(createdAt.getTime() + (maxProcessingTimeHoursForOrder || SEED_DEFAULT_PROCESSING_TIME_HOURS) * 60 * 60 * 1000);
    }

    demoOrders.push({
      id: orderId, customer, items, status: currentStatus, createdAt, receivedAt, estimatedCompletionTime, completedAt, ownerId,
      pickupLocation: (currentStatus === OrderStatus.COMPLETED || currentStatus === OrderStatus.RETURNED) && SEED_PICKUP_LOCATIONS.length > 0 ? getRandomElement(SEED_PICKUP_LOCATIONS) : undefined,
      totalAmount: orderTotalAmount, 
      qrCodePaymentUrl: `https://api.vietqr.io/image/ACB-99998888-z5NqV5g.png?amount=${orderTotalAmount}&addInfo=${orderId.replace("DH-","")}&accountName=TIEM%20GIAT%20LA%20DEMO`,
      scanHistory, notes: Math.random() > 0.6 ? `Ghi chú cho đơn hàng demo ${i + 1}` : undefined,
    });
  }
  
  // Add payment status to demo orders
  return demoOrders.map(order => {
      const isPaid = order.status === OrderStatus.COMPLETED || order.status === OrderStatus.RETURNED;
      return {
          ...order,
          paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.UNPAID,
          paymentMethod: isPaid ? getRandomElement(Object.values(PaymentMethod)) : undefined,
      };
  });
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
            totalAmount: def.price * getRandomInt(1,5),
            ownerId,
            notes: Math.random() > 0.5 ? `Đơn NVL mẫu ${i+1} cho cửa hàng ${ownerId.includes('dung') ? 'A' : 'B'}` : undefined
        });
    }
    return orders;
};

const createInitialWashMethods = (ownerId: string): WashMethodDefinition[] => [
  { id: `wm_wet_wash_default_${ownerId}`, name: "Giặt ướt", description: "Giặt bằng nước và hóa chất giặt thông thường.", ownerId },
  { id: `wm_dry_clean_default_${ownerId}`, name: "Giặt khô", description: "Làm sạch bằng dung môi hóa học thay vì nước.", ownerId },
  { id: `wm_steam_iron_default_${ownerId}`, name: "Là hơi", description: "Làm phẳng quần áo bằng bàn là hơi nước công nghiệp.", ownerId },
  { id: `wm_dry_only_default_${ownerId}`, name: "Chỉ sấy", description: "Sấy khô quần áo đã được giặt sạch.", ownerId },
  { id: `wm_iron_only_default_${ownerId}`, name: "Chỉ ủi", description: "Làm phẳng quần áo bằng bàn là nhiệt thông thường.", ownerId },
];


type AppStateSetters = {
    setUsersData: (data: User[]) => void;
    setCustomersData: (data: User[]) => void;
    setServicesData: (data: ServiceItem[]) => void;
    setAllOrdersData: (data: Order[]) => void;
    setAllInventoryData: (data: InventoryItem[]) => void;
    setAllMaterialOrdersData: (data: MaterialOrder[]) => void;
    setMaterialItemDefinitionsData: (data: MaterialItemDefinition[]) => void;
    setAllNotificationsData: (data: Notification[]) => void;
    setAllVariableCostsData: (data: VariableCost[]) => void;
    setAllFixedCostsData: (data: FixedCostItem[]) => void;
    setStoreProfilesData: (data: StoreProfile[]) => void;
    setPromotionsData: (data: Promotion[]) => void;
    setFixedCostsUpdateHistoryData: (data: FixedCostUpdateHistoryEntry[]) => void;
    setServiceRatingsData: (data: ServiceRating[]) => void;
    setStaffRatingsData: (data: StaffRating[]) => void;
    setTipsData: (data: Tip[]) => void;
    setAllKpisData: (data: KPI[]) => void;
    setStoreUpdateHistoryData: (data: StoreUpdateHistoryEntry[]) => void;
    setSuppliersData: (data: Supplier[]) => void;
    setWashMethodsData: (data: WashMethodDefinition[]) => void;
};

export const seedInitialData = async (setters: AppStateSetters) => {
  const isDataSeeded = localStorage.getItem(LsKeys.USERS_KEY);

  // Seed only if there's no user data, or if it's an empty array (cleared localStorage)
  if (!isDataSeeded || JSON.parse(isDataSeeded).length === 0) {
    console.log("Seeding initial data into state...");

    // 1. Hash passwords for mock users
    const hashedUsers = await Promise.all(MOCK_USERS.map(async (user) => {
        if (user.password) {
            user.password = await simpleHash(user.password);
        }
        return user;
    }));
    setters.setUsersData(hashedUsers);

    // 2. Seed static data
    setters.setServicesData(MOCK_SERVICES);
    setters.setStoreProfilesData(MOCK_STORE_PROFILES);
    setters.setMaterialItemDefinitionsData(INITIAL_MATERIAL_ITEM_DEFINITIONS);
    setters.setSuppliersData([]); // Initialize with empty array

    // 3. Generate and seed dynamic data for each store owner
    const customersForOrders = hashedUsers.filter(u => u.role === UserRole.CUSTOMER);
    if(setters.setCustomersData) {
        setters.setCustomersData(customersForOrders);
    }
    

    const storeOwners = hashedUsers.filter(u => u.role === UserRole.OWNER);
    
    let allOrders: Order[] = [];
    let allFixedCosts: FixedCostItem[] = [];
    let allVariableCosts: VariableCost[] = [];
    let allInventory: InventoryItem[] = [];
    let allMaterialOrders: MaterialOrder[] = [];
    let allWashMethods: WashMethodDefinition[] = [];

    storeOwners.forEach(owner => {
        const storeProfile = MOCK_STORE_PROFILES.find(p => p.ownerId === owner.id);
        const storeNameForCosts = storeProfile ? storeProfile.storeName : owner.name;
        
        allWashMethods.push(...createInitialWashMethods(owner.id));
        allOrders.push(...createDemoOrders(customersForOrders, MOCK_SERVICES, hashedUsers, owner.id));
        allFixedCosts.push(...createInitialFixedCosts(owner.id, storeNameForCosts));
        allVariableCosts.push(...createDemoVariableCosts(owner.id));
        allInventory.push(...createDemoInventory(owner.id));
        allMaterialOrders.push(...createDemoMaterialOrders(owner.id, INITIAL_MATERIAL_ITEM_DEFINITIONS));
    });

    setters.setAllOrdersData(allOrders);
    setters.setAllFixedCostsData(allFixedCosts);
    setters.setAllVariableCostsData(allVariableCosts);
    setters.setAllInventoryData(allInventory);
    setters.setAllMaterialOrdersData(allMaterialOrders);
    setters.setWashMethodsData(allWashMethods);

    // 4. Initialize remaining data slices to empty arrays
    setters.setAllNotificationsData([]);
    setters.setServiceRatingsData([]);
    setters.setStaffRatingsData([]);
    setters.setTipsData([]);
    setters.setAllKpisData([]);
    setters.setPromotionsData([]);
    setters.setFixedCostsUpdateHistoryData([]);
    setters.setStoreUpdateHistoryData([]);
    
    // A small delay to allow react to batch state updates before logging completion
    setTimeout(() => console.log("Initial data seeding complete. State updated."), 100);
  }
};
