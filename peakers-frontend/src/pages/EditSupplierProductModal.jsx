import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/AddSupplierProductModal.css";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";

const EditSupplierProductModal = ({ product, onClose, refreshProducts }) => {
  const [products, setProducts] = useState([]);
  const [editedProduct, setEditedProduct] = useState({
    product_id: product?.product_id || "",
    price: product?.price || "",
    stock_supplied: product?.stock_supplied || "",
    supply_date: product?.supply_date ? product.supply_date.split("T")[0] : "",
  });
  const [error, setError] = useState(null);

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
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await axios.put(
        `/api/v1/update-supplier-product/${product?.supplier_product_id}`,
        editedProduct
      );

      refreshProducts();
      toast.success("Supplier product updated successfully!", {
        containerId: "product-toast",
      });
      onClose();
    } catch (error) {
      console.error("Error updating product:", error);

      if (error.response?.data?.error) {
        if (
          error.response.data.error.includes("Insufficient") ||
          error.response.data.error.includes("Not enough")
        ) {
          setError(error.response.data.error);
        } else {
          toast.error(error.response.data.error, {
            containerId: "product-toast",
          });
        }
      } else {
        toast.error("Error updating product.", {
          containerId: "product-toast",
        });
      }
    }
  };

  if (!product) return null;

  return (
    <div className="supplier-product-modal-overlay">
      <div className="supplier-product-modal-container">
        <span className="supplier-product-modal-close" onClick={onClose}>
          &times;
        </span>

        <h2 className="supplier-product-modal-title">Edit Supplier Product</h2>

        {error && (
          <div className="supplier-product-modal-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="supplier-product-modal-form">
          <select
            name="product_id"
            value={editedProduct.product_id}
            onChange={handleChange}
            className="supplier-product-modal-input"
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

          <input
            type="number"
            name="price"
            placeholder="Price"
            value={editedProduct.price}
            onChange={handleChange}
            className="supplier-product-modal-input"
            required
          />

          <input
            type="number"
            name="stock_supplied"
            placeholder="Stock Supplied"
            value={editedProduct.stock_supplied}
            onChange={handleChange}
            className="supplier-product-modal-input"
            required
          />

          <input
            type="date"
            name="supply_date"
            value={editedProduct.supply_date}
            onChange={handleChange}
            className="supplier-product-modal-input"
            required
          />

          <button type="submit" className="supplier-product-modal-button">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditSupplierProductModal;
