
import { useCallback } from 'react';
import { KPI, KpiPeriodType, Order, StaffRating, Tip, User, UserRole, OrderStatus } from '../../../types';

type Props = {
  allKpisData: KPI[];
  setAllKpisData: React.Dispatch<React.SetStateAction<KPI[]>>;
  usersData: User[];
  allOrdersData: Order[];
  staffRatingsData: StaffRating[];
  tipsData: Tip[];
  getOwnerIdForUser: (userId: string, allUsers: User[]) => string | null;
};

// Helper function to get the week number
const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};


export const useKpiManagement = ({ 
  allKpisData,
  setAllKpisData,
  usersData,
  allOrdersData,
  staffRatingsData,
  tipsData,
  getOwnerIdForUser
}: Props) => {

  const calculateAndStoreKPIsForAllStaff = useCallback(async (periodType: KpiPeriodType, referenceDate: Date): Promise<void> => {
    
    let startDate: Date;
    let endDate: Date;
    let periodDisplay: string;

    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    switch (periodType) {
      case 'daily':
        startDate = new Date(ref);
        endDate = new Date(ref);
        endDate.setHours(23, 59, 59, 999);
        periodDisplay = `Ngày ${ref.toLocaleDateString('vi-VN')}`;
        break;
      case 'weekly':
        const firstDayOfWeek = ref.getDate() - ref.getDay() + (ref.getDay() === 0 ? -6 : 1); // Monday
        startDate = new Date(ref.setDate(firstDayOfWeek));
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        periodDisplay = `Tuần ${getWeekNumber(startDate)}/${startDate.getFullYear()}`;
        break;
      case 'monthly':
        startDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
        endDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        periodDisplay = `Tháng ${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
        break;
    }

    const staffAndManagers = usersData.filter(u => u.role === UserRole.STAFF || u.role === UserRole.MANAGER);
    const newKpis: KPI[] = [];

    for (const user of staffAndManagers) {
      const ownerId = getOwnerIdForUser(user.id, usersData);
      if (!ownerId) continue;

      // 1. Filter data for the user within the period
      const relevantOrderIds = new Set<string>();
      allOrdersData.forEach(order => {
        // Find orders where the staff performed a key action within the period.
        const hasKeyAction = order.scanHistory?.some(scan =>
          scan.staffUserId === user.id &&
          scan.timestamp >= startDate &&
          scan.timestamp <= endDate &&
          (scan.staffRoleInAction === 'processing' || scan.staffRoleInAction === 'return')
        );
        if (hasKeyAction) {
          relevantOrderIds.add(order.id);
        }
      });
      
      const ordersInPeriod = allOrdersData.filter(o => relevantOrderIds.has(o.id));
      const staffRatingsInPeriod = staffRatingsData.filter(r => r.staffUserId === user.id && r.createdAt >= startDate && r.createdAt <= endDate);
      const tipsInPeriod = tipsData.filter(t => t.targetStaffUserId === user.id && t.createdAt >= startDate && t.createdAt <= endDate);

      // 2. Calculate metrics
      const ordersProcessed = ordersInPeriod.length;
      
      const completableOrders = ordersInPeriod.filter(o => 
        (o.status === OrderStatus.COMPLETED || o.status === OrderStatus.RETURNED) &&
        o.completedAt && o.estimatedCompletionTime
      );
      
      const onTimeCompletedOrders = completableOrders.filter(o => new Date(o.completedAt!) <= new Date(o.estimatedCompletionTime!));
      const onTimeRate = completableOrders.length > 0 ? (onTimeCompletedOrders.length / completableOrders.length) * 100 : 100;
      
      const totalRating = staffRatingsInPeriod.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = staffRatingsInPeriod.length > 0 ? totalRating / staffRatingsInPeriod.length : 0;
      
      const totalTipAmount = tipsInPeriod.reduce((sum, t) => sum + t.amount, 0);

      const kpiId = `${user.id}-${periodType}-${startDate.toISOString().split('T')[0]}`;

      const newKpi: KPI = {
        id: kpiId,
        userId: user.id,
        user: {id: user.id, name: user.name, role: user.role, username: user.username, phone: user.phone}, // Add user snapshot for display
        periodType,
        periodDisplay,
        startDate,
        endDate,
        ordersProcessed,
        onTimeRate,
        avgRating,
        totalTipAmount,
        createdAt: new Date(),
        ownerId,
      };
      
      newKpis.push(newKpi);
    }

    // 3. Update state by replacing old KPIs for the same period with new ones
    setAllKpisData(prevKpis => {
      const newKpiIds = new Set(newKpis.map(k => k.id));
      const otherKpis = prevKpis.filter(kpi => !newKpiIds.has(kpi.id));
      return [...otherKpis, ...newKpis];
    });

  }, [usersData, allOrdersData, staffRatingsData, tipsData, getOwnerIdForUser, setAllKpisData]);

  const getKPIs = useCallback((filters: { userId?: string; periodType?: KpiPeriodType; startDate?: Date; endDate?: Date, ownerIdFilter?: string }) => {
    return allKpisData.filter(kpi => 
        (!filters.userId || kpi.userId === filters.userId) &&
        (!filters.periodType || kpi.periodType === filters.periodType) &&
        (!filters.startDate || new Date(kpi.startDate) >= filters.startDate) &&
        (!filters.endDate || new Date(kpi.endDate) <= filters.endDate) &&
        (!filters.ownerIdFilter || kpi.ownerId === filters.ownerIdFilter)
    );
  }, [allKpisData]);

  return {
    calculateAndStoreKPIsForAllStaff,
    getKPIs,
  };
};
