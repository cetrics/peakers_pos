import React, { useEffect, useState } from "react";
import axios from "axios";
import CustomerModal from "./CustomerModal"; // Import Modal Component
import "./styles/Customer.css"; // Ensure this CSS file exists

const CustomerCards = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
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

  // ✅ Fetch customers from backend
  const fetchCustomers = async (pageNumber) => {
    try {
      const response = await axios.get(`/get-customers?page=${pageNumber}`);
      setCustomers(response.data.customers);
      setFilteredCustomers(response.data.customers);
      setTotalCustomers(response.data.total_customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  useEffect(() => {
    fetchCustomers(page);
  }, [page]);

  // ✅ Function to handle search input from index.html search bar
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

  // ✅ Show alert messages
  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: "", type: "" }), 3000);
  };

  // ✅ Open modal for adding/editing customers
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

  // ✅ Handle form submission (Add or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (errors.phone || errors.email) {
      showAlert("Fix errors before submitting.", "error");
      return;
    }

    try {
      if (editingCustomerId) {
        await axios.put(`/update-customer/${editingCustomerId}`, formData);
        showAlert("Customer updated!", "success");
      } else {
        await axios.post("/add-customer", formData);
        showAlert("Customer added!", "success");
      }
      setShowModal(false);
      fetchCustomers(page);
    } catch (error) {
      console.error("Server error:", error.response?.data || error);
      showAlert(
        error.response?.data?.error || "Error saving customer.",
        "error"
      );
    }
  };

  return (
    <div className="customer-container">
      {alert.message && (
        <div className={`alert ${alert.type}`}>{alert.message}</div>
      )}

      <button className="add-customer-btn" onClick={() => openModal()}>
        <i className="fas fa-plus"></i>
      </button>

      <div className="customer-grid">
        {filteredCustomers.map((customer) => (
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
        ))}
      </div>

      {totalCustomers > 20 && (
        <div className="pagination">
          <button onClick={() => setPage(page - 1)} disabled={page === 1}>
            ⬅️ Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={customers.length < 10}
          >
            Next ➡️
          </button>
        </div>
      )}

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
