import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/AddSupplierProductModal.css";

const AddSupplierProductModal = ({ supplierId, onClose, refreshProducts }) => {
  const [formData, setFormData] = useState({
    product_id: "",
    stock_supplied: "",
    price: "",
    supply_date: "",
  });

  const [products, setProducts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get("/get-products");
        setProducts(response.data.products);
      } catch (error) {
        console.error("Error fetching products:", error);
        setErrorMessage("Failed to load product list.");
      }
    };
    fetchProducts();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMessage(""); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/supplier-products/${supplierId}/add`, formData);
      refreshProducts();
      onClose();
    } catch (error) {
      console.error("Error adding supplier product:", error);
      if (error.response && error.response.data && error.response.data.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage("An unexpected error occurred.");
      }
    }
  };

  return (
    <div className="supplier-product-modal-overlay">
      <div className="supplier-product-modal-container">
        <span
          className="supplier-product-modal-close"
          onClick={onClose}
          title="Close"
        >
          &times;
        </span>

        <h3 className="supplier-product-modal-title">Add Supplier Product</h3>

        {errorMessage && (
          <div className="supplier-product-modal-error">{errorMessage}</div>
        )}

        <form onSubmit={handleSubmit} className="supplier-product-modal-form">
          <select
            name="product_id"
            value={formData.product_id}
            onChange={handleInputChange}
            className="supplier-product-modal-input"
            required
          >
            <option value="">Select Product</option>
            {products.map((product) => (
              <option key={product.product_id} value={product.product_id}>
                {product.product_name} - {product.product_number}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="stock_supplied"
            placeholder="Stock Supplied"
            value={formData.stock_supplied}
            onChange={handleInputChange}
            className="supplier-product-modal-input"
            required
          />

          <input
            type="number"
            name="price"
            placeholder="Price"
            value={formData.price}
            onChange={handleInputChange}
            className="supplier-product-modal-input"
            required
          />

          <input
            type="date"
            name="supply_date"
            value={formData.supply_date}
            onChange={handleInputChange}
            className="supplier-product-modal-input"
            required
          />

          <button type="submit" className="supplier-product-modal-button">
            Add Product
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddSupplierProductModal;
