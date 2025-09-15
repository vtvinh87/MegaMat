
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ServiceItem } from '../../../types';

type Props = {
  servicesData: ServiceItem[];
  setServicesData: React.Dispatch<React.SetStateAction<ServiceItem[]>>;
  addNotification: (notification: any) => void;
};

export const useServiceManagement = ({
  servicesData,
  setServicesData,
  addNotification,
}: Props) => {
  const addService = useCallback((serviceData: Omit<ServiceItem, 'id'>) => {
    const newService: ServiceItem = { ...serviceData, id: uuidv4() };
    setServicesData(prev => [newService, ...prev]);
    addNotification({ message: `Đã thêm dịch vụ mới: ${newService.name}`, type: 'success', showToast: true });
  }, [setServicesData, addNotification]);
  
  const updateService = useCallback((serviceToUpdate: ServiceItem) => {
    setServicesData(prev => prev.map(s => s.id === serviceToUpdate.id ? serviceToUpdate : s));
    addNotification({ message: `Đã cập nhật dịch vụ: ${serviceToUpdate.name}`, type: 'info', showToast: true });
  }, [setServicesData, addNotification]);

  const deleteService = useCallback((serviceId: string) => {
    setServicesData(prev => prev.filter(s => s.id !== serviceId));
    addNotification({ message: `Đã xóa một dịch vụ.`, type: 'warning', showToast: true });
  }, [setServicesData, addNotification]);

  return {
    addService,
    updateService,
    deleteService,
  };
};