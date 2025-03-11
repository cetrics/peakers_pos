import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaTrash } from "react-icons/fa";
import "./styles/Supplier.css"; // Maintain the theme

const AddSupplierModal = ({ onClose, refreshSuppliers, supplierData }) => {
  const [supplierName, setSupplierName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (supplierData) {
      setSupplierName(supplierData.supplier_name);
      setContactPerson(supplierData.contact_person);
      setPhoneNumber(supplierData.phone_number);
      setEmail(supplierData.email);
      setAddress(supplierData.address);
    }
  }, [supplierData]);

  // Function to check if supplier name exists before submission
  const checkSupplierExists = async (name) => {
    try {
      const response = await axios.get(`/check-supplier-exists/${name}`);
      return response.data.exists;
    } catch (error) {
      return false; // Assume it doesn't exist in case of an error
    }
  };

  // ✅ Function to display alert dynamically in supplier-container
  const showAlert = (message, type = "success") => {
    const container = document.querySelector(".supplier-container");
    if (!container) return;

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert ${type}`;
    alertDiv.textContent = message;

    container.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.style.opacity = "0";
      setTimeout(() => container.removeChild(alertDiv), 300);
    }, 3000);
  };

  const handleSaveSupplier = async () => {
    if (!supplierName.trim()) {
      setError("Supplier name is required.");
      return;
    }

    try {
      const exists = await checkSupplierExists(supplierName);
      if (!supplierData && exists) {
        setError("Supplier name already exists.");
        return;
      }

      if (supplierData) {
        // Update existing supplier
        await axios.put(`/update-supplier/${supplierData.supplier_id}`, {
          supplier_name: supplierName,
          contact_person: contactPerson,
          phone_number: phoneNumber,
          email: email,
          address: address,
        });
        showAlert("Supplier updated successfully!");
      } else {
        // Add new supplier
        await axios.post("/add-supplier", {
          supplier_name: supplierName,
          contact_person: contactPerson,
          phone_number: phoneNumber,
          email: email,
          address: address,
        });
        showAlert("Supplier added successfully!");
      }

      refreshSuppliers();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to save supplier.");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/delete-supplier/${supplierData.supplier_id}`);
      refreshSuppliers();
      showAlert("Supplier deleted successfully!");
      onClose();
    } catch (error) {
      setError("Error deleting supplier.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <span className="close-icon" onClick={onClose}>
          &times;
        </span>
        <h2>{supplierData ? "Edit Supplier" : "Add Supplier"}</h2>

        {error && <p className="error">{error}</p>}

        <input
          type="text"
          placeholder="Supplier Name"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Contact Person"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
        />
        <input
          type="text"
          placeholder="Phone"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="modal-buttons">
          {supplierData && (
            <button className="delete-btn" onClick={handleDelete}>
              <FaTrash /> Delete
            </button>
          )}
          <button onClick={handleSaveSupplier}>
            {supplierData ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSupplierModal;
