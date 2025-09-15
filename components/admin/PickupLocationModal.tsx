import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { MapPinIcon, CheckIcon, XIcon } from 'lucide-react';

interface PickupLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: string) => void;
  orderId: string;
  locations: string[];
}

export const PickupLocationModal: React.FC<PickupLocationModalProps> = ({ isOpen, onClose, onConfirm, orderId, locations }) => {
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  useEffect(() => {
    if (isOpen && locations.length > 0) {
      setSelectedLocation(locations[0]); // Default to first location
    } else if (isOpen) {
      setSelectedLocation(''); // No locations available
    }
  }, [isOpen, locations]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedLocation && locations.length > 0) {
      alert('Vui lòng chọn một vị trí để đồ.');
      return;
    }
    if (locations.length === 0 && !selectedLocation){
        alert('Không có vị trí nào được cấu hình. Vui lòng thêm vị trí trong hệ thống hoặc nhập thủ công (nếu cho phép).');
        // For now, we require selection from PICKUP_LOCATIONS
        return;
    }
    onConfirm(selectedLocation);
  };

  const locationOptions = locations.map(loc => ({ value: loc, label: loc }));

  return (
    <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-[60] transition-opacity duration-300 animate-fadeIn">
      <Card 
        title={`Chọn Vị trí Để đồ cho ĐH: ${orderId}`} 
        icon={<MapPinIcon size={20} className="mr-2 text-brand-primary"/>}
        className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base"
      >
        <p className="text-sm text-text-muted mb-4">
          Đơn hàng đã xử lý xong. Vui lòng chọn vị trí để đồ cho khách hàng đến nhận.
        </p>
        {locations.length > 0 ? (
            <Select
            label="Vị trí để đồ*"
            options={locationOptions}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            required
            />
        ) : (
            <p className="text-sm text-status-warning p-3 bg-status-warning-bg rounded-md">
                Không có vị trí để đồ nào được cấu hình sẵn. Vui lòng cấu hình trong hệ thống.
            </p>
        )}
        
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} leftIcon={<XIcon size={16}/>}>Hủy</Button>
          <Button 
            variant="primary" 
            onClick={handleConfirm} 
            leftIcon={<CheckIcon size={16}/>}
            disabled={locations.length > 0 && !selectedLocation}
          >
            Xác nhận Vị trí
          </Button>
        </div>
      </Card>
    </div>
  );
};