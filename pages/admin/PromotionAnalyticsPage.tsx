import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Promotion, Order, UserRole, User } from '../../types';
import { ArrowLeftIcon, TagIcon, BarChart2Icon, Users, ClipboardListIcon, TrendingUpIcon, Percent, DollarSign, Calendar, InfoIcon, CheckCircle, XCircle, BuildingIcon } from 'lucide-react';

const KpiCard: React.FC<{ title: string; value: string; subValue?: string; icon: React.ReactNode }> = ({ title, value, subValue, icon }) => (
    <Card className="!shadow-sm">
        <div className="flex items-center space-x-4">
            <div className="p-3 bg-brand-primary/10 rounded-full">
                {icon}
            </div>
            <div>
                <p className="text-sm text-text-muted">{title}</p>
                <p className="text-2xl font-bold text-text-heading">{value}</p>
                {subValue && <p className="text-xs text-text-muted">{subValue}</p>}
            </div>
        </div>
    </Card>
);

const PromotionAnalyticsPage: React.FC = () => {
    const { id: promotionId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { promotions, orders: allOrders, users } = useData(); // Use unfiltered orders
    const { currentUser } = useAuth();

    const promotion = useMemo(() => {
        // Chairman needs to see all promotions, while owners/managers see theirs (already filtered by context)
        // For simplicity, we search the full list and verify ownership later if needed.
        return promotions.find(p => p.id === promotionId);
    }, [promotionId, promotions]);
    
    const isChairman = currentUser?.role === UserRole.CHAIRMAN;

    const analytics = useMemo(() => {
        if (!promotion) return null;
        
        // Chairman sees all orders for the promo, Owner/Manager sees only their store's orders (handled by `useData` filter)
        const promotionalOrders = allOrders.filter(o => o.appliedPromotionId === promotion.id);
        const regularOrders = allOrders.filter(o => !o.appliedPromotionId && o.ownerId === promotion.ownerId);

        const redemptionCount = promotionalOrders.length;
        const totalDiscount = promotionalOrders.reduce((sum, o) => sum + (o.promotionDiscountAmount || 0), 0);
        const revenueGenerated = promotionalOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const promotionalAOV = redemptionCount > 0 ? revenueGenerated / redemptionCount : 0;
        
        const totalRegularRevenue = regularOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const regularAOV = regularOrders.length > 0 ? totalRegularRevenue / regularOrders.length : 0;

        const customerUsage = promotionalOrders.reduce((acc, order) => {
            const existing = acc.find(item => item.customerId === order.customer.id);
            if (existing) {
                existing.count += 1;
                existing.totalSpent += order.totalAmount;
            } else {
                acc.push({ customerId: order.customer.id, customerName: order.customer.name, count: 1, totalSpent: order.totalAmount });
            }
            return acc;
        }, [] as { customerId: string; customerName: string; count: number; totalSpent: number }[]);
        
        const customerBreakdown = customerUsage.sort((a, b) => b.count - a.count || b.totalSpent - a.totalSpent);
        
        // --- Chairman-specific: Breakdown by store ---
        let storeBreakdown: { storeOwnerId: string; storeName: string; redemptionCount: number; totalDiscount: number; revenueGenerated: number; }[] = [];
        if (isChairman && promotion.isSystemWide) {
            const ordersByStore = promotionalOrders.reduce((acc, order) => {
                (acc[order.ownerId] = acc[order.ownerId] || []).push(order);
                return acc;
            }, {} as Record<string, Order[]>);

            storeBreakdown = Object.entries(ordersByStore).map(([ownerId, storeOrders]) => {
                const storeName = users.find(u => u.id === ownerId)?.name || `Cửa hàng ID: ${ownerId.slice(-4)}`;
                return {
                    storeOwnerId: ownerId,
                    storeName: storeName,
                    redemptionCount: storeOrders.length,
                    totalDiscount: storeOrders.reduce((sum, o) => sum + (o.promotionDiscountAmount || 0), 0),
                    revenueGenerated: storeOrders.reduce((sum, o) => sum + o.totalAmount, 0),
                };
            }).sort((a,b) => b.revenueGenerated - a.revenueGenerated);
        }

        return {
            promotionalOrders, redemptionCount, totalDiscount, revenueGenerated,
            promotionalAOV, regularAOV, customerBreakdown, storeBreakdown
        };
    }, [promotion, allOrders, isChairman, users]);

    if (!promotion) {
        return ( <Card title="Không tìm thấy"><p>...</p></Card> ); // Shortened for brevity
    }
    
    if (!analytics) return null;

    return (
        <div className="space-y-6">
            <Button variant="link" onClick={() => navigate('/admin/promotions')} className="pl-0">
                <ArrowLeftIcon size={18} className="mr-2" /> Quay lại danh sách
            </Button>
            
            <Card title="Tổng quan Phân tích Khuyến mãi" icon={<BarChart2Icon size={22} className="text-brand-primary" />}>
                 <h2 className="text-2xl font-bold text-text-heading">{promotion.name}</h2>
                 <p className="font-mono text-lg text-brand-primary bg-blue-500/10 px-3 py-1 rounded-md inline-block my-2">{promotion.code}</p>
                 <div className="text-sm text-text-body mt-2">
                    <strong>Chi tiết:</strong> Giảm {promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : `${promotion.discountValue.toLocaleString('vi-VN')} VNĐ`}{promotion.discountType === 'percentage' && promotion.maxDiscountAmount ? `, tối đa ${promotion.maxDiscountAmount.toLocaleString('vi-VN')} VNĐ` : ''}{promotion.minOrderAmount ? ` cho đơn từ ${promotion.minOrderAmount.toLocaleString('vi-VN')} VNĐ.` : '.'}
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t border-border-base">
                    <div className="flex items-center"><InfoIcon size={16} className="mr-2 text-text-muted" /> Trạng thái: {promotion.isActive ? <span className="flex items-center text-status-success ml-1"><CheckCircle size={14} className="mr-1"/>Hoạt động</span> : <span className="flex items-center text-status-danger ml-1"><XCircle size={14} className="mr-1"/>Không hoạt động</span>}</div>
                    <div className="flex items-center"><Calendar size={16} className="mr-2 text-text-muted" /> Bắt đầu: {promotion.startDate ? new Date(promotion.startDate).toLocaleDateString('vi-VN') : 'N/A'}</div>
                    <div className="flex items-center"><Calendar size={16} className="mr-2 text-text-muted" /> Kết thúc: {promotion.endDate ? new Date(promotion.endDate).toLocaleDateString('vi-VN') : 'N/A'}</div>
                 </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Lượt sử dụng" value={`${analytics.redemptionCount}`} subValue={`trên ${promotion.usageLimit || '∞'} giới hạn`} icon={<Users size={24} className="text-brand-primary" />} />
                <KpiCard title="Tổng giảm giá" value={`${analytics.totalDiscount.toLocaleString('vi-VN')} VNĐ`} icon={<DollarSign size={24} className="text-brand-primary" />} />
                <KpiCard title="Doanh thu tạo ra" value={`${analytics.revenueGenerated.toLocaleString('vi-VN')} VNĐ`} icon={<TrendingUpIcon size={24} className="text-brand-primary" />} />
                <KpiCard title="AOV (Khuyến mãi)" value={`${analytics.promotionalAOV.toLocaleString('vi-VN')} VNĐ`} subValue={`So với ${analytics.regularAOV.toLocaleString('vi-VN')} VNĐ (thường)`} icon={<Percent size={24} className="text-brand-primary" />} />
            </div>
            
            {isChairman && promotion.isSystemWide && (
                 <Card title="Phân tích Hiệu suất theo Cửa hàng" icon={<BuildingIcon size={20} className="text-brand-primary" />}>
                     <div className="overflow-x-auto rounded-lg border border-border-base max-h-80">
                        <table className="min-w-full divide-y divide-border-base text-sm">
                            <thead className="bg-bg-subtle/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-text-muted">Cửa hàng</th>
                                    <th className="px-4 py-2 text-left font-semibold text-text-muted">Lượt sử dụng</th>
                                    <th className="px-4 py-2 text-left font-semibold text-text-muted">Doanh thu (KM)</th>
                                    <th className="px-4 py-2 text-left font-semibold text-text-muted">Tổng giảm giá</th>
                                </tr>
                            </thead>
                            <tbody className="bg-bg-surface divide-y divide-border-base">
                                {analytics.storeBreakdown.map(item => (
                                    <tr key={item.storeOwnerId} className="hover:bg-bg-surface-hover">
                                        <td className="px-4 py-2 font-medium">{item.storeName}</td>
                                        <td className="px-4 py-2 text-center">{item.redemptionCount}</td>
                                        <td className="px-4 py-2 text-right">{item.revenueGenerated.toLocaleString('vi-VN')} VNĐ</td>
                                        <td className="px-4 py-2 text-right text-status-danger-text">{item.totalDiscount.toLocaleString('vi-VN')} VNĐ</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                </Card>
            )}

            <Card title="Phân tích Khách hàng" icon={<Users size={20} className="text-brand-primary" />}>
                 <div className="overflow-x-auto rounded-lg border border-border-base max-h-80">
                    <table className="min-w-full divide-y divide-border-base text-sm">
                        <thead className="bg-bg-subtle/50 sticky top-0"><tr><th className="px-4 py-2 text-left font-semibold text-text-muted">Tên Khách hàng</th><th className="px-4 py-2 text-left font-semibold text-text-muted">Số lần sử dụng</th><th className="px-4 py-2 text-left font-semibold text-text-muted">Tổng chi tiêu (với KM)</th></tr></thead>
                        <tbody className="bg-bg-surface divide-y divide-border-base">{analytics.customerBreakdown.map(item => (<tr key={item.customerId} className="hover:bg-bg-surface-hover"><td className="px-4 py-2 font-medium">{item.customerName}</td><td className="px-4 py-2 text-center">{item.count}</td><td className="px-4 py-2 text-right">{item.totalSpent.toLocaleString('vi-VN')} VNĐ</td></tr>))}</tbody>
                    </table>
                 </div>
            </Card>

            <Card title="Các Đơn hàng đã áp dụng" icon={<ClipboardListIcon size={20} className="text-brand-primary" />}>
                <div className="overflow-x-auto rounded-lg border border-border-base max-h-96">
                    <table className="min-w-full divide-y divide-border-base text-sm">
                        <thead className="bg-bg-subtle/50 sticky top-0"><tr><th className="px-4 py-2 text-left font-semibold text-text-muted">Mã ĐH</th><th className="px-4 py-2 text-left font-semibold text-text-muted">Khách hàng</th><th className="px-4 py-2 text-left font-semibold text-text-muted">Ngày</th><th className="px-4 py-2 text-left font-semibold text-text-muted">Tổng tiền</th><th className="px-4 py-2 text-left font-semibold text-text-muted">Giảm giá</th></tr></thead>
                        <tbody className="bg-bg-surface divide-y divide-border-base">{analytics.promotionalOrders.map(order => (<tr key={order.id} className="hover:bg-bg-surface-hover"><td className="px-4 py-2 font-medium text-text-link hover:underline"><Link to={`/admin/orders/${order.id}`}>{order.id}</Link></td><td className="px-4 py-2">{order.customer.name}</td><td className="px-4 py-2">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td><td className="px-4 py-2 text-right">{order.totalAmount.toLocaleString('vi-VN')} VNĐ</td><td className="px-4 py-2 text-right text-status-success-text">{order.promotionDiscountAmount?.toLocaleString('vi-VN')} VNĐ</td></tr>))}</tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default PromotionAnalyticsPage;