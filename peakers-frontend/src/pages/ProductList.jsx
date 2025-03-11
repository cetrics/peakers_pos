import React, { useEffect, useState } from "react";
import axios from "axios";
import AddProductModal from "./AddProductModal";
import AddCategoryModal from "./AddCategoryModal";
import "./styles/Product.css";

const ProductCards = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Fetch products with pagination
  const fetchProducts = async (pageNumber) => {
    try {
      const response = await axios.get(`/get-products?page=${pageNumber}`);
      setProducts(response.data.products);
      setFilteredProducts(response.data.products);
      setTotalProducts(response.data.total_products);
    } catch (error) {
      console.error("Error fetching products:", error);
      showAlert("Failed to fetch products.", "error");
    }
  };

  useEffect(() => {
    fetchProducts(page);
  }, [page]);

  useEffect(() => {
    const searchInput = document.getElementById("customerSearch");
    if (!searchInput) return;

    const handleSearch = (event) => {
      const query = event.target.value.toLowerCase();
      if (!query) {
        setFilteredProducts(products); // Reset to all products
        return;
      }

      const filtered = products.filter(
        (product) =>
          product.product_name.toLowerCase().includes(query) ||
          (product.product_description &&
            product.product_description.toLowerCase().includes(query)) ||
          (product.category_name &&
            product.category_name.toLowerCase().includes(query))
      );
      setFilteredProducts(filtered);
    };

    searchInput.addEventListener("input", handleSearch);

    return () => {
      searchInput.removeEventListener("input", handleSearch);
    };
  }, [products]);

  // ✅ Listen for global alert events
  useEffect(() => {
    const handleAlertEvent = (event) => {
      setAlert({ message: event.detail.message, type: event.detail.type });

      // Hide after 3 seconds
      setTimeout(() => {
        setAlert({ message: "", type: "" });
      }, 3000);
    };

    document.addEventListener("showAlert", handleAlertEvent);

    return () => {
      document.removeEventListener("showAlert", handleAlertEvent);
    };
  }, []);

  // Show Alert inside product-container
  const showAlert = (message, type) => {
    setAlert({ message, type });

    // Hide after 3 seconds
    setTimeout(() => {
      setAlert({ message: "", type: "" });
    }, 3000);
  };

  return (
    <div className="product-container">
      {/* ✅ Floating Plus Buttons */}
      <div className="button-group">
        <button
          className="add-product-btn"
          onClick={() => {
            setSelectedProduct(null);
            setShowProductModal(true);
          }}
        >
          <i className="fas fa-plus"></i>
          <span className="tooltip">Add Product</span>
        </button>
        <button
          className="add-category-btn"
          onClick={() => setShowCategoryModal(true)}
        >
          <i className="fas fa-plus"></i>
          <span className="tooltip">Add Category</span>
        </button>
      </div>

      {/* ✅ Alert inside product-container */}
      {alert.message && (
        <div className={`alert ${alert.type}`}>{alert.message}</div>
      )}

      {/* ✅ Product Grid */}
      <div className="product-grid">
        {filteredProducts.map((product) => (
          <div
            key={product.product_id}
            className="product-card"
            onClick={() => {
              setSelectedProduct(product);
              setShowProductModal(true);
            }}
          >
            <h3>{product.product_name}</h3>
            <p>Ksh.{product.product_price}</p>
            <p>📦 Stock: {product.product_stock}</p>
            <p>🗂 Category: {product.category_name || "N/A"}</p>
          </div>
        ))}
      </div>

      {/* ✅ Pagination */}
      {totalProducts > 20 && (
        <div className="pagination">
          <button onClick={() => setPage(page - 1)} disabled={page === 1}>
            ⬅️ Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={products.length < 20}
          >
            Next ➡️
          </button>
        </div>
      )}

      {/* ✅ Modals */}
      {showProductModal && (
        <AddProductModal
          onClose={() => setShowProductModal(false)}
          refreshProducts={() => fetchProducts(page)}
          product={selectedProduct}
          showAlert={showAlert} // ✅ Pass showAlert function
        />
      )}
      {showCategoryModal && (
        <AddCategoryModal
          onClose={() => setShowCategoryModal(false)}
          refreshCategories={() => {}}
        />
      )}
    </div>
  );
};

export default ProductCards;
