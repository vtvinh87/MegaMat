
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { UserRole, ReportPeriod, Order, VariableCost, FixedCostItem, User, KPI } from '../../types';
import { ClipboardListIcon, DollarSignIcon, TrendingUpIcon, PackageIcon, SparklesIcon, UsersIcon, PercentIcon, StarIcon, BarChart3Icon } from 'lucide-react';

// --- Helper Functions (copied from ReportsPage for self-containment) ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

function filterByPeriod<TItem extends { createdAt?: Date; date?: Date; startDate?: Date }>(
  items: TItem[],
  period: ReportPeriod,
  dateField: keyof TItem
): TItem[] {
  const now = new Date();
  let startNum: number | null = null;
  let endNum: number | null = null;

  switch (period) {
    case 'today':
      startNum = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      endNum = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      break;
    case 'this_week':
      const firstDayOfWeek = new Date(now);
      firstDayOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      startNum = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate(), 0, 0, 0, 0).getTime();
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
      endNum = new Date(lastDayOfWeek.getFullYear(), lastDayOfWeek.getMonth(), lastDayOfWeek.getDate(), 23, 59, 59, 999).getTime();
      break;
    case 'this_month':
      startNum = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      endNum = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      break;
    case 'this_quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      startNum = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0).getTime();
      endNum = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59, 999).getTime();
      break;
    case 'this_year':
      startNum = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
      endNum = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      break;
    case 'all_time':
      return items;
  }

  if (startNum === null || endNum === null) return items;

  return items.filter(item => {
    const itemDateValue = item[dateField];
    const itemDate = new Date(itemDateValue as any);
    if (isNaN(itemDate.getTime())) return false;
    const itemTime = itemDate.getTime();
    return itemTime >= startNum && itemTime <= endNum;
  });
}

const getAdjustedFixedCostsForMainPeriod = (currentPeriod: ReportPeriod, monthlyTotal: number, allOrders: Order[]): number => {
    const now = new Date();
    switch (currentPeriod) {
      case 'today': return monthlyTotal / getDaysInMonth(now.getFullYear(), now.getMonth());
      case 'this_week': return (monthlyTotal / getDaysInMonth(now.getFullYear(), now.getMonth())) * 7;
      case 'this_month': return monthlyTotal;
      case 'this_quarter': return monthlyTotal * 3;
      case 'this_year':
        const monthsSoFar = now.getMonth() + (now.getDate() / getDaysInMonth(now.getFullYear(), now.getMonth()));
        return monthlyTotal * monthsSoFar;
      case 'all_time':
        if (allOrders.length === 0) return monthlyTotal;
        const oldestOrderTimestamp = Math.min(...allOrders.map(o => new Date(o.createdAt).getTime()));
        const oldestOrderDate = new Date(oldestOrderTimestamp);
        const monthsDifference = (now.getFullYear() - oldestOrderDate.getFullYear()) * 12 + (now.getMonth() - oldestOrderDate.getMonth()) + 1;
        return monthlyTotal * Math.max(1, monthsDifference);
      default: return monthlyTotal;
    }
};

interface ComparisonStoreData {
    ownerId: string;
    storeName: string;
    revenue: number;
    profit: number;
    aov: number;
    orderCount: number;
    topServices: { name: string; revenue: number }[];
    avgOnTimeRate: number;
    avgStaffRating: number;
    totalOrdersProcessedByStaff: number;
}

const MetricDisplay: React.FC<{label: string; value: string; icon: React.ReactNode}> = ({label, value, icon}) => (
    <div className="flex items-center space-x-3 py-2 border-b border-border-base last:border-b-0">
      <div className="text-brand-primary flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="font-semibold text-text-heading text-base">{value}</p>
      </div>
    </div>
);


const StoreComparisonPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { users, storeProfiles, orders, variableCosts, fixedCosts, kpis, getOwnerIdForUser } = useData();
    const navigate = useNavigate();

    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [period, setPeriod] = useState<ReportPeriod>('this_month');
    
    const allStores = useMemo(() => 
        storeProfiles.map(p => ({ ownerId: p.ownerId, name: p.storeName }))
        .sort((a,b) => a.name.localeCompare(b.name)), 
    [storeProfiles]);

    const periodOptions = [
        { value: 'today', label: 'Hôm nay' }, { value: 'this_week', label: 'Tuần này' },
        { value: 'this_month', label: 'Tháng này' }, { value: 'this_quarter', label: 'Quý này' },
        { value: 'this_year', label: 'Năm này' }, { value: 'all_time', label: 'Toàn thời gian' }
    ];

    const handleStoreSelectionChange = (storeId: string) => {
        setSelectedStoreIds(prev =>
            prev.includes(storeId)
                ? prev.filter(id => id !== storeId)
                : [...prev, storeId]
        );
    };

    const comparisonData = useMemo<ComparisonStoreData[]>(() => {
        if (selectedStoreIds.length === 0) return [];

        return selectedStoreIds.map(ownerId => {
            const storeName = storeProfiles.find(p => p.ownerId === ownerId)?.storeName || 'Cửa hàng không rõ';

            const storeOrdersAllTime = orders.filter(o => o.ownerId === ownerId);
            const storeOrders = filterByPeriod(storeOrdersAllTime, period, 'createdAt');
            const storeVariableCosts = filterByPeriod(variableCosts.filter(vc => vc.ownerId === ownerId), period, 'date');
            const storeFixedCostsMonthly = fixedCosts.filter(fc => fc.ownerId === ownerId).reduce((sum, fc) => sum + fc.amount, 0);

            const revenue = storeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
            const orderCount = storeOrders.length;
            const aov = orderCount > 0 ? revenue / orderCount : 0;
            
            const totalVariableCosts = storeVariableCosts.reduce((sum, vc) => sum + vc.amount, 0);
            const proratedFixedCosts = getAdjustedFixedCostsForMainPeriod(period, storeFixedCostsMonthly, storeOrdersAllTime);
            const profit = revenue - (totalVariableCosts + proratedFixedCosts);

            const serviceMap = storeOrders.reduce((acc, order) => {
                order.items.forEach(item => {
                    const name = item.serviceItem.name;
                    const value = Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0);
                    acc[name] = (acc[name] || 0) + value;
                });
                return acc;
            }, {} as Record<string, number>);

            const topServices = Object.entries(serviceMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, revenue]) => ({ name, revenue }));

            const storeStaffIds = users.filter(u => getOwnerIdForUser(u.id, users) === ownerId && (u.role === UserRole.STAFF || u.role === UserRole.MANAGER)).map(u => u.id);
            const storeKpis = filterByPeriod(kpis.filter(k => storeStaffIds.includes(k.userId)), period, 'startDate');

            const avgOnTimeRate = storeKpis.length > 0 ? storeKpis.reduce((sum, k) => sum + k.onTimeRate, 0) / storeKpis.length : 0;
            const avgStaffRating = storeKpis.length > 0 ? storeKpis.reduce((sum, k) => sum + k.avgRating, 0) / storeKpis.length : 0;
            const totalOrdersProcessedByStaff = storeKpis.reduce((sum, k) => sum + k.ordersProcessed, 0);

            return {
                ownerId, storeName, revenue, profit, aov, orderCount,
                topServices, avgOnTimeRate, avgStaffRating, totalOrdersProcessedByStaff
            };
        });
    }, [selectedStoreIds, period, storeProfiles, orders, variableCosts, fixedCosts, kpis, users, getOwnerIdForUser]);

    if (currentUser?.role !== UserRole.CHAIRMAN) {
        navigate('/admin/dashboard');
        return null;
    }

    return (
        <div className="space-y-6">
            <Card title="Bảng điều khiển So sánh Cửa hàng" icon={<ClipboardListIcon size={24} className="text-brand-primary" />}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-text-body mb-2">Chọn Cửa hàng để so sánh (tối đa 4):</label>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-3 border border-border-base rounded-md max-h-48 overflow-y-auto">
                            {allStores.map(store => (
                                <label key={store.ownerId} className="flex items-center space-x-2 p-2 rounded-md hover:bg-bg-surface-hover cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedStoreIds.includes(store.ownerId)}
                                        onChange={() => handleStoreSelectionChange(store.ownerId)}
                                        disabled={selectedStoreIds.length >= 4 && !selectedStoreIds.includes(store.ownerId)}
                                        className="h-4 w-4 rounded text-brand-primary focus:ring-brand-primary-focus"
                                    />
                                    <span className="text-sm text-text-body">{store.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Select
                          label="Chọn kỳ báo cáo"
                          options={periodOptions}
                          value={period}
                          onChange={e => setPeriod(e.target.value as ReportPeriod)}
                        />
                    </div>
                </div>
            </Card>

            {selectedStoreIds.length === 0 ? (
                <Card><p className="text-center text-text-muted py-10">Vui lòng chọn ít nhất một cửa hàng để xem so sánh.</p></Card>
            ) : (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(selectedStoreIds.length, 4)} gap-6`}>
                    {comparisonData.map(data => (
                        <Card key={data.ownerId} title={data.storeName} className="flex flex-col">
                           <div className="space-y-2">
                               <MetricDisplay label="Doanh thu" value={`${data.revenue.toLocaleString('vi-VN')} VNĐ`} icon={<TrendingUpIcon size={20}/>}/>
                               <MetricDisplay label="Lợi nhuận" value={`${data.profit.toLocaleString('vi-VN')} VNĐ`} icon={<DollarSignIcon size={20}/>}/>
                               <MetricDisplay label="Số đơn hàng" value={`${data.orderCount}`} icon={<PackageIcon size={20}/>}/>
                               <MetricDisplay label="AOV" value={`${data.aov.toLocaleString('vi-VN')} VNĐ`} icon={<BarChart3Icon size={20}/>}/>
                           </div>
                           <div className="mt-4 pt-4 border-t border-border-base">
                               <h4 className="text-sm font-semibold text-text-heading mb-2 flex items-center"><SparklesIcon size={16} className="mr-2 text-brand-primary"/>Dịch vụ hàng đầu</h4>
                               <ul className="space-y-1 text-xs text-text-body">
                                   {data.topServices.length > 0 ? data.topServices.map(s => (
                                       <li key={s.name} className="flex justify-between">
                                           <span>{s.name}</span>
                                           <span className="font-medium">{s.revenue.toLocaleString('vi-VN')}</span>
                                       </li>
                                   )) : <li className="text-text-muted italic">Chưa có dữ liệu</li>}
                               </ul>
                           </div>
                           <div className="mt-4 pt-4 border-t border-border-base">
                               <h4 className="text-sm font-semibold text-text-heading mb-2 flex items-center"><UsersIcon size={16} className="mr-2 text-brand-primary"/>KPI Nhân viên (TB)</h4>
                               <div className="space-y-2 text-xs">
                                   <div className="flex justify-between"><span>Tỷ lệ đúng hạn:</span> <span className="font-medium">{data.avgOnTimeRate.toFixed(1)}%</span></div>
                                   <div className="flex justify-between"><span>Đánh giá TB:</span> <span className="font-medium">{data.avgStaffRating.toFixed(2)} ★</span></div>
                                   <div className="flex justify-between"><span>Tổng đơn xử lý:</span> <span className="font-medium">{data.totalOrdersProcessedByStaff}</span></div>
                               </div>
                           </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StoreComparisonPage;
