import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { StoreProfile, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SettingsIcon, SaveIcon, PlusCircleIcon, Trash2Icon, MapPinIcon, ClockIcon, AlertTriangleIcon, AwardIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StoreSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { getCurrentUserOwnerId, findStoreProfileByOwnerId, updateStoreProfile, addNotification } = useData();
  const navigate = useNavigate();

  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [pickupLocations, setPickupLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [defaultProcessingTime, setDefaultProcessingTime] = useState<number | string>('');
  
  // State for loyalty settings
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyAccrualRate, setLoyaltyAccrualRate] = useState<number | string>('');
  const [loyaltyRedemptionRate, setLoyaltyRedemptionRate] = useState<number | string>('');

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [saveReason, setSaveReason] = useState('');

  const ownerId = useMemo(() => getCurrentUserOwnerId(), [getCurrentUserOwnerId]);
  
  useEffect(() => {
    if (ownerId) {
      const profile = findStoreProfileByOwnerId(ownerId);
      if (profile) {
        setStoreProfile(profile);
        setPickupLocations(profile.pickupLocations || []);
        setDefaultProcessingTime(profile.defaultProcessingTimeHours ?? '');
        setLoyaltyEnabled(profile.loyaltySettings?.enabled || false);
        setLoyaltyAccrualRate(profile.loyaltySettings?.accrualRate ?? '');
        setLoyaltyRedemptionRate(profile.loyaltySettings?.redemptionRate ?? '');
      }
    }
  }, [ownerId, findStoreProfileByOwnerId]);
  
  const hasChanges = useMemo(() => {
    if (!storeProfile) return false;

    const originalLocations = storeProfile.pickupLocations || [];
    const originalTime = storeProfile.defaultProcessingTimeHours ?? '';
    const originalLoyalty = storeProfile.loyaltySettings || { enabled: false, accrualRate: '', redemptionRate: '' };
    
    if (Number(defaultProcessingTime) !== Number(originalTime)) return true;
    if (loyaltyEnabled !== originalLoyalty.enabled) return true;
    if (Number(loyaltyAccrualRate) !== Number(originalLoyalty.accrualRate)) return true;
    if (Number(loyaltyRedemptionRate) !== Number(originalLoyalty.redemptionRate)) return true;
    if (pickupLocations.length !== originalLocations.length) return true;
    
    const sortedOriginal = [...originalLocations].sort();
    const sortedCurrent = [...pickupLocations].sort();
    return sortedOriginal.some((loc, index) => loc !== sortedCurrent[index]);
  }, [storeProfile, pickupLocations, defaultProcessingTime, loyaltyEnabled, loyaltyAccrualRate, loyaltyRedemptionRate]);

  if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.MANAGER)) {
    // This check is belt-and-suspenders as routing should prevent this.
    navigate('/admin/dashboard');
    return null;
  }
  
  if (!storeProfile) {
    return <Card title="Cài đặt Cửa hàng"><p className="text-text-muted">Đang tải thông tin cửa hàng...</p></Card>;
  }

  const handleAddLocation = () => {
    if (newLocation.trim() && !pickupLocations.includes(newLocation.trim())) {
      setPickupLocations([...pickupLocations, newLocation.trim()]);
      setNewLocation('');
    }
  };
  
  const handleRemoveLocation = (locationToRemove: string) => {
    setPickupLocations(pickupLocations.filter(loc => loc !== locationToRemove));
  };
  
  const handleSaveSettings = () => {
    if (!saveReason.trim()) {
      addNotification({ message: 'Lý do cập nhật không được để trống.', type: 'error' });
      return;
    }
    
    const updates: Partial<StoreProfile> & { ownerId: string } = {
      ownerId: storeProfile.ownerId,
      pickupLocations: pickupLocations,
      defaultProcessingTimeHours: Number(defaultProcessingTime) || undefined,
      loyaltySettings: {
        enabled: loyaltyEnabled,
        accrualRate: Number(loyaltyAccrualRate) || 0,
        redemptionRate: Number(loyaltyRedemptionRate) || 0,
      }
    };
    
    updateStoreProfile(updates, saveReason);
    addNotification({ message: 'Đã lưu cài đặt cửa hàng.', type: 'success' });
    setIsReasonModalOpen(false);
    setSaveReason('');
  };

  return (
    <>
      <Card
        title="Cài đặt Cửa hàng"
        icon={<SettingsIcon className="text-brand-primary" size={24} />}
        actions={
          <Button onClick={() => setIsReasonModalOpen(true)} disabled={!hasChanges} leftIcon={<SaveIcon size={18} />}>
            Lưu Thay đổi
          </Button>
        }
      >
        <div className="space-y-8">
          {/* Loyalty Program Setting */}
          <Card title="Chương trình Khách hàng Thân thiết" icon={<AwardIcon size={20} />} className="bg-bg-subtle">
            <p className="text-sm text-text-muted mb-4">Kích hoạt và cấu hình chương trình tích điểm cho khách hàng.</p>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loyaltyEnabled}
                  onChange={e => setLoyaltyEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary-focus"
                />
                <span className="text-text-body font-medium">Kích hoạt chương trình tích điểm</span>
              </label>
              
              {loyaltyEnabled && (
                <div className="pl-8 space-y-3 pt-2 border-l-2 border-border-base ml-2">
                  <Input
                    label="Số tiền (VNĐ) để được 1 điểm"
                    type="number"
                    min="1000"
                    step="1000"
                    value={loyaltyAccrualRate}
                    onChange={e => setLoyaltyAccrualRate(e.target.value)}
                    placeholder="VD: 10000"
                  />
                  <Input
                    label="Giá trị quy đổi 1 điểm (VNĐ)"
                    type="number"
                    min="0"
                    step="100"
                    value={loyaltyRedemptionRate}
                    onChange={e => setLoyaltyRedemptionRate(e.target.value)}
                    placeholder="VD: 1000"
                  />
                </div>
              )}
            </div>
          </Card>
          
          {/* Pickup Locations Setting */}
          <Card title="Quản lý Vị trí Để đồ" icon={<MapPinIcon size={20} />} className="bg-bg-subtle">
            <p className="text-sm text-text-muted mb-4">Quản lý các vị trí để đồ cho khách sau khi giặt xong. VD: Kệ A1, Tủ B2.</p>
            <div className="space-y-2">
              {pickupLocations.map((loc, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-bg-surface rounded-md border">
                  <span className="text-text-body">{loc}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveLocation(loc)} className="p-1 text-status-danger" title="Xóa vị trí">
                    <Trash2Icon size={16} />
                  </Button>
                </div>
              ))}
               {pickupLocations.length === 0 && <p className="text-sm text-text-muted text-center py-2">Chưa có vị trí nào.</p>}
            </div>
            <div className="mt-4 flex space-x-2">
              <Input
                placeholder="Thêm vị trí mới..."
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                wrapperClassName="flex-grow"
              />
              <Button onClick={handleAddLocation} leftIcon={<PlusCircleIcon size={16} />}>Thêm</Button>
            </div>
          </Card>
          
          {/* Default Times Setting */}
          <Card title="Cài đặt Thời gian Mặc định" icon={<ClockIcon size={20} />} className="bg-bg-subtle">
            <p className="text-sm text-text-muted mb-4">Cài đặt thời gian xử lý mặc định cho các đơn hàng không có dịch vụ nào chỉ định thời gian cụ thể.</p>
            <Input
              label="Thời gian xử lý mặc định (giờ)"
              type="number"
              min="0.5"
              step="0.5"
              value={defaultProcessingTime}
              onChange={e => setDefaultProcessingTime(e.target.value)}
              placeholder="VD: 5"
            />
          </Card>
        </div>
      </Card>
      
      {/* Reason for Save Modal */}
      <Modal
        isOpen={isReasonModalOpen}
        onClose={() => setIsReasonModalOpen(false)}
        title="Xác nhận Lưu Cài đặt"
        size="md"
        footerContent={
          <>
            <Button variant="secondary" onClick={() => setIsReasonModalOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleSaveSettings} disabled={!saveReason.trim()}>Lưu</Button>
          </>
        }
      >
        <p className="text-text-body mb-4">Vui lòng nhập lý do bạn thay đổi cài đặt cửa hàng.</p>
        <Input
          isTextArea
          rows={3}
          label="Lý do cập nhật*"
          value={saveReason}
          onChange={e => setSaveReason(e.target.value)}
          placeholder="VD: Cập nhật lại các kệ để đồ, điều chỉnh thời gian xử lý chung..."
          required
        />
      </Modal>
    </>
  );
};

export default StoreSettingsPage;