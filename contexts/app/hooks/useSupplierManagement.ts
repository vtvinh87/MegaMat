
import { useCallback } from 'react';
import { Supplier } from '../../../types';

type Props = {
  suppliersData: Supplier[];
  setSuppliersData: React.Dispatch<React.SetStateAction<Supplier[]>>;
  addNotification: (notification: any) => void;
};

export const useSupplierManagement = ({
  suppliersData,
  setSuppliersData,
  addNotification,
}: Props) => {
  const addSupplier = useCallback((supplier: Supplier) => {
    setSuppliersData(prev => [supplier, ...prev]);
    addNotification({ message: `Đã thêm nhà cung cấp: ${supplier.name}`, type: 'success', showToast: true });
  }, [setSuppliersData, addNotification]);

  const updateSupplier = useCallback((supplierToUpdate: Supplier) => {
    setSuppliersData(prev => prev.map(s => s.id === supplierToUpdate.id ? supplierToUpdate : s));
    addNotification({ message: `Đã cập nhật NCC: ${supplierToUpdate.name}`, type: 'info', showToast: true });
  }, [setSuppliersData, addNotification]);

  return {
    addSupplier,
    updateSupplier,
  };
};