import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/EditSupplierProductModal.css";

const AddSupplierModal = ({ onClose, refreshSuppliers, supplierData }) => {
  const [supplierName, setSupplierName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (supplierData) {
      setSupplierName(supplierData.supplier_name || "");
      setContactPerson(supplierData.contact_person || "");
      setPhoneNumber(supplierData.phone_number || "");
      setEmail(supplierData.email || "");
      setAddress(supplierData.address || "");
    }
  }, [supplierData]);

  const handleSaveSupplier = async () => {
    if (!supplierName.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setError(""); // clear previous error
    try {
      if (supplierData) {
        await axios.put(`/update-supplier/${supplierData.supplier_id}`, {
          supplier_name: supplierName,
          contact_person: contactPerson,
          phone_number: phoneNumber,
          email: email,
          address: address,
        });
        toast.success("Supplier updated successfully!");
      } else {
        await axios.post("/add-supplier", {
          supplier_name: supplierName,
          contact_person: contactPerson,
          phone_number: phoneNumber,
          email: email,
          address: address,
        });
        toast.success("Supplier added successfully!");
      }
      refreshSuppliers();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to save supplier.");
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      try {
        await axios.delete(`/delete-supplier/${supplierData.supplier_id}`);
        refreshSuppliers();
        toast.success("Supplier deleted successfully!");
        onClose();
      } catch (error) {
        setError("Error deleting supplier.");
      }
    }
  };

  return (
    <div className="supplier-modal-overlay">
      <div className="supplier-modal-box">
        <span className="supplier-modal-close" onClick={onClose}>
          &times;
        </span>
        <h2 className="supplier-modal-title">
          {supplierData ? "Edit Supplier" : "Add Supplier"}
        </h2>

        {error && <p className="supplier-modal-error">{error}</p>}

        <input
          className="supplier-modal-input"
          type="text"
          placeholder="Supplier Name"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
        />
        <input
          className="supplier-modal-input"
          type="text"
          placeholder="Contact Person"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
        />
        <input
          className="supplier-modal-input"
          type="text"
          placeholder="Phone"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <input
          className="supplier-modal-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="supplier-modal-input"
          type="text"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="supplier-modal-buttons">
          <button className="supplier-modal-save" onClick={handleSaveSupplier}>
            {supplierData ? "Update Supplier" : "Add Supplier"}
          </button>
          {supplierData && (
            <button className="supplier-modal-delete" onClick={handleDelete}>
              Delete Supplier
            </button>
          )}
        </div>
      </div>
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default AddSupplierModal;
