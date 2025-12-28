import React, { useEffect, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import CustomerModal from "./CustomerModal";
import "./styles/Customer.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const CustomerCards = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    customer_name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all customers from backend using /get-sales-customers
  const fetchAllCustomers = async () => {
    setIsLoading(true);
    try {
      // First get the total number of customers
      const initialResponse = await axios.get(
        `/get-sales-customers?page=1&timestamp=${new Date().getTime()}`
      );
      const totalCustomers = initialResponse.data.total_customers;

      // Calculate how many pages we need to fetch
      const customersPerPage = initialResponse.data.customers.length;
      const totalPages = Math.ceil(totalCustomers / customersPerPage);

      // Fetch all pages sequentially
      let allCustomers = [];
      for (let page = 1; page <= totalPages; page++) {
        const response = await axios.get(
          `/get-sales-customers?page=${page}&timestamp=${new Date().getTime()}`
        );
        allCustomers = [...allCustomers, ...response.data.customers];
      }

      setCustomers(allCustomers);
      setFilteredCustomers(allCustomers);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCustomers();
  }, []);

  // Download CSV Report
  const downloadCSV = () => {
    const headers = ["Customer ID", "Name", "Phone", "Email", "Address"];

    const data = filteredCustomers.map((customer) => [
      customer.id,
      customer.name,
      customer.phone || "N/A",
      customer.email || "N/A",
      customer.address || "N/A",
    ]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `customers_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Download Excel Report
  const downloadExcel = () => {
    const data = filteredCustomers.map((customer) => ({
      "Customer ID": customer.id,
      Name: customer.name,
      Phone: customer.phone || "N/A",
      Email: customer.email || "N/A",
      Address: customer.address || "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(
      workbook,
      `customers_${new Date().toISOString().slice(0, 10)}.xlsx`
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
      doc.text("Customers Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Customers: ${filteredCustomers.length}`, 14, 29);

      // Main table data
      const headers = [["Customer ID", "Name", "Phone", "Email", "Address"]];

      const data = filteredCustomers.map((customer) => [
        customer.id,
        customer.name,
        customer.phone || "N/A",
        customer.email || "N/A",
        customer.address || "N/A",
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
          4: { cellWidth: 40 }, // Wider column for address
        },
      });

      doc.save(`customers_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Function to handle search input
  useEffect(() => {
    const searchInput = document.getElementById("customerSearch");

    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();

        if (!query) {
          setFilteredCustomers(customers);
          return;
        }

        const filtered = customers.filter(
          (customer) =>
            customer.name.toLowerCase().includes(query) ||
            (customer.phone && customer.phone.includes(query)) ||
            (customer.email && customer.email.toLowerCase().includes(query))
        );
        setFilteredCustomers(filtered);
      };

      searchInput.addEventListener("input", handleSearch);

      return () => {
        searchInput.removeEventListener("input", handleSearch);
      };
    }
  }, [customers]);

  // Show alert messages
  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: "", type: "" }), 3000);
  };

  // Open modal for adding/editing customers
  const openModal = (customer = null) => {
    if (customer) {
      setFormData({
        customer_name: customer.name,
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
      });
      setEditingCustomerId(customer.id);
    } else {
      setFormData({ customer_name: "", phone: "", email: "", address: "" });
      setEditingCustomerId(null);
    }
    setShowModal(true);
  };

  // Handle form submission (Add or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (errors.phone || errors.email) {
      showAlert("Fix errors before submitting.", "error");
      return;
    }

    try {
      if (editingCustomerId) {
        await axios.put(`/update-customer/${editingCustomerId}`, formData);
        toast.success("Customer updated!", { containerId: "customer-toast" });
      } else {
        await axios.post("/add-customer", formData);
        toast.success("Customer added!", { containerId: "customer-toast" });
      }
      setShowModal(false);
      fetchAllCustomers(); // Refresh the customer list
    } catch (error) {
      console.error("Server error:", error.response?.data || error);
      toast.error("Error saving customer.", { containerId: "customer-toast" });
    }
  };

  return (
    <div className="customer-container">
      <ToastContainer containerId="customer-toast" />
      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-indicator">Loading customers...</div>
      )}

      {/* Report Buttons */}
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

      {alert.message && (
        <div className={`alert ${alert.type}`}>{alert.message}</div>
      )}

      <button className="add-customer-btn" onClick={() => openModal()}>
        <i className="fas fa-plus"></i>
      </button>

      <div className="customer-grid">
        {filteredCustomers.length > 0
          ? filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="customer-card"
                onClick={() => openModal(customer)}
              >
                <h3>{customer.name}</h3>
                <p>📞 {customer.phone || "N/A"}</p>
                <p>✉️ {customer.email || "N/A"}</p>
                <p>🏠 {customer.address || "N/A"}</p>
              </div>
            ))
          : !isLoading && <div className="no-results">No customers found</div>}
      </div>

      <CustomerModal
        showModal={showModal}
        setShowModal={setShowModal}
        formData={formData}
        handleChange={(e) =>
          setFormData({ ...formData, [e.target.name]: e.target.value })
        }
        handleSubmit={handleSubmit}
        errors={errors}
        editingCustomerId={editingCustomerId}
      />
    </div>
  );
};

export default CustomerCards;
