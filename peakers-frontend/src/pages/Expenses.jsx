import React, { useEffect, useState } from "react";
import axios from "axios";
import AddExpenseModal from "./AddExpenseModal"; // ✅ import modal
import "./styles/Expenses.css";

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const user_id = 1; // replace with auth user

  const fetchExpenses = async () => {
    const res = await axios.get("/expenses", { params: { user_id } });
    setExpenses(res.data);
    setTotal(res.data.reduce((sum, e) => sum + Number(e.amount), 0));
  };

  const addExpense = async (form) => {
    await axios.post("/expenses", { ...form, user_id });
    fetchExpenses();
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return (
    <div className="expense-container">
      <h3>💸 Expenses</h3>

      <div className="expense-summary">
        <strong>Total Expenses:</strong> KES {total.toFixed(2)}
      </div>

      {/* Floating Plus Button */}
      <button
        className="add-expense-btn"
        onClick={() => setShowExpenseModal(true)}
      >
        <i className="fas fa-plus"></i>
        <span className="tooltip">Add Expense</span>
      </button>

      <table className="expense-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Payment</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.expense_id}>
              <td>
                {new Date(e.expense_date).toLocaleDateString("en-KE", {
                  timeZone: "Africa/Nairobi",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td>{e.category}</td>
              <td>{e.description}</td>
              <td>{e.payment_method}</td>
              <td>KES {e.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {showExpenseModal && (
        <AddExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSubmit={addExpense}
        />
      )}
    </div>
  );
};

export default Expenses;
