import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/Product.css";

const AddProductModal = ({ onClose, refreshProducts, product, showAlert }) => {
  const [categories, setCategories] = useState([]);
  const [productData, setProductData] = useState({
    product_number: "",
    product_name: "",
    product_price: "",
    product_description: "",
    product_stock: "0", // Default stock to 0
    category_id_fk: "",
  });

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get("/get-categories");
        setCategories(response.data.categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Set product data if editing an existing product
  useEffect(() => {
    if (product) {
      setProductData({
        product_number: product.product_number || "",
        product_name: product.product_name || "",
        product_price: product.product_price || "",
        product_description: product.product_description || "",
        product_stock:
          product.product_stock !== undefined
            ? String(product.product_stock)
            : "0",
        category_id_fk: product.category_id_fk
          ? String(product.category_id_fk)
          : "",
      });
    }
  }, [product]);

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData({ ...productData, [name]: value });
  };

  // Save product (either add new or update)
  const handleSaveProduct = async () => {
    try {
      const updatedProduct = { ...productData };

      // When editing, keep the original stock value
      if (product) {
        await axios.put(
          `/update-product/${product.product_id}`,
          updatedProduct,
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        showAlert("Product updated successfully!", "success");
      } else {
        // For new product, stock will be 0 as default
        await axios.post(`/add-product`, updatedProduct, {
          headers: { "Content-Type": "application/json" },
        });
        showAlert("Product added successfully!", "success");
      }

      refreshProducts();
      onClose();
    } catch (error) {
      showAlert("Error saving product!", "error");
      console.error("Error saving product:", error.response?.data || error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <span className="close-icon" onClick={onClose}>
          &times;
        </span>
        <h2>{product ? "Edit Product" : "Add Product"}</h2>

        <input
          type="text"
          name="product_number"
          placeholder="Product Number"
          value={productData.product_number}
          onChange={handleInputChange}
        />
        <input
          type="text"
          name="product_name"
          placeholder="Product Name"
          value={productData.product_name}
          onChange={handleInputChange}
        />
        <input
          type="number"
          name="product_price"
          placeholder="Price"
          value={productData.product_price}
          onChange={handleInputChange}
        />
        <textarea
          name="product_description"
          placeholder="Description"
          value={productData.product_description}
          onChange={handleInputChange}
        />

        {/* Stock is disabled for both new and edited products */}
        <input
          type="number"
          name="product_stock"
          placeholder="Stock Count"
          value={productData.product_stock}
          disabled
        />

        <select
          name="category_id_fk"
          value={productData.category_id_fk}
          onChange={handleInputChange}
        >
          <option value="">Select Category</option>
          {categories.map((category) => (
            <option
              key={category.category_id}
              value={String(category.category_id)}
            >
              {category.category_name}
            </option>
          ))}
        </select>
        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button onClick={handleSaveProduct}>
            {product ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
