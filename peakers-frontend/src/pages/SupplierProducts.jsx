import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  FaArrowLeft,
  FaPlus,
  FaMoneyBillWave,
  FaBoxes,
  FaCalendarAlt,
  FaCreditCard,
  FaHistory,
} from "react-icons/fa";
import AddSupplierProductModal from "./AddSupplierProductModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import SupplierPaymentHistoryModal from "./SupplierPaymentHistoryModal";
import EditSupplierProductModal from "./EditSupplierProductModal";
import "./styles/SupplierProducts.css";

const SupplierProducts = () => {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [supplierName, setSupplierName] = useState(
    location.state?.supplierName || `Supplier ${supplierId}`
  );
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currency, setCurrency] = useState("KES");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] =
    useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState(null);

  useEffect(() => {
    fetchSupplierName();
    fetchSupplierProducts();
  }, [supplierId]);

  useEffect(() => {
    // Attach search event listener AFTER products are fetched
    const searchInput = document.getElementById("customerSearch");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    return () => {
      if (searchInput) {
        searchInput.removeEventListener("input", handleSearch);
      }
    };
  }, [products]); // ✅ Attach listener only AFTER products are set

  const fetchSupplierName = async () => {
    try {
      const response = await axios.get(`/api/v1/supplier/${supplierId}`);
      setSupplierName(response.data.supplier_name || `Supplier ${supplierId}`);
    } catch (error) {
      console.error("Error fetching supplier name:", error);
    }
  };

  const fetchSupplierProducts = async () => {
    try {
      const response = await axios.get(`/supplier-products/${supplierId}`);
      setProducts(response.data);
      setFilteredProducts(response.data); // ✅ Ensure filteredProducts has initial data
    } catch (error) {
      console.error("Error fetching supplier products:", error);
    }
  };

  // 🔍 Search Function (Triggered by Index Page Search Bar)
  const handleSearch = (e) => {
    if (!products.length) return; // ✅ Prevent search before data is loaded

    const query = e.target.value.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.product_name.toLowerCase().includes(query) ||
        product.price.toString().includes(query) ||
        product.stock_supplied.toString().includes(query)
    );
    setFilteredProducts(filtered);
  };

  const openPaymentModal = (product) => {
    setSelectedProduct(product);
    setIsPaymentModalOpen(true);
  };

  const openHistoryModal = (product) => {
    setSelectedProductForHistory(product);
    setIsHistoryModalOpen(true);
  };

  const openEditModal = (product) => {
    setSelectedProductForEdit(product);
    setIsEditModalOpen(true);
  };

  return (
    <div className="supplier-products-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>
      <h2>Products Supplied by {supplierName}</h2>
      <button
        className="currency-toggle-btn"
        onClick={() => setCurrency(currency === "KES" ? "USD" : "KES")}
      >
        Switch to {currency === "KES" ? "USD ($)" : "KES (KSh)"}
      </button>
      <button
        className="add-supplier-product-btn"
        title="Add Supplier Product"
        onClick={() => setIsModalOpen(true)}
      >
        <FaPlus />
      </button>
      <div className="products-list">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div
              key={product.supplier_product_id}
              className="product-card"
              onClick={() => openEditModal(product)}
            >
              <h3>{product.product_name}</h3>
              <p>
                <FaMoneyBillWave /> Price:{" "}
                {currency === "KES"
                  ? `KSh ${product.price}`
                  : `$${product.price}`}
              </p>
              <p>
                <FaBoxes /> Stock Supplied: {product.stock_supplied}
              </p>
              <p>
                <FaCalendarAlt /> Supply Date:{" "}
                {new Date(product.supply_date).toLocaleDateString()}
              </p>

              <div className="product-actions">
                <button
                  className="payment-btn"
                  title="Make Payment"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPaymentModal(product);
                  }}
                >
                  <FaCreditCard /> Pay
                </button>

                <button
                  className="history-btn"
                  title="View Payment History"
                  onClick={(e) => {
                    e.stopPropagation();
                    openHistoryModal(product);
                  }}
                >
                  <FaHistory /> History
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No products supplied by this supplier.</p>
        )}
      </div>
      {isModalOpen && (
        <AddSupplierProductModal
          supplierId={supplierId}
          onClose={() => setIsModalOpen(false)}
          refreshProducts={fetchSupplierProducts}
        />
      )}
      {isPaymentModalOpen && selectedProduct && (
        <SupplierPaymentModal
          product={selectedProduct}
          supplierId={supplierId}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}
      {isHistoryModalOpen && selectedProductForHistory && (
        <SupplierPaymentHistoryModal
          supplierId={supplierId}
          supplierProductId={selectedProductForHistory.supplier_product_id}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}
      {isEditModalOpen && selectedProductForEdit && (
        <EditSupplierProductModal
          product={selectedProductForEdit}
          supplierId={supplierId}
          onClose={() => setIsEditModalOpen(false)}
          refreshProducts={fetchSupplierProducts}
        />
      )}
    </div>
  );
};

export default SupplierProducts;
