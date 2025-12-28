import React, { useEffect, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import AddProductModal from "./AddProductModal";
import AddCategoryModal from "./AddCategoryModal";
import "./styles/Product.css";
import AddRecipeModal from "./AddRecipeModal";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ProductCards = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);

  // Fetch all products
  const fetchAllProducts = async () => {
    setIsLoading(true);
    try {
      // 🔹 EXISTING PRODUCT FETCH (unchanged)
      const initialResponse = await axios.get("/get-products?page=1");
      const totalProducts = initialResponse.data.total_products;
      const productsPerPage = initialResponse.data.products.length;
      const totalPages = Math.ceil(totalProducts / productsPerPage);

      let allProducts = [];
      for (let page = 1; page <= totalPages; page++) {
        const response = await axios.get(`/get-products?page=${page}`);
        allProducts = [...allProducts, ...response.data.products];
      }

      // 🔹 NEW: Fetch bundles
      const bundleRes = await axios.get("/get-bundles");

      const bundles = bundleRes.data.map((bundle) => ({
        product_id: `bundle-${bundle.bundle_id}`,
        product_name: bundle.product_name,
        product_price: bundle.product_price,
        buying_price: bundle.buying_price, // ✅ now real value
        product_stock: bundle.product_stock,
        category_name: "Bundle",
        is_bundle: true,
        items: bundle.items,
        products_count: bundle.products_count, // ✅ count
      }));

      // 🔹 MERGE
      const combined = [...allProducts, ...bundles];

      setProducts(combined);
      setFilteredProducts(combined);
    } catch (error) {
      console.error("Error fetching products:", error);
      showAlert("Failed to fetch products.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

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

  // Download CSV Report
  const downloadCSV = () => {
    const headers = [
      "Product ID",
      "Product Name",
      "Price",
      "Buying Price",
      "Stock",
      "Category",
      "Description",
    ];

    const data = filteredProducts.map((product) => [
      product.product_id,
      product.product_name,
      `Ksh ${product.product_price}`,
      `Ksh ${product.buying_price}`,
      product.product_stock,
      product.category_name || "N/A",
      product.product_description || "",
    ]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `products_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Download Excel Report
  const downloadExcel = () => {
    const data = filteredProducts.map((product) => ({
      "Product ID": product.product_id,
      "Product Name": product.product_name,
      "Selling Price": product.product_price,
      "Buying Price": product.buying_price,
      Stock: product.product_stock,
      Category: product.category_name || "N/A",
      Description: product.product_description || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(
      workbook,
      `products_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Download PDF Report
  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "landscape",
      });

      // Title and Date
      doc.setFontSize(16);
      doc.text("Products Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Products: ${filteredProducts.length}`, 14, 29);

      // Main table data
      const headers = [
        [
          "Product ID",
          "Product Name",
          "Selling Price (Ksh)",
          "Buying Price (Ksh)",
          "Stock",
          "Category",
          "Description",
        ],
      ];

      const data = filteredProducts.map((product) => [
        product.product_id,
        product.product_name,
        product.product_price,
        product.buying_price,
        product.product_stock,
        product.category_name || "N/A",
        product.product_description || "",
      ]);

      // Generate main table
      doc.autoTable({
        head: headers,
        body: data,
        startY: 35,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: "middle",
        },
        headStyles: {
          fillColor: [61, 128, 133],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          6: { cellWidth: 40 }, // Wider column for description
        },
        didParseCell: (data) => {
          if (
            data.section === "body" &&
            (data.column.index === 2 || data.column.index === 3)
          ) {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      doc.save(`products_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Listen for global alert events
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
      <ToastContainer
        containerId="product-toast"
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-indicator">Loading products...</div>
      )}

      {/* Report Buttons with Icons */}
      <div className="report-buttons">
        <button className="report-button" onClick={downloadCSV}>
          <i className="fas fa-file-csv"></i>Download CSV
        </button>
        <button className="report-button" onClick={downloadExcel}>
          <i className="fas fa-file-excel"></i>Download Excel
        </button>
        <button className="report-button" onClick={downloadPDF}>
          <i className="fas fa-file-pdf"></i>Download PDF
        </button>
      </div>

      {/* Floating Plus Buttons */}
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

      {/* Alert inside product-container */}
      {alert.message && (
        <div className={`alert ${alert.type}`}>{alert.message}</div>
      )}

      {/* Product Grid */}
      <div className="product-grid">
        {filteredProducts.length > 0
          ? filteredProducts.map((product) => (
              <div
                key={product.product_id}
                className="product-card"
                onClick={() => {
                  setSelectedProduct(product);
                  setShowProductModal(true);
                }}
              >
                {product.is_bundle && (
                  <span className="bundle-badge">Bundle</span>
                )}

                <h3>{product.product_name}</h3>
                <p>💰 Selling: Ksh.{product.product_price}</p>
                <p>📊 Buying: Ksh.{product.buying_price}</p>
                {product.is_bundle && (
                  <p>🧩 Products in bundle: {product.products_count}</p>
                )}

                <p>
                  📦 Stock:{" "}
                  {product.product_stock < 1 ? (
                    <span style={{ color: "red", fontWeight: "bold" }}>
                      Out of stock
                    </span>
                  ) : (
                    product.product_stock
                  )}
                </p>

                <p>🗂 Category: {product.category_name || "N/A"}</p>

                {product.ingredients_count > 0 && (
                  <button
                    className="btn-sm btn-outline-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecipeProduct(product);
                      setShowRecipeModal(true);
                    }}
                  >
                    🍳 Add Material
                  </button>
                )}
              </div>
            ))
          : !isLoading && <div className="no-results">No products found</div>}
      </div>

      {/* Modals */}
      {showProductModal && (
        <AddProductModal
          onClose={() => setShowProductModal(false)}
          refreshProducts={fetchAllProducts}
          product={selectedProduct}
          showAlert={showAlert}
        />
      )}
      {showCategoryModal && (
        <AddCategoryModal
          onClose={() => setShowCategoryModal(false)}
          refreshCategories={() => {}}
        />
      )}
      {/* ✅ Move this inside return */}
      {showRecipeModal && (
        <AddRecipeModal
          product={recipeProduct}
          onClose={() => setShowRecipeModal(false)}
          showAlert={showAlert}
        />
      )}
    </div>
  );
};

export default ProductCards;
