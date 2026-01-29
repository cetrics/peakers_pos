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
    } catch {
      setMaterialOptions([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get("/get-suppliers");
      setSuppliers(res.data?.suppliers || []);
    } catch {
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
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error", {
        containerId: "supplier-toast",
      });
    }
  };

  const handleAddPayment = async () => {
    try {
      await axios.post("/pay-material-supply", {
        supply_id: payment.supply_id,
        amount_paid: payment.amount,
        payment_type: payment.payment_type,
      });
      toast.success("Payment recorded", {
        containerId: "supplier-toast",
      });
      setPayment({ supply_id: "", amount: "", payment_type: "Cash" });
      setShowPaymentModal(false);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error", {
        containerId: "supplier-toast",
      });
    }
  };

  const fetchPaymentsForSupplier = async (supply_id) => {
    try {
      const res = await axios.get(`/get-material-payments/${supply_id}`);
      setSelectedSupplierPayments(res.data.payments || []);
      setViewingPaymentsFor(supply_id);
    } catch {}
  };

  return (
    <div className="page-container">
      <ToastContainer containerId="supplier-toast" position="top-center" />

      {/* Floating Action Buttons */}
      <div className="action-buttons">
        <Link to="/material-page" className="circle-btn bw-btn">
          <span className="btn-label">Back to Materials</span>📋
        </Link>
        <button
          className="circle-btn bw-btn"
          onClick={() => setShowSupplierModal(true)}
        >
          <span className="btn-label">Add Supplier</span>➕
        </button>
        <button
          className="circle-btn bw-btn"
          onClick={() => setShowPaymentModal(true)}
        >
          <span className="btn-label">Add Payment</span>💰
        </button>
      </div>

      <div className="material-page-box wide">
        <h3>🧾 Suppliers & Payments</h3>

        <div className="table-container">
          <table className="material-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Material</th>
                <th>Total Supplied</th>
                <th>Total Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length ? (
                suppliers.map((sup) => (
                  <tr key={sup.supply_id}>
                    <td>{sup.supplier_name}</td>
                    <td>{sup.material_name}</td>
                    <td>
                      {sup.total_quantity} {sup.unit}
                    </td>
                    <td>KES {sup.total_paid}</td>
                    <td
                      className={
                        sup.balance > 0 ? "text-warning" : "text-success"
                      }
                    >
                      KES {sup.balance}
                    </td>
                    <td className="action-cell">
                      <button
                        onClick={() => fetchPaymentsForSupplier(sup.supply_id)}
                      >
                        📜
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
                        💰
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
        </div>
      </div>

      {/* Payment History Modal */}
      {viewingPaymentsFor && (
        <div className="modal-overlay">
          <div className="modal wide">
            <button
              className="modal-close"
              onClick={() => setViewingPaymentsFor(null)}
            >
              &times;
            </button>
            <h4>Payment History</h4>
            <table className="material-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {selectedSupplierPayments.length ? (
                  selectedSupplierPayments.map((p) => (
                    <tr key={p.payment_id}>
                      <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td>KES {p.amount_paid}</td>
                      <td>{p.payment_type}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="text-center">
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <option value="">Select Material</option>
              {materialOptions.map((m) => (
                <option key={m.material_id} value={m.material_id}>
                  {m.material_name}
                </option>
              ))}
            </select>

            <input
              placeholder="Supplier Name"
              value={supplier.supplier_name}
              onChange={(e) =>
                setSupplier({ ...supplier, supplier_name: e.target.value })
              }
            />
            <input
              type="number"
              placeholder="Quantity"
              value={supplier.quantity}
              onChange={(e) =>
                setSupplier({ ...supplier, quantity: e.target.value })
              }
            />
            <input
              type="number"
              placeholder="Unit Price"
              value={supplier.unit_price}
              onChange={(e) =>
                setSupplier({ ...supplier, unit_price: e.target.value })
              }
            />
            <button onClick={handleAddSupplier}>Save</button>
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
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.supply_id} value={s.supply_id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Amount"
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
              <option>Cash</option>
              <option>Mpesa</option>
            </select>

            <button onClick={handleAddPayment}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentsPage;
