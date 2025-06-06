
import { UserRole, ServiceItem, WashMethod } from './types';

export const APP_NAME = "Mega Laundromat";

export const USER_ROLES_OPTIONS = [
  { value: UserRole.STAFF, label: 'Nhân viên' },
  { value: UserRole.MANAGER, label: 'Quản lý' },
  { value: UserRole.OWNER, label: 'Chủ cửa hàng' },
  { value: UserRole.CHAIRMAN, label: 'Chủ tịch' }, // Added Chairman
  { value: UserRole.CUSTOMER, label: 'Khách hàng (Logout)' }, // Simplified logout
];

export const MOCK_SERVICES: ServiceItem[] = [
  { id: 'svc001', name: 'Giặt sấy áo sơ mi', unit: 'Cái', washMethod: WashMethod.WET_WASH, price: 20000, minPrice: 15000, estimatedTimeHours: 2, customerReturnTimeHours: 3 },
  { id: 'svc002', name: 'Giặt khô Vest', unit: 'Bộ', washMethod: WashMethod.DRY_CLEAN, price: 150000, minPrice: 120000, estimatedTimeHours: 20, customerReturnTimeHours: 24 },
  { id: 'svc003', name: 'Giặt chăn lông', unit: 'Cái', washMethod: WashMethod.WET_WASH, price: 100000, estimatedTimeHours: 5, customerReturnTimeHours: 6 }, // No minPrice
  { id: 'svc004', name: 'Là hơi quần tây', unit: 'Cái', washMethod: WashMethod.STEAM_IRON, price: 30000, estimatedTimeHours: 0.5, customerReturnTimeHours: 1 },
  { id: 'svc005', name: 'Giặt sấy quần Jeans', unit: 'Cái', washMethod: WashMethod.WET_WASH, price: 25000, minPrice: 20000, estimatedTimeHours: 2.5, customerReturnTimeHours: 3 },
  { id: 'svc006', name: 'Sấy khô khăn tắm', unit: 'Kg', washMethod: WashMethod.DRY_ONLY, price: 15000, estimatedTimeHours: 1.5, customerReturnTimeHours: 2 },
  { id: 'svc007', name: 'Ủi áo dài', unit: 'Bộ', washMethod: WashMethod.IRON_ONLY, price: 50000, estimatedTimeHours: 1.5, customerReturnTimeHours: 2 },
];

export const WASH_METHOD_OPTIONS = Object.values(WashMethod).map(method => ({
  value: method,
  label: method,
}));


export const PICKUP_LOCATIONS = ['Kệ A1', 'Kệ A2', 'Kệ B1', 'Kệ B2', 'Kệ C1'];

export const DEFAULT_PROCESSING_TIME_HOURS = 5; // Default processing time for QR scan 1
