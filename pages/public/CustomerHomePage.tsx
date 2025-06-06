import React, { useState, ChangeEvent, FormEvent, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Order, OrderStatus, ServiceItem as AppServiceItem, Customer, ChatMessage as ChatMessageType, UserRole, OrderItem, WashMethod, Notification as NotificationType, User, ChatMessage, OrderDetailsFromAI as AppOrderDetailsFromAI, StoreProfile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { Select } from '../../components/ui/Select';
import { OrderConfirmationModal } from '../../components/shared/OrderConfirmationModal';
import { RatingTipModal } from '../../components/shared/RatingTipModal'; 
import { SearchIcon, PackageIcon, UserIcon, ClockIcon, CheckCircleIcon, ZapIcon, MapPinIcon, InfoIcon, AlertTriangle, XIcon, PackageCheckIcon, DollarSignIcon, ListIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon, MessageCircleIcon, SendIcon, PlusIcon, Trash2Icon, NavigationIcon, TruckIcon, PhoneIcon, EditIcon, MinusCircleIcon, StarIcon, BellDotIcon, BuildingIcon } from 'lucide-react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai"; 
import { v4 as uuidv4 } from 'uuid';
import { APP_NAME } from '../../constants';

const ITEMS_PER_PAGE = 5; 

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessageDisplay: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[70%] p-3 rounded-lg shadow ${
          isUser 
            ? 'bg-brand-primary text-text-on-primary rounded-br-none' 
            : 'bg-bg-surface dark:bg-slate-700 text-text-body dark:text-slate-100 rounded-bl-none border border-border-base'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-sky-200' : 'text-text-muted'}`}>
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

interface CustomerOrderItemStructure {
  id: string; 
  serviceNameKey: string; 
  selectedWashMethod: WashMethod;
  quantity: number;
  notes?: string;
}


type ActiveTab = 'lookup' | 'createOrder' | 'aiAssistant';

export const CustomerHomePage: React.FC = () => { // Changed to named export
  const { 
    orders: allOrders, 
    findOrder: findOrderById, 
    services: availableServices, 
    addNotification, 
    currentUser,
    customers,
    addOrder: systemAddOrder, 
    addCustomer: systemAddCustomer,
    notifications, 
    markNotificationAsRead,
    setActivePublicCustomerId, 
    storeProfiles, 
  } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('lookup');
  
  const [lookupSearchTerm, setLookupSearchTerm] = useState('');
  const [lookupDate, setLookupDate] = useState(''); 
  const [detailedOrder, setDetailedOrder] = useState<Order | null>(null);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [displayedOrders, setDisplayedOrders] = useState<Order[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const [customerOrderItems, setCustomerOrderItems] = useState<CustomerOrderItemStructure[]>([]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [orderNotes, setOrderNotes] = useState(''); 
  const [selectedStoreForManualOrder, setSelectedStoreForManualOrder] = useState<string | null>(null);
  
  const [customerForNewOrder, setCustomerForNewOrder] = useState<Customer | null>(null); 
  const [servingCustomerPhoneInput, setServingCustomerPhoneInput] = useState(''); 
  const [isStaffServingModeActive, setIsStaffServingModeActive] = useState(true); 

  const [publicCustomerPhoneInput, setPublicCustomerPhoneInput] = useState('');
  const [identifiedPublicCustomer, setIdentifiedPublicCustomerState] = useState<Customer | null>(null);
  const [isEditingPublicCustomerPhone, setIsEditingPublicCustomerPhone] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [isOrderConfirmationModalOpen, setIsOrderConfirmationModalOpen] = useState(false);
  const [orderDataForConfirmation, setOrderDataForConfirmation] = useState<AppOrderDetailsFromAI | null>(null);
  const [customerForAIOrder, setCustomerForAIOrder] = useState<Customer | null>(null);
  const [targetStoreOwnerIdForAI, setTargetStoreOwnerIdForAI] = useState<string | undefined>(undefined);


  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [orderIdForRating, setOrderIdForRating] = useState<string | null>(null);
  const [customerIdForRating, setCustomerIdForRating] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null); 
  const chatInputRef = useRef<HTMLInputElement>(null); 

   const setIdentifiedPublicCustomer = useCallback((customer: Customer | null) => {
    setIdentifiedPublicCustomerState(customer);
    if (setActivePublicCustomerId) {
        setActivePublicCustomerId(customer ? customer.id : null);
    }
  }, [setActivePublicCustomerId]);

  useEffect(() => {
    return () => {
      if (setActivePublicCustomerId) {
        setActivePublicCustomerId(null);
      }
    };
  }, [setActivePublicCustomerId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    // Auto-select store if only one exists for manual orders
    if (storeProfiles.length === 1) {
      setSelectedStoreForManualOrder(storeProfiles[0].ownerId);
    } else if (storeProfiles.length > 1 && !selectedStoreForManualOrder) {
      // Optionally set a default or leave null to force selection
      // setSelectedStoreForManualOrder(storeProfiles[0].ownerId); // Or null
    }
  }, [storeProfiles, selectedStoreForManualOrder]);


  const openRatingModal = (orderId: string, customerId: string, notificationToMarkAsReadId?: string) => {
    setOrderIdForRating(orderId);
    setCustomerIdForRating(customerId);
    setIsRatingModalOpen(true);
    if (notificationToMarkAsReadId) {
      markNotificationAsRead(notificationToMarkAsReadId);
    }
  };
  
  useEffect(() => {
    const savedPhone = localStorage.getItem('laundryAppPublicCustomerPhone');
    if (savedPhone) {
      const foundCustomer = customers.find(c => c.phone === savedPhone);
      if (foundCustomer) {
        setIdentifiedPublicCustomer(foundCustomer);
        setPublicCustomerPhoneInput(foundCustomer.phone);
        setIsEditingPublicCustomerPhone(false);
      } else {
        localStorage.removeItem('laundryAppPublicCustomerPhone'); 
        setIsEditingPublicCustomerPhone(true);
      }
    } else {
      setIsEditingPublicCustomerPhone(true);
    }
  }, [customers, setIdentifiedPublicCustomer]);

  const handleConfirmPublicCustomerPhone = () => {
    if (!publicCustomerPhoneInput.trim()) {
      addNotification({ message: "Vui lòng nhập số điện thoại của bạn.", type: 'warning' });
      return;
    }
    const foundCustomer = customers.find(c => c.phone === publicCustomerPhoneInput.trim());
    if (foundCustomer) {
      setIdentifiedPublicCustomer(foundCustomer);
      localStorage.setItem('laundryAppPublicCustomerPhone', foundCustomer.phone);
      setIsEditingPublicCustomerPhone(false);
      addNotification({ message: `Chào mừng ${foundCustomer.name}! Bạn có thể xem thông báo và đặt lịch.`, type: 'success' });
    } else {
      setIdentifiedPublicCustomer(null);
      localStorage.removeItem('laundryAppPublicCustomerPhone');
      addNotification({ message: `Số điện thoại ${publicCustomerPhoneInput} chưa được đăng ký. Bạn có thể tạo đơn hàng mới để đăng ký thông tin.`, type: 'error' });
    }
  };

  const handleChangePublicCustomerPhone = () => {
    setIdentifiedPublicCustomer(null);
    localStorage.removeItem('laundryAppPublicCustomerPhone');
    setPublicCustomerPhoneInput('');
    setIsEditingPublicCustomerPhone(true);
  };

  const publicCustomerNotifications = useMemo(() => {
    if (!identifiedPublicCustomer) return [];
    return notifications
      .filter(n => !n.read && n.orderId)
      .map(n => {
        const order = allOrders.find(o => o.id === n.orderId);
        if (order && order.customer.id === identifiedPublicCustomer.id) {
          if (n.type === 'rating_prompt' && order.status !== OrderStatus.RETURNED) {
            return null;
          }
          return { ...n, orderStatus: order.status }; 
        }
        return null;
      })
      .filter(notification => notification !== null) as (NotificationType & { orderStatus?: OrderStatus })[];
  }, [notifications, allOrders, identifiedPublicCustomer]);


  useEffect(() => {
    if (activeTab === 'aiAssistant' && !chatSession && process.env.API_KEY) {
      try {
        const aiApiKey = process.env.API_KEY;
        const geminiChatInstance = new GoogleGenAI({ apiKey: aiApiKey });
        
        const servicesListForAI = availableServices.length > 0 
          ? availableServices.map(s => `* "${s.name}" (ID: ${s.id}, Giá: ${s.price.toLocaleString('vi-VN')} VNĐ / ${s.unit}${s.minPrice && s.minPrice > 0 ? `, Giá tối thiểu: ${s.minPrice.toLocaleString('vi-VN')} VNĐ` : ''}, Phương pháp: ${s.washMethod}, TG xử lý: ${s.estimatedTimeHours} giờ, TG dự kiến trả: ${s.customerReturnTimeHours} giờ)`).join('\n')
          : "Hiện tại không có dịch vụ nào được định nghĩa trong hệ thống.";
        
        const storeProfilesListForAI = storeProfiles.length > 0
          ? storeProfiles.map(p => `* "${p.storeName}" (ID cửa hàng: ${p.ownerId}, Địa chỉ: ${p.storeAddress || 'N/A'})`).join('\n')
          : "Hiện tại chưa có thông tin chi nhánh cửa hàng nào.";

        const systemInstruction = `Bạn là Trợ Lý AI của tiệm giặt là ${APP_NAME}. Nhiệm vụ của bạn là hỗ trợ khách hàng một cách thân thiện và hiệu quả.

QUAN TRỌNG VỀ ĐỊNH DẠNG PHẢN HỒI JSON:
Mọi phản hồi của bạn PHẢI LUÔN LUÔN là một JSON object. Có 3 loại action chính:
1.  \`LOOKUP_INFO_REQUEST\`: Khi bạn cần hệ thống tra cứu thông tin.
    *   Để tra cứu ĐƠN HÀNG THEO MÃ ĐH hoặc SĐT (có thể kèm ngày):
        Cấu trúc: \\\`{"action": "LOOKUP_INFO_REQUEST", "type": "ORDER", "query": "USER_PROVIDED_ID_OR_PHONE_HERE", "date": "YYYY-MM-DD" (tùy chọn)}\\\`
    *   Để tra cứu THÔNG TIN KHÁCH HÀNG THEO SĐT (khi bắt đầu quy trình tạo đơn):
        Cấu trúc: \\\`{"action": "LOOKUP_INFO_REQUEST", "type": "CUSTOMER", "query": "USER_PROVIDED_PHONE_HERE"}\\\`
    Sau khi bạn gửi yêu cầu này, hệ thống sẽ thực hiện tra cứu. Phản hồi tiếp theo hiển thị trong chat (như một tin nhắn của bạn) sẽ là kết quả của việc tra cứu đó. Bạn sẽ dựa vào kết quả này để tiếp tục hội thoại với khách hàng (dùng \\\`TEXT_RESPONSE\\\`).

2.  \`CREATE_ORDER_REQUEST\`: CHỈ KHI khách hàng đã cung cấp ĐẦY ĐỦ thông tin tạo đơn (bao gồm cả cửa hàng đã chọn) VÀ ĐÃ XÁC NHẬN ĐỒNG Ý tạo đơn hàng.
    Cấu trúc: \\\`{"action": "CREATE_ORDER_REQUEST", "orderDetails": { ... }}\\\` (chi tiết như mô tả ở bước B.7)

3.  \`TEXT_RESPONSE\`: Đối với TẤT CẢ các trường hợp khác.
    Cấu trúc: \\\`{"text_response": "Nội dung văn bản thân thiện của bạn ở đây"}\\\`

TUYỆT ĐỐI KHÔNG trả về văn bản thuần túy không nằm trong JSON, hoặc JSON có cấu trúc khác ngoài ba định dạng đã chỉ định ở trên.

CÁC CHỨC NĂNG CHÍNH:

A. TRA CỨU THÔNG TIN ĐƠN HÀNG: (Như cũ)

B. QUY TRÌNH TẠO ĐƠN HÀNG (TUÂN THỦ NGHIÊM NGẶT):
   1.  HỎI SĐT KHÁCH HÀNG: (Như cũ)
   2.  GỬI YÊU CẦU TRA CỨU KHÁCH HÀNG: (Như cũ)
   3.  XỬ LÝ KẾT QUẢ TRA CỨU (DỰA VÀO PHẢN HỒI CỦA HỆ THỐNG SẼ XUẤT HIỆN TRONG CHAT NHƯ TIN NHẮN CỦA BẠN):
       *   TRƯỜNG HỢP 1: Nếu tin nhắn *bạn (AI) vừa nói ra* (thông tin từ hệ thống) có dạng: "Tôi đã tìm thấy thông tin của bạn: Tên [Tên KH], SĐT [SĐT KH], Địa chỉ [ĐỊA CHỈ THỰC TẾ CỦA KHÁCH HÀNG]. Thông tin này có chính xác không ạ?"
           VÀ người dùng xác nhận "Đúng rồi" (hoặc tương tự).
           THÌ:
           1.  **Trích xuất địa chỉ:** Bạn PHẢI lấy CHÍNH XÁC giá trị của \`[ĐỊA CHỈ THỰC TẾ CỦA KHÁCH HÀNG]\` từ tin nhắn bạn vừa nói ở trên.
           2.  **Tạo phản hồi:** Bạn TIẾP TỤC bằng JSON sau:
               \\\`{"text_response": "Cảm ơn bạn đã xác nhận! Địa chỉ của bạn là '[DÁN_ĐỊA_CHỈ_THỰC_TẾ_VỪA_TRÍCH_XUẤT_VÀO_ĐÂY]'. Chúng tôi sẽ mặc định sử dụng địa chỉ này để giao và nhận đồ nhé, trừ khi bạn có yêu cầu khác. Bây giờ, bạn muốn đặt những dịch vụ nào ạ?"}\\\`
               **Ví dụ QUAN TRỌNG:** Nếu tin nhắn bạn vừa nói có "...Địa chỉ **số 123 Đường ABC, Quận 1, TP.HCM**...", thì JSON \`text_response\` của bạn phải là "Cảm ơn bạn đã xác nhận! Địa chỉ của bạn là '**số 123 Đường ABC, Quận 1, TP.HCM**'. ..."
               **CẢNH BÁO:** TUYỆT ĐỐI không dùng địa chỉ ví dụ như 'số 14 ngõ 649 Kim Mã...' hay bất kỳ placeholder nào như '[Địa chỉ khách hàng]' trong phản hồi. PHẢI là địa chỉ thực tế bạn vừa đọc ra cho khách.
           3.  AI PHẢI LƯU TRỮ ĐỊA CHỈ NÀY (địa chỉ thực tế đã trích xuất) để sử dụng sau.
           TUYỆT ĐỐI KHÔNG HỎI LẠI TÊN HOẶC ĐỊA CHỈ trong trường hợp này (TRỪ KHI thông tin đó không có trong tin nhắn hệ thống ban đầu).

       *   TRƯỜNG HỢP 2: Hệ thống phản hồi (trong chat, do bạn vừa nói ra) có dạng: "Tôi đã tìm thấy thông tin của bạn: Tên [Tên KH], SĐT [SĐT KH]. Thông tin này có chính xác không ạ?" (KHÔNG CÓ "Địa chỉ").
           VÀ người dùng xác nhận "Đúng rồi" (hoặc tương tự).
           THÌ bạn (AI) TIẾP TỤC bằng \\\`{"text_response": "Tôi thấy thông tin bạn đăng ký với SĐT [SĐT KHÁCH CUNG CẤP] là Tên [Tên KHÁCH CUNG CẤP]. Bạn vui lòng cho tôi xin địa chỉ cụ thể để giao/nhận đồ và bạn muốn đặt dịch vụ nào ạ?"}\\\`. AI PHẢI LƯU TRỮ ĐỊA CHỈ MỚI NÀY.

       *   TRƯỜNG HỢP 3: Hệ thống phản hồi (trong chat, do bạn vừa nói ra) có dạng: "Tôi chưa tìm thấy thông tin cho SĐT [SĐT KH]..."
           THÌ bạn (AI) TIẾP TỤC bằng \\\`{"text_response": "Tôi chưa tìm thấy thông tin của bạn. Bạn vui lòng cho tôi biết Tên và Địa chỉ của bạn để tạo hồ sơ mới được không?"}\\\`. AI PHẢI LƯU TRỮ TÊN VÀ ĐỊA CHỈ MỚI NÀY.
   
   4.  **XÁC ĐỊNH CỬA HÀNG ĐÍCH:**
       *   Sau khi thông tin khách hàng được xác nhận hoặc thu thập, NẾU khách hàng muốn tạo đơn hàng mới, BẠN PHẢI HỎI khách hàng muốn đặt dịch vụ tại cửa hàng nào. 
       *   Ví dụ: "Bạn muốn đặt dịch vụ tại cửa hàng nào ạ? Chúng tôi có các chi nhánh: ${storeProfiles.map(p => `"${p.storeName}" (Địa chỉ: ${p.storeAddress || 'Chưa rõ'})`).join(', ')}." 
       *   Sau khi khách hàng chọn tên cửa hàng, bạn PHẢI tìm \`ownerId\` (ID cửa hàng) CHÍNH XÁC tương ứng với tên cửa hàng đó từ "DANH SÁCH CỬA HÀNG HIỆN CÓ" được cung cấp bên dưới. Ghi nhớ \`ownerId\` này.
       *   Bạn PHẢI bao gồm \\\`"targetStoreOwnerId": "ACTUAL_OWNER_ID_FROM_LIST"\\\` (thay "ACTUAL_OWNER_ID_FROM_LIST" bằng \`ownerId\` thực tế bạn tìm được, ví dụ: "user_owner_dung") trong JSON \`CREATE_ORDER_REQUEST\` ở bước B.7. Nếu không có \`ownerId\` hợp lệ, bạn không được tạo đơn.

   5.  THU THẬP CHI TIẾT ĐƠN HÀNG: (Như cũ, nhưng nhớ sử dụng địa chỉ đã lưu và chuẩn bị cho cửa hàng đã chọn)
   6.  TÓM TẮT VÀ XÁC NHẬN: Sau khi có đủ thông tin (bao gồm cả cửa hàng đã chọn), hãy tóm tắt lại toàn bộ đơn hàng. Trong phần tóm tắt này, đối với tên, SĐT, và ĐẶC BIỆT LÀ ĐỊA CHỈ KHÁCH HÀNG (bao gồm cả địa chỉ giao và nhận nếu khác), bạn PHẢI SỬ DỤNG GIÁ TRỊ THỰC TẾ đã được xác nhận hoặc thu thập trước đó (ví dụ: '123 Đường ABC, Quận 1'). TUYỆT ĐỐI KHÔNG dùng placeholder kiểu '[Địa chỉ...]', '[Địa chỉ lấy đồ]', '[Địa chỉ giao hàng]' v.v. trong bản tóm tắt. Nhắc lại cả TÊN CỬA HÀNG khách đã chọn. Sau đó, hỏi khách hàng xác nhận cuối cùng (dùng \\\`{"text_response": "..."}\\\`).
   7.  GỬI YÊU CẦU TẠO ĐƠN: CHỈ KHI khách hàng đã ĐỒNG Ý cuối cùng, HÃY trả lời CHỈ bằng JSON \\\`{"action": "CREATE_ORDER_REQUEST", "orderDetails": { ... }}\\\` với cấu trúc CHI TIẾT và GIÁ TRỊ THỰC TẾ như sau:
      "orderDetails": {
        "customer": { 
            "name": "Nguyễn Văn An", 
            "phone": "0901234567", 
            "address": "123 Đường ABC, Phường Cầu Ông Lãnh, Quận 1, TP.HCM" // BẮT BUỘC phải là địa chỉ thực tế đã được khách hàng xác nhận hoặc cung cấp. TUYỆT ĐỐI KHÔNG dùng placeholder như '[Địa chỉ khách hàng]'. Nếu không có, để trống ('').
        },
        "items": [ 
            { "serviceName": "Giặt sấy áo sơ mi", "quantity": 2, "notes": "Áo trắng, giặt kỹ cổ áo" } 
        ],
        "pickupAddress": "123 Đường ABC, Phường Cầu Ông Lãnh, Quận 1, TP.HCM", // Tương tự customer.address. BẮT BUỘC là địa chỉ thực tế.
        "pickupTime": "10:00 ngày 25/12/2023", 
        "deliveryAddress": "123 Đường ABC, Phường Cầu Ông Lãnh, Quận 1, TP.HCM", // Tương tự customer.address. BẮT BUỘC là địa chỉ thực tế.
        "deliveryTime": "17:00 ngày 26/12/2023", 
        "orderNotes": "Giao hàng sau 5 giờ chiều.",
        "targetStoreOwnerId": "ACTUAL_OWNER_ID_FROM_LIST" // Bắt buộc phải có ownerId hợp lệ từ danh sách cửa hàng.
      }

C. CUNG CẤP THÔNG TIN GIÁ DỊCH VỤ: (Như cũ)

DANH SÁCH DỊCH VỤ HIỆN CÓ (chỉ sử dụng tên dịch vụ từ danh sách này khi tạo đơn hàng):
${servicesListForAI}
--- Hết danh sách dịch vụ ---

DANH SÁCH CỬA HÀNG HIỆN CÓ (Sử dụng ID cửa hàng này cho targetStoreOwnerId khi tạo đơn):
${storeProfilesListForAI}
--- Hết danh sách cửa hàng ---
`;
        
        const newChat = geminiChatInstance.chats.create({ 
            model: 'gemini-2.5-flash-preview-04-17',
            config: { 
                systemInstruction,
                responseMimeType: "application/json" 
            } 
        });
        setChatSession(newChat);
        setGeminiError(null);
         setChatMessages([{
            id: uuidv4(),
            sender: 'ai',
            text: `Xin chào! Tôi là Trợ Lý AI của tiệm giặt ${APP_NAME}. Tôi có thể giúp bạn tra cứu đơn hàng, xem giá dịch vụ, hoặc hỗ trợ bạn tạo đơn hàng mới và đặt lịch giao nhận. Bạn cần gì hôm nay?`,
            timestamp: new Date()
        }]);
      } catch (error) {
        console.error("Lỗi khởi tạo Gemini Chat:", error);
        setGeminiError("Không thể kết nối với Trợ Lý AI. Vui lòng thử lại sau.");
      }
    }
    if (activeTab === 'aiAssistant' && !process.env.API_KEY) {
        setGeminiError("API Key cho Trợ Lý AI chưa được cấu hình.");
    }
  }, [activeTab, chatSession, availableServices, APP_NAME, customers, storeProfiles]); 

useEffect(() => {
    if (currentUser && currentUser.role !== UserRole.CUSTOMER) {
        setIsStaffServingModeActive(true); 
    } else {
        setIsStaffServingModeActive(false); 
        setCustomerForNewOrder(null); 
    }
}, [currentUser]); 

useEffect(() => {
    if (activeTab === 'createOrder') {
        if (isStaffServingModeActive && customerForNewOrder) {
            setPickupAddress(customerForNewOrder.address || '');
            setDeliveryAddress(customerForNewOrder.address || '');
        } 
        else if (!isStaffServingModeActive && identifiedPublicCustomer) {
            setCustomerForNewOrder(identifiedPublicCustomer); 
            setPickupAddress(identifiedPublicCustomer.address || '');
            setDeliveryAddress(identifiedPublicCustomer.address || '');
        }
        else {
            setCustomerForNewOrder(null);
            setPickupAddress('');
            setDeliveryAddress('');
        }
    }
}, [activeTab, customerForNewOrder, identifiedPublicCustomer, isStaffServingModeActive]);


  const handleSetServingCustomer = (e: FormEvent) => {
    e.preventDefault();
    const phoneToFind = servingCustomerPhoneInput.trim();

    if (!phoneToFind) {
        addNotification({ message: "Vui lòng nhập SĐT khách hàng.", type: 'warning' });
        setCustomerForNewOrder(null); 
        return;
    }

    const foundCustomer = customers.find(c => c.phone === phoneToFind);
    if (foundCustomer) {
        setCustomerForNewOrder(foundCustomer);
        addNotification({ message: `Đang phục vụ khách: ${foundCustomer.name} (${foundCustomer.phone})`, type: 'info' });
    } else {
        addNotification({ message: `Không tìm thấy khách hàng với SĐT: ${phoneToFind}. Vui lòng thêm mới nếu cần.`, type: 'warning' });
        setCustomerForNewOrder(null); 
    }
  };

  const handleClearServingCustomer = () => {
    setIsStaffServingModeActive(true); 
    setServingCustomerPhoneInput(''); 
    setCustomerForNewOrder(null); 
    addNotification({ message: "Đã hủy chọn khách hàng đang phục vụ.", type: 'info' });
  };

  const handleLookupSearch = (e: FormEvent) => {
    e.preventDefault();
    setDetailedOrder(null); setOrderList([]); setDisplayedOrders([]); setCurrentPage(1); setSearchError(null); setSearchMessage(null);

    let effectiveSearchTermForLogic = lookupSearchTerm.trim();
    let searchInitiatedByActiveCustomer = false;

    if (!effectiveSearchTermForLogic && identifiedPublicCustomer) {
      effectiveSearchTermForLogic = identifiedPublicCustomer.phone;
      searchInitiatedByActiveCustomer = true; 
    } else if (!effectiveSearchTermForLogic && isStaffServingModeActive && customerForNewOrder) {
      effectiveSearchTermForLogic = customerForNewOrder.phone;
      searchInitiatedByActiveCustomer = true;
    } else if (!effectiveSearchTermForLogic) {
      setSearchError('Vui lòng nhập Mã ĐH hoặc SĐT.');
      return;
    }
    
    const searchTermNormalized = effectiveSearchTermForLogic.toUpperCase();

    if (searchTermNormalized.startsWith('DH-') || searchTermNormalized.startsWith('CUS-REQ-') || searchTermNormalized.startsWith('AI-')) {
      const order = findOrderById(effectiveSearchTermForLogic);
      if (order) {
        setDetailedOrder(order);
        if (isStaffServingModeActive) setCustomerForNewOrder(order.customer);
        setSearchMessage(`Kết quả cho Mã ĐH "${effectiveSearchTermForLogic}".`);
      } else {
        setSearchError(`Không tìm thấy đơn hàng với mã: ${effectiveSearchTermForLogic}.`);
      }
    } else { 
      const ordersByPhoneBase = allOrders.filter(o => o.customer.phone === effectiveSearchTermForLogic);
      
      if (ordersByPhoneBase.length === 0) {
        setSearchError(`Không tìm thấy đơn hàng nào cho SĐT "${effectiveSearchTermForLogic}".`);
        setOrderList([]);
        if (isStaffServingModeActive) setCustomerForNewOrder(null); 
        return;
      }
      
      if (isStaffServingModeActive) setCustomerForNewOrder(ordersByPhoneBase[0].customer);

      let ordersAfterDateFilter = ordersByPhoneBase;
      let dateFilterInfo = "";
      if (lookupDate && /^\d{4}-\d{2}-\d{2}$/.test(lookupDate)) {
        const [year, month, day] = lookupDate.split('-').map(Number);
        const targetDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        dateFilterInfo = ` tạo ngày ${day}/${month}/${year}`;
        ordersAfterDateFilter = ordersByPhoneBase.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= targetDateStart && orderDate <= targetDateEnd;
        });
      }
      
      if (ordersAfterDateFilter.length === 0) {
          setSearchError(`Không tìm thấy đơn hàng nào cho SĐT "${effectiveSearchTermForLogic}"${dateFilterInfo}.`);
          setOrderList([]);
          return;
      }

      let finalResultsToDisplay;
      let excludedReturnedInfo = "";

      if (ordersAfterDateFilter.length > 5) {
        finalResultsToDisplay = ordersAfterDateFilter.filter(o => o.status !== OrderStatus.RETURNED);
        if (finalResultsToDisplay.length < ordersAfterDateFilter.length) {
            excludedReturnedInfo = " (các đơn 'Đã trả' được ẩn do có nhiều kết quả)";
        }
      } else {
        finalResultsToDisplay = ordersAfterDateFilter;
      }
      
      finalResultsToDisplay.sort((a, b) => {
        const aIsReturned = a.status === OrderStatus.RETURNED;
        const bIsReturned = b.status === OrderStatus.RETURNED;
        if (aIsReturned && !bIsReturned) return 1; 
        if (!aIsReturned && bIsReturned) return -1; 
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
      });
      
      const baseSearchSubject = searchInitiatedByActiveCustomer 
          ? `cho SĐT (${effectiveSearchTermForLogic})`
          : `cho SĐT "${effectiveSearchTermForLogic}"`;

      if (finalResultsToDisplay.length > 0) {
        setSearchMessage(`Tìm thấy ${finalResultsToDisplay.length} đơn hàng ${baseSearchSubject}${dateFilterInfo}${excludedReturnedInfo}. Sắp xếp ưu tiên đơn chưa trả.`);
      } else {
        setSearchError(`Không tìm thấy đơn hàng nào (chưa trả) ${baseSearchSubject}${dateFilterInfo}${excludedReturnedInfo}.`);
      }
      
      setOrderList(finalResultsToDisplay);
      setTotalPages(Math.ceil(finalResultsToDisplay.length / ITEMS_PER_PAGE));
    }
  };
  
  useEffect(() => {
    if (orderList.length > 0) {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      setDisplayedOrders(orderList.slice(start, start + ITEMS_PER_PAGE));
    } else {
      setDisplayedOrders([]);
    }
  }, [orderList, currentPage]);


  const handleViewDetails = (order: Order) => {
    setDetailedOrder(order);
    if (isStaffServingModeActive) {
        setCustomerForNewOrder(order.customer); 
    }
  };

  const handleBackToList = () => {
    setDetailedOrder(null);
    if (orderList.length > 0) { 
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      setDisplayedOrders(orderList.slice(start, start + ITEMS_PER_PAGE));
    }
  };
  const paginate = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const getStatusInfo = (status: OrderStatus): {textColor: string, bgColor: string, borderColor: string, text: string, icon?: React.ReactNode} => {
    switch (status) {
      case OrderStatus.PENDING: return {textColor: 'text-status-warning-text dark:text-amber-300', bgColor: 'bg-status-warning-bg dark:bg-amber-700/30', borderColor: 'border-status-warning dark:border-amber-600', text: OrderStatus.PENDING, icon: <ClockIcon size={14} className="mr-1.5"/>};
      case OrderStatus.PROCESSING: return {textColor: 'text-status-info-text dark:text-sky-300', bgColor: 'bg-status-info-bg dark:bg-sky-700/30', borderColor: 'border-status-info dark:border-sky-600', text: OrderStatus.PROCESSING, icon: <ZapIcon size={14} className="mr-1.5"/>};
      case OrderStatus.COMPLETED: return {textColor: 'text-status-success-text dark:text-emerald-300', bgColor: 'bg-status-success-bg dark:bg-emerald-700/30', borderColor: 'border-status-success dark:border-emerald-600', text: OrderStatus.COMPLETED, icon: <CheckCircleIcon size={14} className="mr-1.5"/>};
      case OrderStatus.CANCELLED: return {textColor: 'text-status-danger-text dark:text-rose-300', bgColor: 'bg-status-danger-bg dark:bg-rose-700/30', borderColor: 'border-status-danger dark:border-rose-600', text: OrderStatus.CANCELLED, icon: <XIcon size={14} className="mr-1.5"/>};
      case OrderStatus.RETURNED: return {textColor: 'text-text-on-primary dark:text-sky-100', bgColor: 'bg-brand-primary dark:bg-brand-primary', borderColor: 'border-brand-primary-focus dark:border-sky-400', text: OrderStatus.RETURNED, icon: <PackageCheckIcon size={14} className="mr-1.5"/>};
      default: return {textColor: 'text-text-muted', bgColor: 'bg-bg-subtle dark:bg-slate-700/30', borderColor: 'border-border-base', text: status, icon: <InfoIcon size={14} className="mr-1.5"/>};
    }
  };
  const getRemainingTime = (estCompletion?: Date): string => {
    if (!estCompletion) return 'N/A';
    const diffMs = new Date(estCompletion).getTime() - new Date().getTime();
    if (diffMs <= 0) return 'Đã xong hoặc quá hạn';
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs} giờ ${mins} phút`;
  };
  const DetailItem: React.FC<{label: string; children: React.ReactNode; dtCls?: string; ddCls?: string;}> =
    ({label, children, dtCls = '', ddCls = ''}) => (
    <div className="flex justify-between py-1.5">
      <dt className={`text-sm font-medium text-text-muted ${dtCls}`}>{label}</dt>
      <dd className={`text-sm text-text-body dark:text-slate-200 text-right ${ddCls}`}>{children}</dd>
    </div>
  );

  const uniqueServiceNames = useMemo(() => {
    if (!availableServices || availableServices.length === 0) return [];
    const serviceNames = new Set<string>();
    availableServices.forEach(service => serviceNames.add(service.name));
    return Array.from(serviceNames).map(name => ({
      value: name,
      label: name,
    })).sort((a,b) => a.label.localeCompare(b.label));
  }, [availableServices]);

  const handleAddCustomerOrderItem = () => {
    if (uniqueServiceNames.length === 0) {
        addNotification({ message: "Không có dịch vụ nào để thêm.", type: 'warning' });
        return;
    }
    const defaultServiceName = uniqueServiceNames[0].value;
    const servicesWithThisName = availableServices.filter(s => s.name === defaultServiceName);
    const defaultWashMethod = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethod : WashMethod.WET_WASH;

    setCustomerOrderItems(prev => [
      ...prev,
      { 
        id: uuidv4(),
        serviceNameKey: defaultServiceName, 
        selectedWashMethod: defaultWashMethod, 
        quantity: 1, 
        notes: '' 
      }
    ]);
  };

  const handleCustomerOrderItemChange = (itemId: string, field: keyof CustomerOrderItemStructure, value: string | number | WashMethod) => {
    setCustomerOrderItems(prevItems => 
      prevItems.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item };
          if (field === 'serviceNameKey') {
            const newServiceName = value as string;
            updatedItem.serviceNameKey = newServiceName;
            const servicesWithThisName = availableServices.filter(s => s.name === newServiceName);
            updatedItem.selectedWashMethod = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethod : WashMethod.WET_WASH;
          } else if (field === 'selectedWashMethod') {
            updatedItem.selectedWashMethod = value as WashMethod;
          } else if (field === 'quantity') {
            updatedItem.quantity = Math.max(1, parseInt(value as string, 10) || 1);
          } else if (field === 'notes') {
            updatedItem.notes = value as string;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleRemoveCustomerOrderItem = (itemId: string) => {
    setCustomerOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const calculateNewOrderTotal = useMemo(() => {
    return customerOrderItems.reduce((sum, item) => {
      const service = availableServices.find(s => s.name === item.serviceNameKey && s.washMethod === item.selectedWashMethod);
      if (service) {
        const lineTotal = Math.max(service.price * item.quantity, service.minPrice || 0);
        return sum + lineTotal;
      }
      return sum;
    }, 0);
  }, [customerOrderItems, availableServices]);

  const handleCreateOrderSubmit = (e: FormEvent) => {
    e.preventDefault();
     if (customerOrderItems.length === 0) {
      addNotification({ message: 'Vui lòng chọn ít nhất một dịch vụ.', type: 'warning' });
      return;
    }
    
    const customerContextForOrder = customerForNewOrder; 

    if (!customerContextForOrder) { 
      addNotification({ message: 'Không xác định được thông tin khách hàng. Vui lòng tra cứu hoặc được nhân viên chọn phục vụ.', type: 'error'});
      return;
    }

    let ownerIdForOrder: string | null = null;
    if (storeProfiles.length === 1) {
      ownerIdForOrder = storeProfiles[0].ownerId;
    } else if (storeProfiles.length > 1) {
      if (!selectedStoreForManualOrder) {
        addNotification({ message: 'Vui lòng chọn cửa hàng để đặt dịch vụ.', type: 'warning' });
        return;
      }
      ownerIdForOrder = selectedStoreForManualOrder;
    } else { 
        addNotification({ message: 'Hiện tại không có cửa hàng nào để đặt dịch vụ. Vui lòng thử lại sau.', type: 'error' });
        return;
    }

    if (!ownerIdForOrder) { 
      addNotification({ message: 'Lỗi: Không thể xác định cửa hàng. Vui lòng thử lại.', type: 'error' });
      return;
    }
    
    let hasInvalidServiceCombination = false;
    const itemsForNewOrder: OrderItem[] = customerOrderItems.map(coItem => {
        const serviceItem = availableServices.find(s => s.name === coItem.serviceNameKey && s.washMethod === coItem.selectedWashMethod);
        if (!serviceItem) {
            addNotification({ message: `Lỗi: Không tìm thấy dịch vụ "${coItem.serviceNameKey}" với phương pháp "${coItem.selectedWashMethod}".`, type: 'error'});
            hasInvalidServiceCombination = true;
            return { serviceItem: {} as AppServiceItem, selectedWashMethod: coItem.selectedWashMethod, quantity: coItem.quantity };
        }
        return { 
            serviceItem, 
            selectedWashMethod: coItem.selectedWashMethod, 
            quantity: coItem.quantity,
            notes: coItem.notes 
        };
    });

    if (hasInvalidServiceCombination) {
        return; 
    }
    
    const finalTotalAmount = itemsForNewOrder.reduce((sum, item) => {
        const linePrice = Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0);
        return sum + linePrice;
    }, 0);

    const createdAt = new Date();
    let receivedAt = createdAt;
    if (pickupTime) { 
        try {
            const parsedPickupTime = new Date(pickupTime);
            if (!isNaN(parsedPickupTime.getTime())) {
                receivedAt = parsedPickupTime;
            } else {
                console.warn("Invalid pickupTime format, defaulting receivedAt to createdAt");
            }
        } catch (e) {
            console.warn("Error parsing pickupTime, defaulting receivedAt to createdAt:", e);
        }
    }
    
    const itemsMaxCustomerReturnTimeHours = Math.max(0, ...itemsForNewOrder.map(item => item.serviceItem.customerReturnTimeHours));
    const calculatedEstCompletionTimeBasedOnServices = new Date(receivedAt.getTime() + itemsMaxCustomerReturnTimeHours * 60 * 60 * 1000);

    const finalEstimatedCompletionTime = deliveryTime && !isNaN(new Date(deliveryTime).getTime())
        ? new Date(deliveryTime)
        : (itemsMaxCustomerReturnTimeHours > 0 ? calculatedEstCompletionTimeBasedOnServices : undefined);


    const generalNotesText = orderNotes.trim();
    let pickupInfoText = '';
    if(pickupAddress.trim()){
        pickupInfoText = `Lấy đồ tại: ${pickupAddress.trim()}`;
        if(pickupTime){
             try {
                pickupInfoText += ` lúc ${new Date(pickupTime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}`;
            } catch(e) { console.warn("Error formatting pickupTime for notes:", e); }
        }
    }

    let deliveryInfoText = '';
    if(deliveryAddress.trim()){
        deliveryInfoText = `Giao đồ tại: ${deliveryAddress.trim()}`;
        if(deliveryTime){
            try {
                deliveryInfoText += ` lúc ${new Date(deliveryTime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}`;
            } catch(e) { console.warn("Error formatting deliveryTime for notes:", e); }
        }
    }

    const notesParts: string[] = [];
    if (generalNotesText) notesParts.push(generalNotesText);
    if (pickupInfoText) notesParts.push(pickupInfoText);
    if (deliveryInfoText) notesParts.push(deliveryInfoText);
    const finalCombinedNotes = notesParts.join('; ').trim() || undefined;


    const newOrderPayload: Order = { 
        id: `CUS-REQ-${uuidv4().slice(0,6).toUpperCase()}`, 
        customer: customerContextForOrder,
        items: itemsForNewOrder,
        status: OrderStatus.PENDING, 
        createdAt: createdAt,
        receivedAt: receivedAt,
        estimatedCompletionTime: finalEstimatedCompletionTime,
        totalAmount: finalTotalAmount, 
        scanHistory: [{ timestamp: createdAt, action: 'Yêu cầu đặt lịch từ khách hàng', scannedBy: 'Khách hàng Website' }],
        notes: finalCombinedNotes, 
        ownerId: ownerIdForOrder,
    };
    systemAddOrder(newOrderPayload); 
    addNotification({ message: `Đã gửi yêu cầu đặt lịch. Mã tham khảo: ${newOrderPayload.id}. Tổng tiền dự kiến: ${finalTotalAmount.toLocaleString('vi-VN')} VNĐ. Chúng tôi sẽ sớm liên hệ với bạn!`, type: 'success' });
    
    setCustomerOrderItems([]); 
    if (customerContextForOrder?.address) { 
      setPickupAddress(customerContextForOrder.address); 
      setDeliveryAddress(customerContextForOrder.address); 
    } else {
      setPickupAddress('');
      setDeliveryAddress('');
    }
    setPickupTime(''); 
    setDeliveryTime(''); 
    setOrderNotes('');
    setSelectedStoreForManualOrder(storeProfiles.length === 1 ? storeProfiles[0].ownerId : null);
  };


  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading || !chatSession) return;
    const userMessage: ChatMessage = { id: uuidv4(), sender: 'user', text: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    setGeminiError(null);
    let aiMessageToDisplay: ChatMessage | null = null;

    try {
      const response: GenerateContentResponse = await chatSession.sendMessage({ message: userMessage.text });
      const rawAiResponseText = response.text; 

      try {
        let jsonStrToParse = typeof rawAiResponseText === 'string' ? rawAiResponseText.trim() : '';
        
        if (!jsonStrToParse && typeof rawAiResponseText === 'string' && rawAiResponseText.length > 0) { 
          jsonStrToParse = rawAiResponseText; 
        } else if (!jsonStrToParse && (rawAiResponseText === undefined || rawAiResponseText === null)) {
          setGeminiError("AI response was empty or not in the expected format.");
          setIsChatLoading(false);
          setChatMessages(prev => [...prev, {id: uuidv4(), sender:'ai', text: "Xin lỗi, tôi không nhận được phản hồi hợp lệ từ AI.", timestamp: new Date()}]);
          return;
        }


        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStrToParse.match(fenceRegex);
        
        if (match && typeof match[2] === 'string') {
          jsonStrToParse = match[2].trim();
        } else if (match && match[2] === undefined && jsonStrToParse.startsWith('{') && jsonStrToParse.endsWith('}')) {
          // It's likely already JSON without fences
        } else if (match && match[2] === undefined) {
           // No fence and doesn't look like JSON, possible plain text or error from AI
        }


        const parsedJson = JSON.parse(jsonStrToParse);

        if (parsedJson && typeof parsedJson === 'object') {
          if (parsedJson.action === "LOOKUP_INFO_REQUEST") {
            const query = parsedJson.query;
            const type = parsedJson.type;

            if (type === "CUSTOMER" && query) {
              const foundCustomer = customers.find(c => c.phone === query.trim());
              let customerLookupResponseText = "";
              if (foundCustomer) {
                customerLookupResponseText = `Tôi đã tìm thấy thông tin của bạn: Tên ${foundCustomer.name}, SĐT ${query}${foundCustomer.address ? `, Địa chỉ ${foundCustomer.address}` : ''}. Thông tin này có chính xác không ạ?`;
              } else {
                customerLookupResponseText = `Tôi chưa tìm thấy thông tin cho SĐT ${query}. Bạn vui lòng cho tôi biết Tên và Địa chỉ của bạn để tôi tạo hồ sơ mới nhé?`;
              }
              aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: customerLookupResponseText, timestamp: new Date() };
              setChatMessages(prev => [...prev, aiMessageToDisplay!]);
             
              return; 
            } else if (type === "ORDER" && query) {
              const dateQuery = parsedJson.date; 
              let lookupResultText = '';
              const queryNormalized = query.trim().toUpperCase();

              if (queryNormalized.startsWith('DH-') || queryNormalized.startsWith('CUS-REQ-') || queryNormalized.startsWith('AI-')) {
                  const foundOrder = findOrderById(query);
                  if (foundOrder) {
                      const statusInfo = getStatusInfo(foundOrder.status);
                      lookupResultText = `Thông tin đơn hàng "${query}":\nKhách: ${foundOrder.customer.name}\nTrạng thái: ${statusInfo.text}\nTổng: ${foundOrder.totalAmount.toLocaleString('vi-VN')} VNĐ\nNgày tạo: ${new Date(foundOrder.createdAt).toLocaleDateString('vi-VN')}`;
                      if ((foundOrder.status === OrderStatus.PROCESSING || foundOrder.status === OrderStatus.PENDING) && foundOrder.estimatedCompletionTime) { // Also show for PENDING
                        lookupResultText += `\nDự kiến trả: ${new Date(foundOrder.estimatedCompletionTime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}`;
                      }
                      else if ((foundOrder.status === OrderStatus.COMPLETED || foundOrder.status === OrderStatus.RETURNED) && foundOrder.pickupLocation) lookupResultText += `\nVị trí đồ: ${foundOrder.pickupLocation}`;
                  } else lookupResultText = `Không tìm thấy đơn hàng "${query}".`;
              } else { 
                  const ordersByPhoneBase = allOrders.filter(o => o.customer.phone === query.trim());
                  if (ordersByPhoneBase.length === 0) {
                      lookupResultText = `Không tìm thấy đơn hàng nào cho SĐT "${query}".`;
                  } else {
                      let foundOrdersForDisplay: Order[] = [];
                      let messageIntro = '';

                      if (dateQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
                          const [year, month, day] = dateQuery.split('-').map(Number);
                          const targetDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
                          const targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
                          
                          const exactDateMatches = ordersByPhoneBase.filter(o => {
                              const orderDate = new Date(o.createdAt);
                              return orderDate >= targetDateStart && orderDate <= targetDateEnd;
                          }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

                          if (exactDateMatches.length > 0) {
                              foundOrdersForDisplay = exactDateMatches;
                              messageIntro = `Tìm thấy ${exactDateMatches.length} đơn hàng cho SĐT "${query}" vào ngày ${day}/${month}/${year}:\n`;
                          } else {
                              const nearestMatches = ordersByPhoneBase.map(o => ({
                                  order: o,
                                  diff: Math.abs(new Date(o.createdAt).setHours(0,0,0,0) - targetDateStart.getTime())
                              }))
                              .sort((a, b) => {
                                  if (a.diff === b.diff) return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
                                  return a.diff - b.diff;
                              })
                              .slice(0, 3)
                              .map(item => item.order);

                              if (nearestMatches.length > 0) {
                                  foundOrdersForDisplay = nearestMatches;
                                  messageIntro = `Không có đơn hàng nào vào ngày ${day}/${month}/${year} cho SĐT "${query}". Hiển thị 3 đơn hàng gần nhất:\n`;
                              } else {
                                  lookupResultText = `Không tìm thấy đơn hàng nào cho SĐT "${query}" vào ngày ${day}/${month}/${year} hoặc các ngày lân cận.`;
                              }
                          }
                      } else { 
                          foundOrdersForDisplay = ordersByPhoneBase
                              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                              .slice(0, 3);
                          if (foundOrdersForDisplay.length > 0) {
                             messageIntro = `Tìm thấy ${foundOrdersForDisplay.length} đơn hàng gần nhất cho SĐT "${query}":\n`;
                          } else {
                              lookupResultText = `Không tìm thấy đơn hàng nào cho SĐT "${query}".`;
                          }
                      }

                      if (foundOrdersForDisplay.length > 0) {
                          lookupResultText = messageIntro + foundOrdersForDisplay.map((o, idx) => {
                              const statusInfo = getStatusInfo(o.status);
                              return `${idx + 1}. Mã ĐH: ${o.id} (${statusInfo.text}) - Ngày: ${new Date(o.createdAt).toLocaleDateString('vi-VN')}`;
                          }).join('\n');
                      } else if (!lookupResultText) { 
                          lookupResultText = `Không tìm thấy đơn hàng nào phù hợp cho SĐT "${query}"` + (dateQuery ? ` và ngày đã chọn.` : `.`);
                      }
                  }
              }
              aiMessageToDisplay = { 
                  id: uuidv4(), 
                  sender: 'ai', 
                  text: lookupResultText || "Xin lỗi, không tìm thấy thông tin phù hợp hoặc đã có lỗi xảy ra.", 
                  timestamp: new Date() 
              };
              setChatMessages(prev => [...prev, aiMessageToDisplay!]);
             
              return; 
            } else {
              aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: `Yêu cầu tra cứu không hợp lệ: ${rawAiResponseText}`, timestamp: new Date() };
            }
          } else if (parsedJson.action === "CREATE_ORDER_REQUEST" && parsedJson.orderDetails) {
            const orderDetailsAI: AppOrderDetailsFromAI = parsedJson.orderDetails;
            let customerToPassToModal: Customer | null = null;
            const existingCustomer = customers.find(c => c.phone === orderDetailsAI.customer.phone);
            if (existingCustomer) customerToPassToModal = { ...existingCustomer, address: orderDetailsAI.customer.address || existingCustomer.address || ''};
            else if (orderDetailsAI.customer.name && orderDetailsAI.customer.phone) customerToPassToModal = {id: `temp-${uuidv4()}`, name: orderDetailsAI.customer.name, phone: orderDetailsAI.customer.phone, address: orderDetailsAI.customer.address || ''};
            
            if (customerToPassToModal) {
                setCustomerForAIOrder(customerToPassToModal);
                setOrderDataForConfirmation(orderDetailsAI);
                setTargetStoreOwnerIdForAI(orderDetailsAI.targetStoreOwnerId); 
                setIsOrderConfirmationModalOpen(true);
                aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: "Tuyệt vời! Tôi đã chuẩn bị đơn hàng. Vui lòng kiểm tra và xác nhận trong hộp thoại nhé.", timestamp: new Date() };
            } else {
                 aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: "Thông tin khách hàng (SĐT, Tên) chưa đủ. Vui lòng cung cấp lại.", timestamp: new Date() };
            }
          } else if (parsedJson.text_response) {
            aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: parsedJson.text_response, timestamp: new Date() };
          } else {
            aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: `Phản hồi không mong muốn từ AI: ${rawAiResponseText}`, timestamp: new Date() };
          }
        } else { 
            aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: `Lỗi xử lý phản hồi từ AI. Phản hồi gốc: ${rawAiResponseText}`, timestamp: new Date() };
        }
      } catch (parseError) { 
        console.error("Lỗi phân tích JSON từ AI:", parseError, "Phản hồi gốc:", rawAiResponseText);
        aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: `Đã có lỗi khi hiểu phản hồi từ Trợ Lý AI. Nội dung AI trả về (không phải JSON hợp lệ): ${rawAiResponseText}`, timestamp: new Date() };
      }

      if (aiMessageToDisplay) {
        setChatMessages(prev => [...prev, aiMessageToDisplay]);
      }
    } catch (error) { 
        console.error("Lỗi gửi tin nhắn tới Gemini:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setGeminiError(`Lỗi kết nối tới Trợ Lý AI: ${errorMessage}`);
        setChatMessages(prev => [...prev, {
            id: uuidv4(),
            sender: 'ai',
            text: "Rất tiếc, đã có lỗi xảy ra khi kết nối với Trợ Lý AI. Vui lòng thử lại sau.",
            timestamp: new Date()
        }]);
    } finally {
        setIsChatLoading(false);
        if (chatInputRef.current) { 
          chatInputRef.current.focus();
        }
    }
  };

  const handleConfirmAIOrder = (confirmedOrderPayload: Order) => { 
    systemAddOrder(confirmedOrderPayload); 
    addNotification({ message: `Đơn hàng ${confirmedOrderPayload.id} đã được tạo thành công qua Trợ Lý AI.`, type: 'success' });
    setIsOrderConfirmationModalOpen(false);
    setOrderDataForConfirmation(null);
    setCustomerForAIOrder(null);
    setTargetStoreOwnerIdForAI(undefined);
     setChatMessages(prev => [...prev, {
        id: uuidv4(),
        sender: 'ai',
        text: `Đã tạo thành công đơn hàng ${confirmedOrderPayload.id} cho bạn. Cảm ơn bạn đã sử dụng dịch vụ!`,
        timestamp: new Date()
    }]);
  };

  const handleCloseConfirmationModal = () => {
    setIsOrderConfirmationModalOpen(false);
    setOrderDataForConfirmation(null);
    setCustomerForAIOrder(null);
    setTargetStoreOwnerIdForAI(undefined);
    setChatMessages(prev => [...prev, {
        id: uuidv4(),
        sender: 'ai',
        text: "Đã hủy việc tạo đơn hàng. Bạn cần hỗ trợ gì thêm không?",
        timestamp: new Date()
    }]);
  };

  const TABS = [
    { id: 'lookup', label: 'Tra cứu Đơn hàng', icon: <SearchIcon size={18}/> },
    { id: 'createOrder', label: 'Đặt lịch Giặt là', icon: <ShoppingCartIcon size={18}/> },
    { id: 'aiAssistant', label: 'Trợ Lý AI', icon: <MessageCircleIcon size={18}/> },
  ];

  const lookupInputPlaceholder = useMemo(() => {
    if (isStaffServingModeActive && customerForNewOrder) {
        return `Tra cứu cho SĐT đang phục vụ (${customerForNewOrder.phone}) hoặc nhập SĐT/Mã ĐH khác`;
    }
    if (identifiedPublicCustomer) {
        return `Tra cứu cho SĐT của bạn (${identifiedPublicCustomer.phone}) hoặc nhập SĐT/Mã ĐH khác`;
    }
    return "VD: DH-12345 hoặc 090xxxxxxx";
  }, [isStaffServingModeActive, customerForNewOrder, identifiedPublicCustomer]);

  const isStaffLoggedIn = currentUser && currentUser.role !== UserRole.CUSTOMER;
  
  const displayCustomer = isStaffServingModeActive && customerForNewOrder ? customerForNewOrder : identifiedPublicCustomer;
  const canSubmitCreateOrder = 
    customerOrderItems.length > 0 &&
    ((isStaffServingModeActive && customerForNewOrder) || identifiedPublicCustomer) &&
    availableServices.length > 0 &&
    !customerOrderItems.some(item => !availableServices.find(s => s.name === item.serviceNameKey && s.washMethod === item.selectedWashMethod)) &&
    (storeProfiles.length === 0 || (storeProfiles.length === 1 && storeProfiles[0].ownerId) || (storeProfiles.length > 1 && selectedStoreForManualOrder));


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-bg-surface dark:bg-slate-800 shadow-lg rounded-xl p-3 sm:p-4 border border-border-base">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-3 mb-3">
            <div className="flex-grow mb-3 sm:mb-0">
                <h1 className="text-2xl font-bold text-text-heading dark:text-slate-100 mb-1">Chào mừng bạn đến với {APP_NAME}!</h1>
                {!isStaffLoggedIn && (
                  isEditingPublicCustomerPhone || !identifiedPublicCustomer ? (
                    <div className="mt-2 flex items-end space-x-2">
                      <Input
                        label="SĐT của bạn (để xem thông báo & đặt lịch nhanh)"
                        value={publicCustomerPhoneInput}
                        onChange={(e) => setPublicCustomerPhoneInput(e.target.value)}
                        placeholder="Nhập SĐT (10 chữ số)"
                        leftIcon={<PhoneIcon size={16} />}
                        wrapperClassName="flex-grow"
                        className="!py-2 text-sm"
                      />
                      <Button onClick={handleConfirmPublicCustomerPhone} variant="primary" size="md" className="!py-2 whitespace-nowrap">
                        Xác nhận SĐT
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-text-muted dark:text-slate-400">
                      Đang xem với SĐT: <strong className="text-text-body dark:text-slate-200">{identifiedPublicCustomer.name} ({identifiedPublicCustomer.phone})</strong>
                      <Button variant="link" size="sm" onClick={handleChangePublicCustomerPhone} className="ml-2 !p-0.5 text-xs">Đổi SĐT</Button>
                    </div>
                  )
                )}
                {isStaffLoggedIn && (
                    isStaffServingModeActive && !customerForNewOrder ? (
                        <form onSubmit={handleSetServingCustomer} className="mt-2 flex items-end space-x-2">
                            <Input
                                label="SĐT Khách hàng phục vụ"
                                value={servingCustomerPhoneInput}
                                onChange={(e) => setServingCustomerPhoneInput(e.target.value)}
                                placeholder="Nhập SĐT khách..."
                                leftIcon={<PhoneIcon size={16} />}
                                wrapperClassName="flex-grow"
                                className="!py-2 text-sm"
                            />
                            <Button type="submit" variant="primary" size="md" className="!py-2 whitespace-nowrap">Chọn Khách</Button>
                        </form>
                    ) : isStaffServingModeActive && customerForNewOrder ? (
                         <div className="mt-2 text-sm text-text-muted dark:text-slate-400">
                            Đang phục vụ: <strong className="text-text-body dark:text-slate-200">{customerForNewOrder.name} ({customerForNewOrder.phone})</strong>
                            <Button variant="link" size="sm" onClick={handleClearServingCustomer} className="ml-2 !p-0.5 text-xs">Đổi khách</Button>
                        </div>
                    ) : null
                )}
            </div>
        </div>
        {identifiedPublicCustomer && publicCustomerNotifications.length > 0 && (
            <Card title="Thông báo cho bạn" icon={<BellDotIcon size={18} className="text-brand-primary"/>} className="mb-4 border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-800/20" contentClassName="!py-2">
                <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                    {publicCustomerNotifications.map(n => (
                        <div key={n.id} className={`p-2 rounded-md flex justify-between items-center ${n.type === 'rating_prompt' ? 'bg-yellow-100 dark:bg-yellow-700/30' : 'bg-bg-surface dark:bg-slate-700'}`}>
                            <div>
                                <p className={`${n.type === 'rating_prompt' ? 'text-yellow-700 dark:text-yellow-200' : 'text-text-body dark:text-slate-200'}`}>{n.message}</p>
                                <p className="text-xs text-text-muted">{new Date(n.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})} - {n.orderId}</p>
                            </div>
                            {n.type === 'rating_prompt' && n.orderStatus === OrderStatus.RETURNED ? (
                                <Button variant="primary" size="sm" className="!text-xs !py-1 !px-2" onClick={() => openRatingModal(n.orderId!, identifiedPublicCustomer!.id, n.id)}>Đánh giá</Button>
                            ) : (
                                <Button variant="ghost" size="sm" className="!text-xs !py-1 !px-2" onClick={() => markNotificationAsRead(n.id)}>Đã xem</Button>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border-base pt-4">
            {TABS.map(tab => (
            <Button 
                key={tab.id} 
                variant={activeTab === tab.id ? 'primary' : 'ghost'} 
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`w-full justify-center py-2.5 sm:py-3 ${activeTab === tab.id ? 'shadow-md' : ''}`}
                leftIcon={React.cloneElement(tab.icon, {className: `mr-2 ${activeTab === tab.id ? 'text-text-on-primary' : 'text-brand-primary dark:text-sky-400'}`})}
            >
                {tab.label}
            </Button>
            ))}
        </div>
      </div>

      {activeTab === 'lookup' && (
        <Card title="Tra cứu Thông tin Đơn hàng" icon={<SearchIcon className="text-brand-primary" size={20} />}>
          <form onSubmit={handleLookupSearch} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                    wrapperClassName="md:col-span-2"
                    label="Nhập Mã đơn hàng hoặc SĐT của bạn"
                    value={lookupSearchTerm}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setLookupSearchTerm(e.target.value)}
                    placeholder={lookupInputPlaceholder}
                    leftIcon={<PackageIcon/>}
                />
                <Input
                    label="Ngày tạo đơn (tùy chọn)"
                    type="date"
                    value={lookupDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setLookupDate(e.target.value)}
                    leftIcon={<CalendarDaysIcon />}
                />
            </div>
            <Button type="submit" variant="primary" className="w-full md:w-auto" leftIcon={<SearchIcon size={18}/>}>
              Tìm kiếm
            </Button>
          </form>

          {searchError && <p className="text-center text-status-danger bg-status-danger-bg p-3 rounded-md">{searchError}</p>}
          {searchMessage && !searchError && <p className="text-center text-status-info bg-status-info-bg p-3 rounded-md">{searchMessage}</p>}

          {detailedOrder ? (
            <Card className="mt-6 bg-bg-subtle/30 dark:bg-slate-800/50">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-text-heading dark:text-slate-100">Chi tiết Đơn hàng: {detailedOrder.id}</h3>
                    <Button variant="ghost" onClick={handleBackToList} size="sm" leftIcon={<ListIcon size={16}/>}>Xem danh sách</Button>
                </div>
                <dl className="divide-y divide-border-base dark:divide-slate-700">
                    <DetailItem label="Khách hàng:">
                        <span className="flex items-center justify-end"> <UserIcon size={14} className="mr-1.5 text-text-muted"/> {detailedOrder.customer.name} ({detailedOrder.customer.phone})</span>
                    </DetailItem>
                    <DetailItem label="Trạng thái:">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${getStatusInfo(detailedOrder.status).bgColor} ${getStatusInfo(detailedOrder.status).textColor} border ${getStatusInfo(detailedOrder.status).borderColor}`}>
                            {getStatusInfo(detailedOrder.status).icon}
                            {getStatusInfo(detailedOrder.status).text}
                        </span>
                    </DetailItem>
                    <DetailItem label="Ngày tạo:">
                        <span className="flex items-center justify-end"><CalendarDaysIcon size={14} className="mr-1.5 text-text-muted"/> {new Date(detailedOrder.createdAt).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</span>
                    </DetailItem>
                    <DetailItem label="Tổng tiền:">
                        <span className="font-bold text-brand-primary dark:text-sky-300 flex items-center justify-end"><DollarSignIcon size={14} className="mr-1"/> {detailedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
                    </DetailItem>
                    {detailedOrder.pickupLocation && (
                        <DetailItem label="Vị trí để đồ:">
                            <span className="flex items-center justify-end"><MapPinIcon size={14} className="mr-1.5 text-text-muted"/> {detailedOrder.pickupLocation}</span>
                        </DetailItem>
                    )}
                    {(detailedOrder.status === OrderStatus.PROCESSING || detailedOrder.status === OrderStatus.PENDING) && detailedOrder.estimatedCompletionTime && (
                      <DetailItem label={detailedOrder.status === OrderStatus.PENDING ? "Dự kiến trả:" : "Dự kiến xong trong:"}>
                        <span className="flex items-center justify-end text-status-info-text dark:text-sky-300">
                          <ClockIcon size={14} className="mr-1.5"/>
                          {detailedOrder.status === OrderStatus.PENDING
                            ? new Date(detailedOrder.estimatedCompletionTime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})
                            : getRemainingTime(detailedOrder.estimatedCompletionTime)}
                        </span>
                      </DetailItem>
                    )}
                    {detailedOrder.notes && (
                        <DetailItem label="Ghi chú đơn hàng:" dtCls="self-start pt-1.5" ddCls="whitespace-pre-wrap text-left sm:text-right">
                            {detailedOrder.notes}
                        </DetailItem>
                    )}
                     {detailedOrder.qrCodePaymentUrl && (
                        <div className="py-3 text-center">
                            <p className="text-sm text-text-muted mb-1">Mã QR thanh toán:</p>
                            <QRCodeDisplay value={detailedOrder.qrCodePaymentUrl} size={100} />
                        </div>
                    )}
                </dl>
                <div className="mt-4 border-t border-border-base dark:border-slate-700 pt-4">
                    <h4 className="text-md font-semibold text-text-heading mb-2">Các dịch vụ:</h4>
                    <ul className="space-y-1 text-sm">
                        {detailedOrder.items.map((item, index) => (
                        <li key={index} className="flex justify-between p-1.5 bg-bg-base dark:bg-slate-800 rounded">
                            <span>{item.serviceItem.name} (x{item.quantity})</span>
                            <span>{(item.serviceItem.price * item.quantity).toLocaleString('vi-VN')} VNĐ</span>
                        </li>
                        ))}
                    </ul>
                </div>
                {(detailedOrder.status === OrderStatus.COMPLETED || detailedOrder.status === OrderStatus.RETURNED) && (
                    <div className="mt-5 text-center">
                        <Button onClick={() => openRatingModal(detailedOrder.id, detailedOrder.customer.id)} variant="primary" leftIcon={<StarIcon size={18}/>}>
                            Đánh giá & Tip
                        </Button>
                    </div>
                )}
            </Card>
          ) : orderList.length > 0 ? (
            <div className="mt-6">
              <div className="grid grid-cols-1 gap-4">
                {displayedOrders.map(order => (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                      <h3 className="text-md font-semibold text-text-link hover:underline">
                        <a href="#" onClick={(e) => {e.preventDefault(); handleViewDetails(order);}}>{order.id}</a>
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${getStatusInfo(order.status).bgColor} ${getStatusInfo(order.status).textColor} border ${getStatusInfo(order.status).borderColor}`}>
                         {getStatusInfo(order.status).icon}
                         {getStatusInfo(order.status).text}
                      </span>
                    </div>
                    <div className="text-sm text-text-muted space-y-1">
                      <p className="flex items-center"><UserIcon size={14} className="mr-1.5"/>{order.customer.name} ({order.customer.phone})</p>
                      <p className="flex items-center"><CalendarDaysIcon size={14} className="mr-1.5"/>Ngày tạo: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
                      <p className="flex items-center"><DollarSignIcon size={14} className="mr-1.5"/>Tổng tiền: {order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                       {order.status === OrderStatus.PENDING && order.estimatedCompletionTime && (
                        <p className="flex items-center"><ClockIcon size={14} className="mr-1.5 text-status-info-text"/>Dự kiến trả: {new Date(order.estimatedCompletionTime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</p>
                      )}
                    </div>
                    <div className="mt-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(order)} leftIcon={<ListIcon size={16}/>}>Xem chi tiết</Button>
                    </div>
                  </Card>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center items-center space-x-2">
                  <Button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} variant="secondary" size="sm"><ChevronLeftIcon size={16}/></Button>
                  <span className="text-sm text-text-muted">Trang {currentPage} / {totalPages}</span>
                  <Button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} variant="secondary" size="sm"><ChevronRightIcon size={16}/></Button>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      )}

      {activeTab === 'createOrder' && (
        <Card title="Đặt lịch Giặt là Trực tuyến" icon={<ShoppingCartIcon className="text-brand-primary" size={20} />}>
             {!displayCustomer && !isStaffServingModeActive && (
                 <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 rounded-md text-sm border border-amber-300 dark:border-amber-600 flex items-center">
                    <AlertTriangle size={18} className="mr-2"/> Vui lòng nhập và xác nhận SĐT của bạn ở đầu trang để tiếp tục đặt lịch.
                </div>
            )}
            {isStaffServingModeActive && !customerForNewOrder && (
                 <div className="p-3 mb-4 bg-sky-50 dark:bg-sky-800/30 text-sky-700 dark:text-sky-300 rounded-md text-sm border border-sky-300 dark:border-sky-600 flex items-center">
                    <InfoIcon size={18} className="mr-2"/> Nhập SĐT ở trên để tìm hoặc tạo khách hàng mới trước khi tạo đơn.
                </div>
            )}
            {displayCustomer && (
                 <div className="p-3 mb-4 bg-emerald-50 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-300 rounded-md text-sm border border-emerald-300 dark:border-emerald-600">
                    <p><strong className="font-semibold">Khách hàng:</strong> {displayCustomer.name} ({displayCustomer.phone})</p>
                    {displayCustomer.address && <p><strong className="font-semibold">Địa chỉ mặc định:</strong> {displayCustomer.address}</p>}
                </div>
            )}

            <form onSubmit={handleCreateOrderSubmit} className="space-y-6">
                <fieldset className="space-y-4 p-4 border border-border-base dark:border-slate-700 rounded-lg">
                    <legend className="text-md font-semibold text-text-heading dark:text-slate-100 mb-2 px-1 flex items-center"><PackageIcon size={18} className="mr-2 text-brand-primary"/>Dịch vụ Chọn</legend>
                    {customerOrderItems.map((item, index) => {
                        const washMethodsForService = availableServices
                            .filter(s => s.name === item.serviceNameKey)
                            .map(s => ({ value: s.washMethod, label: `${s.washMethod} (${s.price.toLocaleString('vi-VN')}đ)`}))
                             .filter((option, idx, self) => self.findIndex(o => o.value === option.value) === idx); // Deduplicate
                        
                        const currentSelectedServiceDetails = availableServices.find(s => s.name === item.serviceNameKey && s.washMethod === item.selectedWashMethod);
                        const lineItemTotal = currentSelectedServiceDetails ? Math.max(currentSelectedServiceDetails.price * item.quantity, currentSelectedServiceDetails.minPrice || 0) : 0;

                        return (
                        <div key={item.id} className="p-3 border border-border-input dark:border-slate-600 rounded-md bg-bg-subtle/30 dark:bg-slate-700/20 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 items-end">
                            <Select
                                wrapperClassName="md:col-span-4"
                                label={`Dịch vụ ${index + 1}`}
                                options={uniqueServiceNames}
                                value={item.serviceNameKey}
                                onChange={(e) => handleCustomerOrderItemChange(item.id, 'serviceNameKey', e.target.value)}
                                disabled={uniqueServiceNames.length === 0}
                            />
                            <Select
                                wrapperClassName="md:col-span-3"
                                label="PP Giặt & Giá"
                                options={washMethodsForService.length > 0 ? washMethodsForService : [{value: item.selectedWashMethod, label: item.selectedWashMethod}]}
                                value={item.selectedWashMethod}
                                onChange={(e) => handleCustomerOrderItemChange(item.id, 'selectedWashMethod', e.target.value as WashMethod)}
                                disabled={washMethodsForService.length === 0}
                            />
                            <Input
                                wrapperClassName="md:col-span-1"
                                label="SL*" type="number" min="1"
                                value={item.quantity.toString()}
                                onChange={(e) => handleCustomerOrderItemChange(item.id, 'quantity', parseInt(e.target.value,10))}
                                required
                            />
                            <div className="md:col-span-2 text-sm text-right self-center">
                                <span className="font-semibold text-text-heading dark:text-slate-100">TT: {lineItemTotal.toLocaleString('vi-VN')}</span>
                            </div>
                             <div className="md:col-span-2 flex justify-end">
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveCustomerOrderItem(item.id)} className="p-1.5 text-status-danger hover:bg-rose-100 dark:hover:bg-rose-700/50" title="Xóa mục">
                                    <MinusCircleIcon size={18} />
                                </Button>
                            </div>
                            </div>
                             <Input
                                label="Ghi chú cho dịch vụ này"
                                value={item.notes || ''}
                                onChange={(e) => handleCustomerOrderItemChange(item.id, 'notes', e.target.value)}
                                placeholder="VD: Giặt kỹ cổ áo, không tẩy..."
                                className="text-xs py-1.5"
                            />
                             {!currentSelectedServiceDetails && item.serviceNameKey && washMethodsForService.length > 0 &&
                                <p className="text-xs text-status-warning mt-1">Vui lòng chọn phương pháp giặt phù hợp.</p>
                            }
                        </div>
                        );
                    })}
                    <Button type="button" variant="secondary" onClick={handleAddCustomerOrderItem} leftIcon={<PlusIcon size={16}/>} size="sm" disabled={uniqueServiceNames.length === 0}>Thêm dịch vụ</Button>
                    {uniqueServiceNames.length === 0 && <p className="text-xs text-text-muted mt-1">Hiện chưa có dịch vụ nào được định nghĩa.</p>}
                </fieldset>

                {storeProfiles.length > 1 && (
                    <Select 
                        label="Chọn cửa hàng phục vụ*"
                        options={storeProfiles.map(p => ({ value: p.ownerId, label: `${p.storeName} (${p.storeAddress?.substring(0,20) || 'N/A'}...)` }))}
                        value={selectedStoreForManualOrder || ""}
                        onChange={e => setSelectedStoreForManualOrder(e.target.value)}
                        placeholder="-- Chọn một cửa hàng --"
                        leftIcon={<BuildingIcon size={16}/>}
                        required
                    />
                )}
                 {storeProfiles.length === 1 && (
                    <p className="text-sm text-text-muted p-2 bg-sky-50 dark:bg-sky-800/30 rounded-md">Dịch vụ sẽ được xử lý tại: <strong className="text-text-body dark:text-sky-200">{storeProfiles[0].storeName}</strong>.</p>
                 )}
                 {storeProfiles.length === 0 && (
                    <p className="text-sm text-status-warning p-2 bg-amber-50 dark:bg-amber-800/30 rounded-md">Hiện chưa có cửa hàng nào được cấu hình. Vui lòng thử lại sau.</p>
                 )}


                <fieldset className="space-y-3 p-4 border border-border-base dark:border-slate-700 rounded-lg">
                     <legend className="text-md font-semibold text-text-heading dark:text-slate-100 mb-2 px-1 flex items-center"><TruckIcon size={18} className="mr-2 text-brand-primary"/>Thông tin Giao/Nhận (tùy chọn)</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Địa chỉ lấy đồ" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Để trống nếu mang đến tiệm" leftIcon={<NavigationIcon size={16}/>}/>
                        <Input label="Thời gian lấy đồ" type="datetime-local" value={pickupTime} onChange={e => setPickupTime(e.target.value)} leftIcon={<CalendarDaysIcon size={16}/>}/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Địa chỉ giao đồ" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Để trống nếu tự đến lấy" leftIcon={<NavigationIcon size={16}/>}/>
                        <Input label="Thời gian giao đồ" type="datetime-local" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} leftIcon={<CalendarDaysIcon size={16}/>}/>
                    </div>
                </fieldset>
                <Input label="Ghi chú chung cho đơn hàng" isTextArea rows={2} value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Yêu cầu đặc biệt khác..." leftIcon={<MessageCircleIcon size={16}/>}/>
                
                 <div className="p-3 bg-sky-50 dark:bg-sky-800/30 rounded-lg border border-sky-200 dark:border-sky-700">
                    <p className="text-md font-semibold text-text-heading dark:text-sky-200 flex items-center justify-between">
                        <span><DollarSignIcon size={18} className="inline mr-1.5 text-brand-primary"/>Tổng tiền dự kiến:</span>
                        <span className="text-xl text-brand-primary dark:text-sky-300">{calculateNewOrderTotal.toLocaleString('vi-VN')} VNĐ</span>
                    </p>
                </div>

                <Button type="submit" variant="primary" size="lg" className="w-full" leftIcon={<ShoppingCartIcon size={20}/>} disabled={!canSubmitCreateOrder}>
                    Gửi Yêu cầu Đặt lịch
                </Button>
            </form>
        </Card>
      )}

      {activeTab === 'aiAssistant' && (
        <Card title="Trợ Lý AI Đặt lịch & Tra cứu" icon={<MessageCircleIcon className="text-brand-primary" size={20} />}>
          {geminiError && <p className="text-center text-status-danger bg-status-danger-bg p-3 rounded-md mb-3">{geminiError}</p>}
          <div ref={chatContainerRef} className="h-96 overflow-y-auto p-4 border border-border-base dark:border-slate-700 rounded-lg bg-bg-subtle/30 dark:bg-slate-700/20 mb-4">
            {chatMessages.map(msg => <ChatMessageDisplay key={msg.id} message={msg} />)}
            {isChatLoading && (
              <div className="flex justify-start mb-3">
                <div className="max-w-[70%] p-3 rounded-lg shadow bg-bg-surface dark:bg-slate-700 text-text-body dark:text-slate-100 rounded-bl-none animate-pulse">
                  <p className="text-sm text-text-muted">AI đang soạn tin...</p>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleChatSend(); }} className="flex space-x-3">
            <Input
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={isChatLoading ? "AI đang phản hồi..." : "Nhập yêu cầu của bạn..."}
              wrapperClassName="flex-grow"
              disabled={isChatLoading || !chatSession}
              aria-label="Nhập tin nhắn cho AI"
            />
            <Button type="submit" variant="primary" disabled={isChatLoading || !chatInput.trim() || !chatSession} rightIcon={<SendIcon size={18}/>}>Gửi</Button>
          </form>
        </Card>
      )}
      {isOrderConfirmationModalOpen && orderDataForConfirmation && customerForAIOrder && (
        <OrderConfirmationModal
          isOpen={isOrderConfirmationModalOpen}
          onClose={handleCloseConfirmationModal}
          onConfirm={handleConfirmAIOrder}
          orderDetailsFromAI={orderDataForConfirmation}
          customer={customerForAIOrder}
          availableServices={availableServices}
          addCustomer={systemAddCustomer} 
          targetStoreOwnerId={targetStoreOwnerIdForAI}
        />
      )}
      {isRatingModalOpen && orderIdForRating && customerIdForRating && (
        <RatingTipModal 
            isOpen={isRatingModalOpen}
            onClose={() => setIsRatingModalOpen(false)}
            orderId={orderIdForRating}
            customerId={customerIdForRating}
        />
      )}
    </div>
  );
};

// Removed: export default CustomerHomePage;
// It's already exported as a named export: export const CustomerHomePage