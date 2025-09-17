import React, { useState, useMemo, ChangeEvent, FormEvent, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Promotion, UserRole, Order, User, ServiceItem, WashMethodDefinition } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { GoogleGenAI, Type } from '@google/genai';
import { Spinner } from '../../components/ui/Spinner';
import { PlusCircleIcon, EditIcon, Trash2Icon, SearchIcon, TagIcon, Percent, DollarSign, Calendar, AlertTriangle, CheckCircle, XCircle, BarChart2, TrendingUp, Users, SparklesIcon, Building, ShieldCheck, ShieldAlert, ShieldOff, BanIcon, HelpCircleIcon, Settings2Icon, DropletsIcon, MegaphoneIcon, FlagIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';


// Generic Reason Modal Component
const ReasonModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  label: string;
  placeholder: string;
  confirmText: string;
}> = ({ isOpen, onClose, onConfirm, title, label, placeholder, confirmText }) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); onConfirm(reason); }}>
        <Input isTextArea rows={4} label={label} value={reason} onChange={e => setReason(e.target.value)} placeholder={placeholder} required />
        <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={!reason.trim()}>{confirmText}</Button>
        </div>
      </form>
    </Modal>
  );
};


const PromotionCard: React.FC<{
  promotion: Promotion;
  orders: Order[];
  users: User[];
  currentUser: User;
  onEdit: (p: Promotion) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRequestOptOut: (id: string, reason: string) => void;
  onRespondToOptOut: (promoId: string, ownerId: string, response: 'approved' | 'rejected', reason?: string) => void;
  onRequestCancellation: (id: string, reason: string) => void;
  onRespondToCancellation: (id: string) => void;
  onToggleStatus: (promotion: Promotion) => void;
  onReport: (promotion: Promotion) => void;
  onResolveReport: (promotionId: string, reportId: string) => void;
}> = ({ promotion, orders, users, currentUser, onEdit, onDelete, onApprove, onReject, onRequestOptOut, onRespondToOptOut, onRequestCancellation, onRespondToCancellation, onToggleStatus, onReport, onResolveReport }) => {
    
    const [reasonModal, setReasonModal] = useState<'optOut' | 'cancelRequest' | 'rejectOptOut' | 'rejectPromotion' | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [currentOwnerToReject, setCurrentOwnerToReject] = useState<string | null>(null);
    const [isReportDetailModalOpen, setIsReportDetailModalOpen] = useState(false);

    const isChairman = currentUser.role === UserRole.CHAIRMAN;
    const isOwner = currentUser.role === UserRole.OWNER;
    const isManager = currentUser.role === UserRole.MANAGER;
    const isMyStorePromo = promotion.ownerId === currentUser.id;

    const ownerName = useMemo(() => users.find(u => u.id === promotion.ownerId)?.name || 'Không rõ', [users, promotion.ownerId]);
    
    const pendingReports = useMemo(() => promotion.managerReports?.filter(r => r.status === 'pending') || [], [promotion.managerReports]);

    // Status for Owners viewing a system-wide promo
    const myOptOutRequest = useMemo(() => {
        if (!isOwner || !promotion.isSystemWide) return null;
        return promotion.optOutRequests?.find(req => req.storeOwnerId === currentUser.id);
    }, [promotion, isOwner, currentUser.id]);

    // Status for Chairman viewing opt-out requests
    const pendingOptOuts = useMemo(() => {
        if (!isChairman || !promotion.isSystemWide) return [];
        return promotion.optOutRequests?.filter(req => req.status === 'pending') || [];
    }, [promotion, isChairman]);

    // Status for Owners viewing a cancellation request from Chairman
    const myCancellationRequest = useMemo(() => {
        if (!isOwner || promotion.isSystemWide || !isMyStorePromo) return null;
        return promotion.cancellationRequest;
    }, [promotion, isOwner, isMyStorePromo]);

    const handleOpenRejectionModal = (ownerId: string) => {
        setCurrentOwnerToReject(ownerId);
        setRejectionReason('');
        setReasonModal('rejectOptOut');
    };

    const renderStatusBadge = () => {
        if (myOptOutRequest) {
            switch (myOptOutRequest.status) {
                case 'pending': return <span className="flex items-center text-xs text-amber-600 bg-amber-100 p-1.5 rounded-md"><ShieldAlert size={14} className="mr-1"/>Chờ C.Tịch duyệt từ chối</span>;
                case 'approved': return <span className="flex items-center text-xs text-status-danger bg-status-danger-bg p-1.5 rounded-md"><BanIcon size={14} className="mr-1"/>Bạn đã từ chối tham gia</span>;
                case 'rejected': return (
                     <div className="text-xs text-gray-700 bg-gray-200 p-2 rounded-md w-full text-left">
                        <div className="flex items-center font-semibold mb-1">
                            <HelpCircleIcon size={14} className="mr-1.5 flex-shrink-0 text-gray-500"/>
                            <span>Y/c từ chối bị từ chối</span>
                        </div>
                        {myOptOutRequest.rejectionReason && (
                            <p className="pl-5 text-gray-600 italic">
                                Lý do: "{myOptOutRequest.rejectionReason}"
                            </p>
                        )}
                    </div>
                );
            }
        }
        if (myCancellationRequest?.status === 'pending') {
            return <span className="flex items-center text-xs text-amber-600 bg-amber-100 p-1.5 rounded-md"><ShieldAlert size={14} className="mr-1"/>Chờ bạn duyệt hủy</span>;
        }
        if (pendingOptOuts.length > 0) {
             return <span className="flex items-center text-xs text-amber-600 bg-amber-100 p-1.5 rounded-md"><ShieldAlert size={14} className="mr-1"/>{pendingOptOuts.length} cửa hàng chờ duyệt</span>;
        }

        if(promotion.status === 'pending') {
            return <span className="flex items-center text-xs text-amber-600 bg-amber-100 p-1.5 rounded-md"><ShieldAlert size={14} className="mr-1"/>Chờ duyệt</span>;
        }
        if(promotion.status === 'rejected') {
            return <span className="flex items-center text-xs text-red-600 bg-red-100 p-1.5 rounded-md"><XCircle size={14} className="mr-1"/>Đã từ chối</span>;
        }

        return promotion.status === 'active' ? 
            <span className="flex items-center text-xs text-status-success"><CheckCircle size={14} className="mr-1"/>Hoạt động</span> : 
            <span className="flex items-center text-xs text-status-danger"><XCircle size={14} className="mr-1"/>Không hoạt động</span>
    };

    const renderActionButtons = () => {
        const isCreator = promotion.createdBy === currentUser.id;

        switch (promotion.status) {
            case 'pending':
                const canApprove = (isOwner && users.find(u => u.id === promotion.createdBy)?.managedBy === currentUser.id) || (isChairman && users.find(u => u.id === promotion.createdBy)?.role === UserRole.OWNER);
                if (canApprove) {
                    return <>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)} className="p-2 text-blue-500" title="Chỉnh sửa"><EditIcon size={18} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onApprove(promotion.id)} className="p-2 text-status-success" title="Duyệt"><CheckCircle size={18} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setReasonModal('rejectPromotion')} className="p-2 text-status-danger" title="Từ chối"><XCircle size={18} /></Button>
                    </>;
                }
                if (isCreator || (isOwner && isMyStorePromo)) { // Creator or Owner can edit their own pending promos
                    return <>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)} className="p-2" title="Chỉnh sửa"><EditIcon size={18} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="p-2 text-status-danger" title="Xóa"><Trash2Icon size={18} /></Button>
                    </>;
                }
                break;

            case 'active':
            case 'inactive':
                if (isOwner && isMyStorePromo) {
                    const toggleText = promotion.status === 'active' ? 'Tạm dừng' : 'Kích hoạt';
                    return <>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)} className="p-2" title="Chỉnh sửa"><EditIcon size={18} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onToggleStatus(promotion)} className="p-2 text-amber-600" title={toggleText}><ShieldOff size={18} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="p-2 text-status-danger" title="Xóa"><Trash2Icon size={18} /></Button>
                    </>;
                }
                if (isManager && promotion.status === 'active') {
                     return <Button variant="secondary" size="sm" onClick={() => onReport(promotion)} leftIcon={<FlagIcon size={14} />}>Báo cáo</Button>;
                }
                if (isChairman && !promotion.isSystemWide) {
                     return <Button variant="ghost" size="sm" onClick={() => setReasonModal('cancelRequest')} className="p-2 text-amber-600" title="Yêu cầu hủy"><BanIcon size={18} /></Button>;
                }
                break;
            
            case 'rejected':
                if (isCreator) {
                     return <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="p-2 text-status-danger" title="Xóa"><Trash2Icon size={18} /></Button>;
                }
                break;
        }

        // Default case for Owner on system-wide promos
        if (isOwner && promotion.isSystemWide) {
            if (!myOptOutRequest || myOptOutRequest.status === 'rejected') {
                return <Button variant="secondary" size="sm" onClick={() => setReasonModal('optOut')}>Từ chối tham gia</Button>;
            }
        }
        // Default case for Owner on cancellation requests
        if (isOwner && isMyStorePromo && myCancellationRequest?.status === 'pending') {
            return <Button variant="danger" size="sm" onClick={() => onRespondToCancellation(promotion.id)}>Chấp thuận Hủy</Button>;
        }

        return null;
    };


    return (
        <>
            <Card className="flex flex-col h-full relative">
                {isOwner && pendingReports.length > 0 && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute top-2 left-2 p-1 text-amber-500 hover:bg-amber-100 z-10" 
                        title={`${pendingReports.length} báo cáo đang chờ`} 
                        onClick={() => setIsReportDetailModalOpen(true)}
                    >
                        <ShieldAlert size={20} />
                    </Button>
                )}
                <span className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded-full ${promotion.isSystemWide ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {promotion.isSystemWide ? "Toàn Chuỗi" : `Cửa hàng: ${ownerName}`}
                </span>
                
                <div className="flex justify-between items-start pb-2">
                    <div>
                        <h3 className={`text-lg font-bold text-text-heading pr-20 ${isOwner && pendingReports.length > 0 ? 'pl-8' : ''}`}>{promotion.name}</h3>
                        <p className="font-mono text-sm text-brand-primary bg-blue-500/10 px-2 py-0.5 rounded-md inline-block">{promotion.code}</p>
                    </div>
                </div>

                <div className="mt-2 text-sm text-text-body flex-grow">
                     Giảm {promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : `${promotion.discountValue.toLocaleString('vi-VN')} VNĐ`}
                    {promotion.discountType === 'percentage' && promotion.maxDiscountAmount && ` (tối đa ${promotion.maxDiscountAmount.toLocaleString('vi-VN')} VNĐ)`}
                    {promotion.minOrderAmount && `, cho đơn từ ${promotion.minOrderAmount.toLocaleString('vi-VN')} VNĐ`}
                </div>
                
                 {pendingOptOuts.length > 0 && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                        <h4 className="text-xs font-bold text-amber-700 mb-1">Yêu cầu từ chối đang chờ:</h4>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {pendingOptOuts.map(req => (
                            <div key={req.storeOwnerId} className="text-xs">
                                <p className="font-semibold">{users.find(u=>u.id === req.storeOwnerId)?.name || 'Cửa hàng không rõ'}</p>
                                <p className="italic text-gray-500">Lý do: "{req.reason}"</p>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                    <Button size="sm" className="!text-xs !px-1.5 !py-0.5" onClick={() => onRespondToOptOut(promotion.id, req.storeOwnerId, 'approved')}>Chấp thuận</Button>
                                    <Button size="sm" variant="secondary" className="!text-xs !px-1.5 !py-0.5" onClick={() => handleOpenRejectionModal(req.storeOwnerId)}>Từ chối</Button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                )}


                <div className="mt-4 pt-4 border-t border-border-base flex items-start justify-between space-x-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                         <Link to={`/admin/promotions/${promotion.id}`}>
                            <Button variant="ghost" size="sm" className="p-2 text-brand-primary" title="Xem phân tích"><BarChart2 size={18} /></Button>
                        </Link>
                        {renderActionButtons()}
                    </div>
                    <div className="flex-shrink-0 max-w-[50%] sm:max-w-[60%]">{renderStatusBadge()}</div>
                </div>
            </Card>

            {isReportDetailModalOpen && isOwner && (
                <Modal
                    isOpen={isReportDetailModalOpen}
                    onClose={() => setIsReportDetailModalOpen(false)}
                    title={`Báo cáo từ Quản lý cho "${promotion.name}"`}
                    size="lg"
                >
                    <div className="space-y-4 max-h-80 overflow-y-auto">
                        {pendingReports.length > 0 ? pendingReports.map(report => (
                            <div key={report.id} className="p-3 bg-bg-subtle rounded-md border border-border-base">
                                <p className="text-sm">
                                    <strong>Người báo cáo:</strong> {users.find(u => u.id === report.reportedBy)?.name || 'Không rõ'}
                                </p>
                                <p className="text-xs text-text-muted">
                                    {new Date(report.timestamp).toLocaleString('vi-VN')}
                                </p>
                                <p className="mt-2 italic text-text-body">"{report.reason}"</p>
                                <div className="text-right mt-2">
                                    <Button size="sm" onClick={() => {
                                        onResolveReport(promotion.id, report.id);
                                        // If this is the last pending report, close the modal
                                        if (pendingReports.length === 1) {
                                            setIsReportDetailModalOpen(false);
                                        }
                                    }}>
                                        Đánh dấu đã xử lý
                                    </Button>
                                </div>
                            </div>
                        )) : <p className="text-text-muted">Không còn báo cáo nào đang chờ.</p>}
                    </div>
                </Modal>
            )}

            <ReasonModal
                isOpen={reasonModal === 'optOut'}
                onClose={() => setReasonModal(null)}
                onConfirm={(reason) => { onRequestOptOut(promotion.id, reason); setReasonModal(null); }}
                title="Yêu cầu Từ chối Tham gia"
                label="Lý do từ chối*"
                placeholder="VD: Chương trình không phù hợp với tệp khách hàng của chúng tôi..."
                confirmText="Gửi Yêu cầu"
            />
            <ReasonModal
                isOpen={reasonModal === 'cancelRequest'}
                onClose={() => setReasonModal(null)}
                onConfirm={(reason) => { onRequestCancellation(promotion.id, reason); setReasonModal(null); }}
                title="Yêu cầu Hủy Khuyến mãi"
                label="Lý do yêu cầu hủy*"
                placeholder="VD: Chương trình không hiệu quả, ảnh hưởng tới thương hiệu..."
                confirmText="Gửi Yêu cầu Hủy"
            />
            <ReasonModal
                isOpen={reasonModal === 'rejectOptOut'}
                onClose={() => setReasonModal(null)}
                onConfirm={(reason) => { 
                    if(currentOwnerToReject) {
                        onRespondToOptOut(promotion.id, currentOwnerToReject, 'rejected', reason);
                    }
                    setReasonModal(null); 
                }}
                title="Lý do Từ chối Yêu cầu"
                label="Lý do (gửi cho chủ cửa hàng)*"
                placeholder="VD: Chương trình là bắt buộc để đồng bộ thương hiệu..."
                confirmText="Gửi Lý do & Từ chối"
            />
            <ReasonModal
                isOpen={reasonModal === 'rejectPromotion'}
                onClose={() => setReasonModal(null)}
                onConfirm={(reason) => { onReject(promotion.id, reason); setReasonModal(null); }}
                title="Lý do Từ chối Khuyến mãi"
                label="Lý do*"
                placeholder="VD: Chương trình chưa phù hợp, cần chỉnh sửa lại..."
                confirmText="Xác nhận Từ chối"
            />
        </>
    );
};

// Helper function to get notable Vietnamese events for a given month
const getVietnameseEvents = (month: number): string => { // month is 0-indexed
    switch (month) {
        case 2: return "Ngày Quốc tế Phụ nữ (8/3)";
        case 3: return "Ngày Giải phóng miền Nam (30/4)";
        case 4: return "Ngày Quốc tế Lao động (1/5)";
        case 8: return "Ngày Quốc khánh (2/9)";
        case 9: return "Ngày Phụ nữ Việt Nam (20/10)";
        case 10: return "Ngày Nhà giáo Việt Nam (20/11)";
        default: return "Không có ngày lễ lớn";
    }
};

const PromotionManagementPage: React.FC = () => {
  const { promotions, addPromotion, updatePromotion, deletePromotion, orders, users, requestPromotionOptOut, respondToOptOutRequest, requestPromotionCancellation, respondToCancellationRequest, addNotification, services, washMethods, approvePromotion, rejectPromotion, addManagerReport, resolveManagerReport } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPromotion, setCurrentPromotion] = useState<Partial<Promotion> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formError, setFormError] = useState<string | null>(null);
  
  // --- START: AI Suggestion State ---
  const [isAiSuggestModalOpen, setIsAiSuggestModalOpen] = useState(false);
  const [aiPromoGoal, setAiPromoGoal] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<Partial<Promotion>[] | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [revenueInsight, setRevenueInsight] = useState<string>('');
  const [usedSuggestionCodes, setUsedSuggestionCodes] = useState<string[]>([]);
  // --- END: AI Suggestion State ---

  // --- START: AI Campaign State ---
  const [isAiCampaignModalOpen, setIsAiCampaignModalOpen] = useState(false);
  const [aiCampaignGoal, setAiCampaignGoal] = useState('');
  const [aiCampaignProposal, setAiCampaignProposal] = useState<string | null>(null);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [aiCampaignError, setAiCampaignError] = useState<string | null>(null);
  const [customerInsights, setCustomerInsights] = useState<string>('');
  const [serviceInsights, setServiceInsights] = useState<string>('');
  // --- END: AI Campaign State ---

  // --- START: Manager Report State ---
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingPromotion, setReportingPromotion] = useState<Promotion | null>(null);
  // --- END: Manager Report State ---

  const isChairman = currentUser?.role === UserRole.CHAIRMAN;
  const isOwner = currentUser?.role === UserRole.OWNER;
  const canManage = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.CHAIRMAN);

  const [storeFilter, setStoreFilter] = useState('all');
  const storeOptions = useMemo(() => {
      if (!isChairman) return [];
      const owners = users.filter(u => u.role === UserRole.OWNER);
      return [{ value: 'all', label: 'Tất cả cửa hàng' }, ...owners.map(o => ({ value: o.id, label: o.name }))];
  }, [isChairman, users]);

  const filteredPromotions = useMemo(() => {
    let promos = promotions;

    if (isChairman) {
        if (storeFilter !== 'all') {
            promos = promotions.filter(p => p.ownerId === storeFilter || p.isSystemWide);
        }
    } else if (isOwner) {
        const myManagedUserIds = users.filter(u => u.managedBy === currentUser.id).map(u => u.id);
        promos = promotions.filter(p => 
            p.ownerId === currentUser.id || 
            (p.createdBy && myManagedUserIds.includes(p.createdBy)) ||
            (p.isSystemWide)
        );
    } else if (currentUser?.role === UserRole.MANAGER) {
        promos = promotions.filter(p => 
            (p.ownerId === currentUser.managedBy && p.status !== 'pending' && p.status !== 'rejected') || // See approved promos in the store
            (p.createdBy === currentUser.id) || // See my own promos (pending or otherwise)
            (p.isSystemWide)
        );
    }
    
    return promos.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0) || new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
  }, [promotions, searchTerm, isChairman, isOwner, storeFilter, currentUser, users]);
  
  // Data analysis for AI suggestions (both promo and campaign)
  useMemo(() => {
    if (!isAiSuggestModalOpen && !isAiCampaignModalOpen) return;

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const ordersThisMonth = orders.filter(o => new Date(o.createdAt) >= startOfThisMonth);
    const ordersLastMonth = orders.filter(o => new Date(o.createdAt) >= startOfLastMonth && new Date(o.createdAt) <= endOfLastMonth);

    // Revenue Insight
    const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + o.totalAmount, 0);
    const revenueLastMonth = ordersLastMonth.reduce((sum, o) => sum + o.totalAmount, 0);
    
    let revenueText = "Doanh thu tháng này ổn định.";
    if (revenueLastMonth > 0 && revenueThisMonth < revenueLastMonth) {
        const percentageDrop = ((revenueLastMonth - revenueThisMonth) / revenueLastMonth) * 100;
        revenueText = `Doanh thu tháng này (${revenueThisMonth.toLocaleString('vi-VN')} VNĐ) đang thấp hơn khoảng ${percentageDrop.toFixed(0)}% so với tháng trước (${revenueLastMonth.toLocaleString('vi-VN')} VNĐ).`;
    } else if (revenueThisMonth > revenueLastMonth) {
        revenueText = `Doanh thu tháng này đang tăng trưởng tốt so với tháng trước.`;
    }
    setRevenueInsight(revenueText);
    
    // Customer Insight
    const customersThisMonth = new Set(ordersThisMonth.map(o => o.customer.id));
    const allCustomersBeforeThisMonth = new Set(orders.filter(o => new Date(o.createdAt) < startOfThisMonth).map(o => o.customer.id));
    const newCustomersThisMonth = Array.from(customersThisMonth).filter(id => !allCustomersBeforeThisMonth.has(id)).length;
    setCustomerInsights(`Tháng này có ${customersThisMonth.size} khách hàng, trong đó có ${newCustomersThisMonth} khách hàng mới.`);

    // Service Insight
    const serviceRevenue = ordersThisMonth.reduce((acc, order) => {
        order.items.forEach(item => {
            const name = item.serviceItem.name;
            const price = item.serviceItem.price * item.quantity;
            acc[name] = (acc[name] || 0) + price;
        });
        return acc;
    }, {} as Record<string, number>);
    
    const sortedServices = Object.entries(serviceRevenue).sort((a, b) => b[1] - a[1]);
    const top3 = sortedServices.slice(0, 3).map(s => s[0]).join(', ');
    const bottom3 = sortedServices.slice(-3).reverse().map(s => s[0]).join(', ');
    setServiceInsights(`Dịch vụ hiệu quả nhất: ${top3 || 'N/A'}. Dịch vụ ít hiệu quả nhất: ${bottom3 || 'N/A'}.`);

  }, [isAiSuggestModalOpen, isAiCampaignModalOpen, orders]);


  const handleGenerateSuggestion = async (goal: string) => {
    if (!goal.trim() || !process.env.API_KEY) {
        setAiError("Vui lòng chọn hoặc nhập một mục tiêu.");
        return;
    }
    setIsGeneratingSuggestion(true);
    setAiError(null);
    setAiSuggestions(null);
    setUsedSuggestionCodes([]); // Reset used suggestions on new generation
    
    const now = new Date();
    const eventContext = getVietnameseEvents(now.getMonth());
    const serviceListText = services.map(s => {
      const washMethodName = washMethods.find(wm => wm.id === s.washMethodId)?.name || 'N/A';
      return `ID: ${s.id}, Tên: ${s.name}, PP Giặt: ${washMethodName}`;
    }).join('; ');
    const washMethodListText = washMethods.map(wm => `ID: ${wm.id}, Tên: ${wm.name}`).join('; ');


    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const schema = {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                  name: { type: Type.STRING, description: 'Tên chương trình khuyến mãi, thật kêu và hấp dẫn bằng tiếng Việt.' },
                  code: { type: Type.STRING, description: 'Mã khuyến mãi ngắn gọn, dễ nhớ, VIẾT HOA, không dấu. Ví dụ: GIAM50K, SALEHE.' },
                  discountType: { type: Type.STRING, enum: ['percentage', 'fixed_amount'] },
                  discountValue: { type: Type.NUMBER, description: 'Giá trị giảm giá. Nếu là percentage, là số từ 1-100. Nếu là fixed_amount, là số tiền VNĐ.' },
                  minOrderAmount: { type: Type.NUMBER, description: 'Giá trị đơn hàng tối thiểu để áp dụng (VNĐ).', nullable: true },
                  maxDiscountAmount: { type: Type.NUMBER, description: 'Giảm giá tối đa cho loại percentage (VNĐ).', nullable: true },
                  applicableDaysOfWeek: {
                      type: Type.ARRAY,
                      description: 'Mảng các số đại diện cho ngày áp dụng. 0=CN, 1=T2, ..., 6=T7. CHỈ dùng khi mục tiêu liên quan đến ngày cụ thể (VD: cuối tuần [0,6]). Nếu không liên quan, bỏ trống.',
                      nullable: true,
                      items: { type: Type.INTEGER }
                  },
                  applicableServiceIds: {
                      type: Type.ARRAY,
                      description: 'Mảng các ID dịch vụ được áp dụng. CHỈ dùng khi mục tiêu liên quan đến dịch vụ cụ thể. Nếu không, bỏ trống.',
                      nullable: true,
                      items: { type: Type.STRING }
                  },
                  applicableWashMethodIds: {
                      type: Type.ARRAY,
                      description: 'Mảng các ID phương pháp giặt được áp dụng. CHỈ dùng khi mục tiêu liên quan đến PP giặt. Nếu không, bỏ trống.',
                      nullable: true,
                      items: { type: Type.STRING }
                  },
                  applicableChannels: {
                      type: Type.ARRAY,
                      description: 'Kênh áp dụng. "online" cho khách tự đặt, "instore" cho nhân viên tạo tại cửa hàng. Bỏ trống để áp dụng cho cả hai.',
                      nullable: true,
                      items: { type: Type.STRING, enum: ['online', 'instore'] }
                  }
              }
            }
        };

        const prompt = `Bạn là chuyên gia marketing cho một tiệm giặt là. Dựa vào bối cảnh sau, hãy tạo ra một MẢNG JSON chứa 3 gợi ý khuyến mãi khác nhau. ƯU TIÊN MỤC TIÊU của người dùng hơn các yếu tố khác.
        
        Bối cảnh:
        - Mục tiêu của người dùng: "${goal}"
        - ${revenueInsight}
        - Sự kiện trong tháng: ${eventContext}
        - Danh sách dịch vụ có sẵn: ${serviceListText}
        - Danh sách phương pháp giặt có sẵn: ${washMethodListText}
        - Các kênh bán hàng: online (khách tự đặt), instore (nhân viên tạo tại cửa hàng).

        Lưu ý quan trọng:
        - Nếu mục tiêu liên quan đến ngày cụ thể (ví dụ: 'tăng doanh thu cuối tuần'), hãy sử dụng trường 'applicableDaysOfWeek'. Cuối tuần là [0, 6]. Thứ 3 và 5 là [2, 4].
        - Nếu mục tiêu liên quan đến dịch vụ (ví dụ: 'giặt khô', 'giặt vest'), hãy tìm ID dịch vụ tương ứng từ danh sách và dùng 'applicableServiceIds'.
        - Nếu mục tiêu liên quan đến phương pháp giặt (ví dụ: 'giặt ướt'), hãy tìm ID phương pháp giặt tương ứng và dùng 'applicableWashMethodIds'.
        - Nếu mục tiêu là khuyến khích đặt hàng online, hãy dùng 'applicableChannels' với giá trị ["online"].
        - Nếu không liên quan, KHÔNG sử dụng các trường điều kiện trên.
        - Đa dạng hóa các gợi ý (loại giảm giá, giá trị, điều kiện).
        - Trả về một mảng JSON hợp lệ chứa đúng 3 đối tượng.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        
        const suggestions = JSON.parse(response.text);
        setAiSuggestions(suggestions);

    } catch (err) {
        console.error("AI suggestion error:", err);
        const errorMessage = err instanceof Error ? err.message : "Lỗi không xác định";
        setAiError(`Không thể tạo gợi ý: ${errorMessage}`);
        addNotification({ message: `Lỗi AI: ${errorMessage}`, type: 'error' });
    } finally {
        setIsGeneratingSuggestion(false);
    }
  };
  
  const handleGenerateCampaign = async (goal: string) => {
    if (!goal.trim() || !process.env.API_KEY) {
        setAiCampaignError("Vui lòng nhập mục tiêu cho chiến dịch.");
        return;
    }
    setIsGeneratingCampaign(true);
    setAiCampaignError(null);
    setAiCampaignProposal(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const now = new Date();
        const eventContext = getVietnameseEvents(now.getMonth());

        const prompt = `Bạn là một nhà chiến lược marketing tài ba cho một cửa hàng giặt là. Dựa trên mục tiêu và dữ liệu kinh doanh được cung cấp, hãy soạn thảo một BẢN ĐỀ XUẤT CHIẾN DỊCH MARKETING chi tiết, chuyên nghiệp bằng tiếng Việt.
        
        BỐI CẢNH KINH DOANH:
        - Tên cửa hàng: ${currentUser?.name}'s Laundromat
        - Mục tiêu chính của chiến dịch: "${goal}"
        - Tình hình doanh thu: ${revenueInsight}
        - Phân tích khách hàng: ${customerInsights}
        - Phân tích dịch vụ: ${serviceInsights}
        - Sự kiện trong tháng: ${eventContext}

        YÊU CẦU ĐỀ XUẤT:
        Hãy trình bày bản đề xuất theo cấu trúc markdown rõ ràng sau:

        **1. Tên chiến dịch:** (Một cái tên hấp dẫn, dễ nhớ)
        
        **2. Đối tượng mục tiêu:** (Mô tả chi tiết nhóm khách hàng nên nhắm tới, dựa trên phân tích)

        **3. Thông điệp chính:** (Câu slogan hoặc thông điệp cốt lõi của chiến dịch)

        **4. Kênh triển khai:** 
        *   **Online:** (Gợi ý các kênh như Facebook, Zalo, Google Maps...)
        *   **Offline:** (Gợi ý các hoạt động tại cửa hàng, phát tờ rơi, hợp tác địa phương...)

        **5. Các bước thực hiện:** (Liệt kê 3-5 hành động cụ thể, theo thứ tự. Ví dụ: Thiết kế banner, chạy quảng cáo Facebook, tạo mã giảm giá...)

        **6. Cách đo lường hiệu quả (KPIs):** (Đề xuất các chỉ số để theo dõi thành công, ví dụ: Số lượng khách hàng mới, Doanh thu từ chiến dịch, Lượt sử dụng mã KM...)
        
        Hãy viết một cách chuyên nghiệp, thuyết phục và khả thi cho một cửa hàng giặt là.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        setAiCampaignProposal(response.text);

    } catch (err) {
        console.error("AI campaign generation error:", err);
        const errorMessage = err instanceof Error ? err.message : "Lỗi không xác định";
        setAiCampaignError(`Không thể tạo đề xuất: ${errorMessage}`);
    } finally {
        setIsGeneratingCampaign(false);
    }
};

  const handleUseSuggestion = (suggestion: Partial<Promotion>) => {
    if (!canManage || !currentUser) return;
    
    if (suggestion.code && promotions.some(p => p.code.toLowerCase() === suggestion.code?.toLowerCase())) {
        addNotification({ message: `Mã khuyến mãi "${suggestion.code}" đã tồn tại.`, type: 'error', showToast: true });
        if (suggestion.code && !usedSuggestionCodes.includes(suggestion.code)) {
            setUsedSuggestionCodes(prev => [...prev, suggestion.code!]);
        }
        return;
    }

    const isSystemWide = isChairman && suggestion.isSystemWide;

    const promotionData = {
        name: suggestion.name || 'Khuyến mãi do AI tạo',
        code: suggestion.code || `AI${uuidv4().slice(0, 4).toUpperCase()}`,
        type: 'discount_voucher',
        discountType: suggestion.discountType || 'percentage',
        discountValue: Number(suggestion.discountValue) || 10,
        // Status is handled by addPromotion hook based on creator's role
        isSystemWide: isSystemWide,
        startDate: suggestion.startDate ? new Date(suggestion.startDate) : undefined,
        endDate: suggestion.endDate ? new Date(suggestion.endDate) : undefined,
        applicableDaysOfWeek: suggestion.applicableDaysOfWeek?.length ? suggestion.applicableDaysOfWeek : undefined,
        applicableServiceIds: suggestion.applicableServiceIds?.length ? suggestion.applicableServiceIds : undefined,
        applicableWashMethodIds: suggestion.applicableWashMethodIds?.length ? suggestion.applicableWashMethodIds : undefined,
        applicableChannels: suggestion.applicableChannels?.length ? suggestion.applicableChannels : undefined,
        minOrderAmount: suggestion.minOrderAmount ? Number(suggestion.minOrderAmount) : undefined,
        maxDiscountAmount: suggestion.maxDiscountAmount ? Number(suggestion.maxDiscountAmount) : undefined,
        usageLimit: suggestion.usageLimit ? Number(suggestion.usageLimit) : undefined,
        usageLimitPerCustomer: suggestion.usageLimitPerCustomer ? Number(suggestion.usageLimitPerCustomer) : 1,
        // The `isActive` flag is used by the hook to set initial status for owners/chairmen
        isActive: true,
    };
    
    addPromotion(promotionData as any);

    if (suggestion.code) {
        setUsedSuggestionCodes(prev => [...prev, suggestion.code!]);
    }
  };


  const openModal = (mode: 'add' | 'edit', promotion: Partial<Promotion> | null = null) => {
    if (!canManage) return;
    setModalMode(mode);
    setFormError(null);
    setCurrentPromotion(mode === 'add' ? (promotion || {
      name: '', code: '', type: 'discount_voucher', discountType: 'percentage',
      discountValue: 10, status: 'inactive', minOrderAmount: undefined, maxDiscountAmount: undefined,
      usageLimit: undefined, usageLimitPerCustomer: 1, isSystemWide: false, applicableDaysOfWeek: [], 
      applicableServiceIds: [], applicableWashMethodIds: [], applicableChannels: []
    }) : { ...promotion });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setCurrentPromotion(null); };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null); // Clear previous errors

    if (!currentPromotion || !currentPromotion.name?.trim() || !currentPromotion.code?.trim() || !currentPromotion.discountType || currentPromotion.discountValue === undefined) {
      setFormError('Tên, Mã, Loại và Giá trị giảm giá là bắt buộc.');
      return;
    }
    if (promotions.some(p => p.code.toLowerCase() === currentPromotion.code?.toLowerCase() && p.id !== currentPromotion.id)) {
        setFormError('Mã khuyến mãi này đã tồn tại.');
        return;
    }
    
    // --- NEW VALIDATIONS ---
    const discountValueNum = Number(currentPromotion.discountValue);
    if (currentPromotion.discountType === 'percentage' && (discountValueNum <= 0 || discountValueNum > 100)) {
        setFormError('Giá trị giảm giá (%) phải nằm trong khoảng (0, 100].');
        return;
    }
    if (currentPromotion.discountType === 'fixed_amount' && discountValueNum <= 0) {
        setFormError('Giá trị giảm giá (VNĐ) phải lớn hơn 0.');
        return;
    }

    if (currentPromotion.maxDiscountAmount && Number(currentPromotion.maxDiscountAmount) < 0) {
        setFormError('Giảm giá tối đa không thể là số âm.');
        return;
    }

    if (currentPromotion.minOrderAmount && Number(currentPromotion.minOrderAmount) < 0) {
        setFormError('Đơn hàng tối thiểu không thể là số âm.');
        return;
    }
    
    if (currentPromotion.usageLimit && Number(currentPromotion.usageLimit) < 0) {
        setFormError('Giới hạn lượt dùng không thể là số âm.');
        return;
    }
    
    if (currentPromotion.usageLimitPerCustomer && Number(currentPromotion.usageLimitPerCustomer) < 0) {
        setFormError('Lượt dùng / Khách hàng không thể là số âm.');
        return;
    }

    if (currentPromotion.startDate && currentPromotion.endDate && new Date(currentPromotion.endDate) < new Date(currentPromotion.startDate)) {
        setFormError('Ngày kết thúc không được sớm hơn ngày bắt đầu.');
        return;
    }
    // --- END NEW VALIDATIONS ---

    const isSystemWide = isChairman && currentPromotion.isSystemWide;
    
    const promotionData = {
      name: currentPromotion.name, code: currentPromotion.code.toUpperCase(), type: currentPromotion.type!,
      discountType: currentPromotion.discountType, discountValue: Number(currentPromotion.discountValue),
      startDate: currentPromotion.startDate ? new Date(currentPromotion.startDate) : undefined,
      endDate: currentPromotion.endDate ? new Date(currentPromotion.endDate) : undefined,
      applicableDaysOfWeek: currentPromotion.applicableDaysOfWeek?.length ? currentPromotion.applicableDaysOfWeek : undefined,
      applicableServiceIds: currentPromotion.applicableServiceIds?.length ? currentPromotion.applicableServiceIds : undefined,
      applicableWashMethodIds: currentPromotion.applicableWashMethodIds?.length ? currentPromotion.applicableWashMethodIds : undefined,
      applicableChannels: currentPromotion.applicableChannels?.length ? currentPromotion.applicableChannels : undefined,
      minOrderAmount: currentPromotion.minOrderAmount ? Number(currentPromotion.minOrderAmount) : undefined,
      maxDiscountAmount: currentPromotion.maxDiscountAmount ? Number(currentPromotion.maxDiscountAmount) : undefined,
      usageLimit: currentPromotion.usageLimit ? Number(currentPromotion.usageLimit) : undefined,
      usageLimitPerCustomer: currentPromotion.usageLimitPerCustomer ? Number(currentPromotion.usageLimitPerCustomer) : undefined,
      isSystemWide: isSystemWide,
    };
    
    if (modalMode === 'add') {
      const isActive = currentPromotion.status === 'active';
      addPromotion({ ...promotionData, isActive });
    } else if (currentPromotion.id) {
        const originalPromotion = promotions.find(p => p.id === currentPromotion.id);
        
        let finalStatus = currentPromotion.status; 
        
        if (originalPromotion && originalPromotion.status === 'pending' && currentUser?.role === UserRole.MANAGER) {
            finalStatus = 'pending';
        }
        
        updatePromotion({ ...currentPromotion, ...promotionData, status: finalStatus } as Promotion);
    }
    closeModal();
  };
  
  const handleDayOfWeekChange = (dayIndex: number) => {
    if (!currentPromotion) return;
    const currentDays = currentPromotion.applicableDaysOfWeek || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex].sort();
    setCurrentPromotion({ ...currentPromotion, applicableDaysOfWeek: newDays });
  };

  const handleServiceIdChange = (serviceId: string) => {
      if (!currentPromotion) return;
      const currentIds = currentPromotion.applicableServiceIds || [];
      const newIds = currentIds.includes(serviceId)
        ? currentIds.filter(id => id !== serviceId)
        : [...currentIds, serviceId];
      setCurrentPromotion({ ...currentPromotion, applicableServiceIds: newIds });
  };

  const handleWashMethodChange = (washMethodId: string) => {
      if (!currentPromotion) return;
      const currentMethods = currentPromotion.applicableWashMethodIds || [];
      const newMethods = currentMethods.includes(washMethodId)
        ? currentMethods.filter(m => m !== washMethodId)
        : [...currentMethods, washMethodId];
      setCurrentPromotion({ ...currentPromotion, applicableWashMethodIds: newMethods });
  };
  
  const handleChannelChange = (channel: 'online' | 'instore') => {
      if (!currentPromotion) return;
      const currentChannels = currentPromotion.applicableChannels || [];
      const newChannels = currentChannels.includes(channel)
        ? currentChannels.filter(c => c !== channel)
        : [...currentChannels, channel];
      setCurrentPromotion({ ...currentPromotion, applicableChannels: newChannels });
  };


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!currentPromotion) return;
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        if (name === 'isActive') {
            setCurrentPromotion({ ...currentPromotion, status: checked ? 'active' : 'inactive' });
        } else {
            setCurrentPromotion({ ...currentPromotion, [name]: checked });
        }
    } else {
        setCurrentPromotion({ ...currentPromotion, [name]: value });
    }
  };

  const handleDelete = (promotionId: string) => { if (window.confirm('Bạn có chắc muốn xóa khuyến mãi này không?')) { deletePromotion(promotionId); } };

  const handleOpenReportModal = (promo: Promotion) => {
    setReportingPromotion(promo);
    setIsReportModalOpen(true);
  };
  
  const handleSendReport = (reason: string) => {
    if (!reportingPromotion || !currentUser) return;
    addManagerReport(reportingPromotion.id, reason);
    setIsReportModalOpen(false);
    setReportingPromotion(null);
  };
  
  const handleToggleStatus = (promo: Promotion) => {
    if (!currentUser || currentUser.role !== UserRole.OWNER) return;
    const newStatus = promo.status === 'active' ? 'inactive' : 'active';
    updatePromotion({ ...promo, status: newStatus });
  };

  const discountTypeOptions = [{ value: 'percentage', label: 'Phần trăm (%)' }, { value: 'fixed_amount', label: 'Số tiền cố định (VNĐ)' }];
  const daysOfWeek = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  
  const commonGoals = [
    "Thu hút khách hàng mới",
    "Tăng doanh thu cuối tuần",
    "Khuyến khích khách hàng đặt online",
    "Tri ân khách hàng thân thiết",
    "Xử lý dịch vụ ít người dùng",
    "Tăng giá trị đơn hàng trung bình",
  ];

  const markdownToHtml = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\* (.*?)(?=\n\*|\n\n|$)/g, '<li>$1</li>') // List items
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>') // Wrap in ul
      .replace(/\n/g, '<br />'); // Newlines
  };

  const closeAiSuggestModal = () => {
    setIsAiSuggestModalOpen(false);
    setAiSuggestions(null);
    setAiPromoGoal('');
    setUsedSuggestionCodes([]);
  };

  return (
    <>
      <Card
        title="Quản lý Khuyến mãi & Marketing"
        icon={<TagIcon className="text-brand-primary" size={24} />}
        actions={canManage && (
            <div className="flex space-x-2">
                <Button variant="secondary" onClick={() => setIsAiCampaignModalOpen(true)} leftIcon={<MegaphoneIcon size={18} />}>Gợi ý Chiến dịch</Button>
                <Button variant="secondary" onClick={() => setIsAiSuggestModalOpen(true)} leftIcon={<SparklesIcon size={18} />}>Gợi ý KM bằng AI</Button>
                <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18} />}>Tạo Mới</Button>
            </div>
        )}
      >
        <div className={`grid grid-cols-1 ${isChairman ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
            <Input placeholder="Tìm theo Tên hoặc Mã..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<SearchIcon />} wrapperClassName="flex-grow" />
            {isChairman && (
                <Select label="Lọc theo cửa hàng" options={storeOptions} value={storeFilter} onChange={e => setStoreFilter(e.target.value)} leftIcon={<Building size={16}/>} />
            )}
        </div>
        
        {filteredPromotions.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPromotions.map(p => (
                    <PromotionCard 
                        key={p.id} 
                        promotion={p} 
                        orders={orders} 
                        users={users}
                        currentUser={currentUser!}
                        onEdit={openModal.bind(null, 'edit')} 
                        onDelete={handleDelete}
                        onApprove={approvePromotion}
                        onReject={rejectPromotion}
                        onRequestOptOut={requestPromotionOptOut}
                        onRespondToOptOut={respondToOptOutRequest}
                        onRequestCancellation={requestPromotionCancellation}
                        onRespondToCancellation={respondToCancellationRequest.bind(null, p.id, 'approved')}
                        onToggleStatus={handleToggleStatus}
                        onReport={handleOpenReportModal}
                        onResolveReport={resolveManagerReport}
                    />
                ))}
            </div>
        ) : (
            <p className="text-center text-text-muted py-10">Không có chương trình khuyến mãi nào được tìm thấy.</p>
        )}
      </Card>
      
      {isModalOpen && currentPromotion && canManage && (
        <Modal isOpen={isModalOpen} onClose={closeModal} title={modalMode === 'add' ? 'Tạo Khuyến mãi' : 'Sửa Khuyến mãi'} size="xl">
          <form onSubmit={handleSave} noValidate className="space-y-4 pt-2">
            {formError && <p className="text-sm text-status-danger flex items-center"><AlertTriangle size={16} className="mr-1.5"/>{formError}</p>}
            
            {isChairman && modalMode === 'add' && (
                <label className="flex items-center space-x-3 cursor-pointer p-3 bg-purple-50 border border-purple-200 rounded-md">
                    <input type="checkbox" name="isSystemWide" checked={!!currentPromotion.isSystemWide} onChange={handleInputChange} className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
                    <span className="text-purple-800 font-medium">Tạo là Khuyến mãi Toàn Chuỗi</span>
                </label>
            )}

            <Input label="Tên Khuyến mãi*" name="name" value={currentPromotion.name || ''} onChange={handleInputChange} required />
            <Input label="Mã Khuyến mãi (Không dấu, viết liền)*" name="code" value={currentPromotion.code || ''} onChange={handleInputChange} required placeholder="VD: KHAITRUONG, GIAM50K" />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Loại giảm giá*" name="discountType" options={discountTypeOptions} value={currentPromotion.discountType} onChange={handleInputChange} required />
              <Input label="Giá trị giảm giá*" name="discountValue" type="number" min="0" value={currentPromotion.discountValue?.toString() || ''} onChange={handleInputChange} required />
            </div>
            {currentPromotion?.discountType === 'percentage' && ( <Input label="Giảm giá tối đa (VNĐ)" name="maxDiscountAmount" type="number" min="0" value={currentPromotion.maxDiscountAmount?.toString() || ''} onChange={handleInputChange} placeholder="Để trống nếu không giới hạn" /> )}
            
             <fieldset className="border border-border-base rounded-md p-3">
                <legend className="text-sm font-medium text-text-muted px-1">Ngày áp dụng (tùy chọn)</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <Input label="Ngày bắt đầu" name="startDate" type="date" value={currentPromotion.startDate ? new Date(currentPromotion.startDate).toISOString().split('T')[0] : ''} onChange={handleInputChange} />
                    <Input label="Ngày kết thúc" name="endDate" type="date" value={currentPromotion.endDate ? new Date(currentPromotion.endDate).toISOString().split('T')[0] : ''} onChange={handleInputChange} />
                </div>
                <div className="mt-3">
                    <label className="block text-sm font-medium text-text-body mb-2">Các ngày trong tuần được áp dụng (để trống là áp dụng mọi ngày)</label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {daysOfWeek.map((day, index) => (
                            <label key={index} className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={currentPromotion.applicableDaysOfWeek?.includes(index) || false} onChange={() => handleDayOfWeekChange(index)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus"/>
                                <span className="text-sm">{day}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </fieldset>

            <fieldset className="border border-border-base rounded-md p-3">
                <legend className="text-sm font-medium text-text-muted px-1">Điều kiện & Giới hạn</legend>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <Input label="Đơn hàng tối thiểu (VNĐ)" name="minOrderAmount" type="number" min="0" value={currentPromotion.minOrderAmount?.toString() || ''} onChange={handleInputChange} placeholder="Để trống nếu không có" />
                    <Input label="Giới hạn lượt dùng (toàn CT)" name="usageLimit" type="number" min="0" value={currentPromotion.usageLimit?.toString() || ''} onChange={handleInputChange} placeholder="Để trống nếu không giới hạn" />
                    <Input label="Lượt dùng / Khách hàng" name="usageLimitPerCustomer" type="number" min="1" value={currentPromotion.usageLimitPerCustomer?.toString() || ''} onChange={handleInputChange} placeholder="VD: 1" />
                </div>
            </fieldset>

             <fieldset className="border border-border-base rounded-md p-3">
                <legend className="text-sm font-medium text-text-muted px-1 flex items-center"><Settings2Icon size={14} className="mr-1.5" /> Điều kiện Dịch vụ</legend>
                <p className="text-xs text-text-muted mb-2">Để trống để áp dụng cho tất cả dịch vụ.</p>
                {currentPromotion.applicableWashMethodIds && currentPromotion.applicableWashMethodIds.length > 0 && (
                    <p className="text-xs text-status-warning-text p-2 bg-status-warning-bg rounded-md mb-2">
                        Không thể chọn điều kiện Dịch vụ khi đã chọn điều kiện Phương pháp Giặt.
                    </p>
                )}
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-bg-subtle rounded-md">
                    {services.map(service => (
                        <label key={service.id} className={`flex items-center space-x-2 p-1 hover:bg-bg-surface rounded ${!!currentPromotion.applicableWashMethodIds?.length ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={currentPromotion.applicableServiceIds?.includes(service.id) || false} onChange={() => handleServiceIdChange(service.id)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" disabled={!!currentPromotion.applicableWashMethodIds?.length} />
                            <span className="text-sm">{service.name} ({washMethods.find(wm => wm.id === service.washMethodId)?.name})</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <fieldset className="border border-border-base rounded-md p-3">
                <legend className="text-sm font-medium text-text-muted px-1 flex items-center"><DropletsIcon size={14} className="mr-1.5" /> Điều kiện Phương pháp Giặt</legend>
                <p className="text-xs text-text-muted mb-2">Để trống để áp dụng cho tất cả phương pháp giặt.</p>
                {currentPromotion.applicableServiceIds && currentPromotion.applicableServiceIds.length > 0 && (
                     <p className="text-xs text-status-warning-text p-2 bg-status-warning-bg rounded-md mb-2">
                        Không thể chọn điều kiện Phương pháp Giặt khi đã chọn điều kiện Dịch vụ.
                    </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-2 p-2">
                    {washMethods.map(method => (
                        <label key={method.id} className={`flex items-center space-x-2 ${!!currentPromotion.applicableServiceIds?.length ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={currentPromotion.applicableWashMethodIds?.includes(method.id) || false} onChange={() => handleWashMethodChange(method.id)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" disabled={!!currentPromotion.applicableServiceIds?.length} />
                            <span className="text-sm">{method.name}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <fieldset className="border border-border-base rounded-md p-3">
                <legend className="text-sm font-medium text-text-muted px-1 flex items-center"><Settings2Icon size={14} className="mr-1.5" /> Kênh áp dụng</legend>
                <p className="text-xs text-text-muted mb-2">Để trống để áp dụng cho cả đơn Online và đơn tại cửa hàng.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 p-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={currentPromotion.applicableChannels?.includes('online') || false} onChange={() => handleChannelChange('online')} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" />
                        <span className="text-sm">Online (Khách tự đặt)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={currentPromotion.applicableChannels?.includes('instore') || false} onChange={() => handleChannelChange('instore')} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" />
                        <span className="text-sm">Tại cửa hàng (NV tạo)</span>
                    </label>
                </div>
            </fieldset>
            
            <label className="flex items-center space-x-3 cursor-pointer pt-2">
                <input type="checkbox" name="isActive" checked={currentPromotion.status === 'active'} onChange={handleInputChange} className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" disabled={currentUser?.role === UserRole.MANAGER && modalMode === 'add'}/>
                <span className="text-text-body font-medium">Kích hoạt khuyến mãi {currentUser?.role === UserRole.MANAGER && <span className="text-xs text-text-muted">(Chủ tiệm sẽ duyệt)</span>}</span>
            </label>
            
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">Lưu</Button>
            </div>
          </form>
        </Modal>
      )}

      {isAiSuggestModalOpen && (
        <Modal isOpen={isAiSuggestModalOpen} onClose={closeAiSuggestModal} title="Trợ lý AI Gợi ý Khuyến mãi" size="xl">
            <div className="space-y-4">
                {!aiSuggestions && !isGeneratingSuggestion && (
                    <>
                        <p className="text-sm text-text-muted">Trợ lý sẽ phân tích dữ liệu doanh thu và sự kiện trong tháng để đưa ra gợi ý tốt nhất. Hãy chọn một mục tiêu:</p>
                        <div className="flex flex-wrap gap-2">
                            {commonGoals.map(goal => (
                                <Button key={goal} variant="secondary" size="sm" onClick={() => handleGenerateSuggestion(goal)}>{goal}</Button>
                            ))}
                        </div>
                        <Input isTextArea rows={2} label="Hoặc nhập mục tiêu riêng của bạn:" value={aiPromoGoal} onChange={e => setAiPromoGoal(e.target.value)} placeholder="VD: Tăng đơn hàng cho dịch vụ giặt khô..." />
                        <Button onClick={() => handleGenerateSuggestion(aiPromoGoal)} disabled={!aiPromoGoal.trim()}>Tạo gợi ý theo mục tiêu riêng</Button>
                        <div className="text-xs text-text-muted p-2 bg-bg-subtle rounded-md">
                            <p className="font-semibold">Phân tích tự động:</p>
                            <p className="italic">{revenueInsight}</p>
                        </div>
                    </>
                )}

                {isGeneratingSuggestion && <div className="flex flex-col items-center justify-center h-48"><Spinner /><p className="mt-2 text-text-muted">AI đang phân tích và sáng tạo...</p></div>}
                
                {aiError && <p className="text-sm text-status-danger">{aiError}</p>}
                
                {aiSuggestions && (
                    <div className="mt-4 pt-4 border-t border-border-base">
                        <h4 className="font-semibold text-text-heading mb-2">AI đề xuất 3 phương án:</h4>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                            {aiSuggestions.map((suggestion, index) => {
                                const isUsed = suggestion.code && usedSuggestionCodes.includes(suggestion.code);
                                return (
                                <Card key={index} className="!shadow-sm bg-bg-subtle/50">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1 text-sm flex-grow">
                                            <p><strong>Tên:</strong> {suggestion.name}</p>
                                            <p><strong>Mã:</strong> <span className="font-mono text-brand-primary">{suggestion.code}</span></p>
                                            <p><strong>Chi tiết:</strong> Giảm {suggestion.discountType === 'percentage' ? `${suggestion.discountValue}%` : `${suggestion.discountValue?.toLocaleString('vi-VN')} VNĐ`}</p>
                                            {suggestion.minOrderAmount && <p><strong>Đơn tối thiểu:</strong> {suggestion.minOrderAmount.toLocaleString('vi-VN')} VNĐ</p>}
                                            {suggestion.maxDiscountAmount && <p><strong>Giảm tối đa:</strong> {suggestion.maxDiscountAmount.toLocaleString('vi-VN')} VNĐ</p>}
                                            {suggestion.applicableDaysOfWeek && suggestion.applicableDaysOfWeek.length > 0 && (
                                                <p><strong>Ngày áp dụng:</strong> {suggestion.applicableDaysOfWeek.map(d => daysOfWeek[d]).join(', ')}</p>
                                            )}
                                        </div>
                                        <Button onClick={() => handleUseSuggestion(suggestion)} size="sm" className="flex-shrink-0 ml-2" disabled={isUsed}>
                                            {isUsed ? 'Đã tạo' : 'Sử dụng'}
                                        </Button>
                                    </div>
                                </Card>
                            )})}
                        </div>
                         <Button onClick={() => { setAiSuggestions(null); setAiPromoGoal(''); setUsedSuggestionCodes([]); }} className="w-full mt-4" variant="secondary">Thử lại với mục tiêu khác</Button>
                    </div>
                )}
            </div>
        </Modal>
      )}

      {isAiCampaignModalOpen && (
        <Modal isOpen={isAiCampaignModalOpen} onClose={() => setIsAiCampaignModalOpen(false)} title="Trợ lý AI Gợi ý Chiến dịch Marketing" size="xl">
            <div className="space-y-4">
                 {!aiCampaignProposal && !isGeneratingCampaign && (
                    <>
                        <p className="text-sm text-text-muted">AI sẽ phân tích sâu dữ liệu kinh doanh của bạn để đề xuất một chiến dịch marketing hoàn chỉnh. Hãy chọn mục tiêu chính:</p>
                        <div className="flex flex-wrap gap-2">
                            {commonGoals.map(goal => (
                                <Button key={goal} variant="secondary" size="sm" onClick={() => handleGenerateCampaign(goal)}>{goal}</Button>
                            ))}
                        </div>
                        <Input isTextArea rows={2} label="Hoặc nhập mục tiêu chi tiết hơn:" value={aiCampaignGoal} onChange={e => setAiCampaignGoal(e.target.value)} placeholder="VD: Tăng nhận diện thương hiệu tại khu vực Thủ Đức..." />
                        <Button onClick={() => handleGenerateCampaign(aiCampaignGoal)} disabled={!aiCampaignGoal.trim()}>Tạo Đề xuất Chiến dịch</Button>
                        <div className="text-xs text-text-muted p-3 bg-bg-subtle rounded-md space-y-1">
                            <p className="font-semibold">Dữ liệu AI sẽ sử dụng để phân tích:</p>
                            <p><strong>Doanh thu:</strong> <span className="italic">{revenueInsight}</span></p>
                            <p><strong>Khách hàng:</strong> <span className="italic">{customerInsights}</span></p>
                            <p><strong>Dịch vụ:</strong> <span className="italic">{serviceInsights}</span></p>
                        </div>
                    </>
                 )}
                
                {isGeneratingCampaign && <div className="flex flex-col items-center justify-center h-48"><Spinner /><p className="mt-2 text-text-muted">AI đang xây dựng chiến lược...</p></div>}
                {aiCampaignError && <p className="text-sm text-status-danger">{aiCampaignError}</p>}

                {(aiCampaignProposal || aiCampaignError) && (
                    <div className="mt-4 pt-4 border-t border-border-base">
                        {aiCampaignProposal && (
                             <>
                                <h4 className="font-semibold text-text-heading mb-2">Đề xuất Chiến dịch Marketing từ AI:</h4>
                                <div className="prose prose-sm max-w-none text-text-body whitespace-pre-wrap p-3 bg-bg-subtle rounded-md border border-border-base max-h-80 overflow-y-auto" 
                                     dangerouslySetInnerHTML={{ __html: markdownToHtml(aiCampaignProposal) }}>
                                </div>
                             </>
                        )}
                        <Button 
                            onClick={() => { setAiCampaignProposal(null); setAiCampaignGoal(''); setAiCampaignError(null); }} 
                            className="w-full mt-4" 
                            variant="secondary">
                            Thử lại với mục tiêu khác
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
      )}

      {isReportModalOpen && reportingPromotion && (
         <ReasonModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            onConfirm={handleSendReport}
            title={`Báo cáo về KM: ${reportingPromotion.name}`}
            label="Nội dung báo cáo*"
            placeholder="VD: Chương trình không hiệu quả, khách hàng phàn nàn về điều kiện..."
            confirmText="Gửi Báo cáo"
        />
      )}
    </>
  );
};

export default PromotionManagementPage;