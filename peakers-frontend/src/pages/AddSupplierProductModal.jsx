import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/AddSupplierProductModal.css";

const AddSupplierProductModal = ({
  supplierId,
  onClose,
  refreshProducts,
  showNotification,
}) => {
  const [formData, setFormData] = useState({
    product_id: "",
    stock_supplied: "",
    price: "",
    supply_date: "",
  });

  const [products, setProducts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

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
      const response = await axios.post(
        `/supplier-products/${supplierId}/add`,
        formData,
      );

      showNotification(
        response.data?.message || "Supplier product added successfully!",
        "success",
      );

      refreshProducts();
      onClose();
    } catch (error) {
      console.error("Error adding supplier product:", error);

      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to add supplier product.";

      setErrorMessage(message);
      showNotification(message, "error");
    }
  };
  const filteredProductOptions = products.filter((product) =>
    `${product.product_name} ${product.product_number || ""}`
      .toLowerCase()
      .includes(productSearch.toLowerCase()),
  );

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
          <div className="supplier-product-search-wrap">
            <input
              type="text"
              placeholder="Search product by name or number..."
              value={productSearch}
              onFocus={() => setShowProductDropdown(true)}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
                setFormData({ ...formData, product_id: "" });
              }}
              className="supplier-product-modal-input"
              required
            />

            {showProductDropdown && (
              <div className="supplier-product-dropdown">
                {filteredProductOptions.length > 0 ? (
                  filteredProductOptions.map((product) => (
                    <div
                      key={product.product_id}
                      className="supplier-product-dropdown-item"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          product_id: product.product_id,
                        });

                        setProductSearch(
                          `${product.product_name} - ${product.product_number || ""}`,
                        );

                        setShowProductDropdown(false);
                      }}
                    >
                      <strong>{product.product_name}</strong>
                      <span>{product.product_number}</span>
                    </div>
                  ))
                ) : (
                  <div className="supplier-product-dropdown-empty">
                    No product found
                  </div>
                )}
              </div>
            )}
          </div>

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
