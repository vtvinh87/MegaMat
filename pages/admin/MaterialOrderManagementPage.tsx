import React, { useState, useMemo, ChangeEvent, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom'; // Import Link
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialOrder, UserRole, MaterialItemDefinition, User } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { FilterIcon, ShoppingCart, CalendarDays, UserCircle, MessageSquare, Check, X, PlusCircleIcon, Trash2Icon, DollarSignIcon, Edit3Icon, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type MaterialOrderStatusFilter = MaterialOrder['status'] | 'all';

// Input for each item in the create modal
type CreateModalOrderItemInput = {
  materialItemDefinitionId: string;
  quantity: number | '';
  itemNotes?: string;
  // For display in modal only
  unitDisplay?: string;
  priceDisplay?: number;
  itemTotal?: number;
};


// Generic Reason/Input Modal
interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue: string) => void;
  title: string;
  description?: string;
  inputLabel: string;
  inputPlaceholder: string;
  confirmButtonText: string;
  confirmButtonVariant?: 'primary' | 'danger';
  requiresInput?: boolean; 
}

const ActionModal: React.FC<ActionModalProps> = ({ 
    isOpen, onClose, onConfirm, title, description, inputLabel, inputPlaceholder, 
    confirmButtonText, confirmButtonVariant = "primary", requiresInput = true 
}) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requiresInput && !inputValue.trim()) {
      alert(`${inputLabel} không được để trống.`);
      return;
    }
    onConfirm(inputValue);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
      <Card title={title} className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base">
        {description && <p className="text-sm text-text-muted mb-3">{description}</p>}
        <Input
          isTextArea={inputLabel.toLowerCase().includes("lý do") || inputLabel.toLowerCase().includes("ghi chú")}
          rows={3}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={inputPlaceholder}
          label={inputLabel}
          aria-label={inputLabel}
          required={requiresInput}
        />
        <div className="mt-4 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant={confirmButtonVariant} onClick={handleConfirm}>{confirmButtonText}</Button>
        </div>
      </Card>
    </div>
  );
};


interface CreateMaterialOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itemsData: { materialItemDefinitionId: string; quantity: number; itemNotes?: string }[], globalNotes?: string) => void;
  materialDefinitions: MaterialItemDefinition[];
}

const CreateMaterialOrderModal: React.FC<CreateMaterialOrderModalProps> = ({ isOpen, onClose, onConfirm, materialDefinitions }) => {
  const [items, setItems] = useState<CreateModalOrderItemInput[]>([{ materialItemDefinitionId: '', quantity: '', itemNotes: '' }]);
  const [globalNotes, setGlobalNotes] = useState('');
  const [overallTotal, setOverallTotal] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (materialDefinitions.length > 0) {
        const firstDef = materialDefinitions[0];
        setItems([{ 
            materialItemDefinitionId: firstDef.id, 
            quantity: 1, 
            itemNotes: '', 
            unitDisplay: firstDef.unit, 
            priceDisplay: firstDef.price,
            itemTotal: firstDef.price * 1
        }]);
      } else {
        setItems([{ materialItemDefinitionId: '', quantity: '', itemNotes: '' }]);
      }
      setGlobalNotes('');
    }
  }, [isOpen, materialDefinitions]);

  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.itemTotal || 0), 0);
    setOverallTotal(total);
  }, [items]);


  if (!isOpen) return null;

  const handleItemChange = (index: number, field: keyof CreateModalOrderItemInput, value: string | number) => {
    const newItems = [...items];
    const currentItem = { ...newItems[index] };

    if (field === 'materialItemDefinitionId') {
      const defId = value as string;
      const definition = materialDefinitions.find(d => d.id === defId);
      currentItem.materialItemDefinitionId = defId;
      currentItem.unitDisplay = definition?.unit || '';
      currentItem.priceDisplay = definition?.price || 0;
    } else if (field === 'quantity') {
      currentItem.quantity = value === '' ? '' : (parseInt(value as string, 10) || '');
    } else if (field === 'itemNotes') {
      currentItem.itemNotes = value as string;
    }
    
    // Recalculate itemTotal
    const qty = typeof currentItem.quantity === 'number' ? currentItem.quantity : 0;
    currentItem.itemTotal = (currentItem.priceDisplay || 0) * qty;
    
    newItems[index] = currentItem;
    setItems(newItems);
  };

  const handleAddItem = () => {
     const newItemBase: CreateModalOrderItemInput = { materialItemDefinitionId: '', quantity: 1, itemNotes: ''};
     if(materialDefinitions.length > 0) {
         newItemBase.materialItemDefinitionId = materialDefinitions[0].id;
         newItemBase.unitDisplay = materialDefinitions[0].unit;
         newItemBase.priceDisplay = materialDefinitions[0].price;
         newItemBase.itemTotal = materialDefinitions[0].price * 1;
     }
    setItems([...items, newItemBase]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    const validItemsToSubmit = items
      .filter(item => item.materialItemDefinitionId && item.quantity !== '' && Number(item.quantity) > 0)
      .map(item => ({
        materialItemDefinitionId: item.materialItemDefinitionId,
        quantity: Number(item.quantity),
        itemNotes: item.itemNotes?.trim() || undefined,
      }));

    if (validItemsToSubmit.length === 0) {
      alert("Vui lòng thêm ít nhất một nguyên vật liệu hợp lệ (chọn NVL và số lượng > 0).");
      return;
    }
    if (materialDefinitions.length === 0) {
        alert("Không có danh mục NVL nào được định nghĩa. Vui lòng thêm trong Quản lý Danh mục NVL trước.");
        return;
    }
    onConfirm(validItemsToSubmit, globalNotes.trim() || undefined);
    onClose();
  };
  
  const definitionOptions = materialDefinitions.map(def => ({value: def.id, label: `${def.name} (${def.price.toLocaleString('vi-VN')} VNĐ/${def.unit})`}));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
      <Card title="Tạo Đơn Đặt Nguyên Vật Liệu Mới" className="w-full max-w-2xl bg-bg-surface shadow-xl !border-border-base">
        <div className="space-y-5 max-h-[60vh] overflow-y-auto p-1">
          {items.map((item, index) => (
            <div key={index} className="p-4 border border-border-base rounded-lg bg-bg-subtle/30 relative">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-3 items-end">
                <Select
                  wrapperClassName="md:col-span-5"
                  label={`NVL ${index + 1}*`}
                  options={definitionOptions}
                  value={item.materialItemDefinitionId}
                  onChange={(e) => handleItemChange(index, 'materialItemDefinitionId', e.target.value)}
                  placeholder="-- Chọn NVL --"
                  disabled={materialDefinitions.length === 0}
                />
                <Input
                  wrapperClassName="md:col-span-2"
                  label="Số lượng*"
                  type="number"
                  min="1"
                  placeholder="SL"
                  value={item.quantity.toString()}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                />
                <div className="md:col-span-2 text-sm">
                  <span className="block text-xs text-text-muted">Đ.vị: {item.unitDisplay || '-'}</span>
                  <span className="block text-xs text-text-muted">Đ.giá: {(item.priceDisplay || 0).toLocaleString('vi-VN')}</span>
                </div>
                <div className="md:col-span-2 text-sm font-medium">
                  <span className="block text-xs text-text-muted">Thành tiền:</span>
                  {(item.itemTotal || 0).toLocaleString('vi-VN')} VNĐ
                </div>
                <div className="md:col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveItem(index)} className="p-2" title="Xóa NVL">
                      <Trash2Icon size={16} />
                    </Button>
                  )}
                </div>
              </div>
              <Input
                  wrapperClassName="mt-2"
                  label="Ghi chú cho NVL này (nếu có)"
                  placeholder="Ví dụ: loại ưu tiên, kiểm tra kỹ date..."
                  value={item.itemNotes || ''}
                  onChange={(e) => handleItemChange(index, 'itemNotes', e.target.value)}
                  className="text-xs py-1.5"
                />
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={handleAddItem} leftIcon={<PlusCircleIcon size={16}/>} size="sm" disabled={materialDefinitions.length === 0}>
            Thêm dòng NVL
          </Button>
          {materialDefinitions.length === 0 && <p className="text-xs text-status-warning">Không có NVL nào được định nghĩa. Hãy thêm trong phần "Quản lý Danh mục NVL".</p>}
          
          <Input
            isTextArea
            rows={2}
            label="Ghi chú chung cho đơn đặt hàng (nếu có)"
            placeholder="Ví dụ: Yêu cầu giao hàng gấp, liên hệ trước khi giao..."
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
          />
          <div className="mt-4 text-right font-bold text-lg text-text-heading">
            Tổng cộng đơn đặt: {overallTotal.toLocaleString('vi-VN')} VNĐ
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={materialDefinitions.length === 0}>Tạo Đơn Đặt</Button>
        </div>
      </Card>
    </div>
  );
};


const MaterialOrderManagementPage: React.FC = () => {
  // FIX: Replaced useAppContext with useData and useAuth
  const { 
    materialOrders, 
    approveMaterialOrder, 
    rejectMaterialOrder, 
    addMaterialOrder: contextAddMaterialOrder, 
    addNotification,
    materialItemDefinitions 
  } = useData();
  const { currentUser } = useAuth();
  
  const [statusFilter, setStatusFilter] = useState<MaterialOrderStatusFilter>('all'); 
  
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalConfig, setActionModalConfig] = useState<{
    orderId: string;
    action: 'approve' | 'reject';
    currentNotes?: string;
  } | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredMaterialOrders = useMemo(() => {
    return materialOrders
      .filter(order => statusFilter === 'all' || order.status === statusFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [materialOrders, statusFilter]);

  const getStatusClassAndText = (status: MaterialOrder['status']): { className: string, text: string } => {
    switch (status) {
      case 'Chờ duyệt': return { className: 'bg-status-warning-bg text-status-warning-text', text: 'Chờ duyệt' };
      case 'Đã duyệt': return { className: 'bg-status-success-bg text-status-success-text', text: 'Đã duyệt' };
      case 'Đã hủy': return { className: 'bg-status-danger-bg text-status-danger-text', text: 'Đã hủy' };
      default: return { className: 'bg-bg-subtle text-text-muted', text: status };
    }
  };

  const handleOpenActionModal = (order: MaterialOrder, action: 'approve' | 'reject') => {
    setActionModalConfig({ orderId: order.id, action, currentNotes: order.notes });
    setIsActionModalOpen(true);
  };
  
  const handleConfirmActionModal = (reasonOrNote: string) => {
    if (!actionModalConfig || !currentUser?.role) {
        addNotification({ message: "Hành động không hợp lệ hoặc không thể xác định người dùng.", type: "error" });
        return;
    }
    const {orderId, action} = actionModalConfig;

    if (action === 'reject') {
        rejectMaterialOrder(orderId, currentUser.role, reasonOrNote);
    } else if (action === 'approve') {
        approveMaterialOrder(orderId, currentUser.role, reasonOrNote);
    }
    setIsActionModalOpen(false);
    setActionModalConfig(null);
  };

  const handleCreateMaterialOrder = (
    itemsData: { materialItemDefinitionId: string; quantity: number; itemNotes?: string }[], 
    globalNotes?: string
  ) => {
    if (!currentUser?.role) {
        addNotification({ message: "Không thể xác định người dùng để tạo đơn đặt.", type: "error"});
        return;
    }
    contextAddMaterialOrder({ 
        items: itemsData,
        createdBy: currentUser.role, 
        notes: globalNotes 
    });
  };


  const statusOptions: { value: MaterialOrderStatusFilter; label: string }[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'Chờ duyệt', label: 'Chờ duyệt' },
    { value: 'Đã duyệt', label: 'Đã duyệt' },
    { value: 'Đã hủy', label: 'Đã hủy' },
  ];

  const tableHeaders = [
    { label: "Nguyên vật liệu chính", icon: <FileText size={14} /> },
    { label: "Mã Đặt NVL", icon: <ShoppingCart size={14} /> },
    { label: "Người tạo", icon: <UserCircle size={14} /> },
    { label: "Ngày tạo", icon: <CalendarDays size={14} /> },
    { label: "Tổng Tiền", icon: <DollarSignIcon size={14}/> },
    { label: "Trạng thái", icon: <FilterIcon size={14} /> },
    { label: "Ghi chú chung", icon: <MessageSquare size={14} /> },
    { label: "Hành động", icon: <Edit3Icon size={14} /> }
  ];

  const canPerformApproveRejectActions = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.MANAGER;
  const canCreateOrder = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.STAFF);

  return (
    <>
      <Card 
        title="Quản lý Đơn đặt Nguyên vật liệu"
        actions={canCreateOrder ? (
            <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<PlusCircleIcon size={18}/>}>
                Tạo Đơn Đặt NVL Mới
            </Button>
        ) : null}
      >
        <div className="mb-6">
          <Select
            label="Lọc theo trạng thái"
            options={statusOptions}
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as MaterialOrderStatusFilter)}
            leftIcon={<FilterIcon />}
          />
        </div>

        {filteredMaterialOrders.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có đơn đặt nguyên vật liệu nào phù hợp.</p>
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
                {filteredMaterialOrders.map(order => {
                  const statusInfo = getStatusClassAndText(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-bg-surface-hover transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body max-w-xs truncate">
                        <span title={order.items.map(item => `${item.nameSnapshot} (SL: ${item.quantity})`).join(', ')}>
                          {order.items[0]?.nameSnapshot || 'N/A'}
                          {order.items.length > 1 && <span className="text-text-muted text-xs ml-1">(+{order.items.length - 1})</span>}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-link hover:underline">
                        <Link to={`/admin/material-orders/${order.id}`}>{order.id}</Link>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{order.createdBy}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-body">
                        {order.totalAmount.toLocaleString('vi-VN')} VNĐ
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${statusInfo.className}`}>
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-text-muted max-w-xs truncate" title={order.notes}>{order.notes || '-'}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                        {order.status === 'Chờ duyệt' && canPerformApproveRejectActions && (
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm" title="Duyệt đơn" className="text-status-success hover:text-emerald-600 p-1.5" onClick={() => handleOpenActionModal(order, 'approve')}>
                              <Check size={18} />
                            </Button>
                            <Button variant="ghost" size="sm" title="Từ chối đơn" className="text-status-danger hover:text-rose-600 p-1.5" onClick={() => handleOpenActionModal(order, 'reject')}>
                              <X size={18} />
                            </Button>
                          </div>
                        )}
                        {(order.status !== 'Chờ duyệt' || !canPerformApproveRejectActions) && (
                            <span className="text-xs text-text-muted italic">Không có hành động</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      {isActionModalOpen && actionModalConfig && (
        <ActionModal
          isOpen={isActionModalOpen}
          onClose={() => { setIsActionModalOpen(false); setActionModalConfig(null);}}
          onConfirm={handleConfirmActionModal}
          title={actionModalConfig.action === 'approve' ? `Duyệt Đơn Đặt NVL: ${actionModalConfig.orderId}` : `Từ Chối Đơn Đặt NVL: ${actionModalConfig.orderId}`}
          description={actionModalConfig.action === 'approve' ? 'Bạn có thể thêm ghi chú cho việc duyệt đơn này (không bắt buộc).' : `Vui lòng nhập lý do bạn từ chối đơn đặt NVL này.`}
          inputLabel={actionModalConfig.action === 'approve' ? 'Ghi chú duyệt (không bắt buộc)' : 'Lý do từ chối*'}
          inputPlaceholder={actionModalConfig.action === 'approve' ? 'Nhập ghi chú...' : 'Nhập lý do...'}
          confirmButtonText={actionModalConfig.action === 'approve' ? 'Xác nhận Duyệt' : 'Xác nhận Từ chối'}
          confirmButtonVariant={actionModalConfig.action === 'approve' ? 'primary' : 'danger'}
          requiresInput={actionModalConfig.action === 'reject'}
        />
      )}

      <CreateMaterialOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreateMaterialOrder}
        materialDefinitions={materialItemDefinitions} 
      />
    </>
  );
};

export default MaterialOrderManagementPage;