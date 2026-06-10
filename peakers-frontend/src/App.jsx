import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import RegisterCustomer from "./pages/RegisterCustomer";
import ProductList from "./pages/ProductList";
import SupplierList from "./pages/SupplierList";
import SupplierProducts from "./pages/SupplierProducts";
import Sales from "./pages/Sales";
import OrdersPage from "./pages/OrdersPage";
import MaterialManagementModal from "./pages/MaterialManagementModal";
import SupplierPaymentsPage from "./pages/SupplierPaymentsPage";
import MaterialInventoryPage from "./pages/MaterialInventoryPage";
import ProtectedLayout from "./pages/ProtectedLayout";
import Expenses from "./pages/Expenses";
import InvoicesPage from "./pages/InvoicesPage";
import RegisterBusinessPage from "./pages/RegisterBusinessPage";
import ContainerInventory from "./pages/ContainerInventory";

import RestaurantSalesPage from "./pages/RestaurantSalesPage";
import RestaurantKitchenPage from "./pages/RestaurantKitchenPage";
import RestaurantActiveOrdersPage from "./pages/RestaurantActiveOrdersPage";
import RestaurantSetupPage from "./pages/RestaurantSetupPage";
import RestaurantProductsPage from "./pages/RestaurantProductsPage";
import RestaurantSupplierStockPage from "./pages/RestaurantSupplierStockPage";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route element={<ProtectedLayout />}>
          {/* Retail Routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<RegisterCustomer />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/suppliers-page" element={<SupplierList />} />
          <Route path="/sales-page" element={<Sales />} />
          <Route path="/orders-page" element={<OrdersPage />} />
          <Route path="/expenses-page" element={<Expenses />} />
          <Route path="/invoice" element={<InvoicesPage />} />
          <Route path="/material-page" element={<MaterialManagementModal />} />
          <Route path="/container_inventory" element={<ContainerInventory />} />
          <Route
            path="/material-inventory"
            element={<MaterialInventoryPage />}
          />
          <Route
            path="/suppliers-material-payment"
            element={<SupplierPaymentsPage />}
          />
          <Route
            path="/supplier_products/:supplierId"
            element={<SupplierProducts />}
          />

          {/* Owner Route */}
          <Route path="/register-business" element={<RegisterBusinessPage />} />

          {/* Restaurant Routes */}
          <Route
            path="/restaurant_dashboard"
            element={<RestaurantDashboard />}
          />
          <Route path="/restaurant-sales" element={<RestaurantSalesPage />} />
          <Route
            path="/restaurant-kitchen"
            element={<RestaurantKitchenPage />}
          />
          <Route
            path="/restaurant-orders"
            element={<RestaurantActiveOrdersPage />}
          />
          <Route path="/restaurant-setup" element={<RestaurantSetupPage />} />
          <Route
            path="/restaurant_products"
            element={<RestaurantProductsPage />}
          />
          <Route
            path="/restaurant_suppliers"
            element={<RestaurantSupplierStockPage />}
          />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
