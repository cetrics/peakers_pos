// AddExpenseModal.jsx
import React, { useState } from "react";
import "./styles/Expenses.css";

const AddExpenseModal = ({ onClose, onSubmit }) => {
  const [form, setForm] = useState({
    category: "",
    description: "",
    amount: "",
    payment_method: "",
    expense_date: "",
  });

  const handleSubmit = () => {
    if (!form.category || !form.amount || !form.expense_date) {
      alert("Please fill all required fields");
      return;
    }
    onSubmit(form);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <span className="close-icon" onClick={onClose}>
          &times;
        </span>
        <h3>💸 Add Expense</h3>
        <input
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          type="number"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <select
          value={form.payment_method}
          onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
        >
          <option value="">Select Payment Method</option>
          <option value="Mpesa">Mpesa</option>
          <option value="Cash">Cash</option>
          <option value="Bank">Bank</option>
        </select>

        <input
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
        />

        <div className="modal-buttons">
          <button onClick={handleSubmit}>Add</button>
        </div>
      </div>
    </div>
  );
};

export default AddExpenseModal;
