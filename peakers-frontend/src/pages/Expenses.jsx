import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AddExpenseModal from "./AddExpenseModal";
import "./styles/Expenses.css";

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const user_id = 1; // Replace with actual logged-in user id

  const fetchExpenses = async () => {
    try {
      const res = await axios.get("/expenses", { params: { user_id } });
      const data = res.data || [];
      const sorted = data.sort(
        (a, b) => new Date(b.expense_date) - new Date(a.expense_date),
      );
      setExpenses(sorted);
      setFilteredExpenses(sorted);
      const sum = sorted.reduce((s, e) => s + Number(e.amount), 0);
      setTotal(sum);
      setFilteredTotal(sum);
      setCurrentPage(1);
    } catch (error) {
      toast.error("Failed to load expenses");
    }
  };

  const applyFilters = (
    searchValue = searchTerm,
    start = startDate,
    end = endDate,
  ) => {
    const query = searchValue.toLowerCase();

    const filtered = expenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);

      const matchesSearch =
        !query ||
        expense.category?.toLowerCase().includes(query) ||
        expense.description?.toLowerCase().includes(query) ||
        expense.payment_method?.toLowerCase().includes(query) ||
        expense.product_name?.toLowerCase().includes(query) ||
        expense.waste_quantity?.toString().includes(query) ||
        expense.amount?.toString().includes(query);

      const matchesStart = !start || expenseDate >= new Date(start);

      const matchesEnd = !end || expenseDate <= new Date(`${end}T23:59:59`);

      return matchesSearch && matchesStart && matchesEnd;
    });

    setFilteredExpenses(filtered);
    setFilteredTotal(filtered.reduce((s, e) => s + Number(e.amount), 0));
    setCurrentPage(1);
  };

  const [searchTerm, setSearchTerm] = useState("");

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const confirmDelete = (expense) => {
    setExpenseToDelete(expense);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    try {
      const businessId = localStorage.getItem("business_id");
      await axios.delete(`/expenses/${expenseToDelete.expense_id}`, {
        headers: { "X-Business-ID": businessId },
      });
      toast.success("Expense deleted successfully");
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed");
    } finally {
      setShowDeleteModal(false);
      setExpenseToDelete(null);
    }
  };

  const openEditModal = (expense) => {
    setEditExpense(expense);
    setShowExpenseModal(true);
  };

  const handleExpenseSubmit = async () => {
    await fetchExpenses();
    setShowExpenseModal(false);
    setEditExpense(null);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return (
    <div className="expense-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <h3>💸 Expenses</h3>

      <div className="expense-summary">
        <strong>Total Expenses:</strong> KES {filteredTotal.toFixed(2)}
        {filteredExpenses.length !== expenses.length && (
          <span className="filter-info">
            (Filtered: {filteredExpenses.length} of {expenses.length} records)
          </span>
        )}
      </div>

      <button
        className="add-expense-btn"
        onClick={() => {
          setEditExpense(null);
          setShowExpenseModal(true);
        }}
      >
        <i className="fas fa-plus"></i>
        <span className="tooltip">Add Expense</span>
      </button>

      <div className="expense-actions">
        <input
          type="text"
          placeholder="Search expenses..."
          className="expense-search"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            applyFilters(e.target.value, startDate, endDate);
          }}
        />

        <input
          type="date"
          className="expense-search"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            applyFilters(searchTerm, e.target.value, endDate);
          }}
        />

        <input
          type="date"
          className="expense-search"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            applyFilters(searchTerm, startDate, e.target.value);
          }}
        />

        <button
          className="page-btn"
          onClick={() => {
            setSearchTerm("");
            setStartDate("");
            setEndDate("");
            setFilteredExpenses(expenses);
            setFilteredTotal(total);
            setCurrentPage(1);
          }}
        >
          Clear
        </button>
      </div>

      {/* Card Grid */}
      <div className="expense-cards">
        {paginatedExpenses.length > 0 ? (
          paginatedExpenses.map((e) => (
            <div className="expense-card" key={e.expense_id}>
              <div className="card-header">
                <span className="card-category">{e.category}</span>
                <span className="card-amount">
                  KES {Number(e.amount).toFixed(2)}
                </span>
              </div>
              <div className="card-details">
                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span>
                    {new Date(e.expense_date).toLocaleDateString("en-KE", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </span>
                </div>
                {e.description && (
                  <div className="detail-row">
                    <span className="detail-label">Description:</span>
                    <span>{e.description}</span>
                  </div>
                )}
                {e.category === "Waste" && (
                  <div className="detail-row waste-detail">
                    <span className="detail-label">Waste:</span>
                    <span>
                      {e.waste_quantity} from {e.product_name || "Product"}
                    </span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Payment:</span>
                  <span>{e.payment_method || "-"}</span>
                </div>
              </div>
              <div className="card-actions">
                <button
                  className="edit-btn"
                  onClick={() => openEditModal(e)}
                  title="Edit"
                >
                  ✏️ Edit
                </button>
                <button
                  className="delete-btn"
                  onClick={() => confirmDelete(e)}
                  title="Delete"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            {expenses.length === 0
              ? "No expenses found"
              : "No expenses match your search"}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="page-btn"
          >
            Prev
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="page-btn"
          >
            Next
          </button>
        </div>
      )}

      {showExpenseModal && (
        <AddExpenseModal
          onClose={() => {
            setShowExpenseModal(false);
            setEditExpense(null);
          }}
          onSubmit={handleExpenseSubmit}
          editExpense={editExpense}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="modal-content delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
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
              <p>Are you sure you want to delete this expense?</p>
              <p style={{ fontSize: "0.9em", color: "#666" }}>
                {expenseToDelete?.category === "Waste"
                  ? "Stock will be restored if this was a waste expense."
                  : "This action cannot be undone."}
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button className="delete-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
