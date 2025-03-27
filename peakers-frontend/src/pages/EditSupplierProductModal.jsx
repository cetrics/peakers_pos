import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/EditSupplierProductModal.css"; // ✅ Import the CSS file

const EditSupplierProductModal = ({ product, onClose, refreshProducts }) => {
  const [products, setProducts] = useState([]);
  const [editedProduct, setEditedProduct] = useState({
    product_id: product?.product_id || "",
    price: product?.price || "",
    stock_supplied: product?.stock_supplied || "",
    supply_date: product?.supply_date ? product.supply_date.split("T")[0] : "",
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get("/get-products");
        setProducts(response.data.products || []);
      } catch (error) {
        console.error("❌ Error fetching products:", error);
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

  // ✅ Function to display alert dynamically in .supplier-container
  const showAlert = (message, type = "success") => {
    const container = document.querySelector(".supplier-products-container"); // Target container
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log("🚀 Submitting updated product:", editedProduct);

      await axios.put(
        `/api/v1/update-supplier-product/${product?.supplier_product_id}`,
        editedProduct
      );

      refreshProducts();
      showAlert("Supplier product updated successfully!"); // ✅ Show alert outside modal
      onClose();
    } catch (error) {
      console.error("❌ Error updating product:", error);
      showAlert("Error updating product.", "error");
    }
  };

  if (!product) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* ❌ Close Button (X Icon) */}
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>

        <h2>Edit Supplier Product</h2>
        <form onSubmit={handleSubmit}>
          {/* ✅ Product Dropdown (Frozen) */}
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

          {/* ✅ Price Input */}
          <label>Price:</label>
          <input
            type="number"
            name="price"
            value={editedProduct.price}
            onChange={handleChange}
            required
          />

          {/* ✅ Stock Supplied Input */}
          <label>Stock Supplied:</label>
          <input
            type="number"
            name="stock_supplied"
            value={editedProduct.stock_supplied}
            onChange={handleChange}
            required
          />

          {/* ✅ Supply Date Input */}
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
