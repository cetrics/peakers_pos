import React, { useState } from "react";
import axios from "axios";
import { FaTimes } from "react-icons/fa";
import "./styles/SupplierPaymentModal.css";

const SupplierPaymentModal = ({ product, supplierId, onClose }) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Mpesa"); // Default is Mpesa
  const [reference, setReference] = useState(""); // Reference field for Mpesa
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState(""); // Stores success or error message
  const [alertType, setAlertType] = useState(""); // "success" or "error"

  const handlePayment = async () => {
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      setAlertMessage("Enter a valid payment amount.");
      setAlertType("error");
      return;
    }

    try {
      const response = await axios.post("/supplier-payments", {
        supplier_id: supplierId,
        supplier_product_id: product.supplier_product_id,
        amount: parseFloat(amountPaid),
        payment_method: paymentMethod,
        reference,
      });

      const balance = response.data.balance_remaining; // Get new balance from backend

      // ✅ Show success alert
      setAlertMessage(
        `✅ Payment successful! Balance remaining: KSh ${balance}`
      );
      setAlertType("success");

      // ✅ Clear only the input fields but keep the modal open
      setAmountPaid("");
      setReference("");
    } catch (error) {
      console.error("Error processing payment:", error);

      // ❌ Show error alert
      setAlertMessage("❌ Failed to process payment. Try again.");
      setAlertType("error");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Make Payment</h2>
        <p>
          <strong>Product:</strong> {product.product_name}
        </p>
        <p>
          <strong>Price:</strong> KSh {product.price}
        </p>

        <label>Amount to Pay (Partial Allowed):</label>
        <input
          type="number"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          placeholder="Enter amount"
        />

        <label>Payment Method:</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="Mpesa">Mpesa</option>
          <option value="Cash">Cash</option>
        </select>

        {paymentMethod === "Mpesa" && (
          <div>
            <label>Mpesa Code:</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter Mpesa code"
            />
          </div>
        )}

        {/* Styled Alert Message (Stays Visible) */}
        {alertMessage && (
          <div className={`alert-message ${alertType}`}>{alertMessage}</div>
        )}

        <button className="confirm-btn" onClick={handlePayment}>
          Confirm Payment
        </button>
      </div>
    </div>
  );
};

export default SupplierPaymentModal;
