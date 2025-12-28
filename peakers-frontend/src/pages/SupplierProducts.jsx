import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { ToastContainer } from "react-toastify";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import AddSupplierProductModal from "./AddSupplierProductModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import SupplierPaymentHistoryModal from "./SupplierPaymentHistoryModal";
import EditSupplierProductModal from "./EditSupplierProductModal";
import styles from "./styles/SupplierProducts.module.css";

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

  const showNotification = (message, type = "success") => {
    if (type === "success") {
      toast.success(message);
    } else if (type === "error") {
      toast.error(message);
    } else {
      toast(message);
    }
  };

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
      showNotification("Supplier data loaded successfully", "success");
    } catch (error) {
      console.error("Error fetching supplier name:", error);
      showNotification("Failed to load supplier data", "error");
    }
  };

  const fetchSupplierProducts = async () => {
    try {
      const response = await axios.get(`/supplier-products/${supplierId}`);
      setProducts(response.data);
      setFilteredProducts(response.data);
      showNotification("Products loaded successfully", "success");
    } catch (error) {
      console.error("Error fetching supplier products:", error);
      showNotification("Failed to load products", "error");
    }
  };

  const downloadCSV = () => {
    try {
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
        (product.price / 100).toFixed(2),
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
      showNotification("CSV report downloaded", "success");
    } catch (error) {
      console.error("Error generating CSV:", error);
      showNotification("Failed to generate CSV", "error");
    }
  };

  const downloadExcel = () => {
    try {
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
      showNotification("Excel report downloaded", "success");
    } catch (error) {
      console.error("Error generating Excel:", error);
      showNotification("Failed to generate Excel", "error");
    }
  };

  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "landscape",
      });

      doc.setFontSize(16);
      doc.text(`Products Supplied by ${supplierName}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Products: ${filteredProducts.length}`, 14, 29);

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
      showNotification("PDF report downloaded", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showNotification("Failed to generate PDF", "error");
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
    <div className={styles.container}>
      {/* Notification */}
      <ToastContainer
        containerId="product-toast"
        position="top-right"
        autoClose={3000}
      />
      <div className={styles.reportButtons}>
        <button className={styles.reportButton} onClick={downloadCSV}>
          <i
            className={`fas fa-file-csv ${styles.reportIcon}`}
            style={{ color: "#217346" }}
          ></i>
          Download CSV
        </button>
        <button className={styles.reportButton} onClick={downloadExcel}>
          <i
            className={`fas fa-file-excel ${styles.reportIcon}`}
            style={{ color: "#217346" }}
          ></i>
          Download Excel
        </button>
        <button className={styles.reportButton} onClick={downloadPDF}>
          <i
            className={`fas fa-file-pdf ${styles.reportIcon}`}
            style={{ color: "#d24726" }}
          ></i>
          Download PDF
        </button>
      </div>

      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>
      <h2>Products Supplied by {supplierName}</h2>
      <button
        className={styles.addSupplierProductBtn}
        title="Add Supplier Product"
        onClick={() => setIsModalOpen(true)}
      >
        <FaPlus />
      </button>
      <div className={styles.productsList}>
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div
              key={product.supplier_product_id}
              className={styles.productCard}
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

              <div className={styles.productActions}>
                <button
                  className={styles.paymentBtn}
                  title="Make Payment"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPaymentModal(product);
                  }}
                >
                  <FaCreditCard /> Pay
                </button>

                <button
                  className={styles.historyBtn}
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
          showNotification={showNotification}
        />
      )}
      {isPaymentModalOpen && selectedProduct && (
        <SupplierPaymentModal
          product={selectedProduct}
          supplierId={supplierId}
          onClose={() => setIsPaymentModalOpen(false)}
          showNotification={showNotification}
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
          showNotification={showNotification}
        />
      )}
    </div>
  );
};

export default SupplierProducts;
