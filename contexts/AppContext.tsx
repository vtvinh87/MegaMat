
import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppData, Notification, Theme, User, UserRole, InventoryItem, CrmTask, InteractionHistoryEntry } from '../types';
import { useAppState } from './app/state';
import { seedInitialData } from './app/data';
import { loadDataFromLocalStorage, saveDataToLocalStorage, CURRENT_USER_KEY, THEME_KEY, simpleHash } from './app/utils';
import { v4 as uuidv4 } from 'uuid';
import { AuthContext, AuthContextType } from './AuthContext';
import { DataContext, DataContextType } from './DataContext';
import { useToast } from './ToastContext';
import { GoogleGenAI, Type } from "@google/genai";
import { APP_NAME } from '../constants';

// Import new custom hooks
import { useUserManagement } from './app/hooks/useUserManagement';
import { useNotificationLogic } from './app/hooks/useNotificationLogic';
import { useDataFiltering } from './app/hooks/useDataFiltering';
import { useOrderManagement } from './app/hooks/useOrderManagement';
import { useServiceManagement } from './app/hooks/useServiceManagement';
import { useSupplierManagement } from './app/hooks/useSupplierManagement';
import { useInventoryManagement } from './app/hooks/useInventoryManagement';
import { useMaterialManagement } from './app/hooks/useMaterialManagement';
import { useFinancialManagement } from './app/hooks/useFinancialManagement';
import { useFeedbackManagement } from './app/hooks/useFeedbackManagement';
import { useKpiManagement } from './app/hooks/useKpiManagement';
import { usePromotionManagement } from './app/hooks/usePromotionManagement';
import { useWashMethodManagement } from './app/hooks/useWashMethodManagement';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- Toast Integration ---
  const { addToast } = useToast();

  // --- Session State ---
  const [currentUserInternal, setCurrentUserInternal] = useState<User | null>(() => loadDataFromLocalStorage<User | null>(CURRENT_USER_KEY, null));
  const [activePublicCustomerId, setActivePublicCustomerIdState] = useState<string | null>(null);

  // --- Theme State ---
  const [theme, setThemeInternal] = useState<Theme>(() => {
    const storedTheme = loadDataFromLocalStorage<Theme>(THEME_KEY, 'light');
    return storedTheme;
  });

  // --- Core Application Data State & Persistence ---
  const appState = useAppState();

  // --- Data Seeding on Initial Load ---
  useEffect(() => {
    const doSeed = async () => {
      await seedInitialData(appState);
    };
    doSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // --- Session Logic ---
  // FIX: Wrap `setCurrentUser` in `useCallback` to ensure it has a stable identity across re-renders.
  // This is necessary because it's used in the dependency array of other `useCallback` hooks like `login`.
  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserInternal(user);
    if (user) {
      saveDataToLocalStorage(CURRENT_USER_KEY, user);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeInternal(newTheme);
    saveDataToLocalStorage(THEME_KEY, newTheme);
  }, []);
  
  const setActivePublicCustomerId = useCallback((customerId: string | null) => {
    setActivePublicCustomerIdState(customerId);
  }, []);

  // --- Business Logic Hooks Composition ---
  const userManagement = useUserManagement({
    currentUser: currentUserInternal,
    ...appState
  });

  const notificationLogic = useNotificationLogic({
    currentUser: currentUserInternal,
    currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
    allNotificationsData: appState.allNotificationsData,
    setAllNotificationsData: appState.setAllNotificationsData,
    allOrdersData: appState.allOrdersData,
    getOwnerIdForUser: userManagement.getOwnerIdForUser,
    usersData: appState.usersData,
    addToast: addToast,
  });
  
  // --- CRM Logic ---
  const addUserInteraction = useCallback((customerId: string, interaction: Omit<InteractionHistoryEntry, 'timestamp' | 'staffUserId'> & { staffUserId?: string }) => {
    appState.setUsersData(prevUsers => prevUsers.map(user => {
      if (user.id === customerId) {
        const newInteraction: InteractionHistoryEntry = {
          ...interaction,
          staffUserId: interaction.staffUserId || currentUserInternal?.id || 'system',
          timestamp: new Date(),
        };
        const updatedHistory = [newInteraction, ...(user.interactionHistory || [])];
        return { ...user, interactionHistory: updatedHistory };
      }
      return user;
    }));
    notificationLogic.addNotification({ message: `Đã ghi nhận tương tác mới với khách hàng.`, type: 'info', showToast: true });
  }, [appState.setUsersData, notificationLogic, currentUserInternal]);

  const addCrmTask = useCallback((taskData: Omit<CrmTask, 'id' | 'createdAt' | 'ownerId'>) => {
    const ownerId = userManagement.getCurrentUserOwnerId();
    if (!ownerId) {
      notificationLogic.addNotification({ message: 'Lỗi: Không thể xác định cửa hàng để tạo công việc.', type: 'error', showToast: true });
      return;
    }
    const newTask: CrmTask = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date(),
      ownerId,
    };
    appState.setCrmTasksData(prev => [newTask, ...prev]);
    notificationLogic.addNotification({ message: `Đã tạo công việc mới: "${newTask.title}"`, type: 'success', showToast: true });
  }, [userManagement.getCurrentUserOwnerId, appState.setCrmTasksData, notificationLogic]);

  const updateCrmTask = useCallback((taskData: Partial<CrmTask> & { id: string }) => {
    appState.setCrmTasksData(prevTasks => prevTasks.map(task => {
      if (task.id === taskData.id) {
        const updatedTask = { ...task, ...taskData };
        if (updatedTask.status === 'completed' && !updatedTask.completedAt) {
          updatedTask.completedAt = new Date();
        }
        notificationLogic.addNotification({ message: `Đã cập nhật công việc: "${updatedTask.title}"`, type: 'info', showToast: true });
        return updatedTask;
      }
      return task;
    }));
  }, [appState.setCrmTasksData, notificationLogic]);

  const deleteCrmTask = useCallback((taskId: string) => {
    appState.setCrmTasksData(prev => prev.filter(task => task.id !== taskId));
    notificationLogic.addNotification({ message: 'Đã xóa một công việc CRM.', type: 'warning', showToast: true });
  }, [appState.setCrmTasksData, notificationLogic]);

  const userMgmtWithNotifications = useUserManagement({
      currentUser: currentUserInternal,
      addNotification: notificationLogic.addNotification,
      ...appState
  });

    const analyzeAndSetChurnRisk = useCallback(async (customerId: string) => {
    const customer = userMgmtWithNotifications.findUserById(customerId);
    if (!customer) {
      addToast({ message: 'Không tìm thấy khách hàng để phân tích.', type: 'error' });
      return;
    }

    try {
        if (!process.env.API_KEY) throw new Error("API key is not configured.");

        // 1. Gather Data
        const customerOrders = appState.allOrdersData.filter(o => o.customer.id === customerId).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const customerServiceRatings = appState.serviceRatingsData.filter(r => r.customerUserId === customerId);
        const customerStaffRatings = appState.staffRatingsData.filter(r => r.customerUserId === customerId);
        const customerInteractions = customer.interactionHistory || [];

        // 2. Calculate Metrics
        const lastOrderDate = customerOrders.length > 0 ? new Date(customerOrders[0].createdAt).toLocaleDateString('vi-VN') : 'N/A';
        const aov = customerOrders.length > 0 ? (customer.lifetimeValue || 0) / customerOrders.length : 0;
        
        let frequency = 'N/A';
        if (customerOrders.length > 1) {
            const diffs = [];
            for (let i = 0; i < customerOrders.length - 1; i++) {
                const diff = new Date(customerOrders[i].createdAt).getTime() - new Date(customerOrders[i+1].createdAt).getTime();
                diffs.push(diff / (1000 * 3600 * 24));
            }
            const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            frequency = `${avgDiff.toFixed(1)} ngày`;
        }

        const avgServiceRating = customerServiceRatings.length > 0 ? customerServiceRatings.reduce((sum, r) => sum + r.rating, 0) / customerServiceRatings.length : 'N/A';
        const recentComments = [...customerServiceRatings, ...customerStaffRatings].slice(0, 3).map(r => r.comment).filter(Boolean).join('; ');
        const recentInteractions = customerInteractions.slice(0, 3).map(i => `${i.channel}: ${i.summary}`).join('; ');

        // 3. Construct Prompt
        const prompt = `Bạn là chuyên gia phân tích giữ chân khách hàng cho tiệm giặt là ${APP_NAME}. Phân tích dữ liệu khách hàng sau đây để dự đoán nguy cơ khách hàng rời bỏ (churn risk).
    
        Dữ liệu khách hàng:
        - Tên: ${customer.name}
        - Thành viên từ: ${customer.customerSince ? new Date(customer.customerSince).toLocaleDateString('vi-VN') : 'N/A'}
        - Tổng chi tiêu: ${customer.lifetimeValue?.toLocaleString('vi-VN')} VNĐ
        - Hạng thành viên: ${customer.loyaltyTier || 'N/A'}

        Tóm tắt lịch sử đơn hàng (${customerOrders.length} đơn):
        - Ngày đặt hàng cuối: ${lastOrderDate}
        - Giá trị đơn hàng trung bình: ${aov.toLocaleString('vi-VN')} VNĐ
        - Tần suất đặt hàng (trung bình): ${frequency}

        Tóm tắt đánh giá:
        - Đánh giá dịch vụ trung bình: ${typeof avgServiceRating === 'number' ? avgServiceRating.toFixed(2) + ' ★' : 'Chưa có'}
        - Các bình luận gần đây: "${recentComments || 'Không có'}"

        Tóm tắt tương tác:
        - Số lần tương tác: ${customerInteractions.length}
        - Các tương tác gần đây: "${recentInteractions || 'Không có'}"

        Dựa trên các dữ liệu trên, hãy đưa ra phân tích nguy cơ rời bỏ. Chú ý đến các dấu hiệu tiêu cực như: tần suất đặt hàng giảm, đánh giá thấp gần đây, có khiếu nại.
        Chỉ trả về một đối tượng JSON hợp lệ theo schema.`;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                probability: { type: Type.NUMBER, description: 'A float between 0 (no risk) and 1 (high risk)' },
                reasons: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 2-3 key reasons for your prediction, in Vietnamese.' },
            }
        };

        // 4. Call Gemini API
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });

        const analysis = JSON.parse(response.text.trim());

        // 5. Update User State
        const churnPredictionData = {
            probability: analysis.probability,
            reasons: analysis.reasons,
            lastAnalyzed: new Date(),
        };

        await userMgmtWithNotifications.updateUser({ id: customerId, churnPrediction: churnPredictionData });
        addToast({ message: `Đã phân tích xong rủi ro churn cho ${customer.name}.`, type: 'success' });

    } catch (err) {
        console.error("Churn analysis error:", err);
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        addToast({ message: `Lỗi phân tích: ${msg}`, type: 'error' });
    }
  }, [appState.allOrdersData, appState.serviceRatingsData, appState.staffRatingsData, userMgmtWithNotifications, addToast]);


  const orderManagement = useOrderManagement({
      currentUser: currentUserInternal,
      allOrdersData: appState.allOrdersData,
      setAllOrdersData: appState.setAllOrdersData,
      addNotification: notificationLogic.addNotification,
      storeProfilesData: appState.storeProfilesData,
      usersData: appState.usersData,
      setUsersData: appState.setUsersData,
      promotionsData: appState.promotionsData,
      setPromotionsData: appState.setPromotionsData,
      allInventoryData: appState.allInventoryData,
      setAllInventoryData: appState.setAllInventoryData,
      addUserInteraction,
  });
  
  const serviceManagement = useServiceManagement({
      servicesData: appState.servicesData,
      setServicesData: appState.setServicesData,
      addNotification: notificationLogic.addNotification,
  });
  
  const supplierManagement = useSupplierManagement({
      suppliersData: appState.suppliersData,
      setSuppliersData: appState.setSuppliersData,
      addNotification: notificationLogic.addNotification,
  });
  
  const inventoryManagement = useInventoryManagement({
      currentUser: currentUserInternal,
      currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
      allInventoryData: appState.allInventoryData,
      setAllInventoryData: appState.setAllInventoryData,
      addNotification: notificationLogic.addNotification,
      inventoryAdjustmentRequests: appState.inventoryAdjustmentRequestsData,
      setInventoryAdjustmentRequests: appState.setInventoryAdjustmentRequestsData,
      usersData: appState.usersData,
      setAcknowledgedRejectedRequestsData: appState.setAcknowledgedRejectedRequestsData,
  });
  
  const materialManagement = useMaterialManagement({
      currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
      materialItemDefinitionsData: appState.materialItemDefinitionsData,
      setMaterialItemDefinitionsData: appState.setMaterialItemDefinitionsData,
      allMaterialOrdersData: appState.allMaterialOrdersData,
      setAllMaterialOrdersData: appState.setAllMaterialOrdersData,
      allInventoryData: appState.allInventoryData,
      setAllInventoryData: appState.setAllInventoryData,
      addNotification: notificationLogic.addNotification,
  });

  const financialManagement = useFinancialManagement({
      currentUser: currentUserInternal,
      currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
      allVariableCostsData: appState.allVariableCostsData,
      setAllVariableCostsData: appState.setAllVariableCostsData,
      allFixedCostsData: appState.allFixedCostsData,
      setAllFixedCostsData: appState.setAllFixedCostsData,
      fixedCostsUpdateHistoryData: appState.fixedCostsUpdateHistoryData,
      setFixedCostsUpdateHistoryData: appState.setFixedCostsUpdateHistoryData,
      addNotification: notificationLogic.addNotification,
  });

  const feedbackManagement = useFeedbackManagement({
      allOrdersData: appState.allOrdersData,
      serviceRatingsData: appState.serviceRatingsData,
      setServiceRatingsData: appState.setServiceRatingsData,
      staffRatingsData: appState.staffRatingsData,
      setStaffRatingsData: appState.setStaffRatingsData,
      tipsData: appState.tipsData,
      setTipsData: appState.setTipsData,
      addNotification: notificationLogic.addNotification,
      findUserById: userManagement.findUserById,
  });

  const kpiManagement = useKpiManagement({
      allKpisData: appState.allKpisData,
      setAllKpisData: appState.setAllKpisData,
      usersData: appState.usersData,
      allOrdersData: appState.allOrdersData,
      staffRatingsData: appState.staffRatingsData,
      tipsData: appState.tipsData,
      getOwnerIdForUser: userManagement.getOwnerIdForUser,
  });
  
  const promotionManagement = usePromotionManagement({
    currentUser: currentUserInternal,
    currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
    promotionsData: appState.promotionsData,
    setPromotionsData: appState.setPromotionsData,
    addNotification: notificationLogic.addNotification,
    usersData: appState.usersData,
    setAcknowledgedSystemPromos: appState.setAcknowledgedSystemPromos,
    setAcknowledgedCancelRequests: appState.setAcknowledgedCancelRequests,
    setAcknowledgedOptOutRequests: appState.setAcknowledgedOptOutRequests,
  });

  const washMethodManagement = useWashMethodManagement({
    currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
    washMethodsData: appState.washMethodsData,
    setWashMethodsData: appState.setWashMethodsData,
    addNotification: notificationLogic.addNotification,
  });

  

  const filteredData = useDataFiltering({
      currentUser: currentUserInternal,
      currentUserOwnerId: userManagement.getCurrentUserOwnerId(),
      findUsersByManagerId: userManagement.findUsersByManagerId,
      ...appState
  });
  
  // --- Automated Reordering Logic ---
  const handleAutomaticReorder = useCallback((lowStockItem: InventoryItem) => {
    const definition = appState.materialItemDefinitionsData.find(def => 
        def.name.toLowerCase() === lowStockItem.name.toLowerCase()
    );
    
    if (!definition) {
        console.warn(`Auto-reorder skipped: No definition for "${lowStockItem.name}".`);
        return;
    }

    const hasPendingOrder = appState.allMaterialOrdersData.some(order => 
        order.ownerId === lowStockItem.ownerId &&
        order.status === 'Chờ duyệt' &&
        order.items.some(item => item.materialItemDefinitionId === definition.id)
    );

    if (hasPendingOrder) {
        // FIX: Replaced incorrect 'ownerId' with 'userId'. The notification logic derives the ownerId from the userId. The user here is the owner of the item.
        notificationLogic.addNotification({
            message: `Tồn kho thấp cho "${lowStockItem.name}", nhưng đã có một đơn đặt hàng đang chờ duyệt.`,
            type: 'info',
            userId: lowStockItem.ownerId,
            showToast: true,
        });
        return;
    }

    const reorderQuantity = Math.max(5, Math.ceil(lowStockItem.lowStockThreshold * 2.5));

    materialManagement.addMaterialOrder({
        items: [{ materialItemDefinitionId: definition.id, quantity: reorderQuantity }],
        createdBy: UserRole.SYSTEM,
        notes: `Tự động tạo do tồn kho thấp. SL hiện tại: ${lowStockItem.quantity}. Ngưỡng: ${lowStockItem.lowStockThreshold}.`,
    }, lowStockItem.ownerId);

    const managersAndOwner = appState.usersData.filter(u => 
        (u.role === UserRole.OWNER && u.id === lowStockItem.ownerId) ||
        (u.role === UserRole.MANAGER && userManagement.getOwnerIdForUser(u.id, appState.usersData) === lowStockItem.ownerId)
    );

    managersAndOwner.forEach(manager => {
        notificationLogic.addNotification({
            message: `Tồn kho thấp cho "${lowStockItem.name}". Một đơn đặt hàng brouillon đã được tự động tạo để bạn duyệt.`,
            type: 'warning',
            userId: manager.id,
            showToast: true
        });
    });

  }, [appState.materialItemDefinitionsData, appState.allMaterialOrdersData, appState.usersData, materialManagement, notificationLogic, userManagement]);

  const prevInventoryRef = useRef<InventoryItem[]>();
  useEffect(() => {
    if (prevInventoryRef.current === undefined) {
        prevInventoryRef.current = appState.allInventoryData;
        return;
    }

    const prevInventory = prevInventoryRef.current;
    const currentInventory = appState.allInventoryData;
    
    if (prevInventory === currentInventory) {
        return;
    }

    currentInventory.forEach(currentItem => {
        const prevItem = prevInventory.find(p => p.id === currentItem.id);
        if (prevItem && prevItem.quantity > prevItem.lowStockThreshold && currentItem.quantity <= currentItem.lowStockThreshold) {
            handleAutomaticReorder(currentItem);
        }
    });
    
    prevInventoryRef.current = currentInventory;
  }, [appState.allInventoryData, handleAutomaticReorder]);


  // --- Auth Logic ---
  const login = useCallback(async (username: string, password?: string): Promise<User | null> => {
    const user = appState.usersData.find(u => u.username.toLowerCase() === username.toLowerCase() || u.phone === username);
    if (user) {
      // FIX: The simpleHash function was missing its required password argument.
      const hashedPassword = password ? await simpleHash(password) : undefined;
      if (user.password === hashedPassword) {
        setCurrentUser(user);
        notificationLogic.addNotification({ message: `Chào mừng ${user.name} (${user.role}) đã đăng nhập.`, type: 'success', userId: user.id, userRole: user.role, showToast: true });
        return user;
      }
    }
    notificationLogic.addNotification({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.', type: 'error', showToast: true });
    return null;
  }, [appState.usersData, notificationLogic, setCurrentUser]);

  const logout = useCallback(() => {
    const loggingOutUser = currentUserInternal;
    setCurrentUser(null);
    setActivePublicCustomerIdState(null); 
    if (loggingOutUser) {
        notificationLogic.addNotification({ message: `${loggingOutUser.name || 'Bạn'} đã đăng xuất.`, type: 'info', userId: loggingOutUser.id, userRole: loggingOutUser.role, showToast: true });
    }
  }, [currentUserInternal, notificationLogic, setCurrentUser]);
  
  // --- Assemble final context values ---
  const authContextValue: AuthContextType = {
    currentUser: currentUserInternal,
    login,
    logout,
  };

  const dataContextValue: DataContextType = {
    theme,
    setTheme,
    
    // Raw Data State 
    users: appState.usersData,
    services: appState.servicesData,
    suppliers: appState.suppliersData,
    materialItemDefinitions: appState.materialItemDefinitionsData,
    storeProfiles: appState.storeProfilesData,
    fixedCostsUpdateHistory: appState.fixedCostsUpdateHistoryData,
    storeUpdateHistory: appState.storeUpdateHistoryData,
    serviceRatings: appState.serviceRatingsData,
    staffRatings: appState.staffRatingsData,
    tips: appState.tipsData,
    promotions: appState.promotionsData,
    acknowledgedSystemPromos: appState.acknowledgedSystemPromos,
    acknowledgedCancelRequests: appState.acknowledgedCancelRequests,
    acknowledgedOptOutRequests: appState.acknowledgedOptOutRequests,
    acknowledgedRejectedRequests: appState.acknowledgedRejectedRequestsData,
    washMethods: appState.washMethodsData,
    crmTasks: appState.crmTasksData,
    
    activePublicCustomerId,
    setActivePublicCustomerId,

    // Spread composed hooks
    ...userMgmtWithNotifications,
    ...notificationLogic,
    ...orderManagement,
    ...serviceManagement,
    ...supplierManagement,
    ...inventoryManagement,
    ...materialManagement,
    ...financialManagement,
    ...feedbackManagement,
    ...kpiManagement,
    ...promotionManagement,
    ...washMethodManagement,
    addUserInteraction,
    addCrmTask,
    updateCrmTask,
    deleteCrmTask,
    analyzeAndSetChurnRisk,
    ...filteredData, // Spread filtered data slices last to override raw ones
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <DataContext.Provider value={dataContextValue}>
        {children}
      </DataContext.Provider>
    </AuthContext.Provider>
  );
};