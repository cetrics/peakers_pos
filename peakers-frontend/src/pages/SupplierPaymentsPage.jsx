import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./styles/SupplierPaymentsPage.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SupplierPaymentsPage = () => {
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierPayments, setSelectedSupplierPayments] = useState([]);
  const [viewingPaymentsFor, setViewingPaymentsFor] = useState(null);
  const [materialOptions, setMaterialOptions] = useState([]);

  const [supplier, setSupplier] = useState({
    material_id: "",
    supplier_name: "",
    quantity: "",
    unit_price: "",
  });

  const [payment, setPayment] = useState({
    supply_id: "",
    amount: "",
    payment_type: "Cash",
  });

  const fetchMaterials = async () => {
    try {
      const res = await axios.get("/get-materials");
      setMaterialOptions(res.data?.materials || []);
    } catch (err) {
      console.error("Failed to fetch materials", err);
      setMaterialOptions([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get("/get-suppliers");
      setSuppliers(res.data?.suppliers || []);
    } catch (err) {
      console.error("Failed to fetch suppliers", err);
      setSuppliers([]);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async () => {
    try {
      await axios.post("/add-material-supply", supplier);
      toast.success("Material supply recorded", {
        containerId: "supplier-toast",
      });
      setSupplier({
        material_id: "",
        supplier_name: "",
        quantity: "",
        unit_price: "",
      });
      setShowSupplierModal(false);
      await fetchSuppliers();
    } catch (err) {
      console.error("Failed to record material supply", err);
      toast.error("Error: " + (err.response?.data?.error || "Internal error"), {
        containerId: "supplier-toast",
      });
    }
  };

  const handleAddPayment = async () => {
    const payload = {
      supply_id: payment.supply_id,
      amount_paid: payment.amount,
      payment_type: payment.payment_type,
    };

    console.log("Submitting payment:", payload);

    try {
      await axios.post("/pay-material-supply", payload);
      toast.success("Payment recorded", { containerId: "supplier-toast" });
      setPayment({ supply_id: "", amount: "", payment_type: "Cash" });
      setShowPaymentModal(false);
      await fetchSuppliers();
    } catch (err) {
      console.error("Failed to add payment", err);
      toast.error(
        "Failed to add payment: " + (err.response?.data?.error || "Error"),
        { containerId: "supplier-toast" }
      );
    }
  };

  const fetchPaymentsForSupplier = async (supply_id) => {
    try {
      const res = await axios.get(`/get-material-payments/${supply_id}`);
      setSelectedSupplierPayments(res.data.payments || []);
      setViewingPaymentsFor(supply_id);
    } catch (err) {
      console.error("Failed to fetch payments", err);
    }
  };

  return (
    <div className="page-container">
      <ToastContainer
        containerId="supplier-toast"
        position="top-center"
        autoClose={3000}
      />
      <div className="action-buttons">
        <Link to="/material-page" className="circle-btn with-label">
          <span className="btn-label">Back to Materials</span>📋
        </Link>
        <button
          className="circle-btn with-label"
          onClick={() => setShowSupplierModal(true)}
        >
          <span className="btn-label">Add Supplier</span>➕
        </button>
        <button
          className="circle-btn with-label"
          onClick={() => setShowPaymentModal(true)}
        >
          <span className="btn-label">Add Payment</span>💰
        </button>
      </div>

      <div className="modal wide">
        <h3>🧾 Suppliers & Payments</h3>
        <table className="material-table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Material</th>
              <th>Total Supplied</th>
              <th>Total Paid</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers?.length > 0 ? (
              suppliers.map((sup) => (
                <tr key={sup.supply_id}>
                  <td>{sup.supplier_name}</td>
                  <td>{sup.material_name}</td>
                  <td>
                    {sup.total_quantity} {sup.unit}
                  </td>
                  <td>KES {sup.total_paid}</td>
                  <td
                    className={sup.balance > 0 ? "text-danger" : "text-success"}
                  >
                    KES {sup.balance}
                  </td>
                  <td>
                    <button
                      onClick={() => fetchPaymentsForSupplier(sup.supply_id)}
                    >
                      📜 View Payments
                    </button>
                    <button
                      onClick={() => {
                        setPayment({
                          ...payment,
                          supply_id: sup.supply_id,
                        });
                        setShowPaymentModal(true);
                      }}
                    >
                      💰 Pay
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No suppliers found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Payments Detail Modal */}
        {viewingPaymentsFor && (
          <div className="supplier-payment-modal-overlay">
            <div className="supplier-payment-modal">
              <button
                className="supplier-payment-close-btn"
                onClick={() => setViewingPaymentsFor(null)}
              >
                &times;
              </button>

              <h4 className="supplier-payment-title">
                Payment History for Supplier:{" "}
                {
                  suppliers.find((s) => s.supply_id === viewingPaymentsFor)
                    ?.supplier_name
                }
              </h4>

              <table className="supplier-payment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Payment Type</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplierPayments?.length > 0 ? (
                    selectedSupplierPayments.map((payment) => (
                      <tr key={payment.payment_id}>
                        <td>
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td>KES {payment.amount_paid}</td>
                        <td>{payment.payment_type}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="supplier-payment-empty-row">
                        No payments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal small">
            <button
              className="modal-close"
              onClick={() => setShowSupplierModal(false)}
            >
              &times;
            </button>
            <h4>Add Supplier</h4>
            <select
              value={supplier.material_id}
              onChange={(e) =>
                setSupplier({ ...supplier, material_id: e.target.value })
              }
            >
              <option value="">-- Select Material --</option>
              {materialOptions?.length > 0 ? (
                materialOptions.map((mat) => (
                  <option key={mat.material_id} value={mat.material_id}>
                    {mat.material_name} ({mat.unit})
                  </option>
                ))
              ) : (
                <option disabled>No materials available</option>
              )}
            </select>

            <input
              placeholder="Supplier Name"
              value={supplier.supplier_name}
              onChange={(e) =>
                setSupplier({ ...supplier, supplier_name: e.target.value })
              }
            />
            <input
              placeholder="Quantity"
              type="number"
              value={supplier.quantity}
              onChange={(e) =>
                setSupplier({ ...supplier, quantity: e.target.value })
              }
            />
            <input
              placeholder="Unit Price"
              type="number"
              value={supplier.unit_price}
              onChange={(e) =>
                setSupplier({ ...supplier, unit_price: e.target.value })
              }
            />

            <button onClick={handleAddSupplier}>Save Supplier</button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal small">
            <button
              className="modal-close"
              onClick={() => setShowPaymentModal(false)}
            >
              &times;
            </button>

            <h4>Record Payment</h4>
            <select
              value={payment.supply_id}
              onChange={(e) =>
                setPayment({ ...payment, supply_id: e.target.value })
              }
            >
              <option value="">-- Select Supplier Supply --</option>
              {suppliers?.length > 0 ? (
                suppliers.map((sup) => (
                  <option key={sup.supply_id} value={sup.supply_id}>
                    {sup.supplier_name} (Balance: KES {sup.balance})
                  </option>
                ))
              ) : (
                <option disabled>No suppliers available</option>
              )}
            </select>
            <input
              placeholder="Amount"
              type="number"
              value={payment.amount}
              onChange={(e) =>
                setPayment({ ...payment, amount: e.target.value })
              }
            />
            <select
              value={payment.payment_type}
              onChange={(e) =>
                setPayment({ ...payment, payment_type: e.target.value })
              }
            >
              <option value="Cash">Cash</option>
              <option value="Mpesa">Mpesa</option>
            </select>
            <button onClick={handleAddPayment}>Save Payment</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentsPage;
