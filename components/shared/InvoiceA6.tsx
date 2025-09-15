

import React from 'react';
import { Order, StoreProfile } from '../../types'; // Added StoreProfile
import { QRCodeDisplay } from './QRCodeDisplay'; 

interface InvoiceA6Props {
  order: Order;
  storeProfile?: StoreProfile; // Added storeProfile prop
}

// Default store info if no specific profile is provided
const DEFAULT_STORE_INFO = {
  name: "Tiệm Giặt Là Sạch Thơm",
  address: "123 Đường ABC, Phường X, Quận Y, TP.HCM",
  phone: "0901.234.567",
  logoUrl: "/default_logo.png" 
};

const DISCLAIMER_TEXT = [
  "Cửa hàng không chịu trách nhiệm đối với các rủi ro bất khả kháng như thiên tai, hỏa hoạn, mất cắp không do lỗi của cửa hàng.",
  "Quý khách vui lòng thông báo trước cho nhân viên về các loại vải/chất liệu đặc biệt, dễ co rút, phai màu hoặc yêu cầu giặt riêng. Cửa hàng không chịu trách nhiệm nếu đồ bị hư hỏng do không được thông báo trước.",
  "Đồ sau khi xử lý sẽ được lưu trữ miễn phí tại cửa hàng trong vòng 15 ngày. Sau thời gian này, cửa hàng có thể áp dụng phí lưu kho hoặc xử lý theo quy định."
];

export const InvoiceA6: React.FC<InvoiceA6Props> = ({ order, storeProfile }) => {
  if (!order) return null;

  const { customer, items, totalAmount, createdAt, estimatedCompletionTime, receivedAt, loyaltyDiscountAmount, loyaltyPointsRedeemed, promotionDiscountAmount, paymentStatus } = order;

  const currentStoreInfo = {
    name: storeProfile?.storeName || DEFAULT_STORE_INFO.name,
    address: storeProfile?.storeAddress || DEFAULT_STORE_INFO.address,
    phone: storeProfile?.storePhone || DEFAULT_STORE_INFO.phone,
    logoUrl: storeProfile?.storeLogoUrl || DEFAULT_STORE_INFO.logoUrl,
  };
  
  const subtotal = items.reduce((sum, item) => sum + Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0), 0);
  const finalAmountToPay = subtotal - (loyaltyDiscountAmount || 0) - (promotionDiscountAmount || 0);


  return (
    <div className="invoice-a6-container bg-white text-gray-800 p-3 font-sans">
      <style>{`
        .invoice-a6-container {
          width: 105mm; 
          min-height: 140mm; 
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          font-size: 8pt; 
          line-height: 1.3;
          color: #2d3748; 
        }
        .invoice-a6-container img.store-logo { max-height: 30px; max-width: 80%; margin-bottom: 3px; object-fit: contain; }
        .invoice-a6-container h1, .invoice-a6-container h2, .invoice-a6-container h3 {
          margin: 0;
          padding: 0;
          font-weight: bold;
          color: #1a202c; 
        }
        .invoice-a6-container .header { text-align: center; margin-bottom: 8px; }
        .invoice-a6-container .store-name { font-size: 12pt; margin-bottom: 2px; }
        .invoice-a6-container .store-contact { font-size: 7pt; margin-bottom: 4px; color: #4a5568; } 
        .invoice-a6-container .invoice-title { font-size: 11pt; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #4a5568; padding-bottom: 2px; }
        
        .invoice-a6-container .meta-info, .invoice-a6-container .customer-info { margin-bottom: 6px; }
        .invoice-a6-container .meta-info p, .invoice-a6-container .customer-info p { margin: 1px 0; }
        .invoice-a6-container .meta-info strong, .invoice-a6-container .customer-info strong { font-weight: bold; color: #1a202c; }

        .invoice-a6-container .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        .invoice-a6-container .items-table th, .invoice-a6-container .items-table td {
          border: 1px solid #718096; 
          padding: 2px 3px;
          text-align: left;
          color: #2d3748; 
        }
        .invoice-a6-container .items-table th { background-color: #e2e8f0; font-size: 7.5pt; font-weight: bold; color: #1a202c; } 
        .invoice-a6-container .items-table td { font-size: 7.5pt; }
        .invoice-a6-container .items-table .quantity, .invoice-a6-container .items-table .price, .invoice-a6-container .items-table .line-total { text-align: right; }
        
        .invoice-a6-container .totals { margin-top: 8px; margin-bottom: 8px; text-align: right; }
        .invoice-a6-container .totals p { margin: 2px 0; font-size: 8.5pt; color: #2d3748;}
        .invoice-a6-container .totals .grand-total { font-size: 10pt; font-weight: bold; color: #1a202c;}
        .invoice-a6-container .payment-status { font-size: 8.5pt; font-weight: bold; margin-top:4px; color: #1a202c;}
        
        .invoice-a6-container .qr-section { text-align: center; margin: 8px 0; }
        .invoice-a6-container .qr-section p { font-size: 7pt; margin-top: 2px; color: #4a5568; }

        .invoice-a6-container .disclaimer { margin-top: auto; padding-top: 6px; border-top: 1px dashed #718096; } 
        .invoice-a6-container .disclaimer h3 { font-size: 8pt; margin-bottom: 3px; text-align: center; }
        .invoice-a6-container .disclaimer ul { list-style-type: disc; padding-left: 12px; margin: 0; }
        .invoice-a6-container .disclaimer li { font-size: 6.5pt; margin-bottom: 1.5px; color: #4a5568; } 
        
        .invoice-a6-container .footer-thankyou { text-align: center; font-size: 7.5pt; margin-top: 6px; font-style: italic; color: #4a5568;}
      `}</style>
      
      <div className="header">
        {currentStoreInfo.logoUrl && <img src={currentStoreInfo.logoUrl} alt={`${currentStoreInfo.name} Logo`} className="store-logo mx-auto" />}
        <h1 className="store-name">{currentStoreInfo.name}</h1>
        <p className="store-contact">{currentStoreInfo.address} - SĐT: {currentStoreInfo.phone}</p>
        <h2 className="invoice-title">Phiếu Dịch Vụ</h2>
      </div>

      <div className="meta-info">
        <p><strong>Mã ĐH:</strong> {order.id}</p>
        <p><strong>Ngày tạo:</strong> {new Date(createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        {receivedAt && <p><strong>Ngày nhận đồ:</strong> {new Date(receivedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
        {estimatedCompletionTime && <p><strong>Dự kiến trả:</strong> {new Date(estimatedCompletionTime).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
      </div>

      <div className="customer-info">
        <p><strong>Khách hàng:</strong> {customer.name} - <strong>SĐT:</strong> {customer.phone}</p>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Dịch vụ</th>
            <th className="quantity">SL</th>
            <th className="price">Đơn giá</th>
            <th className="line-total">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lineItemTotal = Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0);
            return (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.serviceItem.name}</td>
                <td className="quantity">{item.quantity}</td>
                <td className="price">{item.serviceItem.price.toLocaleString('vi-VN')}</td>
                <td className="line-total">{lineItemTotal.toLocaleString('vi-VN')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="totals">
        <p>TỔNG CỘNG: {subtotal.toLocaleString('vi-VN')} VNĐ</p>
        {loyaltyDiscountAmount && loyaltyDiscountAmount > 0 && (
          <p>Giảm giá ({loyaltyPointsRedeemed} điểm): -{loyaltyDiscountAmount.toLocaleString('vi-VN')} VNĐ</p>
        )}
        {promotionDiscountAmount && promotionDiscountAmount > 0 && (
          <p>Khuyến mãi: -{promotionDiscountAmount.toLocaleString('vi-VN')} VNĐ</p>
        )}
        <p className="grand-total">THÀNH TIỀN: {finalAmountToPay.toLocaleString('vi-VN')} VNĐ</p>
        <p className="payment-status">TRẠNG THÁI THANH TOÁN: {paymentStatus.toUpperCase()}</p>
      </div>
      
      {order.qrCodePaymentUrl && (
        <div className="qr-section">
          <QRCodeDisplay value={order.qrCodePaymentUrl} size={64} />
           <p>(Mã tham chiếu thanh toán)</p>
        </div>
      )}


      <div className="disclaimer">
        <h3>LƯU Ý QUAN TRỌNG</h3>
        <ul>
          {DISCLAIMER_TEXT.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      </div>
      <p className="footer-thankyou">Cảm ơn quý khách đã sử dụng dịch vụ của {currentStoreInfo.name}!</p>
    </div>
  );
};

export default InvoiceA6;