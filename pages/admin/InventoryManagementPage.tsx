
import React, { useState, useMemo, ChangeEvent, FormEvent, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { InventoryItem } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PlusCircleIcon, EditIcon, SearchIcon, AlertTriangleIcon, Archive, Hash, CheckSquare, Sliders, Tag, CameraIcon } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
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
  const { inventory, addInventoryItem, updateInventoryItem, addNotification } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<InventoryItem> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [inventory, searchTerm]);

  const openModal = (mode: 'add' | 'edit', item: Partial<InventoryItem> | null = null) => {
    setModalMode(mode);
    setCurrentItem(mode === 'add' ? { name: '', quantity: 0, unit: '', lowStockThreshold: 5 } : { ...item });
    setIsModalOpen(true);
    setScanError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentItem || !currentItem.name || !currentItem.unit || currentItem.quantity === undefined || currentItem.lowStockThreshold === undefined) {
      alert('Tên, đơn vị tính, số lượng, và ngưỡng báo tồn là bắt buộc.');
      return;
    }
    
    if (modalMode === 'add') {
      const newItemPayload: Omit<InventoryItem, 'id' | 'ownerId'> = {
        name: currentItem.name!,
        quantity: Number(currentItem.quantity) || 0,
        unit: currentItem.unit!,
        lowStockThreshold: Number(currentItem.lowStockThreshold) || 0,
      };
      addInventoryItem(newItemPayload);
    } else if (currentItem.id) {
      const itemToUpdate: InventoryItem = {
        id: currentItem.id!,
        ownerId: currentItem.ownerId!,
        name: currentItem.name!,
        quantity: Number(currentItem.quantity) || 0,
        unit: currentItem.unit!,
        lowStockThreshold: Number(currentItem.lowStockThreshold) || 0,
      };
      updateInventoryItem(itemToUpdate);
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
      
      setCurrentItem(prev => prev ? { ...prev, quantity: count } : null);
      addNotification({ message: `AI đã đếm được ${count} ${currentItem.unit || 'sản phẩm'}.`, type: 'success' });

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("AI Scan Error:", err);
      setScanError(`Lỗi quét AI: ${message}`);
      addNotification({ message: `Lỗi quét AI: ${message}`, type: 'error' });
    } finally {
      setIsScanning(false);
      // Reset file input value to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
      <Card 
        title="Quản lý Tồn kho"
        actions={
          <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm vật tư</Button>
        }
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
                {filteredInventory.map(item => (
                  <tr key={item.id} className={`${item.quantity <= item.lowStockThreshold ? 'bg-status-warning-bg/50 dark:bg-amber-800/30' : ''} hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors`}>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{item.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.quantity}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.unit}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.lowStockThreshold}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
                      {item.quantity <= item.lowStockThreshold ? 
                        <span className="text-status-warning-text dark:text-amber-300 font-semibold flex items-center">
                          <AlertTriangleIcon size={16} className="mr-1.5"/>Sắp hết
                        </span> : 
                        <span className="text-status-success-text dark:text-emerald-300">Còn hàng</span>
                      }
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => openModal('edit', item)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
                        <EditIcon size={18}/>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && currentItem && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Vật tư mới' : 'Sửa thông tin Vật tư'}
          size="lg"
        >
          <form onSubmit={handleSave}>
            <div className="space-y-4 pt-2">
              <Input label="Tên vật tư*" name="name" value={currentItem.name || ''} onChange={handleInputChange} required />
              
              <div>
                <div className="flex justify-between items-end">
                  <Input 
                    label="Số lượng*" 
                    name="quantity" 
                    type="number" 
                    min="0" 
                    value={currentItem.quantity === undefined ? '' : currentItem.quantity} 
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
                {scanError && <p className="text-xs text-status-danger mt-1">{scanError}</p>}
              </div>

              <Input label="Đơn vị tính*" name="unit" value={currentItem.unit || ''} onChange={handleInputChange} required />
              <Input label="Ngưỡng báo tồn*" name="lowStockThreshold" type="number" min="0" value={currentItem.lowStockThreshold === undefined ? '' : currentItem.lowStockThreshold} onChange={handleInputChange} required />
            </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">Lưu</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default InventoryManagementPage;
