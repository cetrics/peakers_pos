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
import ProtectedLayout from "./pages/ProtectedLayout"; // ✅
import Expenses from "./pages/Expenses";

const App = () => {
  return (
    <Router>
      <Routes>
        {/* ✅ All Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<RegisterCustomer />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/suppliers-page" element={<SupplierList />} />
          <Route path="/sales-page" element={<Sales />} />
          <Route path="/orders-page" element={<OrdersPage />} />
          <Route path="/expenses-page" element={<Expenses />} />
          <Route path="/material-page" element={<MaterialManagementModal />} />
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
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
