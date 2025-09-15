

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
// FIX: Replaced deprecated `Customer` type with `User`.
import { Order, OrderStatus, User, ChatMessage, UserRole, OrderDetailsFromAI as AppOrderDetailsFromAI, StoreProfile, Promotion } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { OrderConfirmationModal } from '../../../components/shared/OrderConfirmationModal';
import { MessageCircleIcon, SendIcon } from 'lucide-react';
import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai"; 
import { v4 as uuidv4 } from 'uuid';
import { APP_NAME } from '../../../constants';
import { ChatMessageDisplay } from './ChatMessageDisplay';

// Define the structured schema for the AI's responses
const aiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    text_response: {
      type: Type.STRING,
      description: "A friendly, conversational text response for the user.",
      nullable: true,
    },
    lookup_info_request: {
      type: Type.OBJECT,
      description: "A request to look up information in the system.",
      nullable: true,
      properties: {
        type: { type: Type.STRING, enum: ["ORDER", "CUSTOMER"] },
        query: { type: Type.STRING, description: "The order ID or customer phone number to look up." },
        date: { type: Type.STRING, description: "Optional date filter (YYYY-MM-DD).", nullable: true },
        statuses: {
          type: Type.ARRAY,
          description: "Optional array of order statuses to filter by. Use exact enum values from the list provided in system instructions.",
          nullable: true,
          items: {
            type: Type.STRING,
            enum: ["Chưa xử lý", "Đang xử lý", "Đã xử lý", "Đã hủy", "Đã trả"],
          },
        },
      },
    },
    create_order_request: {
      type: Type.OBJECT,
      description: "A request to create a new laundry order, sent only after final user confirmation.",
      nullable: true,
      properties: {
        customer: {
          type: Type.OBJECT,
          properties: {
            phone: { type: Type.STRING },
            name: { type: Type.STRING, nullable: true },
            address: { type: Type.STRING, nullable: true },
          },
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              serviceName: { type: Type.STRING },
              quantity: { type: Type.INTEGER },
              notes: { type: Type.STRING, nullable: true },
            },
          },
        },
        pickupAddress: { type: Type.STRING, nullable: true },
        deliveryAddress: { type: Type.STRING, nullable: true },
        pickupTime: { type: Type.STRING, nullable: true },
        deliveryTime: { type: Type.STRING, nullable: true },
        orderNotes: { type: Type.STRING, nullable: true },
        targetStoreOwnerId: { type: Type.STRING, description: "The ID of the store where the order should be placed." },
      },
    },
  },
};

interface AIAssistantTabProps {
  loggedInCustomer?: User | null;
}


export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({ loggedInCustomer }) => {
  // FIX: Replaced `customers` and `addCustomer` with `users` and `addUser`.
  const { 
    orders: allOrders, 
    services: availableServices, 
    addNotification, 
    users,
    addOrder: systemAddOrder, 
    addUser: systemAddUser,
    storeProfiles, 
    findOrder: findOrderById,
    promotions,
    // FIX: Get washMethods from context to pass to the confirmation modal.
    washMethods,
  } = useData();
  const customers = useMemo(() => users.filter(u => u.role === UserRole.CUSTOMER), [users]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [isOrderConfirmationModalOpen, setIsOrderConfirmationModalOpen] = useState(false);
  const [orderDataForConfirmation, setOrderDataForConfirmation] = useState<AppOrderDetailsFromAI | null>(null);
  // FIX: Changed state type from `Customer` to `User`.
  const [customerForAIOrder, setCustomerForAIOrder] = useState<User | null>(null);
  const [targetStoreOwnerIdForAI, setTargetStoreOwnerIdForAI] = useState<string | undefined>(undefined);
  
  const chatContainerRef = useRef<HTMLDivElement>(null); 
  const chatInputRef = useRef<HTMLInputElement>(null); 

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  const activePromotions = useMemo(() => {
    const now = new Date();
    return promotions.filter(p => 
        p.isActive &&
        (!p.startDate || new Date(p.startDate) <= now) &&
        (!p.endDate || new Date(p.endDate) >= now)
    );
  }, [promotions]);

  useEffect(() => {
    // This effect runs only once when the component mounts or when essential data changes.
    // It initializes the AI chat session with the correct context (logged-in vs. anonymous).
    if (!chatSession && process.env.API_KEY) {
      try {
        const aiApiKey = process.env.API_KEY;
        const geminiChatInstance = new GoogleGenAI({ apiKey: aiApiKey });
        
        const servicesListForAI = availableServices.map(s => `* "${s.name}" (Giá: ${s.price.toLocaleString('vi-VN')} VNĐ / ${s.unit})`).join('\n');
        const storeProfilesListForAI = storeProfiles.map(p => `* "${p.storeName}" (ID cửa hàng: ${p.ownerId}, Địa chỉ: ${p.storeAddress || 'N/A'})`).join('\n');
        const promotionsListForAI = activePromotions.map(p => {
            const storeScope = p.isSystemWide ? 'Toàn chuỗi' : `Cửa hàng: ${storeProfiles.find(s => s.ownerId === p.ownerId)?.storeName || 'chỉ định'}`;
            const discountText = p.discountType === 'percentage'
                ? `Giảm ${p.discountValue}% (tối đa ${p.maxDiscountAmount?.toLocaleString('vi-VN')} VNĐ)`
                : `Giảm ${p.discountValue.toLocaleString('vi-VN')} VNĐ`;
            const minOrderText = p.minOrderAmount ? `, cho đơn từ ${p.minOrderAmount.toLocaleString('vi-VN')} VNĐ` : '';
            return `* Mã "${p.code}": ${discountText}${minOrderText}. (${p.name}). Áp dụng: ${storeScope}.`;
        }).join('\n');


        const commonWorkflows = `
**Order Creation Flow:**
1.  Gather ALL necessary information from the user (phone, name, services, quantities, store choice, pickup/delivery details).
2.  Summarize the complete order details and ask for the user's final confirmation.
3.  ONLY after the user explicitly confirms (e.g., "yes", "ok", "confirm"), populate the \`create_order_request\` field with ALL collected details. Do NOT send it before final confirmation.
4.  **Order Modification:** If the user wants to change something after you've summarized, DO NOT send \`create_order_request\`. Instead, use \`text_response\` to acknowledge the change, update the order details internally, and present a NEW, updated summary for confirmation.
5.  **Promotion Handling:** After getting items and store choice, INFORM the user about relevant promotion codes from the list. DO NOT apply them yourself.
6.  **Final Confirmation Message Generation:** After you send a \`create_order_request\`, the system will process it. You will then receive a system message from the user like: \`(System message: Order [order_id] created successfully. Customer was [new/existing]. Please provide the final confirmation message to the user.)\`. Based on this message, you MUST generate a final confirmation for the user in the \`text_response\` field. If the customer was **new**, your response MUST BE: "Đơn hàng của bạn đã được tạo thành công! Một tài khoản cũng đã được tạo cho bạn với SĐT đã cung cấp. Mật khẩu mặc định là "123123". Vui lòng đăng nhập để theo dõi đơn hàng và đổi mật khẩu nhé.". If the customer was **existing**, your response MUST BE: "Đã tạo thành công đơn hàng [order_id] cho bạn. Cảm ơn bạn đã sử dụng dịch vụ!". You MUST replace \`[order_id]\` with the actual ID from the system message.

**General Information (use for text_response):**
- Our store is open from 8:00 AM to 9:00 PM every day.
- We offer wet wash, dry cleaning, steaming, and ironing services.
- If you have a question about a specific price, please ask about the service by name from the list.
- For any other questions, provide a helpful and friendly response.
`;

        let systemInstruction: string;
        let initialAiMessage: ChatMessage;

        if (loggedInCustomer) {
            // CONTEXT-AWARE INSTRUCTION for logged-in users
            systemInstruction = `You are a friendly and efficient AI Assistant for the ${APP_NAME} laundromat.
The user is ALREADY LOGGED IN. Their details are:
- Name: ${loggedInCustomer.name}
- Phone: ${loggedInCustomer.phone}
- Address: ${loggedInCustomer.address || 'Not provided'}

**CRITICAL INSTRUCTIONS:**
- DO NOT ask for their name, phone number, or address again.
- You MUST use the provided customer details when filling out the \`customer\` object in the \`create_order_request\`.
- Your responses MUST conform to the provided JSON schema.
- To look up orders, if the user asks about orders with specific statuses (e.g., "đơn nào chưa trả?", "đơn nào đang giặt?"), you MUST populate the \`statuses\` array in \`lookup_info_request\`.
- Map natural language to these exact status values:
    - "chưa trả" (not returned), "đang làm", "chưa xong" -> \`["Chưa xử lý", "Đang xử lý", "Đã xử lý"]\`
    - "chưa xử lý", "đang chờ" -> \`["Chưa xử lý"]\`
    - "đang giặt", "đang xử lý" -> \`["Đang xử lý"]\`
    - "đã xong", "chờ lấy" -> \`["Đã xử lý"]\`
    - "đã trả", "đã lấy" -> \`["Đã trả"]\`
- You must always populate the \`query\` field in \`lookup_info_request\` with the user's phone number: ${loggedInCustomer.phone}.

${commonWorkflows}

**Available Services (use 'serviceName'):**
${servicesListForAI}
--- End of service list ---

**Available Stores (use 'ID cửa hàng' for 'targetStoreOwnerId'):**
${storeProfilesListForAI}
--- End of store list ---

**Available Promotions (Inform user about these, do not apply them yourself):**
${promotionsListForAI || "Hiện không có chương trình khuyến mãi nào."}
--- End of promotion list ---
`;
            initialAiMessage = {
                id: uuidv4(),
                sender: 'ai',
                text: `Xin chào ${loggedInCustomer.name}! Tôi là Trợ Lý AI của ${APP_NAME}. Bạn muốn đặt dịch vụ giặt là hay tra cứu đơn hàng nào hôm nay?`,
                timestamp: new Date()
            };

        } else {
            // GENERIC INSTRUCTION for anonymous users
            systemInstruction = `You are a friendly and efficient AI Assistant for the ${APP_NAME} laundromat. Your goal is to help users look up orders or create new ones.

Your responses MUST conform to the provided JSON schema. Based on the user's request, you will populate ONE of the following fields in your JSON response: 'text_response', 'lookup_info_request', or 'create_order_request'.

**Key Workflows:**
1.  **General Conversation:** For greetings, questions, or anything that isn't a specific action, use the \`text_response\` field.
2.  **Information Lookup:**
    *   If the user wants to check an order, ask for their order ID or phone number. Then, populate \`lookup_info_request\` with \`type: "ORDER"\`.
    *   If the user asks about orders with specific statuses (e.g., "đơn nào chưa trả?", "đơn nào đang giặt?", "đơn nào đã xong?"), you MUST populate the \`statuses\` array in \`lookup_info_request\`.
    *   Map natural language to these exact status values:
        *   "chưa trả" (not returned), "đang làm", "chưa xong" -> \`["Chưa xử lý", "Đang xử lý", "Đã xử lý"]\`
        *   "chưa xử lý", "đang chờ" -> \`["Chưa xử lý"]\`
        *   "đang giặt", "đang xử lý" -> \`["Đang xử lý"]\`
        *   "đã xong", "chờ lấy" -> \`["Đã xử lý"]\`
        *   "đã trả", "đã lấy" -> \`["Đã trả"]\`
    *   If no status is mentioned, do not include the \`statuses\` field.
    *   If the user wants to start creating an order, first ask for their phone number. Then, populate \`lookup_info_request\` with \`type: "CUSTOMER"\` to check if they are a returning customer.
    
${commonWorkflows}

**Available Services (use 'serviceName'):**
${servicesListForAI}
--- End of service list ---

**Available Stores (use 'ID cửa hàng' for 'targetStoreOwnerId'):**
${storeProfilesListForAI}
--- End of store list ---

**Available Promotions (Inform user about these, do not apply them yourself):**
${promotionsListForAI || "Hiện không có chương trình khuyến mãi nào."}
--- End of promotion list ---
`;
            initialAiMessage = {
                id: uuidv4(),
                sender: 'ai',
                text: `Xin chào! Tôi là Trợ Lý AI của ${APP_NAME}. Tôi có thể giúp bạn tra cứu đơn hàng hoặc tạo đơn hàng mới. Bạn cần gì hôm nay?`,
                timestamp: new Date()
            };
        }
        
        const newChat = geminiChatInstance.chats.create({ 
            model: 'gemini-2.5-flash',
            config: { 
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: aiResponseSchema
            } 
        });
        setChatSession(newChat);
        setGeminiError(null);
        setChatMessages([initialAiMessage]);

      } catch (error) {
        console.error("Lỗi khởi tạo Gemini Chat:", error);
        setGeminiError("Không thể kết nối với Trợ Lý AI. Vui lòng thử lại sau.");
      }
    }
    if (!process.env.API_KEY) {
        setGeminiError("API Key cho Trợ Lý AI chưa được cấu hình.");
    }
  }, [chatSession, availableServices, storeProfiles, loggedInCustomer, activePromotions]);

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
        const parsedJson = JSON.parse(rawAiResponseText);

        if (parsedJson.lookup_info_request) {
            const { query, type, statuses } = parsedJson.lookup_info_request;
            let lookupResultText = '';

            if (type === "CUSTOMER" && query) {
                const foundCustomer = customers.find(c => c.phone === query.trim());
                lookupResultText = foundCustomer 
                    ? `Tôi đã tìm thấy thông tin của bạn: Tên ${foundCustomer.name}, SĐT ${query}${foundCustomer.address ? `, Địa chỉ ${foundCustomer.address}` : ''}. Thông tin này chính xác chứ?`
                    : `Tôi chưa tìm thấy thông tin cho SĐT ${query}. Bạn vui lòng cho biết Tên và Địa chỉ để tạo hồ sơ mới nhé?`;
                aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: lookupResultText, timestamp: new Date() };
            } else if (type === "ORDER" && query) {
                const isOrderId = query.toUpperCase().startsWith('DH-') || query.toUpperCase().startsWith('AI-');
                let ordersFound = isOrderId ? (findOrderById(query) ? [findOrderById(query)!] : []) : allOrders.filter(o => o.customer.phone === query.trim());
                
                let statusFilterDescription = '';
                if (statuses && Array.isArray(statuses) && statuses.length > 0) {
                    const statusSet = new Set(statuses);
                    ordersFound = ordersFound.filter(o => statusSet.has(o.status));
                    statusFilterDescription = ` với các trạng thái bạn yêu cầu`;
                }
                
                if(ordersFound.length > 0){
                    const sortedOrders = ordersFound.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                     const orderSummaries = sortedOrders.map(o => ({
                        id: o.id,
                        status: o.status,
                        createdAt: o.createdAt,
                        totalAmount: o.totalAmount,
                        items: o.items.map(i => ({ name: i.serviceItem.name, quantity: i.quantity })),
                    }));
                    aiMessageToDisplay = { 
                        id: uuidv4(), 
                        sender: 'ai', 
                        text: `Tìm thấy ${sortedOrders.length} đơn hàng${statusFilterDescription}. Dưới đây là thông tin chi tiết:`, 
                        timestamp: new Date(),
                        structuredContent: {
                            type: 'orderSummary',
                            orders: orderSummaries,
                        }
                    };
                } else {
                    lookupResultText = `Không tìm thấy đơn hàng nào cho "${query}"${statusFilterDescription}.`;
                    aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: lookupResultText, timestamp: new Date() };
                }
            }
        } else if (parsedJson.create_order_request) {
            const orderDetailsAI: AppOrderDetailsFromAI = parsedJson.create_order_request;
            // FIX: Changed type from `Customer` to `User`.
            let customerToPassToModal: User | null = null;
            const phone = orderDetailsAI.customer?.phone;

            if (!phone) {
                aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: "Lỗi: Phản hồi của AI thiếu số điện thoại khách hàng. Vui lòng thử lại.", timestamp: new Date() };
            } else {
                const existingCustomer = customers.find(c => c.phone === phone);
                
                if (existingCustomer) {
                    customerToPassToModal = { ...existingCustomer, name: orderDetailsAI.customer?.name || existingCustomer.name, address: orderDetailsAI.customer?.address || existingCustomer.address || '' };
                } else if (orderDetailsAI.customer?.name && orderDetailsAI.customer?.phone) {
                    // FIX: Create a complete temporary User object.
                    customerToPassToModal = { 
                        id: `temp-${uuidv4()}`, 
                        name: orderDetailsAI.customer.name, 
                        phone: orderDetailsAI.customer.phone, 
                        address: orderDetailsAI.customer.address || '', 
                        loyaltyPoints: 0,
                        role: UserRole.CUSTOMER,
                        username: orderDetailsAI.customer.phone
                    };
                }

                if (customerToPassToModal) {
                    setCustomerForAIOrder(customerToPassToModal);
                    setOrderDataForConfirmation(orderDetailsAI);
                    setTargetStoreOwnerIdForAI(orderDetailsAI.targetStoreOwnerId); 
                    setIsOrderConfirmationModalOpen(true);
                    aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: "Tuyệt vời! Tôi đã chuẩn bị đơn hàng. Vui lòng kiểm tra và xác nhận trong hộp thoại nhé.", timestamp: new Date() };
                } else {
                     aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: "Thông tin khách hàng (SĐT, Tên) chưa đủ. Vui lòng cung cấp lại.", timestamp: new Date() };
                }
            }
        } else if (parsedJson.text_response) {
            aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: parsedJson.text_response, timestamp: new Date() };
        } else {
            aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: `Phản hồi không mong muốn: ${rawAiResponseText}`, timestamp: new Date() };
        }
      } catch (parseError) { 
        aiMessageToDisplay = { id: uuidv4(), sender: 'ai', text: `Lỗi xử lý phản hồi từ AI. AI đã trả về: "${rawAiResponseText}"`, timestamp: new Date() };
      }

      if (aiMessageToDisplay) setChatMessages(prev => [...prev, aiMessageToDisplay!]);

    } catch (error) { 
        console.error("Lỗi gửi tin nhắn tới Gemini:", error);
        setGeminiError(`Lỗi kết nối tới Trợ Lý AI: ${error instanceof Error ? error.message : String(error)}`);
        setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'ai', text: "Rất tiếc, đã có lỗi kết nối. Vui lòng thử lại sau.", timestamp: new Date() }]);
    } finally {
        setIsChatLoading(false);
        chatInputRef.current?.focus();
    }
  };

  const handleConfirmAIOrder = async (confirmedOrderPayload: Order, isNewCustomer: boolean) => {
    systemAddOrder(confirmedOrderPayload);
    addNotification({ message: `Đơn hàng ${confirmedOrderPayload.id} đã được tạo thành công qua Trợ Lý AI.`, type: 'success' });
    setIsOrderConfirmationModalOpen(false);
    setOrderDataForConfirmation(null);
    setCustomerForAIOrder(null);
    setTargetStoreOwnerIdForAI(undefined);

    // Now, get the final confirmation message from the AI.
    if (!chatSession) {
      // Fallback if chat session is lost
      let fallbackText = `Đã tạo thành công đơn hàng ${confirmedOrderPayload.id}. Cảm ơn bạn đã sử dụng dịch vụ!`;
      if (isNewCustomer) {
          fallbackText = `Đơn hàng của bạn đã được tạo thành công! Một tài khoản cũng đã được tạo cho bạn với SĐT ${confirmedOrderPayload.customer.phone}. Mật khẩu mặc định là "123123". Vui lòng đăng nhập để theo dõi đơn hàng và đổi mật khẩu nhé.`;
      }
      setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'ai', text: fallbackText, timestamp: new Date() }]);
      return;
    }
    
    setIsChatLoading(true);
    const systemPromptToAI = `(System message: Order ${confirmedOrderPayload.id} created successfully. Customer was ${isNewCustomer ? 'new' : 'existing'}. Please provide the final confirmation message to the user.)`;

    try {
      const response = await chatSession.sendMessage({ message: systemPromptToAI });
      const rawAiResponseText = response.text;
      const parsedJson = JSON.parse(rawAiResponseText);

      if (parsedJson.text_response) {
          setChatMessages(prev => [...prev, {
              id: uuidv4(),
              sender: 'ai',
              text: parsedJson.text_response.replace('[order_id]', confirmedOrderPayload.id),
              timestamp: new Date()
          }]);
      } else {
          throw new Error("AI did not provide a text_response.");
      }
    } catch (error) {
        console.error("Error getting final confirmation from AI:", error);
        // Fallback message
        let fallbackText = `Đã tạo thành công đơn hàng ${confirmedOrderPayload.id}. Cảm ơn bạn đã sử dụng dịch vụ!`;
        if (isNewCustomer) {
            fallbackText = `Đơn hàng của bạn đã được tạo thành công! Một tài khoản cũng đã được tạo cho bạn với SĐT ${confirmedOrderPayload.customer.phone}. Mật khẩu mặc định là "123123". Vui lòng đăng nhập để theo dõi đơn hàng và đổi mật khẩu nhé.`;
        }
        setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'ai', text: fallbackText, timestamp: new Date() }]);
    } finally {
        setIsChatLoading(false);
    }
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

  return (
    <>
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
          <Button type="submit" variant="primary" disabled={isChatLoading || !chatInput.trim() || !chatSession} rightIcon={<SendIcon size={18} />}>Gửi</Button>
        </form>
      </Card>
      
      {isOrderConfirmationModalOpen && orderDataForConfirmation && customerForAIOrder && (
        <OrderConfirmationModal
          isOpen={isOrderConfirmationModalOpen}
          onClose={handleCloseConfirmationModal}
          onConfirm={handleConfirmAIOrder}
          orderDetailsFromAI={orderDataForConfirmation}
          customer={customerForAIOrder}
          availableServices={availableServices}
          // FIX: Changed prop from `addCustomer` to `addUser`.
          addUser={systemAddUser} 
          targetStoreOwnerId={targetStoreOwnerIdForAI}
          // FIX: Pass washMethods to the modal.
          washMethods={washMethods}
        />
      )}
    </>
  );
};
