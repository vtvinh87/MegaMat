
import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { User, KPI, KpiPeriodType, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { TrendingUpIcon, UserIcon, CalendarDaysIcon, PercentIcon, StarIcon, RefreshCwIcon, DollarSignIcon, BuildingIcon, LineChartIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

const KpiValueWithTarget: React.FC<{
    value: number;
    target?: number | null;
    format: (val: number) => string;
}> = ({ value, target, format }) => {
    if (target === undefined || target === null) {
        return <span>{format(value)}</span>;
    }
    const meetsTarget = value >= target;
    const colorClass = meetsTarget ? 'text-status-success' : 'text-status-danger';

    return (
        <div className="flex flex-col items-center text-center">
            <span className={`font-semibold text-base ${colorClass}`}>{format(value)}</span>
            <span className="text-xs text-text-muted">M.tiêu: {format(target)}</span>
        </div>
    );
};

const KpiReportPage: React.FC = () => {
  const { users, getKPIs, calculateAndStoreKPIsForAllStaff, getOwnerIdForUser } = useData();
  const { currentUser } = useAuth();
  
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [selectedPeriodType, setSelectedPeriodType] = useState<KpiPeriodType | 'all'>('weekly');
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [trendMetric, setTrendMetric] = useState<keyof NonNullable<User['kpiTargets']>>('onTimeRate');
  
  // For Chairman: store selection
  const [selectedStoreOwnerIdForKpi, setSelectedStoreOwnerIdForKpi] = useState<string | 'all'>('all');
  
  const storeOptionsForChairman = useMemo(() => {
    if (currentUser?.role !== UserRole.CHAIRMAN) return [];
    const owners = users.filter(u => u.role === UserRole.OWNER);
    return [{ value: 'all', label: 'Tất cả cửa hàng' }, ...owners.map(o => ({ value: o.id, label: o.name }))];
  }, [users, currentUser]);

  const staffUserOptions = useMemo(() => {
    let relevantUsers = users.filter(u => u.role === UserRole.STAFF || u.role === UserRole.MANAGER);
    if (currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForKpi !== 'all') {
        relevantUsers = relevantUsers.filter(u => getOwnerIdForUser(u.id, users) === selectedStoreOwnerIdForKpi);
    }
    // For Owner/Manager, users are already filtered by getKPIs based on their own ownerId
    // So, staffUserOptions for them should also be based on their store.
    else if (currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.MANAGER) {
        const currentOwnerId = getOwnerIdForUser(currentUser.id, users);
        relevantUsers = relevantUsers.filter(u => getOwnerIdForUser(u.id, users) === currentOwnerId);
    }


    return [
      { value: 'all', label: 'Tất cả Nhân viên/QL' },
      ...relevantUsers.map(u => ({ value: u.id, label: `${u.name} (${u.role})`}))
    ];
  }, [users, currentUser, selectedStoreOwnerIdForKpi, getOwnerIdForUser]);
  
  // Reset selectedStaffId if it's no longer valid for the selected store
  useEffect(() => {
    if (selectedStoreOwnerIdForKpi !== 'all' && selectedStaffId !== 'all') {
      const staffStillInScope = staffUserOptions.some(opt => opt.value === selectedStaffId);
      if (!staffStillInScope) {
        setSelectedStaffId('all');
      }
    }
  }, [selectedStoreOwnerIdForKpi, selectedStaffId, staffUserOptions]);


  const kpiPeriodOptions: { value: KpiPeriodType | 'all'; label: string }[] = [
    { value: 'all', label: 'Tất cả các kỳ' },
    { value: 'daily', label: 'Hàng ngày' },
    { value: 'weekly', label: 'Hàng tuần' },
    { value: 'monthly', label: 'Hàng tháng' },
  ];
  
  const trendMetricOptions = [
    { value: 'onTimeRate', label: 'Tỷ lệ đúng hạn' },
    { value: 'avgRating', label: 'Đánh giá TB' },
    { value: 'ordersProcessed', label: 'Số đơn xử lý' },
    { value: 'totalTipAmount', label: 'Tiền Tip' },
  ];


  const displayedKpis = useMemo(() => {
    const ownerFilterForGetKPIs = (currentUser?.role === UserRole.CHAIRMAN && selectedStoreOwnerIdForKpi !== 'all') 
                                  ? selectedStoreOwnerIdForKpi 
                                  : undefined;
    return getKPIs({
      userId: selectedStaffId === 'all' ? undefined : selectedStaffId,
      periodType: selectedPeriodType === 'all' ? undefined : selectedPeriodType,
      ownerIdFilter: ownerFilterForGetKPIs,
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [getKPIs, selectedStaffId, selectedPeriodType, currentUser, selectedStoreOwnerIdForKpi]);
  
  const trendChartData = useMemo(() => {
      if (selectedStaffId === 'all') return [];
      // Filter for the specific staff and sort chronologically for the chart
      return displayedKpis
        .filter(kpi => kpi.userId === selectedStaffId)
        .slice() // Create a shallow copy to avoid mutating the original
        .reverse(); // Sort ascending by date
  }, [displayedKpis, selectedStaffId]);

  const selectedUserForChart = useMemo(() => users.find(u => u.id === selectedStaffId), [users, selectedStaffId]);
  const targetValueForChart = selectedUserForChart?.kpiTargets?.[trendMetric];


  const handleRefreshKpis = async () => {
    setIsLoadingKpis(true);
    await calculateAndStoreKPIsForAllStaff('weekly', new Date());
    await calculateAndStoreKPIsForAllStaff('monthly', new Date());
    setIsLoadingKpis(false);
  };
  
  useEffect(() => {
    handleRefreshKpis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  if (currentUser?.role === UserRole.CUSTOMER || currentUser?.role === UserRole.STAFF) {
      return (
        <Card title="Truy cập bị từ chối">
            <p className="text-center text-text-muted">Bạn không có quyền xem trang này.</p>
        </Card>
      );
  }

  const tableHeaders = [
    { label: "Nhân viên", icon: <UserIcon size={14} /> },
    { label: "Kỳ KPI", icon: <CalendarDaysIcon size={14} /> },
    { label: "Số đơn xử lý", icon: <TrendingUpIcon size={14} /> },
    { label: "Tỷ lệ đúng hạn", icon: <PercentIcon size={14} /> },
    { label: "Đánh giá TB", icon: <StarIcon size={14} /> },
    { label: "Số tiền Tip", icon: <DollarSignIcon size={14} /> },
    { label: "Ngày tính KPI", icon: <CalendarDaysIcon size={14}/>}
  ];
   if (currentUser?.role === UserRole.CHAIRMAN) {
    tableHeaders.unshift({ label: "Cửa hàng", icon: <BuildingIcon size={14}/> });
  }


  return (
    <div className="space-y-6">
      <Card 
          title="Báo cáo Chỉ số Hiệu suất Nhân viên (KPI)"
          actions={
              <Button onClick={handleRefreshKpis} disabled={isLoadingKpis} leftIcon={<RefreshCwIcon size={16} className={isLoadingKpis ? 'animate-spin' : ''} />}>
                  {isLoadingKpis ? 'Đang làm mới...' : 'Làm mới dữ liệu KPI'}
              </Button>
          }
      >
        <div className={`grid grid-cols-1 md:grid-cols-${currentUser?.role === UserRole.CHAIRMAN ? '3' : '2'} gap-4 mb-6`}>
          {currentUser?.role === UserRole.CHAIRMAN && (
              <Select
                  label="Xem theo Cửa hàng"
                  options={storeOptionsForChairman}
                  value={selectedStoreOwnerIdForKpi}
                  onChange={e => setSelectedStoreOwnerIdForKpi(e.target.value)}
                  leftIcon={<BuildingIcon size={16}/>}
              />
          )}
          <Select
            label="Chọn Nhân viên/QL"
            options={staffUserOptions}
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
          />
          <Select
            label="Chọn Loại kỳ KPI"
            options={kpiPeriodOptions}
            value={selectedPeriodType}
            onChange={e => setSelectedPeriodType(e.target.value as KpiPeriodType | 'all')}
          />
        </div>

        {isLoadingKpis && <p className="text-center text-text-muted py-4">Đang tải dữ liệu KPI...</p>}

        {!isLoadingKpis && displayedKpis.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có dữ liệu KPI nào phù hợp.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle/50">
                <tr>
                  {tableHeaders.map(header => (
                    <th key={header.label} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <div className="flex items-center">
                        {React.cloneElement(header.icon as React.ReactElement<{ className?: string }>, { className: "mr-1.5 flex-shrink-0" })}
                        <span>{header.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-bg-surface divide-y divide-border-base">
                {displayedKpis.map(kpi => {
                    const userForKpi = users.find(u => u.id === kpi.userId);
                    const targets = userForKpi?.kpiTargets;
                    return (
                        <tr key={kpi.id} className="hover:bg-bg-surface-hover transition-colors">
                        {currentUser?.role === UserRole.CHAIRMAN && (
                            <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{users.find(u => u.id === kpi.ownerId)?.name || 'N/A'}</td>
                        )}
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{kpi.user?.name || 'Không rõ'}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{kpi.periodDisplay}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-center">
                            <KpiValueWithTarget value={kpi.ordersProcessed} target={targets?.ordersProcessed} format={v => v.toString()} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-center">
                            <KpiValueWithTarget value={kpi.onTimeRate} target={targets?.onTimeRate} format={v => v.toFixed(1) + '%'} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-center">
                            <KpiValueWithTarget value={kpi.avgRating} target={targets?.avgRating} format={v => v.toFixed(2) + ' ★'} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-center">
                            <KpiValueWithTarget value={kpi.totalTipAmount} target={targets?.totalTipAmount} format={v => v.toLocaleString('vi-VN') + ' VNĐ'} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-text-muted">{new Date(kpi.createdAt).toLocaleDateString('vi-VN')}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      {selectedStaffId !== 'all' && trendChartData.length > 0 && (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-xl font-semibold text-text-heading mb-2 sm:mb-0 flex items-center">
                    <LineChartIcon size={22} className="mr-2 text-brand-primary"/>
                    Biểu đồ Xu hướng KPI cho {selectedUserForChart?.name}
                </h2>
                <Select
                    label="Chọn chỉ số"
                    options={trendMetricOptions}
                    value={trendMetric}
                    onChange={e => setTrendMetric(e.target.value as keyof NonNullable<User['kpiTargets']>)}
                    wrapperClassName="w-full sm:w-56"
                />
            </div>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodDisplay" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <Tooltip
                        formatter={(value: number) => [
                            trendMetric === 'onTimeRate' ? `${value.toFixed(1)}%` :
                            trendMetric === 'avgRating' ? `${value.toFixed(2)} ★` :
                            value.toLocaleString('vi-VN'),
                            trendMetricOptions.find(o => o.value === trendMetric)?.label
                        ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey={trendMetric} name={trendMetricOptions.find(o => o.value === trendMetric)?.label} stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
                    {targetValueForChart !== undefined && (
                        <ReferenceLine y={targetValueForChart} label={`Mục tiêu: ${targetValueForChart}`} stroke="red" strokeDasharray="4 4" />
                    )}
                    </LineChart>
                </ResponsiveContainer>
             </div>
        </Card>
      )}
    </div>
  );
};

export default KpiReportPage;
