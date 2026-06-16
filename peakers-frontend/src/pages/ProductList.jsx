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
  const [searchTerm, setSearchTerm] = useState("");
  const [previewProducts, setPreviewProducts] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
      return;
    }

    const query = searchTerm.toLowerCase();

    setFilteredProducts(
      products.filter(
        (product) =>
          product.product_name?.toLowerCase().includes(query) ||
          product.product_description?.toLowerCase().includes(query) ||
          product.category_name?.toLowerCase().includes(query) ||
          String(product.product_id).includes(query),
      ),
    );
  }, [searchTerm, products]);

  const [importFile, setImportFile] = useState(null);
  const [updateExistingStock, setUpdateExistingStock] = useState("yes");
  const [importCategory, setImportCategory] = useState("Imported Products");

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
      `products_${new Date().toISOString().slice(0, 10)}.xlsx`,
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

  const softDeleteItem = async (product) => {
    const isBundle = product.is_bundle === true;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${product.product_name}"?`,
    );

    if (!confirmDelete) return;

    try {
      if (isBundle) {
        const bundleId = product.product_id.toString().replace("bundle-", "");

        await axios.delete(`/bundles/${bundleId}/soft-delete`);
      } else {
        await axios.delete(`/products/${product.product_id}/soft-delete`);
      }

      toast.success(
        isBundle
          ? "Bundle deleted successfully"
          : "Product deleted successfully",
        {
          containerId: "product-toast",
        },
      );

      fetchAllProducts();
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed", {
        containerId: "product-toast",
      });
    }
  };

  const previewProductsExcel = async () => {
    if (!importFile) {
      toast.error("Please select an Excel file.", {
        containerId: "product-toast",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("category_name", importCategory || "Imported Products");

      const res = await axios.post("/products/preview-import-excel", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setPreviewProducts(res.data.products || []);
      setShowPreviewModal(true);
    } catch (error) {
      toast.error(error.response?.data?.error || "Preview failed.", {
        containerId: "product-toast",
      });
    }
  };

  const importProductsExcel = async () => {
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("update_stock", updateExistingStock);
      formData.append("category_name", importCategory || "Imported Products");

      const res = await axios.post("/products/import-excel", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(
        `Import complete. New: ${res.data.imported}, Updated: ${res.data.updated}, Skipped: ${res.data.skipped}`,
        { containerId: "product-toast" },
      );

      setShowPreviewModal(false);
      setPreviewProducts([]);
      setImportFile(null);
      fetchAllProducts();
    } catch (error) {
      toast.error(error.response?.data?.error || "Import failed.", {
        containerId: "product-toast",
      });
    }
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
      <div className="excel-format-guide">
        <h3>Excel Upload Format</h3>

        <p>Your Excel file should contain these columns:</p>

        <div className="excel-format-columns">
          <span>Product Name / Book Title</span>
          <span>Stock / Qty In Stock</span>
          <span>Buying Price</span>
          <span>Selling Price</span>
          <span>Category</span>
          <span>Unit</span>
        </div>

        <p className="excel-format-note">
          Required columns: Product Name or Book Title, Selling Price, and
          Stock. Other columns are optional.
        </p>
      </div>
      <div className="excel-import-panel">
        <div className="excel-import-left">
          <label className="excel-file-btn">
            <i className="fas fa-upload"></i>
            {importFile ? importFile.name : "Choose Excel File"}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setImportFile(e.target.files[0]);
                setPreviewProducts([]);
                setShowPreviewModal(false);
              }}
            />
          </label>

          <input
            type="text"
            className="excel-import-input"
            placeholder="Default Category"
            value={importCategory}
            onChange={(e) => setImportCategory(e.target.value)}
          />

          <select
            className="excel-import-select"
            value={updateExistingStock}
            onChange={(e) => setUpdateExistingStock(e.target.value)}
          >
            <option value="yes">Update existing stock: Yes</option>
            <option value="no">Update existing stock: No</option>
          </select>
        </div>

        <button className="excel-import-btn" onClick={previewProductsExcel}>
          <i className="fas fa-file-import"></i>
          Import Excel
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

      <div className="product-search">
        <i className="fas fa-search"></i>

        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

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

                <button
                  className="product-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    softDeleteItem(product);
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>

                <h3>{product.product_name}</h3>
                <p>💰 Selling: Ksh.{product.product_price}</p>
                <p>📊 Buying: Ksh.{product.buying_price}</p>
                {product.is_bundle && (
                  <p>🧩 Products in bundle: {product.products_count}</p>
                )}

                <p>
                  📦 Stock:{" "}
                  {Number(product.product_stock) <= 0 ? (
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

      {showPreviewModal && (
        <div className="excel-preview-overlay">
          <div className="excel-preview-modal">
            <div className="excel-preview-header">
              <h2>Confirm Excel Import</h2>
              <button onClick={() => setShowPreviewModal(false)}>
                &times;
              </button>
            </div>

            <p className="excel-preview-note">
              Review the products below before importing. Existing products will
              be detected by name, ignoring uppercase, lowercase, and extra
              spaces.
            </p>

            <div className="excel-preview-table-wrap">
              <table className="excel-preview-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Buying</th>
                    <th>Selling</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {previewProducts.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <span
                          className={
                            item.exists ? "existing-badge" : "new-badge"
                          }
                        >
                          {item.exists ? "Existing" : "New"}
                        </span>
                      </td>
                      <td>{item.product_name}</td>
                      <td>{item.category_name}</td>
                      <td>{item.quantity}</td>
                      <td>Ksh {item.buying_price}</td>
                      <td>Ksh {item.selling_price}</td>
                      <td>{item.product_description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="excel-preview-actions">
              <button
                className="cancel-import-btn"
                onClick={() => setShowPreviewModal(false)}
              >
                Cancel
              </button>

              <button
                className="confirm-import-btn"
                onClick={importProductsExcel}
              >
                Proceed with Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCards;
