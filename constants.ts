import { UserRole, ServiceItem } from './types';

export const APP_NAME = "Mega Laundromat";

export const USER_ROLES_OPTIONS = [
  { value: UserRole.STAFF, label: 'Nhân viên' },
  { value: UserRole.MANAGER, label: 'Quản lý' },
  { value: UserRole.OWNER, label: 'Chủ cửa hàng' },
  { value: UserRole.CHAIRMAN, label: 'Chủ tịch' }, // Added Chairman
  { value: UserRole.CUSTOMER, label: 'Khách hàng (Logout)' }, // Simplified logout
];

export const MOCK_SERVICES: ServiceItem[] = [
  { id: 'svc001', name: 'Giặt sấy áo sơ mi', unit: 'Cái', washMethodId: 'wm_wet_wash_default', price: 20000, minPrice: 15000, estimatedTimeHours: 2, customerReturnTimeHours: 3 },
  { id: 'svc002', name: 'Giặt khô Vest', unit: 'Bộ', washMethodId: 'wm_dry_clean_default', price: 150000, minPrice: 120000, estimatedTimeHours: 20, customerReturnTimeHours: 24 },
  { id: 'svc003', name: 'Giặt chăn lông', unit: 'Cái', washMethodId: 'wm_wet_wash_default', price: 100000, estimatedTimeHours: 5, customerReturnTimeHours: 6 }, // No minPrice
  { id: 'svc004', name: 'Là hơi quần tây', unit: 'Cái', washMethodId: 'wm_steam_iron_default', price: 30000, estimatedTimeHours: 0.5, customerReturnTimeHours: 1 },
  { id: 'svc005', name: 'Giặt sấy quần Jeans', unit: 'Cái', washMethodId: 'wm_wet_wash_default', price: 25000, minPrice: 20000, estimatedTimeHours: 2.5, customerReturnTimeHours: 3 },
  { id: 'svc006', name: 'Sấy khô khăn tắm', unit: 'Kg', washMethodId: 'wm_dry_only_default', price: 15000, estimatedTimeHours: 1.5, customerReturnTimeHours: 2 },
  { id: 'svc007', name: 'Ủi áo dài', unit: 'Bộ', washMethodId: 'wm_iron_only_default', price: 50000, estimatedTimeHours: 1.5, customerReturnTimeHours: 2 },
];
