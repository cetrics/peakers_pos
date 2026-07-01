import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/RestaurantExpensesPage.css";

const emptyForm = {
  category: "",
  amount: "",
  expense_date: "",
  payment_method: "Cash",
  description: "",
};

const RestaurantExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState("cards");

  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const [saving, setSaving] = useState(false);

  const categories = [
    "Food Supplies",
    "Kitchen Supplies",
    "Staff Meals",
    "Rent",
    "Utilities",
    "Transport",
    "Repairs",
    "Cleaning",
    "Marketing",
    "Other",
  ];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await axios.get("/restaurant-expenses", {
        withCredentials: true,
      });

      const sorted = (res.data.expenses || []).sort(
        (a, b) => new Date(b.expense_date) - new Date(a.expense_date),
      );

      setExpenses(sorted);
    } catch {
      toast.error("Failed to load restaurant expenses.");
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const query = searchTerm.toLowerCase();
      const expenseDate = new Date(expense.expense_date);

      const matchesSearch =
        !query ||
        expense.category?.toLowerCase().includes(query) ||
        expense.description?.toLowerCase().includes(query) ||
        expense.payment_method?.toLowerCase().includes(query) ||
        expense.amount?.toString().includes(query);

      const matchesStart = !startDate || expenseDate >= new Date(startDate);
      const matchesEnd =
        !endDate || expenseDate <= new Date(`${endDate}T23:59:59`);

      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [expenses, searchTerm, startDate, endDate]);

  const totalAmount = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );

  const openAddModal = () => {
    setEditingExpense(null);
    setForm({
      ...emptyForm,
      expense_date: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setForm({
      category: expense.category || "",
      amount: expense.amount || "",
      expense_date: expense.expense_date
        ? String(expense.expense_date).slice(0, 10)
        : "",
      payment_method: expense.payment_method || "Cash",
      description: expense.description || "",
    });
    setShowModal(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const saveExpense = async (e) => {
    e.preventDefault();

    if (!form.category) {
      toast.error("Category is required.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      setSaving(true);

      if (editingExpense) {
        await axios.put(
          `/restaurant-expenses/${editingExpense.expense_id}`,
          form,
          { withCredentials: true },
        );
        toast.success("Restaurant expense updated.");
      } else {
        await axios.post("/restaurant-expenses", form, {
          withCredentials: true,
        });
        toast.success("Restaurant expense added.");
      }

      setShowModal(false);
      setEditingExpense(null);
      setForm(emptyForm);
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving expense.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (expense) => {
    setExpenseToDelete(expense);
    setShowDeleteModal(true);
  };

  const deleteExpense = async () => {
    if (!expenseToDelete) return;

    try {
      await axios.delete(`/restaurant-expenses/${expenseToDelete.expense_id}`, {
        withCredentials: true,
      });

      toast.success("Restaurant expense deleted.");
      setShowDeleteModal(false);
      setExpenseToDelete(null);
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed.");
    }
  };
  const isSupplierPayment = (expense) =>
    expense.category === "Supplier Payment";

  return (
    <div className="restaurant-expense-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="restaurant-expense-header">
        <div>
          <h3>Restaurant Expenses</h3>
          <p>Track restaurant costs, payments, supplies, and operations.</p>
        </div>

        <button className="add-expense-btn" onClick={openAddModal}>
          <i className="fas fa-plus"></i>
          <span>Add Expense</span>
        </button>
      </div>

      <div className="restaurant-expense-summary-row">
        <div className="restaurant-expense-summary">
          <strong>Total Restaurant Expenses</strong>
          KES {totalAmount.toFixed(2)}
          <span>
            Showing {filteredExpenses.length} of {expenses.length} records
          </span>
        </div>

        <div className="view-toggle">
          <button
            className={viewMode === "cards" ? "active" : ""}
            onClick={() => setViewMode("cards")}
          >
            Card View
          </button>
          <button
            className={viewMode === "table" ? "active" : ""}
            onClick={() => setViewMode("table")}
          >
            Table View
          </button>
        </div>
      </div>

      <div className="expense-actions">
        <input
          type="text"
          placeholder="Search restaurant expenses..."
          className="expense-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <input
          type="date"
          className="expense-search"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <input
          type="date"
          className="expense-search"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <button className="page-btn" onClick={clearFilters}>
          Clear
        </button>
      </div>

      {viewMode === "cards" ? (
        <div className="expense-cards">
          {filteredExpenses.length === 0 ? (
            <div className="empty-state">No restaurant expenses found.</div>
          ) : (
            filteredExpenses.map((expense) => (
              <div className="expense-card" key={expense.expense_id}>
                <div className="card-header">
                  <span className="card-category">{expense.category}</span>
                  <span className="card-amount">
                    KES {Number(expense.amount || 0).toFixed(2)}
                  </span>
                </div>

                <div className="card-details">
                  <div className="detail-row">
                    <span className="detail-label">Date:</span>
                    <span>
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Payment:</span>
                    <span>{expense.payment_method || "-"}</span>
                  </div>

                  {expense.description && (
                    <div className="detail-row">
                      <span className="detail-label">Description:</span>
                      <span>{expense.description}</span>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  {isSupplierPayment(expense) ? (
                    <span className="locked-badge">
                      <i className="fas fa-lock"></i> Auto Generated
                    </span>
                  ) : (
                    <>
                      <button
                        className="edit-btn"
                        onClick={() => openEditModal(expense)}
                      >
                        ✏️ Edit
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => confirmDelete(expense)}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="restaurant-expense-table-card">
          <table className="restaurant-expense-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-table-cell">
                    No restaurant expenses found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.expense_id}>
                    <td>
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </td>
                    <td>
                      <strong>{expense.category}</strong>
                    </td>
                    <td>{expense.description || "-"}</td>
                    <td>{expense.payment_method || "-"}</td>
                    <td>KES {Number(expense.amount || 0).toFixed(2)}</td>
                    <td>
                      {isSupplierPayment(expense) ? (
                        <span className="locked-badge">
                          <i className="fas fa-lock"></i> Auto Generated
                        </span>
                      ) : (
                        <div className="table-actions">
                          <button
                            className="edit-btn"
                            onClick={() => openEditModal(expense)}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-btn"
                            onClick={() => confirmDelete(expense)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingExpense ? "Edit Expense" : "Add Restaurant Expense"}
              </h3>
              <button
                className="close-modal"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveExpense}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="Enter amount"
                  />
                </div>

                <div className="form-group">
                  <label>Expense Date</label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) =>
                      setForm({ ...form, expense_date: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) =>
                      setForm({ ...form, payment_method: e.target.value })
                    }
                  >
                    <option value="Cash">Cash</option>
                    <option value="Mpesa">Mpesa</option>
                    <option value="Bank">Bank</option>
                    <option value="Card">Card</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Optional description..."
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm-modal">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button
                className="close-modal"
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>Are you sure you want to delete this restaurant expense?</p>
              <p style={{ fontSize: "0.9em", color: "#666" }}>
                This action cannot be undone.
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button className="delete-btn" onClick={deleteExpense}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantExpensesPage;
