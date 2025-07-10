import React from "react";
import "./styles/Customer.css"; // Ensure modal styles are applied

const CustomerModal = ({
  showModal,
  setShowModal,
  formData,
  handleChange,
  handleSubmit,
  errors,
  editingCustomerId,
}) => {
  if (!showModal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <span className="close-icon" onClick={() => setShowModal(false)}>
          &times;
        </span>
        <h2>{editingCustomerId ? "Edit Customer" : "Add Customer"}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="customer_name"
            placeholder="Customer Name"
            value={formData.customer_name}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="phone"
            placeholder="Phone (Optional)"
            value={formData.phone}
            onChange={handleChange}
          />
          {errors.phone && <p className="error-message">{errors.phone}</p>}

          <input
            type="email"
            name="email"
            placeholder="Email (Optional)"
            value={formData.email}
            onChange={handleChange}
          />
          {errors.email && <p className="error-message">{errors.email}</p>}

          <textarea
            name="address"
            placeholder="Address (Optional)"
            value={formData.address}
            onChange={handleChange}
          />

          <div className="modal-buttons">
            <button type="submit">
              {editingCustomerId ? "Update Customer" : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
