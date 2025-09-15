import React, { useState, useMemo, ChangeEvent, FormEvent, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Promotion, UserRole, Order, User, ServiceItem, WashMethod } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { GoogleGenAI, Type } from '@google/genai';
import { Spinner } from '../../components/ui/Spinner';
import { PlusCircleIcon, EditIcon, Trash2Icon, SearchIcon, TagIcon, Percent, DollarSign, Calendar, AlertTriangle, CheckCircle, XCircle, BarChart2, TrendingUp, Users, SparklesIcon, Building, ShieldCheck, ShieldAlert, ShieldOff, BanIcon, HelpCircleIcon, Settings2Icon, DropletsIcon } from 'lucide-react';
import { WASH_METHOD_OPTIONS } from '../../constants';


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
  onRequestOptOut: (id: string, reason: string) => void;
  onRespondToOptOut: (promoId: string, ownerId: string, response: 'approved' | 'rejected', reason?: string) => void;
  onRequestCancellation: (id: string, reason: string) => void;
  onRespondToCancellation: (id: string) => void;
}> = ({ promotion, orders, users, currentUser, onEdit, onDelete, onRequestOptOut, onRespondToOptOut, onRequestCancellation, onRespondToCancellation }) => {
    
    const [reasonModal, setReasonModal] = useState<'optOut' | 'cancelRequest' | 'rejectOptOut' | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [currentOwnerToReject, setCurrentOwnerToReject] = useState<string | null>(null);

    const isChairman = currentUser.role === UserRole.CHAIRMAN;
    const isOwner = currentUser.role === UserRole.OWNER;
    const isMyStorePromo = promotion.ownerId === currentUser.id;

    // Analytics calculation
    const relatedOrders = useMemo(() => orders.filter(o => o.appliedPromotionId === promotion.id), [orders, promotion.id]);
    const totalDiscountGiven = useMemo(() => relatedOrders.reduce((sum, o) => sum + (o.promotionDiscountAmount || 0), 0), [relatedOrders]);
    const revenueGenerated = useMemo(() => relatedOrders.reduce((sum, o) => sum + o.totalAmount, 0), [relatedOrders]);
    
    const ownerName = useMemo(() => users.find(u => u.id === promotion.ownerId)?.name || 'Không rõ', [users, promotion.ownerId]);

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
        return promotion.isActive ? 
            <span className="flex items-center text-xs text-status-success"><CheckCircle size={14} className="mr-1"/>Hoạt động</span> : 
            <span className="flex items-center text-xs text-status-danger"><XCircle size={14} className="mr-1"/>Không hoạt động</span>
    };

    const renderActionButtons = () => {
        // Chairman's actions
        if (isChairman) {
            if (promotion.isSystemWide) { // Chairman's own promo
                return <>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)} className="p-2" title="Chỉnh sửa"><EditIcon size={18} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="p-2 text-status-danger" title="Xóa"><Trash2Icon size={18} /></Button>
                </>
            } else { // Store's promo
                 return <Button variant="ghost" size="sm" onClick={() => setReasonModal('cancelRequest')} className="p-2 text-amber-600" title="Yêu cầu hủy"><BanIcon size={18} /></Button>
            }
        }
        // Owner's actions
        if (isOwner) {
            if (promotion.isSystemWide) { // System-wide promo
                if (!myOptOutRequest || myOptOutRequest.status === 'rejected') {
                    return <Button variant="secondary" size="sm" onClick={() => setReasonModal('optOut')}>Từ chối tham gia</Button>
                }
            } else if (isMyStorePromo) { // My own promo
                if (myCancellationRequest?.status === 'pending') {
                    return <Button variant="danger" size="sm" onClick={() => onRespondToCancellation(promotion.id)}>Chấp thuận Hủy</Button>
                }
                return <>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)} className="p-2" title="Chỉnh sửa"><EditIcon size={18} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="p-2 text-status-danger" title="Xóa"><Trash2Icon size={18} /></Button>
                </>
            }
        }
        // For Manager, they can edit/delete promos of their store owner
        if(currentUser.role === UserRole.MANAGER && promotion.ownerId === currentUser.managedBy){
             return <>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)} className="p-2" title="Chỉnh sửa"><EditIcon size={18} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="p-2 text-status-danger" title="Xóa"><Trash2Icon size={18} /></Button>
                </>
        }

        return null;
    };


    return (
        <>
            <Card className="flex flex-col h-full relative">
                <span className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded-full ${promotion.isSystemWide ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {promotion.isSystemWide ? "Toàn Chuỗi" : `Cửa hàng: ${ownerName}`}
                </span>
                
                <div className="flex justify-between items-start pb-2">
                    <div>
                        <h3 className="text-lg font-bold text-text-heading pr-20">{promotion.name}</h3>
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
  const { promotions, addPromotion, updatePromotion, deletePromotion, orders, users, requestPromotionOptOut, respondToOptOutRequest, requestPromotionCancellation, respondToCancellationRequest, addNotification, services } = useData();
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
  // --- END: AI Suggestion State ---

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
        promos = promotions.filter(p => 
            p.ownerId === currentUser.id || 
            (p.isSystemWide)
        );
    }
    else if (currentUser?.role === UserRole.MANAGER) {
        promos = promotions.filter(p => 
            p.ownerId === currentUser.managedBy ||
            (p.isSystemWide)
        );
    }
    
    return promos.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
  }, [promotions, searchTerm, isChairman, isOwner, storeFilter, currentUser]);
  
  // Revenue analysis for AI suggestion
  useMemo(() => {
    if (!isAiSuggestModalOpen) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonthToDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const revenueThisMonth = orders
        .filter(o => new Date(o.createdAt) >= startOfMonth)
        .reduce((sum, o) => sum + o.totalAmount, 0);
    
    const revenueLastMonthToDate = orders
        .filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= startOfLastMonth && orderDate <= endOfLastMonthToDate;
        })
        .reduce((sum, o) => sum + o.totalAmount, 0);

    let insight = "Doanh thu tháng này ổn định.";
    if (revenueLastMonthToDate > 0 && revenueThisMonth < revenueLastMonthToDate) {
        const percentageDrop = ((revenueLastMonthToDate - revenueThisMonth) / revenueLastMonthToDate) * 100;
        insight = `Phân tích dữ liệu: Doanh thu tháng này (${revenueThisMonth.toLocaleString('vi-VN')} VNĐ) đang thấp hơn khoảng ${percentageDrop.toFixed(0)}% so với cùng kỳ tháng trước (${revenueLastMonthToDate.toLocaleString('vi-VN')} VNĐ). Cần một chương trình khuyến mãi mạnh để kích cầu.`;
    } else if (revenueThisMonth > revenueLastMonthToDate) {
        insight = `Phân tích dữ liệu: Doanh thu tháng này đang tăng trưởng tốt so với tháng trước. Nên tập trung vào việc tri ân khách hàng cũ hoặc thu hút khách hàng mới để giữ đà tăng trưởng.`;
    }
    setRevenueInsight(insight);
  }, [isAiSuggestModalOpen, orders]);


  const handleGenerateSuggestion = async (goal: string) => {
    if (!goal.trim() || !process.env.API_KEY) {
        setAiError("Vui lòng chọn hoặc nhập một mục tiêu.");
        return;
    }
    setIsGeneratingSuggestion(true);
    setAiError(null);
    setAiSuggestions(null);
    
    const now = new Date();
    const eventContext = getVietnameseEvents(now.getMonth());
    const serviceListText = services.map(s => `ID: ${s.id}, Tên: ${s.name}, PP Giặt: ${s.washMethod}`).join('; ');

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
                  applicableWashMethods: {
                      type: Type.ARRAY,
                      description: 'Mảng các phương pháp giặt được áp dụng. CHỈ dùng khi mục tiêu liên quan đến PP giặt. Nếu không, bỏ trống.',
                      nullable: true,
                      items: { type: Type.STRING, enum: Object.values(WashMethod) }
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
        - Các phương pháp giặt có sẵn: ${Object.values(WashMethod).join(', ')}
        - Các kênh bán hàng: online (khách tự đặt), instore (nhân viên tạo tại cửa hàng).

        Lưu ý quan trọng:
        - Nếu mục tiêu liên quan đến ngày cụ thể (ví dụ: 'tăng doanh thu cuối tuần'), hãy sử dụng trường 'applicableDaysOfWeek'. Cuối tuần là [0, 6]. Thứ 3 và 5 là [2, 4].
        - Nếu mục tiêu liên quan đến dịch vụ (ví dụ: 'giặt khô', 'giặt vest'), hãy tìm ID dịch vụ tương ứng từ danh sách và dùng 'applicableServiceIds'.
        - Nếu mục tiêu liên quan đến phương pháp giặt (ví dụ: 'giặt ướt'), hãy dùng 'applicableWashMethods'.
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

  const handleUseSuggestion = (suggestion: Partial<Promotion>) => {
    openModal('add', {
        ...suggestion,
        type: 'discount_voucher',
        isActive: true,
        usageLimitPerCustomer: 1,
    });
    setIsAiSuggestModalOpen(false);
    setAiPromoGoal('');
    setAiSuggestions(null);
  };

  const openModal = (mode: 'add' | 'edit', promotion: Partial<Promotion> | null = null) => {
    if (!canManage) return;
    setModalMode(mode);
    setFormError(null);
    setCurrentPromotion(mode === 'add' ? (promotion || {
      name: '', code: '', type: 'discount_voucher', discountType: 'percentage',
      discountValue: 10, isActive: true, minOrderAmount: undefined, maxDiscountAmount: undefined,
      usageLimit: undefined, usageLimitPerCustomer: 1, isSystemWide: false, applicableDaysOfWeek: [], 
      applicableServiceIds: [], applicableWashMethods: [], applicableChannels: []
    }) : { ...promotion });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setCurrentPromotion(null); };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentPromotion || !currentPromotion.name?.trim() || !currentPromotion.code?.trim() || !currentPromotion.discountType || currentPromotion.discountValue === undefined) {
      setFormError('Tên, Mã, Loại và Giá trị giảm giá là bắt buộc.');
      return;
    }
    if (promotions.some(p => p.code.toLowerCase() === currentPromotion.code?.toLowerCase() && p.id !== currentPromotion.id)) {
        setFormError('Mã khuyến mãi này đã tồn tại.');
        return;
    }
    const isSystemWide = isChairman && currentPromotion.isSystemWide;

    const promotionData = {
      name: currentPromotion.name, code: currentPromotion.code.toUpperCase(), type: currentPromotion.type!,
      discountType: currentPromotion.discountType, discountValue: Number(currentPromotion.discountValue),
      isActive: currentPromotion.isActive || false,
      startDate: currentPromotion.startDate ? new Date(currentPromotion.startDate) : undefined,
      endDate: currentPromotion.endDate ? new Date(currentPromotion.endDate) : undefined,
      applicableDaysOfWeek: currentPromotion.applicableDaysOfWeek?.length ? currentPromotion.applicableDaysOfWeek : undefined,
      applicableServiceIds: currentPromotion.applicableServiceIds?.length ? currentPromotion.applicableServiceIds : undefined,
      applicableWashMethods: currentPromotion.applicableWashMethods?.length ? currentPromotion.applicableWashMethods : undefined,
      applicableChannels: currentPromotion.applicableChannels?.length ? currentPromotion.applicableChannels : undefined,
      minOrderAmount: currentPromotion.minOrderAmount ? Number(currentPromotion.minOrderAmount) : undefined,
      maxDiscountAmount: currentPromotion.maxDiscountAmount ? Number(currentPromotion.maxDiscountAmount) : undefined,
      usageLimit: currentPromotion.usageLimit ? Number(currentPromotion.usageLimit) : undefined,
      usageLimitPerCustomer: currentPromotion.usageLimitPerCustomer ? Number(currentPromotion.usageLimitPerCustomer) : undefined,
      isSystemWide: isSystemWide,
    };
    
    if (modalMode === 'add') {
      addPromotion(promotionData as Omit<Promotion, 'id' | 'timesUsed' | 'ownerId'> & { isSystemWide?: boolean });
    } else if (currentPromotion.id) {
      updatePromotion({ ...currentPromotion, ...promotionData } as Promotion);
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

  const handleWashMethodChange = (washMethod: WashMethod) => {
      if (!currentPromotion) return;
      const currentMethods = currentPromotion.applicableWashMethods || [];
      const newMethods = currentMethods.includes(washMethod)
        ? currentMethods.filter(m => m !== washMethod)
        : [...currentMethods, washMethod];
      setCurrentPromotion({ ...currentPromotion, applicableWashMethods: newMethods });
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
        setCurrentPromotion({ ...currentPromotion, [name]: (e.target as HTMLInputElement).checked });
    } else {
        setCurrentPromotion({ ...currentPromotion, [name]: value });
    }
  };

  const handleDelete = (promotionId: string) => { if (window.confirm('Bạn có chắc muốn xóa khuyến mãi này không?')) { deletePromotion(promotionId); } };

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

  return (
    <>
      <Card
        title="Quản lý Khuyến mãi"
        icon={<TagIcon className="text-brand-primary" size={24} />}
        actions={canManage && (
            <div className="flex space-x-2">
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
                        onRequestOptOut={requestPromotionOptOut}
                        onRespondToOptOut={respondToOptOutRequest}
                        onRequestCancellation={requestPromotionCancellation}
                        onRespondToCancellation={respondToCancellationRequest.bind(null, p.id, 'approved')}
                    />
                ))}
            </div>
        ) : (
            <p className="text-center text-text-muted py-10">Không có chương trình khuyến mãi nào được tìm thấy.</p>
        )}
      </Card>
      
      {isModalOpen && currentPromotion && canManage && (
        <Modal isOpen={isModalOpen} onClose={closeModal} title={modalMode === 'add' ? 'Tạo Khuyến mãi' : 'Sửa Khuyến mãi'} size="xl">
          <form onSubmit={handleSave} className="space-y-4 pt-2 max-h-[80vh] overflow-y-auto pr-2">
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
                {currentPromotion.applicableWashMethods && currentPromotion.applicableWashMethods.length > 0 && (
                    <p className="text-xs text-status-warning-text p-2 bg-status-warning-bg rounded-md mb-2">
                        Không thể chọn điều kiện Dịch vụ khi đã chọn điều kiện Phương pháp Giặt.
                    </p>
                )}
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-bg-subtle rounded-md">
                    {services.map(service => (
                        <label key={service.id} className={`flex items-center space-x-2 p-1 hover:bg-bg-surface rounded ${!!currentPromotion.applicableWashMethods?.length ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={currentPromotion.applicableServiceIds?.includes(service.id) || false} onChange={() => handleServiceIdChange(service.id)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" disabled={!!currentPromotion.applicableWashMethods?.length} />
                            <span className="text-sm">{service.name} ({service.washMethod})</span>
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
                    {WASH_METHOD_OPTIONS.map(option => (
                        <label key={option.value} className={`flex items-center space-x-2 ${!!currentPromotion.applicableServiceIds?.length ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={currentPromotion.applicableWashMethods?.includes(option.value) || false} onChange={() => handleWashMethodChange(option.value)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus" disabled={!!currentPromotion.applicableServiceIds?.length} />
                            <span className="text-sm">{option.label}</span>
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
                <input type="checkbox" name="isActive" checked={!!currentPromotion.isActive} onChange={handleInputChange} className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus"/>
                <span className="text-text-body font-medium">Kích hoạt khuyến mãi</span>
            </label>
            
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">Lưu</Button>
            </div>
          </form>
        </Modal>
      )}

      {isAiSuggestModalOpen && (
        <Modal isOpen={isAiSuggestModalOpen} onClose={() => setIsAiSuggestModalOpen(false)} title="Trợ lý AI Gợi ý Khuyến mãi" size="xl">
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
                            {aiSuggestions.map((suggestion, index) => (
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
                                        <Button onClick={() => handleUseSuggestion(suggestion)} size="sm" className="flex-shrink-0 ml-2">Sử dụng</Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                         <Button onClick={() => { setAiSuggestions(null); setAiPromoGoal(''); }} className="w-full mt-4" variant="secondary">Thử lại với mục tiêu khác</Button>
                    </div>
                )}
            </div>
        </Modal>
      )}
    </>
  );
};

export default PromotionManagementPage;