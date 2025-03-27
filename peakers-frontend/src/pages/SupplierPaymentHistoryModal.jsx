import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaTimes } from "react-icons/fa";
import "./styles/SupplierPaymentHistoryModal.css";

const SupplierPaymentHistoryModal = ({
  supplierId,
  supplierProductId,
  onClose,
}) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await axios.get(
        `/supplier-payments/${supplierId}/${supplierProductId}`
      );

      const data = response.data || {};
      setPayments(data.payments || []);
      setTotalPaid(data.total_paid || 0);
      setRemainingAmount(data.balance_remaining || 0);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      setLoading(false);
    }
  };

  return (
    <div className="supplier-payment-history-modal">
      <div className="modal-content">
        {/* Header with Close Button */}
        <div className="modal-header">
          <h2>Payment History</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {/* Scrollable Table Container */}
        <div className="modal-body">
          {loading ? (
            <p>Loading...</p>
          ) : payments.length > 0 ? (
            <>
              <table className="payment-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td>
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td>KSh {payment.amount}</td>
                      <td>{payment.payment_method}</td>
                      <td>{payment.reference || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Balance Section */}
              <div className="balance-section">
                <strong>Total Balance Paid:</strong> KSh {totalPaid} <br />
                <strong>Remaining Amount to be Paid:</strong>
                <span style={{ color: remainingAmount > 0 ? "red" : "green" }}>
                  KSh {remainingAmount}
                </span>
              </div>
            </>
          ) : (
            <p>No payments found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierPaymentHistoryModal;
