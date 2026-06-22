import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  FaEdit,
  FaArrowLeft,
} from "react-icons/fa";
import AddSupplierModal from "./AddSupplierModal";
import "./styles/Supplierlist.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaTrash } from "react-icons/fa";
const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, []);
  useEffect(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      setFilteredSuppliers(suppliers);
      return;
    }

    const filtered = suppliers.filter(
      (supplier) =>
        String(supplier.supplier_id || "")
          .toLowerCase()
          .includes(query) ||
        String(supplier.supplier_name || "")
          .toLowerCase()
          .includes(query) ||
        String(supplier.contact_person || "")
          .toLowerCase()
          .includes(query) ||
        String(supplier.phone_number || "")
          .toLowerCase()
          .includes(query) ||
        String(supplier.email || "")
          .toLowerCase()
          .includes(query) ||
        String(supplier.address || "")
          .toLowerCase()
          .includes(query),
    );

    setFilteredSuppliers(filtered);
  }, [searchTerm, suppliers]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/suppliers");
      setSuppliers(response.data);
      setFilteredSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setError("Failed to load suppliers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const softDeleteSupplier = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;

    try {
      await axios.delete(
        `/suppliers/${supplierToDelete.supplier_id}/soft-delete`,
      );

      toast.success("Supplier deleted successfully", {
        containerId: "supplier-toast",
      });

      setShowDeleteModal(false);
      setSupplierToDelete(null);

      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed", {
        containerId: "supplier-toast",
      });
    }
  };

  const uploadReceipt = async (file) => {
    const formData = new FormData();
    formData.append("receipt", file);

    const res = await axios.post("/scan-receipt", formData);

    toast.success(
      `Supplier: ${res.data.supplier} • Items added: ${res.data.items.length}`,
    );

    fetchSuppliers(); // refresh list
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
      `suppliers_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
        supplier.email.toLowerCase().includes(query),
    );
    setFilteredSuppliers(filtered);
  };

  return (
    <div className="supplier-page-container">
      <ToastContainer containerId="supplier-toast" />
      <div className="supplier-action-buttons">
        <Link to="/" className="supplier-circle-btn with-label">
          <span className="supplier-btn-label">Back to Dashboard</span>
          <FaArrowLeft />
        </Link>
        <button
          className="supplier-circle-btn with-label"
          onClick={() => {
            setSelectedSupplier(null);
            setIsModalOpen(true);
          }}
        >
          <span className="supplier-btn-label">Add Supplier</span>
          <FaPlus style={{ color: "#606060" }} />
        </button>
      </div>

      <input
        type="file"
        accept="image/*"
        id="receiptUpload"
        style={{ display: "none" }}
        onChange={(e) => uploadReceipt(e.target.files[0])}
      />

      <div className="supplier-modal supplier-modal-wide">
        <h3>Supplier Management</h3>

        {/* Report Buttons */}
        <div className="supplier-report-buttons">
          <button className="supplier-report-button" onClick={downloadCSV}>
            <i
              className="fas fa-file-csv supplier-report-icon"
              style={{ color: "#217346" }}
            ></i>
            Download CSV
          </button>
          <button className="supplier-report-button" onClick={downloadExcel}>
            <i
              className="fas fa-file-excel supplier-report-icon"
              style={{ color: "#217346" }}
            ></i>
            Download Excel
          </button>
          <button className="supplier-report-button" onClick={downloadPDF}>
            <i
              className="fas fa-file-pdf supplier-report-icon"
              style={{ color: "#d24726" }}
            ></i>
            Download PDF
          </button>
        </div>

        <div className="supplier-search-box">
          <i className="fas fa-search"></i>

          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="supplier-text-center">Loading suppliers...</div>
        ) : error ? (
          <div className="supplier-text-center supplier-error-message">
            {error}
            <button onClick={fetchSuppliers} className="supplier-retry-btn">
              Retry
            </button>
          </div>
        ) : (
          <table className="supplier-material-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Phone Number</th>
                <th>Email</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.supplier_id}>
                    <td>{supplier.supplier_id}</td>
                    <td>{supplier.supplier_name}</td>
                    <td>{supplier.contact_person}</td>
                    <td>{supplier.phone_number}</td>
                    <td>{supplier.email}</td>
                    <td>{supplier.address || "N/A"}</td>
                    <td className="supplier-actions-cell">
                      <button
                        className="supplier-edit-btn"
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setIsModalOpen(true);
                        }}
                        title="Edit Supplier"
                      >
                        <FaEdit />
                        Edit
                      </button>
                      <button
                        className="supplier-products-btn"
                        onClick={() =>
                          navigate(`/supplier_products/${supplier.supplier_id}`)
                        }
                        title="View Products"
                      >
                        <FaBoxOpen />
                        View
                      </button>
                      <button
                        className="supplier-delete-btn"
                        onClick={() => softDeleteSupplier(supplier)}
                        title="Delete Supplier"
                      >
                        <FaTrash />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="supplier-text-center">
                    No suppliers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showDeleteModal && (
        <div className="supplier-delete-modal-overlay">
          <div className="supplier-delete-modal">
            <div className="supplier-delete-icon">⚠️</div>

            <h3>Delete Supplier</h3>

            <p>
              Are you sure you want to delete
              <strong> {supplierToDelete?.supplier_name}</strong>?
            </p>

            <div className="supplier-delete-modal-actions">
              <button
                className="supplier-cancel-delete-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSupplierToDelete(null);
                }}
              >
                Cancel
              </button>

              <button
                className="supplier-confirm-delete-btn"
                onClick={confirmDeleteSupplier}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
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
