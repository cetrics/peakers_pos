import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/EditSupplierProductModal.css";

const EditSupplierProductModal = ({ product, onClose, refreshProducts }) => {
  const [products, setProducts] = useState([]);
  const [editedProduct, setEditedProduct] = useState({
    product_id: product?.product_id || "",
    price: product?.price || "",
    stock_supplied: product?.stock_supplied || "",
    supply_date: product?.supply_date ? product.supply_date.split("T")[0] : "",
  });
  const [error, setError] = useState(null); // New error state

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get("/get-products");
        setProducts(response.data.products || []);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (product) {
      setEditedProduct({
        product_id: product.product_id || "",
        price: product.price || "",
        stock_supplied: product.stock_supplied || "",
        supply_date:
          product.supply_date && typeof product.supply_date === "string"
            ? product.supply_date.split("T")[0]
            : "",
      });
    }
  }, [product]);

  const showAlert = (message, type = "success") => {
    const container = document.querySelector(".supplier-products-container");
    if (!container) return;

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert ${type}`;
    alertDiv.textContent = message;

    container.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.style.opacity = "0";
      setTimeout(() => container.removeChild(alertDiv), 300);
    }, 3000);
  };

  const handleChange = (e) => {
    setEditedProduct({ ...editedProduct, [e.target.name]: e.target.value });
    setError(null); // Clear error when user makes changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Reset error state before submission

    try {
      await axios.put(
        `/api/v1/update-supplier-product/${product?.supplier_product_id}`,
        editedProduct
      );

      refreshProducts();
      showAlert("Supplier product updated successfully!");
      onClose();
    } catch (error) {
      console.error("Error updating product:", error);

      // Handle material shortage error specifically
      if (error.response && error.response.data && error.response.data.error) {
        if (
          error.response.data.error.includes("Insufficient") ||
          error.response.data.error.includes("Not enough")
        ) {
          setError(error.response.data.error); // Set the error state
        } else {
          showAlert(error.response.data.error, "error");
        }
      } else {
        showAlert("Error updating product.", "error");
      }
    }
  };

  if (!product) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>

        <h2>Edit Supplier Product</h2>

        {/* Display material shortage error inside the modal */}
        {error && (
          <div className="material-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>Product:</label>
          <select
            name="product_id"
            value={editedProduct.product_id}
            onChange={handleChange}
            required
            disabled
          >
            <option value="">Select a Product</option>
            {products.map((prod) => (
              <option key={prod.product_id} value={prod.product_id}>
                {prod.product_name} - {prod.product_number}
              </option>
            ))}
          </select>

          <label>Price:</label>
          <input
            type="number"
            name="price"
            value={editedProduct.price}
            onChange={handleChange}
            required
          />

          <label>Stock Supplied:</label>
          <input
            type="number"
            name="stock_supplied"
            value={editedProduct.stock_supplied}
            onChange={handleChange}
            required
          />

          <label>Supply Date:</label>
          <input
            type="date"
            name="supply_date"
            value={editedProduct.supply_date}
            onChange={handleChange}
            required
          />

          <div className="modal-actions">
            <button type="submit" className="save-btn">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSupplierProductModal;
