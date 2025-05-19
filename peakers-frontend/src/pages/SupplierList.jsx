import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  FaPlus,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaBoxOpen,
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import AddSupplierModal from "./AddSupplierModal";
import "./styles/Supplier.css";

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSuppliers();
  }, []);

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
  }, [suppliers]);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get("/suppliers");
      setSuppliers(response.data);
      setFilteredSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  // Download CSV Report
  const downloadCSV = () => {
    const headers = [
      "Supplier ID",
      "Supplier Name",
      "Contact Person",
      "Phone Number",
      "Email",
      "Address",
    ];

    const data = filteredSuppliers.map((supplier) => [
      supplier.supplier_id,
      supplier.supplier_name,
      supplier.contact_person,
      supplier.phone_number,
      supplier.email,
      supplier.address || "N/A",
    ]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `suppliers_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Download Excel Report
  const downloadExcel = () => {
    const data = filteredSuppliers.map((supplier) => ({
      "Supplier ID": supplier.supplier_id,
      "Supplier Name": supplier.supplier_name,
      "Contact Person": supplier.contact_person,
      "Phone Number": supplier.phone_number,
      Email: supplier.email,
      Address: supplier.address || "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");
    XLSX.writeFile(
      workbook,
      `suppliers_${new Date().toISOString().slice(0, 10)}.xlsx`
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
      doc.text("Suppliers Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Suppliers: ${filteredSuppliers.length}`, 14, 29);

      // Main table data
      const headers = [
        [
          "Supplier ID",
          "Supplier Name",
          "Contact Person",
          "Phone Number",
          "Email",
          "Address",
        ],
      ];

      const data = filteredSuppliers.map((supplier) => [
        supplier.supplier_id,
        supplier.supplier_name,
        supplier.contact_person,
        supplier.phone_number,
        supplier.email,
        supplier.address || "N/A",
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
          5: { cellWidth: 40 }, // Wider column for address
        },
      });

      doc.save(`suppliers_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleSearch = (e) => {
    if (!suppliers.length) return;

    const query = e.target.value.toLowerCase();
    const filtered = suppliers.filter(
      (supplier) =>
        supplier.supplier_name.toLowerCase().includes(query) ||
        supplier.contact_person.toLowerCase().includes(query) ||
        supplier.phone_number.toLowerCase().includes(query) ||
        supplier.email.toLowerCase().includes(query)
    );
    setFilteredSuppliers(filtered);
  };

  return (
    <div className="supplier-container">
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

      {/* ➕ Floating Add Supplier Button */}
      <button
        className="add-btn"
        onClick={() => {
          setSelectedSupplier(null);
          setIsModalOpen(true);
        }}
      >
        <i className="fas fa-plus"></i>
        <span className="btn-text">Add Supplier</span>
      </button>

      {/* 🏢 Supplier Grid */}
      <div className="supplier-grid">
        {filteredSuppliers.length > 0 ? (
          filteredSuppliers.map((supplier) => (
            <div key={supplier.supplier_id} className="supplier-card">
              <div
                className="supplier-info"
                onClick={() => {
                  setSelectedSupplier(supplier);
                  setIsModalOpen(true);
                }}
              >
                <h3>{supplier.supplier_name}</h3>
                <p>
                  <FaUser className="icon" /> {supplier.contact_person}
                </p>
                <p>
                  <FaPhone className="icon" /> {supplier.phone_number}
                </p>
                <p>
                  <FaEnvelope className="icon" /> {supplier.email}
                </p>
              </div>

              {/* 📦 View Products Icon */}
              <FaBoxOpen
                className="view-products-icon"
                title="View Supplied Products"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/supplier_products/${supplier.supplier_id}`);
                }}
              />
            </div>
          ))
        ) : (
          <p className="no-results">No suppliers found.</p>
        )}
      </div>

      {/* 🏠 Add/Edit Supplier Modal */}
      {isModalOpen && (
        <AddSupplierModal
          onClose={() => setIsModalOpen(false)}
          refreshSuppliers={fetchSuppliers}
          supplierData={selectedSupplier}
        />
      )}
    </div>
  );
};

export default SupplierList;
