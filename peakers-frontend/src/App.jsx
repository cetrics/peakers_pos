import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import RegisterCustomer from "./pages/RegisterCustomer";
import ProductList from "./pages/ProductList";
import SupplierList from "./pages/SupplierList";
import SupplierProducts from "./pages/SupplierProducts"; // Import SupplierProducts
import Sales from "./pages/Sales";
import OrdersPage from "./pages/OrdersPage";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<RegisterCustomer />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/suppliers-page" element={<SupplierList />} />
        <Route path="/sales-page" element={<Sales />} />
        <Route path="/orders-page" element={<OrdersPage />} />
        <Route
          path="/supplier_products/:supplierId"
          element={<SupplierProducts />}
        />{" "}
        {/* New Route */}
      </Routes>
    </Router>
  );
};

export default App;
