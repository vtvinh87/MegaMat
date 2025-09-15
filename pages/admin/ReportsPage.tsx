import React, { useState, useMemo, useEffect, ChangeEvent, FormEvent, useCallback } from 'react';
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, VariableCost, VariableCostCategory, VariableCostInput, UserRole, FixedCostItem, ReportPeriod, ProfitChartDataPoint, FixedCostUpdateHistoryEntry, User } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DownloadIcon, TrendingUp, ShoppingBagIcon, DollarSignIcon, FileTextIcon, PlusCircleIcon, EditIcon, Trash2Icon, ArrowDownCircle, ArrowUpCircle, BarChart3Icon, CalendarIcon, TagIcon, UserIcon, SettingsIcon, CreditCardIcon, SaveIcon, AlertTriangleIcon, EyeOffIcon, InfoIcon, MessageSquareIcon, XCircleIcon, BuildingIcon, SparklesIcon } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Spinner } from '../../components/ui/Spinner';
import { APP_NAME } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ActiveReportSection = 'revenue' | 'costs' | 'profit';


// Variable Cost Modal (remains largely the same)
interface VariableCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (costData: VariableCostInput, reason?: string) => void;
  cost?: VariableCost | null; 
  currentUser: User | null; 
}

const VariableCostModal: React.FC<VariableCostModalProps> = ({ isOpen, onClose, onSave, cost, currentUser }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<VariableCostCategory>(VariableCostCategory.OTHER);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState(''); // For edit mode

  const isEditMode = !!cost;

  useEffect(() => {
    if (cost && isOpen) {
      setDescription(cost.description);
      setAmount(cost.amount);
      setDate(new Date(cost.date).toISOString().split('T')[0]);
      setCategory(cost.category);
      setNotes(cost.notes || '');
      setReason(''); 
    } else if (isOpen) {
      setDescription(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]);
      setCategory(VariableCostCategory.OTHER); setNotes(''); setReason('');
    }
  }, [cost, isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser?.role) { alert('Không thể xác định người dùng.'); return; }
    if (isEditMode && !reason.trim()) { alert('Vui lòng nhập lý do chỉnh sửa.'); return; }
    if (amount === '' || +amount <= 0) { alert('Số tiền chi phí phải lớn hơn 0.'); return; }

    const costData: VariableCostInput = {
      description, amount: +amount, date: new Date(date), category, notes,
      enteredBy: cost?.enteredBy || currentUser.role, 
    };
    onSave(costData, isEditMode ? reason : undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60] animate-fadeIn">
      <Card title={isEditMode ? 'Sửa Chi phí' : 'Thêm Chi phí mới'} className="w-full max-w-lg bg-bg-surface shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Mô tả chi phí*" value={description} onChange={e => setDescription(e.target.value)} required />
          <Input label="Số tiền (VNĐ)*" type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} required min="1" />
          <Input label="Ngày phát sinh*" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Select
            label="Loại chi phí*"
            options={Object.values(VariableCostCategory).map(c => ({ value: c, label: c }))}
            value={category}
            onChange={e => setCategory(e.target.value as VariableCostCategory)}
            required
          />
          <Input label="Ghi chú (nếu có)" value={notes} onChange={e => setNotes(e.target.value)} isTextArea rows={2} />
          {isEditMode && (
            <Input label="Lý do chỉnh sửa*" value={reason} onChange={e => setReason(e.target.value)} required isTextArea rows={2} />
          )}
          <div className="flex justify-end space-x-3 pt-3 border-t border-border-base">
            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
            <Button type="submit" variant="primary">{isEditMode ? 'Lưu thay đổi' : 'Thêm chi phí'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// Generic Reason/Input Modal for confirmations
interface ReasonConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  itemName?: string;
  actionDescription?: string;
  confirmButtonText?: string;
  confirmButtonVariant?: 'primary' | 'danger';
  reasonLabel?: string;
  reasonPlaceholder?: string;
  isReasonOptional?: boolean;
}
const ReasonConfirmModal: React.FC<ReasonConfirmModalProps> = ({
  isOpen, onClose, onConfirm, title, itemName, actionDescription,
  confirmButtonText = "Xác nhận", confirmButtonVariant = "primary",
  reasonLabel = "Lý do*", reasonPlaceholder = "Nhập lý do...", isReasonOptional = false
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isReasonOptional && !reason.trim()) {
      alert(reasonLabel.endsWith("*") ? "Lý do là bắt buộc." : "Vui lòng nhập thông tin.");
      return;
    }
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[70] animate-fadeIn">
      <Card title={title} className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base">
        {itemName && <p className="text-sm text-text-body mb-1">Đối tượng: <span className="font-semibold">{itemName}</span></p>}
        {actionDescription && <p className="text-sm text-text-muted mb-3">{actionDescription}</p>}
        <Input
          isTextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={reasonPlaceholder}
          label={reasonLabel}
          aria-label={reasonLabel}
          required={!isReasonOptional}
        />
        <div className="mt-4 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant={confirmButtonVariant} onClick={handleConfirm}>{confirmButtonText}</Button>
        </div>
      </Card>
    </div>
  );
};


// Helper: Get days in a specific month
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const formatDateForChart = (date: Date, subPeriodUnit: 'day' | 'month'): string => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
   // const quarter = Math.ceil(month / 3); // Not used with current subPeriodUnit type

    switch (subPeriodUnit) {
        case 'day': return `${day}/${month}`;
        case 'month': return `Th ${month}/${year}`;
        // case 'quarter': return `Q${quarter}/${year}`; // Cases for 'quarter' and 'year' are effectively dead code
        // case 'year': return `${year}`;              // given subPeriodUnit is only 'day' or 'month' from caller.
        default: return '';
    }
};

// FIX: Update function signature to be more flexible with generics, preventing type inference issues with empty arrays.
function filterByPeriod<TItem extends Record<string, any>>(
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
      firstDayOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday as first day
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
    default:
      return items;
  }

   if (startNum === null || endNum === null) return items;

  return items.filter(item => {
    const itemDateValue = item[dateField];
    
    // A simplified and robust check for any value that can be parsed into a valid date.
    const itemDate = new Date(itemDateValue);
    if (isNaN(itemDate.getTime())) {
      return false;
    }

    const itemTime = itemDate.getTime();
    return itemTime >= startNum && itemTime <= endNum;
  });
}


const ReportsPage: React.FC = () => {
  // FIX: Replaced useAppContext with useData and useAuth
  const { 
    orders: allOrdersFromContext, 
    variableCosts: allVariableCostsFromContext, 
    fixedCosts: allFixedCostsFromContext, 
    addVariableCost, 
    updateVariableCost, 
    deleteVariableCost, 
    updateFixedCosts, 
    fixedCostsUpdateHistory: allFixedCostsHistoryFromContext,
    addNotification: contextAddNotification,
    getCurrentUserOwnerId,
    users, // For Chairman to select store
  } = useData();
  const { currentUser } = useAuth();
  
  const initialPeriod = currentUser?.role === UserRole.STAFF ? 'today' : 'this_month';
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [chartKey, setChartKey] = useState(0); 
  const [profitChartData, setProfitChartData] = useState<ProfitChartDataPoint[]>([]);
  
  const initialSection = currentUser?.role === UserRole.STAFF ? 'revenue' : 'revenue';
  const [activeSection, setActiveSection] = useState<ActiveReportSection>(initialSection);

  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<VariableCost | null>(null);
  
  const [editableFixedCosts, setEditableFixedCosts] = useState<FixedCostItem[]>([]);
  const [isFixedCostReasonModalOpen, setIsFixedCostReasonModalOpen] = useState(false);
  
  const [isDeleteReasonModalOpen, setIsDeleteReasonModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string; name: string; type: 'variableCost'} | null>(null);

  // AI Analyst State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // For Chairman: store selection
  const [selectedStoreOwnerIdForReport, setSelectedStoreOwnerIdForReport] = useState<string | 'all'>('all');
  const storeOptionsForChairman = useMemo(() => {
    if (currentUser?.role !== UserRole.CHAIRMAN) return [];
    const owners = users.filter(u => u.role === UserRole.OWNER);
    return [{ value: 'all', label: 'Tất cả cửa hàng (Tổng hợp)' }, ...owners.map(o => ({ value: o.id, label: o.name }))];
  }, [users, currentUser]);

  const {
    orders,
    variableCosts,
    fixedCosts,
    fixedCostsUpdateHistory
  } = useMemo(() => {
    if (currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport !== 'all') {
      return {
        orders: allOrdersFromContext.filter(o => o.ownerId === selectedStoreOwnerIdForReport),
        variableCosts: allVariableCostsFromContext.filter(vc => vc.ownerId === selectedStoreOwnerIdForReport),
        fixedCosts: allFixedCostsFromContext.filter(fc => fc.ownerId === selectedStoreOwnerIdForReport),
        fixedCostsUpdateHistory: allFixedCostsHistoryFromContext.filter(fh => fh.ownerId === selectedStoreOwnerIdForReport),
      };
    }
    // For Chairman 'all' or for other roles (already filtered by context)
    return {
      orders: allOrdersFromContext,
      variableCosts: allVariableCostsFromContext,
      fixedCosts: allFixedCostsFromContext,
      fixedCostsUpdateHistory: allFixedCostsHistoryFromContext,
    };
  }, [currentUser, selectedStoreOwnerIdForReport, allOrdersFromContext, allVariableCostsFromContext, allFixedCostsFromContext, allFixedCostsHistoryFromContext]);


  useEffect(() => {
    setEditableFixedCosts(fixedCosts.map(fc => ({...fc})));
  }, [fixedCosts]);

  const handleFixedCostChange = (id: string, newAmount: string) => {
    const amountValue = parseFloat(newAmount);
    if (newAmount === "" || !isNaN(amountValue)) {
        setEditableFixedCosts(prev => 
            prev.map(fc => fc.id === id ? {...fc, amount: newAmount === "" ? 0 : amountValue } : fc)
        );
    }
  };

  const handleOpenFixedCostReasonModal = () => {
    const originalStoreFixedCosts = fixedCosts; // Use currently scoped fixed costs
    const hasChanges = editableFixedCosts.some((efc) => {
        const originalFc = originalStoreFixedCosts.find(ofc => ofc.id === efc.id);
        return !originalFc || efc.amount !== originalFc.amount;
    }) || editableFixedCosts.length !== originalStoreFixedCosts.length; 

    if (!hasChanges) {
        contextAddNotification({message: "Không có thay đổi nào để lưu cho chi phí cố định của phạm vi này.", type: "info"});
        return;
    }
    setIsFixedCostReasonModalOpen(true);
  };

  const handleConfirmSaveFixedCosts = (reason: string) => {
    if (!currentUser?.role) return;
    const costsToSaveForStore = editableFixedCosts.map(({ ownerId, ...rest }) => ({...rest, amount: Number(rest.amount) || 0 }));
    
    const targetOwnerIdForUpdate = (currentUser.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport !== 'all') 
                                    ? selectedStoreOwnerIdForReport 
                                    : getCurrentUserOwnerId(); // For Owner
    
    if (!targetOwnerIdForUpdate && currentUser.role !== UserRole.CHAIRMAN) {
        contextAddNotification({message: "Không thể xác định cửa hàng để lưu chi phí cố định.", type:"error"});
        return;
    }
    if (currentUser.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all') {
      contextAddNotification({message: "Chủ tịch không thể lưu chi phí cố định cho 'Tất cả cửa hàng'. Vui lòng chọn một cửa hàng cụ thể.", type:"error"});
      setIsFixedCostReasonModalOpen(false);
      return;
    }

    updateFixedCosts(costsToSaveForStore, reason, currentUser.role, targetOwnerIdForUpdate);
    setIsFixedCostReasonModalOpen(false);
  };

  const chartColors = {
    revenue: '#0ea5e9', // sky-500
    costs: '#f43f5e',   // rose-500
    profit: '#10b981',  // emerald-500
    variableCosts: '#eab308', // yellow-500
    fixedCosts: '#8b5cf6', // violet-500
    text: '#64748b', // slate-500
    grid: '#e2e8f0', // slate-200
  };
  
  useEffect(() => {
    setChartKey(prev => prev + 1); // Force re-render of charts on theme change
  }, []);

  const filteredRevenueOrdersByPeriod = useMemo(() => 
    filterByPeriod(orders, period, 'createdAt')
  , [orders, period]);
  
  const totalRevenue = useMemo(() => 
    filteredRevenueOrdersByPeriod.reduce((sum, order) => sum + order.totalAmount, 0)
  , [filteredRevenueOrdersByPeriod]);
  const totalRevenueOrdersCount = filteredRevenueOrdersByPeriod.length;

  const revenueByService = useMemo(() => {
    const serviceMap: { [key: string]: { name: string, revenue: number, count: number } } = {};
    filteredRevenueOrdersByPeriod.forEach(order => {
      order.items.forEach(item => {
        const serviceName = item.serviceItem.name;
        if (!serviceMap[serviceName]) {
          serviceMap[serviceName] = { name: serviceName, revenue: 0, count: 0 };
        }
        serviceMap[serviceName].revenue += Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0);
        serviceMap[serviceName].count += item.quantity;
      });
    });
    return Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue);
  }, [filteredRevenueOrdersByPeriod]);

  const displayedVariableCostsByPeriod = useMemo(() => {
    const costsInPeriod = filterByPeriod(variableCosts, period, 'date');
    if (currentUser?.role === UserRole.MANAGER) {
      return costsInPeriod.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    }
    return costsInPeriod.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [variableCosts, period, currentUser]);

  const totalVariableCostsAmountInPeriod = useMemo(() => 
    filterByPeriod(variableCosts, period, 'date').reduce((sum, cost) => sum + cost.amount, 0)
  , [variableCosts, period]);

  const currentScopedMonthlyFixedCostsTotal = useMemo(() => fixedCosts.reduce((sum, item) => sum + item.amount, 0), [fixedCosts]);
  
  const getAdjustedFixedCostsForMainPeriod = useCallback((currentPeriod: ReportPeriod, monthlyTotalForScope: number): number => {
    const now = new Date();
    switch (currentPeriod) {
      case 'today': return monthlyTotalForScope / getDaysInMonth(now.getFullYear(), now.getMonth());
      case 'this_week': return (monthlyTotalForScope / getDaysInMonth(now.getFullYear(), now.getMonth())) * 7; 
      case 'this_month': return monthlyTotalForScope;
      case 'this_quarter': return monthlyTotalForScope * 3; 
      case 'this_year': 
        const monthsSoFar = now.getMonth() + (now.getDate() / getDaysInMonth(now.getFullYear(), now.getMonth()));
        return monthlyTotalForScope * monthsSoFar;
      case 'all_time':
        if (orders.length === 0) return monthlyTotalForScope; // Default to 1 month if no orders
        const oldestOrderTimestamp = Math.min(...orders.map(o => new Date(o.createdAt).getTime()));
        const oldestOrderDate = new Date(oldestOrderTimestamp);
        const monthsDifference = (now.getFullYear() - oldestOrderDate.getFullYear()) * 12 + (now.getMonth() - oldestOrderDate.getMonth()) + 1;
        return monthlyTotalForScope * Math.max(1, monthsDifference);
      default: return monthlyTotalForScope;
    }
  }, [orders]); 
  
  const currentPeriodFixedCosts = getAdjustedFixedCostsForMainPeriod(period, currentScopedMonthlyFixedCostsTotal);
  const totalCosts = currentPeriodFixedCosts + totalVariableCostsAmountInPeriod;
  const profit = totalRevenue - totalCosts;

  const PIE_COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#f43f5e', '#6366f1', '#8B5CF6']; 

  const getFixedCostsForSubInterval = useCallback((subIntervalStartDate: Date, subIntervalEndDate: Date, subPeriodUnit: 'day'|'month', monthlyTotalForScope: number): number => {
      switch (subPeriodUnit) {
          case 'day': return monthlyTotalForScope / getDaysInMonth(subIntervalStartDate.getFullYear(), subIntervalStartDate.getMonth());
          case 'month': return monthlyTotalForScope;
          default: return 0;
      }
  }, []);


  useEffect(() => {
    const generateData = (): ProfitChartDataPoint[] => {
        const data: ProfitChartDataPoint[] = [];
        const now = new Date();
        let subPeriodUnit: 'day' | 'month';
        let startDate: Date, endDate: Date;
        
        switch (period) {
            case 'today': subPeriodUnit = 'day'; startDate = new Date(now.setHours(0,0,0,0)); endDate = new Date(now.setHours(23,59,59,999)); break;
            case 'this_week': subPeriodUnit = 'day'; 
                startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); startDate.setHours(0,0,0,0);
                endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
                break;
            case 'this_month': subPeriodUnit = 'day'; startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999); break;
            case 'this_quarter': subPeriodUnit = 'month'; const q = Math.floor(now.getMonth()/3); startDate = new Date(now.getFullYear(), q*3, 1); endDate = new Date(now.getFullYear(), q*3+3, 0, 23,59,59,999); break;
            case 'this_year': subPeriodUnit = 'month'; startDate = new Date(now.getFullYear(), 0, 1); endDate = new Date(now.getFullYear(), 11, 31, 23,59,59,999); break;
            case 'all_time': subPeriodUnit = 'month'; 
                startDate = orders.length > 0 ? new Date(Math.min(...orders.map(o => new Date(o.createdAt).getTime()))) : new Date();
                startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1); 
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999); 
                break;
            default: return [];
        }

        let currentIterDate = new Date(startDate);
        while(currentIterDate <= endDate) {
            let subStartDate: Date, subEndDate: Date;
            switch(subPeriodUnit) {
                case 'day': subStartDate = new Date(currentIterDate); subEndDate = new Date(currentIterDate); subEndDate.setHours(23,59,59,999); currentIterDate.setDate(currentIterDate.getDate() + 1); break;
                case 'month': subStartDate = new Date(currentIterDate.getFullYear(), currentIterDate.getMonth(), 1); subEndDate = new Date(currentIterDate.getFullYear(), currentIterDate.getMonth()+1, 0, 23,59,59,999); currentIterDate.setMonth(currentIterDate.getMonth() + 1); break;
            }
            
            if (subEndDate > endDate) subEndDate = new Date(endDate);

            const revenueInSub = orders
                .filter(o => { const orderDate = new Date(o.createdAt); return orderDate >= subStartDate && orderDate <= subEndDate; })
                .reduce((sum, o) => sum + o.totalAmount, 0);

            const variableInSub = variableCosts
                .filter(c => { const costDate = new Date(c.date); return costDate >= subStartDate && costDate <= subEndDate; })
                .reduce((sum, c) => sum + c.amount, 0);
            
            const fixedInSub = getFixedCostsForSubInterval(subStartDate, subEndDate, subPeriodUnit, currentScopedMonthlyFixedCostsTotal);
            const totalCostsInSub = variableInSub + fixedInSub;
            const profitInSub = revenueInSub - totalCostsInSub;

            if (revenueInSub > 0 || variableInSub > 0 || (period !== 'all_time' && (subPeriodUnit === 'day' || subPeriodUnit === 'month')) || ((subPeriodUnit === 'month'))) {
                 data.push({
                    name: formatDateForChart(subStartDate, subPeriodUnit),
                    revenue: revenueInSub, totalCosts: totalCostsInSub, profit: profitInSub,
                    variableCosts: variableInSub, fixedCosts: fixedInSub
                });
            }
             if (subPeriodUnit === 'day' && subStartDate > endDate && period !== 'all_time') break; 
             if (subPeriodUnit === 'month' && subStartDate > endDate && period !== 'all_time' && subStartDate.getMonth() > endDate.getMonth() && subStartDate.getFullYear() >= endDate.getFullYear()) break;
        }
        return data;
    };
    setProfitChartData(generateData());
  }, [period, orders, variableCosts, currentScopedMonthlyFixedCostsTotal, getFixedCostsForSubInterval]);


  const handleExportCsv = () => {
    if (profitChartData.length === 0) {
      contextAddNotification({ message: 'Không có dữ liệu để xuất.', type: 'warning' });
      return;
    }
    const headers = ["Kỳ", "Doanh thu", "Tổng chi phí", "Lợi nhuận", "CP Biến đổi", "CP Cố định"];
    const csvRows = [
      headers.join(','),
      ...profitChartData.map(item => [
        `"${item.name}"`,
        item.revenue,
        item.totalCosts,
        item.profit,
        item.variableCosts ?? 0,
        item.fixedCosts ?? 0
      ].join(','))
    ];

    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_cao_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    contextAddNotification({ message: 'Đã bắt đầu tải xuống tệp CSV.', type: 'success' });
  };

  const handleExportPdf = () => {
    if (profitChartData.length === 0) {
      contextAddNotification({ message: 'Không có dữ liệu để xuất.', type: 'warning' });
      return;
    }
    const doc = new jsPDF();
    const periodLabel = periodOptions.find(p => p.value === period)?.label || period;

    doc.text(`Bao cao Tai chinh - Ky: ${periodLabel}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`, 14, 26);
    doc.text(`Tong doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND`, 14, 36);
    doc.text(`Tong chi phi: ${totalCosts.toLocaleString('vi-VN')} VND`, 14, 42);
    doc.text(`Loi nhuan: ${profit.toLocaleString('vi-VN')} VND`, 14, 48);

    const tableColumn = ["Ky", "Doanh thu (VND)", "Tong CP (VND)", "Loi nhuan (VND)"];
    const tableRows = profitChartData.map(item => [
      item.name,
      item.revenue.toLocaleString('vi-VN'),
      item.totalCosts.toLocaleString('vi-VN'),
      item.profit.toLocaleString('vi-VN'),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 55,
    });
    
    doc.save(`Bao_cao_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
    contextAddNotification({ message: 'Đã bắt đầu tải xuống tệp PDF.', type: 'success' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-surface/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-border-base text-sm">
          <p className="font-semibold text-text-heading mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="capitalize">
              {entry.name === 'revenue' ? 'Doanh thu' : entry.name === 'totalCosts' ? 'Tổng chi phí' : entry.name === 'profit' ? 'Lợi nhuận' : entry.name === 'variableCosts' ? 'CP Biến đổi' : 'CP Cố định'}: {entry.value.toLocaleString('vi-VN')} VNĐ
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleSaveVariableCost = (costData: VariableCostInput, reason?: string) => {
    if (!currentUser?.role) return;
    if (editingCost && reason) { 
      updateVariableCost(editingCost.id, costData, reason, currentUser.role);
    } else { 
      addVariableCost(costData);
    }
    setIsCostModalOpen(false); setEditingCost(null);
  };

  const handleOpenEditCostModal = (cost: VariableCost) => { setEditingCost(cost); setIsCostModalOpen(true); };
  const handleOpenDeleteVariableCostModal = (cost: VariableCost) => { setItemToDelete({id: cost.id, name: cost.description, type: 'variableCost'}); setIsDeleteReasonModalOpen(true); };
  const handleConfirmDeleteVariableCost = (reason: string) => { 
    if(itemToDelete && currentUser?.role) {
        deleteVariableCost(itemToDelete.id, reason, currentUser.role);
    }
    setIsDeleteReasonModalOpen(false); setItemToDelete(null); 
  };
  
  const periodOptions = [
    { value: 'today', label: 'Hôm nay' }, { value: 'this_week', label: 'Tuần này' },
    { value: 'this_month', label: 'Tháng này' }, { value: 'this_quarter', label: 'Quý này' },
    { value: 'this_year', label: 'Năm này' }, { value: 'all_time', label: 'Toàn thời gian' }
  ];

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
        if (!process.env.API_KEY) {
            throw new Error("API key is not configured.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const periodLabel = periodOptions.find(p => p.value === period)?.label || 'kỳ đã chọn';
        const topServicesText = revenueByService.length > 0
            ? revenueByService.slice(0, 5).map(s => `    *   ${s.name}: ${s.revenue.toLocaleString('vi-VN')} VNĐ`).join('\n')
            : "    *   Không có dữ liệu doanh thu dịch vụ.";

        const prompt = `Bạn là một chuyên gia phân tích kinh doanh cho chuỗi giặt là ${APP_NAME}.
Dựa trên dữ liệu tài chính cho "${periodLabel}", hãy cung cấp một phân tích sâu sắc, ngắn gọn bằng tiếng Việt.

Tập trung vào:
1.  **Tóm tắt Nhanh:** Tình hình tài chính tổng thể (lãi/lỗ) trong 1-2 câu.
2.  **Động lực Doanh thu:** Dịch vụ nào đang là ngôi sao? Có gì bất thường không?
3.  **Phân tích Chi phí:** Chi phí nào chiếm tỷ trọng lớn nhất? So sánh chi phí biến đổi và cố định.
4.  **Đề xuất Hành động:** 2-3 gợi ý cụ thể, khả thi để chủ cửa hàng có thể cải thiện lợi nhuận.

Sử dụng ngôn ngữ rõ ràng, trực tiếp, dễ hiểu. Định dạng kết quả bằng markdown với tiêu đề đậm và gạch đầu dòng.

**Dữ liệu Tài chính cho "${periodLabel}"**

*   **Hiệu suất Tổng thể:**
    *   Tổng Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VNĐ
    *   Tổng Chi phí: ${totalCosts.toLocaleString('vi-VN')} VNĐ
    *   Lợi nhuận: ${profit.toLocaleString('vi-VN')} VNĐ

*   **Cơ cấu Chi phí:**
    *   Tổng Chi phí Biến đổi: ${totalVariableCostsAmountInPeriod.toLocaleString('vi-VN')} VNĐ
    *   Chi phí Cố định (Ước tính cho kỳ): ${currentPeriodFixedCosts.toLocaleString('vi-VN')} VNĐ

*   **Dịch vụ tạo Doanh thu hàng đầu:**
${topServicesText}

Hãy bắt đầu phân tích của bạn:`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        setAiAnalysis(response.text);

    } catch (err) {
        const message = err instanceof Error ? err.message : "Lỗi không xác định";
        console.error("AI Analysis Error:", err);
        setAiError(`Không thể tạo phân tích: ${message}`);
        contextAddNotification({ message: `Lỗi AI Analyst: ${message}`, type: 'error' });
    } finally {
        setIsAiLoading(false);
    }
  };


  const renderSectionButton = (section: ActiveReportSection, label: string, icon: React.ReactNode) => (
    <Button
        variant={activeSection === section ? 'primary' : 'ghost'}
        onClick={() => setActiveSection(section)}
        className="w-full justify-center py-2.5"
        leftIcon={React.cloneElement(icon as React.ReactElement<{ size?: number; className?: string }>, {size: 18, className: `mr-2 ${activeSection === section ? '' : 'text-brand-primary'}`})}
    >
        {label}
    </Button>
  );
  const SectionHeader: React.FC<{title: string; icon: React.ReactNode}> = ({title, icon}) => (
    <h2 className="text-xl font-semibold text-text-heading mb-4 flex items-center">
        {React.cloneElement(icon as React.ReactElement<{ size?: number; className?: string }>, {size: 22, className: "mr-2"})}
        {title} <span className="text-sm font-normal text-text-muted ml-2">({periodOptions.find(p=>p.value === period)?.label})</span>
        {currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport !== 'all' && (
            <span className="text-sm font-normal text-purple-500 ml-2">
                (Cửa hàng: {users.find(u=>u.id === selectedStoreOwnerIdForReport)?.name || 'Không rõ'})
            </span>
        )}
    </h2>
  );
  
  const availablePeriodOptions = useMemo(() => {
    if (currentUser?.role === UserRole.STAFF) return periodOptions.filter(p => p.value === 'today' || p.value === 'this_week');
    return periodOptions;
  }, [currentUser]);

  const canManageFixedCosts = (currentUser?.role === UserRole.OWNER) || (currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport !== 'all');
  const canViewCosts = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.MANAGER || currentUser?.role === UserRole.CHAIRMAN;
  const canViewProfit = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.CHAIRMAN;
  const canManageVariableCosts = currentUser && (currentUser.role !== UserRole.CUSTOMER); 
  const canDeleteVariableCosts = currentUser && (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.OWNER || currentUser.role === UserRole.CHAIRMAN);

  const lastFixedCostUpdate = fixedCostsUpdateHistory.length > 0 ? fixedCostsUpdateHistory[0] : null;


  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-5 pb-5 border-b border-border-base">
          <h1 className="text-2xl font-bold text-text-heading mb-3 sm:mb-0 flex items-center">
            <BarChart3Icon size={28} className="mr-3 text-brand-primary"/>Báo cáo Tài chính & Hoạt động
          </h1>
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            {currentUser?.role === UserRole.CHAIRMAN && (
                 <Select
                    label="Xem theo Cửa hàng"
                    options={storeOptionsForChairman}
                    value={selectedStoreOwnerIdForReport}
                    onChange={e => setSelectedStoreOwnerIdForReport(e.target.value)}
                    wrapperClassName="flex-grow sm:flex-grow-0 sm:w-56"
                    leftIcon={<BuildingIcon size={16}/>}
                />
            )}
            <Select
              label="Chọn kỳ báo cáo"
              options={availablePeriodOptions}
              value={period}
              onChange={e => setPeriod(e.target.value as ReportPeriod)}
              wrapperClassName="flex-grow sm:flex-grow-0 sm:w-48"
            />
             <Button variant="secondary" onClick={handleExportCsv} leftIcon={<DownloadIcon size={16}/>}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={handleExportPdf} leftIcon={<DownloadIcon size={16}/>}>
              Export PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {renderSectionButton('revenue', 'Doanh thu', <TrendingUp className="text-status-success"/>)}
          {canViewCosts && renderSectionButton('costs', 'Chi phí', <ArrowDownCircle className="text-status-danger"/>)}
          {canViewProfit && renderSectionButton('profit', 'Lợi nhuận', <DollarSignIcon className="text-brand-primary"/>)}
        </div>
      </Card>
      
      {canViewProfit && (
        <Card>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <h2 className="text-xl font-semibold text-text-heading mb-3 sm:mb-0 flex items-center">
              <SparklesIcon size={22} className="mr-2 text-brand-accent" />
              Chuyên gia Phân tích AI
            </h2>
            <Button onClick={handleAiAnalysis} disabled={isAiLoading} leftIcon={isAiLoading ? <Spinner size="sm"/> : <SparklesIcon size={16}/>}>
              {isAiLoading ? "Đang phân tích..." : "Phân tích Dữ liệu Hiện tại"}
            </Button>
          </div>
          <div className="mt-4 border-t border-border-base pt-4">
            {isAiLoading && <div className="flex justify-center items-center h-40"><Spinner /></div>}
            {aiError && <p className="text-status-danger-text text-center p-4">{aiError}</p>}
            {!isAiLoading && !aiError && aiAnalysis && (
                 <div className="prose prose-sm max-w-none text-text-body whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\* (.*?)(?=\n\*|\n\n|$)/g, '<li>$1</li>').replace(/<li>/g, '<li class="list-disc ml-4">') }}>
                 </div>
            )}
            {!isAiLoading && !aiError && !aiAnalysis && <p className="text-text-muted text-center p-4">Nhấp vào nút phân tích để nhận thông tin chi tiết từ AI.</p>}
          </div>
        </Card>
      )}

      {activeSection === 'revenue' && (
        <Card>
          <SectionHeader title="Báo cáo Doanh thu" icon={<TrendingUp className="text-status-success"/>} />
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-center">
                <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-600 font-medium">Tổng doanh thu</p>
                    <p className="text-3xl font-bold text-emerald-700">{totalRevenue.toLocaleString('vi-VN')} VNĐ</p>
                </div>
                <div className="p-4 bg-sky-50 rounded-lg">
                    <p className="text-sm text-sky-600 font-medium">Tổng số đơn hàng</p>
                    <p className="text-3xl font-bold text-sky-700">{totalRevenueOrdersCount}</p>
                </div>
            </div>

             <h3 className="text-lg font-semibold text-text-heading mb-3 mt-8">Doanh thu theo Dịch vụ</h3>
            {revenueByService.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {revenueByService.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-bg-subtle/40 rounded-md text-sm">
                            <span className="text-text-body">{item.name} ({item.count})</span>
                            <span className="font-semibold text-text-heading">{item.revenue.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                    ))}
                </div>
            ) : <p className="text-text-muted">Không có dữ liệu doanh thu theo dịch vụ.</p>}
        </Card>
      )}

      {activeSection === 'costs' && canViewCosts && (
        <Card>
          <SectionHeader title="Báo cáo Chi phí" icon={<ArrowDownCircle className="text-status-danger"/>} />
          
          {canManageFixedCosts && (
            <Card title="Chi phí cố định hàng tháng" className="mb-8 !bg-rose-50 border-l-4 border-status-danger"
              actions={
                <Button onClick={handleOpenFixedCostReasonModal} leftIcon={<SaveIcon size={16}/>} size="sm" disabled={currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all'}>Lưu CĐ</Button>
              }
            >
              <div className="space-y-3">
                {editableFixedCosts.map(cost => (
                  <div key={cost.id} className="flex items-center justify-between">
                    <label htmlFor={`fixed-${cost.id}`} className="text-sm text-text-body flex-1">{cost.name}:</label>
                    <Input 
                      id={`fixed-${cost.id}`} type="number" 
                      value={cost.amount === 0 && editableFixedCosts.find(c=>c.id === cost.id)?.amount.toString() !== "0" && editableFixedCosts.find(c=>c.id === cost.id)?.amount.toString() !== "" ? "" : cost.amount.toString()} 
                      onChange={e => handleFixedCostChange(cost.id, e.target.value)} 
                      className="w-36 text-right py-1 px-2 text-sm" placeholder="0"
                      disabled={currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all'}
                    />
                    <span className="ml-2 text-sm text-text-muted">VNĐ</span>
                  </div>
                ))}
                 {editableFixedCosts.length === 0 && (
                    <p className="text-sm text-text-muted">
                        {currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all' 
                            ? "Chọn một cửa hàng cụ thể để xem và quản lý chi phí cố định."
                            : "Chưa có chi phí cố định nào cho phạm vi này."
                        }
                    </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border-base flex justify-between font-bold text-text-heading">
                <span>Tổng chi phí cố định hàng tháng (hiển thị):</span>
                <span>{editableFixedCosts.reduce((s,c)=> s + Number(c.amount || 0), 0).toLocaleString('vi-VN')} VNĐ</span>
              </div>
               {lastFixedCostUpdate && (
                 <div className="mt-3 pt-3 border-t border-dashed border-border-base text-xs text-text-muted">
                    <p className="flex items-center"><InfoIcon size={14} className="mr-1.5 text-sky-500"/>Cập nhật lần cuối (cho phạm vi này): {new Date(lastFixedCostUpdate.timestamp).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})} bởi {lastFixedCostUpdate.changedBy}</p>
                    <p className="flex items-start mt-0.5"><MessageSquareIcon size={14} className="mr-1.5 text-sky-500 mt-0.5 flex-shrink-0"/>Lý do: <span className="italic">{lastFixedCostUpdate.reason}</span></p>
                 </div>
               )}
            </Card>
          )}
           <Card title="Chi phí biến đổi" 
            actions={canManageVariableCosts && 
                <Button onClick={() => {setEditingCost(null); setIsCostModalOpen(true);}} leftIcon={<PlusCircleIcon size={16}/>} size="sm" disabled={currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all'}>Thêm mới</Button>
            }
           >
            {displayedVariableCostsByPeriod.length > 0 ? (
                <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-bg-subtle">
                            <tr>
                                <th className="p-2 text-left font-semibold text-text-muted"><FileTextIcon size={14} className="inline mr-1"/>Mô tả</th>
                                <th className="p-2 text-left font-semibold text-text-muted"><DollarSignIcon size={14} className="inline mr-1"/>Số tiền</th>
                                <th className="p-2 text-left font-semibold text-text-muted"><CalendarIcon size={14} className="inline mr-1"/>Ngày</th>
                                <th className="p-2 text-left font-semibold text-text-muted"><TagIcon size={14} className="inline mr-1"/>Loại</th>
                                {currentUser?.role !== UserRole.STAFF && <th className="p-2 text-left font-semibold text-text-muted"><SettingsIcon size={14} className="inline mr-1"/>H.Động</th>}
                            </tr>
                        </thead>
                        <tbody>
                        {displayedVariableCostsByPeriod.map(cost => (
                            <tr key={cost.id} className="border-b border-border-base hover:bg-bg-surface-hover">
                                <td className="p-2 text-text-body">{cost.description}</td>
                                <td className="p-2 text-text-body text-right">{cost.amount.toLocaleString('vi-VN')}</td>
                                <td className="p-2 text-text-muted">{new Date(cost.date).toLocaleDateString('vi-VN')}</td>
                                <td className="p-2 text-text-body">{cost.category}</td>
                                {currentUser?.role !== UserRole.STAFF && 
                                    <td className="p-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditCostModal(cost)} className="p-1 mr-1" title="Sửa" disabled={currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all'}><EditIcon size={16}/></Button>
                                        {canDeleteVariableCosts && 
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenDeleteVariableCostModal(cost)} className="p-1 text-status-danger" title="Xóa" disabled={currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForReport === 'all'}><Trash2Icon size={16}/></Button>
                                        }
                                    </td>
                                }
                            </tr>
                         ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="text-text-muted text-center py-4">Không có chi phí biến đổi nào trong kỳ này.</p>}
            <div className="mt-4 pt-3 border-t border-border-base flex justify-between font-bold text-text-heading">
                <span>Tổng chi phí biến đổi ({periodOptions.find(p=>p.value===period)?.label}):</span>
                <span>{totalVariableCostsAmountInPeriod.toLocaleString('vi-VN')} VNĐ</span>
            </div>
           </Card>
        </Card>
      )}
      
      {activeSection === 'profit' && canViewProfit && (
        <Card>
          <SectionHeader title="Báo cáo Lợi nhuận" icon={<DollarSignIcon className="text-brand-primary"/>} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600">Doanh thu</p>
                    <p className="text-xl font-semibold text-emerald-700">{totalRevenue.toLocaleString('vi-VN')} VNĐ</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg">
                    <p className="text-xs text-rose-600">Tổng chi phí</p>
                    <p className="text-xl font-semibold text-rose-700">{totalCosts.toLocaleString('vi-VN')} VNĐ</p>
                </div>
                <div className={`p-3 rounded-lg ${profit >= 0 ? 'bg-sky-50' : 'bg-orange-100'}`}>
                    <p className={`text-xs ${profit >= 0 ? 'text-sky-600' : 'text-orange-600'}`}>Lợi nhuận</p>
                    <p className={`text-xl font-semibold ${profit >= 0 ? 'text-sky-700' : 'text-orange-700'}`}>{profit.toLocaleString('vi-VN')} VNĐ</p>
                </div>
            </div>
          
          <h3 className="text-lg font-semibold text-text-heading mb-3 mt-6">Biểu đồ Lợi nhuận, Doanh thu & Chi phí</h3>
          <div className="h-80 md:h-96">
            <ResponsiveContainer width="100%" height="100%" key={chartKey}>
              <BarChart data={profitChartData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartColors.text }} />
                <YAxis tick={{ fontSize: 11, fill: chartColors.text }} tickFormatter={(value) => `${(value/1000000).toFixed(1)}tr`} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(203, 213, 225, 0.3)'}}/>
                <Legend wrapperStyle={{fontSize: "12px"}}/>
                <Bar dataKey="revenue" fill={chartColors.revenue} name="Doanh thu" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalCosts" fill={chartColors.costs} name="Tổng CP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill={chartColors.profit} name="Lợi nhuận" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {!canViewProfit && activeSection === 'profit' && (
        <Card>
            <SectionHeader title="Báo cáo Lợi nhuận" icon={<EyeOffIcon className="text-text-muted"/>} />
            <p className="text-center text-text-muted py-10">Bạn không có quyền xem báo cáo lợi nhuận.</p>
        </Card>
      )}

      <VariableCostModal isOpen={isCostModalOpen} onClose={() => {setIsCostModalOpen(false); setEditingCost(null);}} onSave={handleSaveVariableCost} cost={editingCost} currentUser={currentUser} />
      
      <ReasonConfirmModal 
        isOpen={isDeleteReasonModalOpen} 
        onClose={() => { setIsDeleteReasonModalOpen(false); setItemToDelete(null); }} 
        onConfirm={handleConfirmDeleteVariableCost} 
        title={`Xác nhận xóa Chi phí`} 
        itemName={itemToDelete?.name} 
        actionDescription="Vui lòng nhập lý do bạn muốn xóa chi phí này." 
        confirmButtonText="Xác nhận Xóa" 
        confirmButtonVariant="danger"
        reasonLabel="Lý do xóa*"
        reasonPlaceholder="Nhập lý do xóa..."
      />
      <ReasonConfirmModal 
        isOpen={isFixedCostReasonModalOpen} 
        onClose={() => setIsFixedCostReasonModalOpen(false)} 
        onConfirm={handleConfirmSaveFixedCosts} 
        title="Xác nhận cập nhật Chi phí Cố định" 
        actionDescription="Vui lòng nhập lý do cho việc thay đổi các mục chi phí cố định." 
        confirmButtonText="Lưu thay đổi"
        reasonLabel="Lý do cập nhật*"
        reasonPlaceholder="Nhập lý do cập nhật..."
      />

    </div>
  );
};

export default ReportsPage;