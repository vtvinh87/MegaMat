import React, { useState, useMemo, ChangeEvent, FormEvent, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryItem, InventoryUpdateHistoryEntry, User, UserRole, InventoryAdjustmentRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PlusCircleIcon, EditIcon, SearchIcon, AlertTriangleIcon, Archive, Hash, CheckSquare, Sliders, Tag, CameraIcon, HistoryIcon, XCircleIcon, CheckIcon, XIcon, UserCheck, InboxIcon, ArrowRight, ClockIcon, MessageSquare, UserIcon, CalendarIcon } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { Spinner } from '../../components/ui/Spinner';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const InventoryManagementPage: React.FC = () => {
  const { 
    inventory, 
    addInventoryItem, 
    requestInventoryAdjustment, 
    approveInventoryAdjustment,
    rejectInventoryAdjustment,
    inventoryAdjustmentRequests,
    addNotification, 
    findUserById, 
    users,
    acknowledgedRejectedRequests,
    acknowledgeAllRejectedRequestsForItem,
  } = useData();
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<InventoryItem> & { requestedQuantity?: number } | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editReason, setEditReason] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [rejectionModalRequest, setRejectionModalRequest] = useState<InventoryAdjustmentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const canApprove = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);

  const pendingRequests = useMemo(() => {
    return inventoryAdjustmentRequests.filter(req => req.status === 'pending');
  }, [inventoryAdjustmentRequests]);
  
  const rejectedRequestIdsForCurrentUser = useMemo(() => {
    if (!currentUser) return new Set<string>();
    return new Set(
      inventoryAdjustmentRequests
        .filter(req => 
            req.status === 'rejected' && 
            req.requestedByUserId === currentUser.id &&
            !acknowledgedRejectedRequests.includes(req.id)
        )
        .map(req => req.inventoryItemId)
    );
  }, [inventoryAdjustmentRequests, currentUser, acknowledgedRejectedRequests]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [inventory, searchTerm]);

  const openModal = (mode: 'add' | 'edit', item: Partial<InventoryItem> | null = null) => {
    setModalMode(mode);
    if (mode === 'add') {
      setCurrentItem({ name: '', quantity: 0, unit: '', lowStockThreshold: 5 });
    } else if (item) {
      setCurrentItem({ ...item, requestedQuantity: item.quantity });
    }
    setEditReason('');
    setIsModalOpen(true);
    setScanError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentItem || !currentItem.name?.trim() || !currentItem.unit?.trim() || currentItem.lowStockThreshold === undefined) {
      alert('Tên, đơn vị tính và ngưỡng báo tồn là bắt buộc.');
      return;
    }
    
    if (modalMode === 'add') {
      const newItemPayload: Omit<InventoryItem, 'id' | 'ownerId'> = {
        name: currentItem.name!,
        quantity: Number(currentItem.requestedQuantity) || 0,
        unit: currentItem.unit!,
        lowStockThreshold: Number(currentItem.lowStockThreshold) || 0,
      };
      addInventoryItem(newItemPayload);
    } else if (currentItem.id) {
       if (!editReason.trim()) {
        alert('Lý do yêu cầu là bắt buộc.');
        return;
      }
      if (currentItem.requestedQuantity === undefined) {
        alert('Số lượng yêu cầu không hợp lệ.');
        return;
      }
      requestInventoryAdjustment(currentItem.id, Number(currentItem.requestedQuantity), editReason);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if(currentItem) {
        const { name, value, type } = e.target;
        setCurrentItem({ ...currentItem, [name]: type === 'number' ? parseFloat(value) : value });
    }
  };

  const handleImageScan = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !currentItem?.name) {
      return;
    }
    const file = event.target.files[0];
    setIsScanning(true);
    setScanError(null);

    try {
      if (!process.env.API_KEY) {
        throw new Error("API key is not configured for AI scanning.");
      }
      const base64Image = await fileToBase64(file);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const textPart = { text: `Count the number of "${currentItem.name}" in this image. Respond with only a single integer number.` };
      const imagePart = { inlineData: { mimeType: file.type, data: base64Image } };
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
      });
      
      const countText = response.text.trim();
      const count = parseInt(countText, 10);

      if (isNaN(count)) {
        throw new Error(`AI did not return a valid number. Response: "${countText}"`);
      }
      
      setCurrentItem(prev => prev ? { ...prev, requestedQuantity: count } : null);
      addNotification({ message: `AI đã đếm được ${count} ${currentItem.unit || 'sản phẩm'}.`, type: 'success' });

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("AI Scan Error:", err);
      setScanError(`Lỗi quét AI: ${message}`);
      addNotification({ message: `Lỗi quét AI: ${message}`, type: 'error' });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmRejection = () => {
    if (rejectionModalRequest && rejectionReason.trim()) {
      rejectInventoryAdjustment(rejectionModalRequest.id, rejectionReason);
      setRejectionModalRequest(null);
      setRejectionReason('');
    }
  };
  
  const tableHeaders = [
    { label: "Tên vật tư", icon: <Archive size={14}/> },
    { label: "Số lượng", icon: <Hash size={14}/> },
    { label: "Đơn vị", icon: <Tag size={14}/> }, 
    { label: "Ngưỡng báo tồn", icon: <Sliders size={14}/> },
    { label: "Trạng thái", icon: <CheckSquare size={14}/> },
    { label: "Hành động", icon: <EditIcon size={14}/> }
  ];

  return (
    <>
      {canApprove && pendingRequests.length > 0 && (
        <Card title="Yêu cầu Điều chỉnh Tồn kho Đang chờ" icon={<InboxIcon size={20} className="text-brand-primary" />} className="mb-6 border-l-4 border-brand-primary !bg-blue-50/60">
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {pendingRequests.map(req => (
              <div key={req.id} className="p-3 bg-bg-surface rounded-lg border border-border-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-grow">
                  <p className="font-semibold text-text-heading">{req.inventoryItemName}</p>
                  <p className="text-sm text-text-body">Yêu cầu bởi: <span className="font-medium">{findUserById(req.requestedByUserId)?.name || 'N/A'}</span></p>
                  <p className="text-sm text-text-body">Thay đổi: <span className="font-mono font-semibold">{req.currentQuantity} → {req.requestedQuantity}</span></p>
                  <p className="text-sm text-text-muted italic mt-1">Lý do: "{req.reason}"</p>
                </div>
                <div className="flex-shrink-0 flex items-center space-x-2 self-end sm:self-center">
                  <Button variant="danger" size="sm" onClick={() => setRejectionModalRequest(req)}>Từ chối</Button>
                  <Button variant="primary" size="sm" onClick={() => approveInventoryAdjustment(req.id)}>Duyệt</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card 
        title="Quản lý Tồn kho"
        actions={<Button onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18} />}>Thêm Vật tư</Button>}
      >
        <Input 
          placeholder="Tìm kiếm vật tư..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="mb-6"
          leftIcon={<SearchIcon />}
        />

        {filteredInventory.length === 0 ? (
          <p className="text-center text-text-muted py-10">Chưa có vật tư nào trong kho.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle/50 dark:bg-slate-700/30">
                <tr>
                  {tableHeaders.map(header => (
                    <th key={header.label} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <div className="flex items-center">
                        {React.cloneElement(header.icon as React.ReactElement<{ className?: string }>, {className: "mr-1.5 flex-shrink-0"})}
                        <span>{header.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-bg-surface divide-y divide-border-base">
                {filteredInventory.map(item => {
                  const pendingRequest = inventoryAdjustmentRequests.find(req => req.inventoryItemId === item.id && req.status === 'pending');
                  let statusElement: React.ReactNode;
                  let quantityElement: React.ReactNode;
                  const hasRejectedRequest = rejectedRequestIdsForCurrentUser.has(item.id);
                  
                  if (pendingRequest) {
                    const requesterName = findUserById(pendingRequest.requestedByUserId)?.name || 'Không rõ';
                    statusElement = (
                      <div>
                        <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-full text-xs">
                            <ClockIcon size={14} className="mr-1.5"/>Chờ duyệt
                        </span>
                        <span className="text-xs text-text-muted block mt-1">Y/c bởi: {requesterName}</span>
                      </div>
                    );
                    quantityElement = (
                        <div className="flex items-center justify-start space-x-2">
                            <span className="line-through text-text-muted">{pendingRequest.currentQuantity}</span>
                            <ArrowRight size={14} className="text-brand-primary"/>
                            <span className="font-bold text-brand-primary">{pendingRequest.requestedQuantity}</span>
                        </div>
                    );
                  } else {
                    if (item.quantity <= 0) {
                        statusElement = (
                            <span className="text-status-danger-text dark:text-rose-300 font-semibold flex items-center">
                                <XCircleIcon size={16} className="mr-1.5"/>Hết hàng
                            </span>
                        );
                    } else if (item.quantity <= item.lowStockThreshold) {
                        statusElement = (
                            <span className="text-status-warning-text dark:text-amber-300 font-semibold flex items-center">
                                <AlertTriangleIcon size={16} className="mr-1.5"/>Sắp hết
                            </span>
                        );
                    } else {
                        statusElement = <span className="text-status-success-text dark:text-emerald-300">Còn hàng</span>;
                    }
                    quantityElement = <span className="font-bold">{item.quantity}</span>;
                  }

                  return (
                    <tr key={item.id} className={`${item.quantity <= 0 && !pendingRequest ? 'bg-status-danger-bg/40' : item.quantity <= item.lowStockThreshold && !pendingRequest ? 'bg-status-warning-bg/50' : ''} hover:bg-bg-surface-hover transition-colors`}>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading flex items-center">
                          {item.name}
                          {hasRejectedRequest && (
                            <button
                                onClick={() => acknowledgeAllRejectedRequestsForItem(item.id)}
                                className="ml-2 p-0.5 rounded-full text-status-danger hover:bg-status-danger-bg/50 transition-colors"
                                title="Bạn có yêu cầu bị từ chối cho vật tư này. Nhấn để ẩn cảnh báo."
                                aria-label={`Ẩn cảnh báo bị từ chối cho ${item.name}`}
                            >
                                <XCircleIcon size={16}/>
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{quantityElement}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.unit}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.lowStockThreshold}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm">{statusElement}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-1">
                                <Button variant="ghost" size="sm" onClick={() => openModal('edit', item)} title={pendingRequest ? "Vật tư này có một yêu cầu điều chỉnh đang chờ duyệt." : "Sửa"} className="text-text-link hover:text-brand-primary p-1.5" disabled={!!pendingRequest}>
                                    <EditIcon size={18}/>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setHistoryItem(item)} title="Xem lịch sử thay đổi" className="text-text-muted hover:text-brand-primary p-1.5" disabled={!item.history || item.history.length === 0}>
                                    <HistoryIcon size={18}/>
                                </Button>
                            </div>
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && currentItem && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Vật tư mới' : 'Yêu cầu Điều chỉnh Vật tư'}
          size="lg"
        >
          <form onSubmit={handleSave}>
            <div className="space-y-4 pt-2">
              <Input label="Tên vật tư*" name="name" value={currentItem.name || ''} onChange={handleInputChange} required disabled={modalMode === 'edit'}/>
              
              <div>
                <div className="flex justify-between items-end">
                   <Input 
                    label={modalMode === 'add' ? 'Số lượng ban đầu*' : 'Số lượng mới*'}
                    name="requestedQuantity" 
                    type="number" 
                    min="0" 
                    value={currentItem.requestedQuantity === undefined ? '' : currentItem.requestedQuantity} 
                    onChange={handleInputChange} 
                    required 
                    wrapperClassName="flex-grow"
                  />
                  <Button 
                    type="button"
                    variant="secondary" 
                    className="ml-2 mb-0" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning || !currentItem.name}
                    title={!currentItem.name ? "Vui lòng nhập Tên vật tư trước" : "Quét ảnh để đếm số lượng"}
                    leftIcon={isScanning ? <Spinner size="sm" /> : <CameraIcon size={16}/>}
                  >
                    {isScanning ? 'Đang quét...' : 'Quét AI'}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageScan}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                 {modalMode === 'edit' && <p className="text-xs text-text-muted mt-1">Số lượng hiện tại: {currentItem.quantity}</p>}
                {scanError && <p className="text-xs text-status-danger mt-1">{scanError}</p>}
              </div>

              <Input label="Đơn vị tính*" name="unit" value={currentItem.unit || ''} onChange={handleInputChange} required disabled={modalMode === 'edit'} />
              <Input label="Ngưỡng báo tồn*" name="lowStockThreshold" type="number" min="0" value={currentItem.lowStockThreshold === undefined ? '' : currentItem.lowStockThreshold} onChange={handleInputChange} required />
              
              {modalMode === 'edit' && (
                <Input
                  isTextArea
                  rows={3}
                  label="Lý do yêu cầu thay đổi*"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="VD: Kiểm kho thực tế, nhập bù số lượng hỏng..."
                  required
                />
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">{modalMode === 'add' ? 'Thêm mới' : 'Gửi Yêu cầu'}</Button>
            </div>
          </form>
        </Modal>
      )}
      
      {historyItem && (
        <Modal isOpen={true} onClose={() => setHistoryItem(null)} title={`Lịch sử thay đổi: ${historyItem.name}`} size="5xl">
          <div className="max-h-[70vh] overflow-y-auto">
            {(!historyItem.history || historyItem.history.length === 0) ? (
              <p className="text-text-muted text-center py-4">Không có lịch sử thay đổi nào cho vật tư này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-bg-subtle z-10">
                    <tr>
                      <th className="p-2 text-left font-semibold text-text-muted"><CheckSquare size={14} className="inline mr-1.5"/>Trạng thái</th>
                      <th className="p-2 text-left font-semibold text-text-muted"><UserIcon size={14} className="inline mr-1.5"/>Người Y/C</th>
                      <th className="p-2 text-left font-semibold text-text-muted"><CalendarIcon size={14} className="inline mr-1.5"/>Thời gian Y/C</th>
                      <th className="p-2 text-left font-semibold text-text-muted"><UserCheck size={14} className="inline mr-1.5"/>Người P.Hồi</th>
                      <th className="p-2 text-left font-semibold text-text-muted"><CalendarIcon size={14} className="inline mr-1.5"/>Thời gian P.Hồi</th>
                      <th className="p-2 text-right font-semibold text-text-muted"><Hash size={14} className="inline mr-1.5"/>Thay đổi SL</th>
                      <th className="p-2 text-left font-semibold text-text-muted"><MessageSquare size={14} className="inline mr-1.5"/>Lý do Y/C</th>
                      <th className="p-2 text-left font-semibold text-text-muted"><MessageSquare size={14} className="inline mr-1.5"/>Ghi chú/Lý do Từ chối</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base">
                    {[...historyItem.history].sort((a, b) => {
                        const dateA = a.respondedAt || a.timestamp;
                        const dateB = b.respondedAt || b.timestamp;
                        if (!dateA || !dateB) return 0;
                        return new Date(dateB).getTime() - new Date(dateA).getTime();
                    }).map(entry => {
                      const respondedTime = entry.respondedAt || entry.timestamp;
                      const key = (respondedTime ? new Date(respondedTime).toISOString() : uuidv4()) + entry.requestedByUserId;
                      const isApproved = entry.status === 'approved';
                      
                      return (
                        <tr key={key} className={isApproved ? '' : 'bg-status-danger-bg/20'}>
                          <td className="p-2 whitespace-nowrap">
                            {isApproved ? (
                              <span className="font-semibold text-status-success-text inline-flex items-center"><CheckIcon size={14} className="mr-1"/>Đã duyệt</span>
                            ) : (
                              <span className="font-semibold text-status-danger-text inline-flex items-center"><XIcon size={14} className="mr-1"/>Bị từ chối</span>
                            )}
                          </td>
                          <td className="p-2">{findUserById(entry.requestedByUserId)?.name || 'Không rõ'}</td>
                          <td className="p-2 whitespace-nowrap">{entry.requestedAt ? new Date(entry.requestedAt).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'}) : 'N/A'}</td>
                          <td className="p-2">{findUserById(entry.respondedByUserId)?.name || 'Không rõ'}</td>
                          <td className="p-2 whitespace-nowrap">{respondedTime ? new Date(respondedTime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'}) : 'N/A'}</td>
                          <td className="p-2 text-right font-mono">
                            {entry.previousQuantity} → {entry.newQuantity}
                            {!isApproved && <span className="text-xs text-status-danger-text ml-1">(Bị từ chối)</span>}
                          </td>
                          <td className="p-2 max-w-xs truncate" title={entry.reason}>{entry.reason}</td>
                          <td className="p-2 max-w-xs truncate" title={entry.rejectionReason}>{entry.rejectionReason || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

       {rejectionModalRequest && (
        <Modal
          isOpen={true}
          onClose={() => setRejectionModalRequest(null)}
          title={`Từ chối Yêu cầu cho "${rejectionModalRequest.inventoryItemName}"`}
          footerContent={
            <>
              <Button variant="secondary" onClick={() => setRejectionModalRequest(null)}>Hủy</Button>
              <Button variant="danger" onClick={handleConfirmRejection} disabled={!rejectionReason.trim()}>Xác nhận Từ chối</Button>
            </>
          }
        >
            <Input
                isTextArea
                rows={3}
                label="Lý do từ chối*"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                required
            />
        </Modal>
      )}
    </>
  );
};

export default InventoryManagementPage;