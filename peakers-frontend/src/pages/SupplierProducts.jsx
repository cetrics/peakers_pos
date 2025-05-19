import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  FaArrowLeft,
  FaPlus,
  FaMoneyBillWave,
  FaBoxes,
  FaCalendarAlt,
  FaCreditCard,
  FaHistory,
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import AddSupplierProductModal from "./AddSupplierProductModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import SupplierPaymentHistoryModal from "./SupplierPaymentHistoryModal";
import EditSupplierProductModal from "./EditSupplierProductModal";
import "./styles/SupplierProducts.css";

const SupplierProducts = () => {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [supplierName, setSupplierName] = useState(
    location.state?.supplierName || `Supplier ${supplierId}`
  );
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currency, setCurrency] = useState("KES");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] =
    useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState(null);

  useEffect(() => {
    fetchSupplierName();
    fetchSupplierProducts();
  }, [supplierId]);

  useEffect(() => {
    const searchInput = document.getElementById("customerSearch");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    return () => {
      if (searchInput) {
        searchInput.removeEventListener("input", handleSearch);
      }
    };
  }, [products]);

  const fetchSupplierName = async () => {
    try {
      const response = await axios.get(`/api/v1/supplier/${supplierId}`);
      setSupplierName(response.data.supplier_name || `Supplier ${supplierId}`);
    } catch (error) {
      console.error("Error fetching supplier name:", error);
    }
  };

  const fetchSupplierProducts = async () => {
    try {
      const response = await axios.get(`/supplier-products/${supplierId}`);
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error("Error fetching supplier products:", error);
    }
  };

  // Download CSV Report
  const downloadCSV = () => {
    const headers = [
      "Product ID",
      "Product Name",
      "Price (KES)",
      "Price (USD)",
      "Stock Supplied",
      "Supply Date",
    ];

    const data = filteredProducts.map((product) => [
      product.supplier_product_id,
      product.product_name,
      product.price,
      (product.price / 100).toFixed(2), // Assuming 1 USD = 100 KES
      product.stock_supplied,
      new Date(product.supply_date).toLocaleDateString(),
    ]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `supplier_products_${supplierName}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
  };

  // Download Excel Report
  const downloadExcel = () => {
    const data = filteredProducts.map((product) => ({
      "Product ID": product.supplier_product_id,
      "Product Name": product.product_name,
      "Price (KES)": product.price,
      "Price (USD)": (product.price / 100).toFixed(2),
      "Stock Supplied": product.stock_supplied,
      "Supply Date": new Date(product.supply_date).toLocaleDateString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Products");
    XLSX.writeFile(
      workbook,
      `supplier_products_${supplierName}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
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
      doc.text(`Products Supplied by ${supplierName}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Products: ${filteredProducts.length}`, 14, 29);

      // Main table data
      const headers = [
        [
          "Product ID",
          "Product Name",
          "Price (KES)",
          "Price (USD)",
          "Stock Supplied",
          "Supply Date",
        ],
      ];

      const data = filteredProducts.map((product) => [
        product.supplier_product_id,
        product.product_name,
        product.price,
        (product.price / 100).toFixed(2),
        product.stock_supplied,
        new Date(product.supply_date).toLocaleDateString(),
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
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
      });

      doc.save(
        `supplier_products_${supplierName}_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleSearch = (e) => {
    if (!products.length) return;

    const query = e.target.value.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.product_name.toLowerCase().includes(query) ||
        product.price.toString().includes(query) ||
        product.stock_supplied.toString().includes(query)
    );
    setFilteredProducts(filtered);
  };

  const openPaymentModal = (product) => {
    setSelectedProduct(product);
    setIsPaymentModalOpen(true);
  };

  const openHistoryModal = (product) => {
    setSelectedProductForHistory(product);
    setIsHistoryModalOpen(true);
  };

  const openEditModal = (product) => {
    setSelectedProductForEdit(product);
    setIsEditModalOpen(true);
  };

  return (
    <div className="supplier-products-container">
      {/* Report Buttons with YouTube-style grey */}
      <div className="report-buttons">
        <button className="report-button" onClick={downloadCSV}>
          <FaFileCsv className="report-icon" /> CSV
        </button>
        <button className="report-button" onClick={downloadExcel}>
          <FaFileExcel className="report-icon" /> Excel
        </button>
        <button className="report-button" onClick={downloadPDF}>
          <FaFilePdf className="report-icon" /> PDF
        </button>
      </div>

      <button className="back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>
      <h2>Products Supplied by {supplierName}</h2>
      <button
        className="currency-toggle-btn"
        onClick={() => setCurrency(currency === "KES" ? "USD" : "KES")}
      >
        Switch to {currency === "KES" ? "USD ($)" : "KES (KSh)"}
      </button>
      <button
        className="add-supplier-product-btn"
        title="Add Supplier Product"
        onClick={() => setIsModalOpen(true)}
      >
        <FaPlus />
      </button>
      <div className="products-list">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div
              key={product.supplier_product_id}
              className="product-card"
              onClick={() => openEditModal(product)}
            >
              <h3>{product.product_name}</h3>
              <p>
                <FaMoneyBillWave /> Price:{" "}
                {currency === "KES"
                  ? `KSh ${product.price}`
                  : `$${(product.price / 100).toFixed(2)}`}
              </p>
              <p>
                <FaBoxes /> Stock Supplied: {product.stock_supplied}
              </p>
              <p>
                <FaCalendarAlt /> Supply Date:{" "}
                {new Date(product.supply_date).toLocaleDateString()}
              </p>

              <div className="product-actions">
                <button
                  className="payment-btn"
                  title="Make Payment"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPaymentModal(product);
                  }}
                >
                  <FaCreditCard /> Pay
                </button>

                <button
                  className="history-btn"
                  title="View Payment History"
                  onClick={(e) => {
                    e.stopPropagation();
                    openHistoryModal(product);
                  }}
                >
                  <FaHistory /> History
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No products supplied by this supplier.</p>
        )}
      </div>
      {isModalOpen && (
        <AddSupplierProductModal
          supplierId={supplierId}
          onClose={() => setIsModalOpen(false)}
          refreshProducts={fetchSupplierProducts}
        />
      )}
      {isPaymentModalOpen && selectedProduct && (
        <SupplierPaymentModal
          product={selectedProduct}
          supplierId={supplierId}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}
      {isHistoryModalOpen && selectedProductForHistory && (
        <SupplierPaymentHistoryModal
          supplierId={supplierId}
          supplierProductId={selectedProductForHistory.supplier_product_id}
          productName={selectedProductForHistory.product_name}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}
      {isEditModalOpen && selectedProductForEdit && (
        <EditSupplierProductModal
          product={selectedProductForEdit}
          supplierId={supplierId}
          onClose={() => setIsEditModalOpen(false)}
          refreshProducts={fetchSupplierProducts}
        />
      )}
    </div>
  );
};

export default SupplierProducts;
