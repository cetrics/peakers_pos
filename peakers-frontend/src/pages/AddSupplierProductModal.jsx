import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/AddSupplierProductModal.css"; // Import CSS styles

const AddSupplierProductModal = ({ supplierId, onClose, refreshProducts }) => {
  const [formData, setFormData] = useState({
    product_id: "",
    stock_supplied: "",
    price: "",
    supply_date: "",
  });

  const [products, setProducts] = useState([]); // Store product list

  useEffect(() => {
    // Fetch products from backend
    const fetchProducts = async () => {
      try {
        const response = await axios.get("/get-products");
        setProducts(response.data.products); // Assuming products array is returned
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/supplier-products/${supplierId}/add`, formData);
      refreshProducts();
      onClose();
    } catch (error) {
      console.error("Error adding supplier product:", error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Close button as an × icon */}
        <span className="close-icon" onClick={onClose}>
          &times;
        </span>

        <h3>Add Supplier Product</h3>
        <form onSubmit={handleSubmit}>
          {/* Dropdown for Product ID */}
          <select
            name="product_id"
            value={formData.product_id}
            onChange={handleInputChange}
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
            required
          />
          <input
            type="number"
            name="price"
            placeholder="Price"
            value={formData.price}
            onChange={handleInputChange}
            required
          />
          <input
            type="date"
            name="supply_date"
            value={formData.supply_date}
            onChange={handleInputChange}
            required
          />
          <button type="submit">Add Product</button>
        </form>
      </div>
    </div>
  );
};

export default AddSupplierProductModal;
