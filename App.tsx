
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { CustomerHomePage } from './pages/public/CustomerHomePage'; // Changed to named import
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import OrderListPage from './pages/admin/OrderListPage';
import OrderCreatePage from './pages/admin/OrderCreatePage';
import OrderDetailPage from './pages/admin/OrderDetailPage';
import CustomerManagementPage from './pages/admin/CustomerManagementPage';
import ServiceManagementPage from './pages/admin/ServiceManagementPage';
import SupplierManagementPage from './pages/admin/SupplierManagementPage';
import InventoryManagementPage from './pages/admin/InventoryManagementPage';
import ReportsPage from './pages/admin/ReportsPage';
import DeletedOrdersHistoryPage from './pages/admin/DeletedOrdersHistoryPage'; 
import OrderPrintPreviewPage from './pages/admin/OrderPrintPreviewPage';
import MaterialOrderManagementPage from './pages/admin/MaterialOrderManagementPage';
import MaterialOrderDetailPage from './pages/admin/MaterialOrderDetailPage';
import KpiReportPage from './pages/admin/KpiReportPage';
import LoginPage from './pages/auth/LoginPage'; 
import UserManagementPage from './pages/admin/UserManagementPage'; // Import UserManagementPage
import { useAppContext } from './contexts/AppContext';
import { UserRole } from './types';

const App: React.FC = () => {
  const { currentUser } = useAppContext(); 

  const isAdminAreaUser = currentUser && currentUser.role !== UserRole.CUSTOMER;
  // Chairman is also an Owner/Manager type for general admin access purposes, specific pages will differentiate further.
  const isOwnerManagerOrChairman = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.CHAIRMAN);
  const isChairman = currentUser && currentUser.role === UserRole.CHAIRMAN;


  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<CustomerHomePage />} />
          <Route path="/login" element={currentUser ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />} />
          
          {isAdminAreaUser ? (
            <>
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              
              {!isChairman && ( // These routes are NOT accessible to Chairman directly through this block
                <>
                  <Route path="/admin/orders" element={<OrderListPage />} />
                  <Route path="/admin/orders/new" element={<OrderCreatePage />} />
                  <Route path="/admin/orders/edit/:id" element={<OrderCreatePage />} />
                  <Route path="/admin/orders/deleted-history" element={<DeletedOrdersHistoryPage />} />
                  <Route path="/admin/orders/print/:orderId" element={<OrderPrintPreviewPage />} />
                  <Route path="/admin/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/admin/customers" element={<CustomerManagementPage />} />
                  <Route path="/admin/services" element={<ServiceManagementPage />} />
                  <Route path="/admin/suppliers" element={<SupplierManagementPage />} />
                  <Route path="/admin/inventory" element={<InventoryManagementPage />} />
                  <Route path="/admin/material-orders" element={<MaterialOrderManagementPage />} />
                  <Route path="/admin/material-orders/:orderId" element={<MaterialOrderDetailPage />} />
                </>
              )}
              
              {/* Reports and KPIs are accessible to all admin users, including Chairman */}
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/kpi-reports" element={<KpiReportPage />} />

              {/* User Management: Accessible to Chairman, Owner, Manager */}
              {isOwnerManagerOrChairman ? (
                <Route path="/admin/users" element={<UserManagementPage />} />
              ) : (
                // Staff trying to access /admin/users will be redirected
                <Route path="/admin/users" element={<Navigate to="/admin/dashboard" replace />} />
              )}
              
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            </>
          ) : (
             <Route path="/admin/*" element={<Navigate to="/login" replace />} />
          )}
           <Route path="*" element={<Navigate to={isAdminAreaUser ? "/admin/dashboard" : "/"} replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
