import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// FIX: Replaced useAppContext with useData
import { useData } from '../../contexts/DataContext';
import { Order, StoreProfile } from '../../types'; // Added StoreProfile
import InvoiceA6 from '../../components/shared/InvoiceA6';
import { Button } from '../../components/ui/Button';
import { PrinterIcon, ArrowLeftIcon } from 'lucide-react';
import { Card } from '../../components/ui/Card';

const OrderPrintPreviewPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  // FIX: Replaced useAppContext with useData
  const { findOrder, findStoreProfileByOwnerId } = useData(); // Added findStoreProfileByOwnerId
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | undefined>(undefined); // Added
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      const foundOrder = findOrder(orderId);
      if (foundOrder) {
        setOrder(foundOrder);
        const profile = findStoreProfileByOwnerId(foundOrder.ownerId); // Find profile
        setStoreProfile(profile);
      }
      setIsLoading(false);
    }
  }, [orderId, findOrder, findStoreProfileByOwnerId]);

  useEffect(() => {
    if (order && !isLoading) {
      console.log("Order data loaded, attempting to print in 700ms:", order.id);
      const timer = setTimeout(() => {
        window.print();
      }, 700); 
      return () => clearTimeout(timer);
    }
  }, [order, isLoading]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-text-muted text-lg">Đang tải hóa đơn...</p>
      </div>
    );
  }

  if (!order) {
    return (
       <Card title="Lỗi" className="max-w-md mx-auto mt-10">
        <p className="text-center text-status-danger">Không tìm thấy đơn hàng để in.</p>
        <div className="mt-6 flex justify-center">
            <Button onClick={() => navigate('/admin/orders')} leftIcon={<ArrowLeftIcon size={18}/>}>
                Về danh sách đơn hàng
            </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-only, .print-only * {
              visibility: visible;
            }
            .print-only {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
            }
            @page {
              size: A6;
              margin: 5mm; 
            }
            .no-print {
              display: none !important;
            }
          }
          .invoice-preview-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            background-color: #e2e8f0; 
          }
          .dark .invoice-preview-container {
             background-color: #1e293b; 
          }
        `}
      </style>
      <div className="no-print mt-4 mb-8 flex flex-col items-center">
         <Card title="Xem trước & In Hóa Đơn" className="w-full max-w-xl mb-6">
            <p className="text-text-body mb-2">Hóa đơn cho đơn hàng <strong>{order.id}</strong> của cửa hàng <strong>{storeProfile?.storeName || 'Mặc định'}</strong>.</p>
            <p className="text-text-muted text-sm mb-4">Hộp thoại in sẽ tự động mở. Nếu không, vui lòng bấm nút "In Hóa Đơn". Bạn nên in 2 liên: 1 cho cửa hàng, 1 cho khách hàng.</p>
            <div className="flex space-x-3 justify-center">
                <Button onClick={() => window.print()} variant="primary" leftIcon={<PrinterIcon size={18}/>}>
                    In Hóa Đơn
                </Button>
                <Button onClick={() => navigate('/admin/orders', { state: { newOrderId: order.id, customerName: order.customer.name } })} variant="secondary" leftIcon={<ArrowLeftIcon size={18}/>}>
                    Về danh sách đơn hàng
                </Button>
            </div>
         </Card>
      </div>

      
      <div className="invoice-preview-container no-print">
        <div className="shadow-lg border border-gray-300"> 
            <InvoiceA6 order={order} storeProfile={storeProfile} /> {/* Passed storeProfile */}
        </div>
      </div>


      
      <div className="print-only">
        <InvoiceA6 order={order} storeProfile={storeProfile} /> {/* Passed storeProfile */}
      </div>
    </>
  );
};

export default OrderPrintPreviewPage;