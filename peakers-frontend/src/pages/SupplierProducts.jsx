import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaArrowLeft,
  FaPlus,
  FaMoneyBillWave,
  FaBoxes,
  FaCalendarAlt,
  FaCreditCard,
  FaHistory, // Payment history icon
} from "react-icons/fa";
import AddSupplierProductModal from "./AddSupplierProductModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import SupplierPaymentHistoryModal from "./SupplierPaymentHistoryModal"; // Import the history modal
import "./styles/SupplierProducts.css";

const SupplierProducts = () => {
  const { supplierId } = useParams();
  const [products, setProducts] = useState([]);
  const [currency, setCurrency] = useState("KES");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] =
    useState(null); // Track product for history
  const navigate = useNavigate();

  useEffect(() => {
    fetchSupplierProducts();
  }, [supplierId]);

  const fetchSupplierProducts = async () => {
    try {
      const response = await axios.get(`/supplier-products/${supplierId}`);
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching supplier products:", error);
    }
  };

  const openPaymentModal = (product) => {
    setSelectedProduct(product);
    setIsPaymentModalOpen(true);
  };

  const openHistoryModal = (product) => {
    setSelectedProductForHistory(product);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="supplier-products-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>

      <h2>Products Supplied by Supplier {supplierId}</h2>

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
        {products.length > 0 ? (
          products.map((product) => (
            <div key={product.supplier_product_id} className="product-card">
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

              {/* Payment and History Buttons */}
              <div className="product-actions">
                <button
                  className="payment-btn"
                  title="Make Payment"
                  onClick={() => openPaymentModal(product)}
                >
                  <FaCreditCard /> Pay
                </button>

                <button
                  className="history-btn"
                  title="View Payment History"
                  onClick={() => openHistoryModal(product)}
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

      {/* Payment History Modal - Opens for Selected Product */}
      {isHistoryModalOpen && selectedProductForHistory && (
        <SupplierPaymentHistoryModal
          supplierId={supplierId}
          supplierProductId={selectedProductForHistory.supplier_product_id}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}
    </div>
  );
};

export default SupplierProducts;
