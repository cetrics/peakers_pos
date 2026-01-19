import React, { useEffect, useState } from "react";
import axios from "axios";
import AddExpenseModal from "./AddExpenseModal"; // ✅ import modal
import "./styles/Expenses.css";

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]); // Add filtered state
  const [total, setTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0); // Add filtered total state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const user_id = 1; // replace with auth user

  const fetchExpenses = async () => {
    const res = await axios.get("/expenses", { params: { user_id } });
    setExpenses(res.data);
    setFilteredExpenses(res.data); // Initialize filtered expenses
    setTotal(res.data.reduce((sum, e) => sum + Number(e.amount), 0));
    setFilteredTotal(res.data.reduce((sum, e) => sum + Number(e.amount), 0)); // Initialize filtered total
  };

  // Add search functionality
  useEffect(() => {
    let searchInput = null;
    let observer = null;

    const handleSearch = (event) => {
      const query = event.target.value.toLowerCase();
      if (!query) {
        setFilteredExpenses(expenses);
        setFilteredTotal(total);
        return;
      }

      const filtered = expenses.filter(
        (expense) =>
          expense.category?.toLowerCase().includes(query) ||
          expense.description?.toLowerCase().includes(query) ||
          expense.payment_method?.toLowerCase().includes(query) ||
          expense.amount?.toString().includes(query) ||
          new Date(expense.expense_date)
            .toLocaleDateString("en-KE", {
              timeZone: "Africa/Nairobi",
              year: "numeric",
              month: "short",
              day: "numeric",
            })
            .toLowerCase()
            .includes(query)
      );

      setFilteredExpenses(filtered);
      setFilteredTotal(filtered.reduce((sum, e) => sum + Number(e.amount), 0));
    };

    // Try to find the input immediately (use a different ID to avoid conflicts)
    searchInput = document.getElementById("customerSearch");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    } else {
      // If not found, set up an observer to watch for it
      observer = new MutationObserver(() => {
        searchInput = document.getElementById("customerSearch");
        if (searchInput) {
          searchInput.addEventListener("input", handleSearch);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (searchInput) {
        searchInput.removeEventListener("input", handleSearch);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [expenses, total]); // Depend on expenses and total

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

      {/* Show filtered total instead of full total */}
      <div className="expense-summary">
        <strong>Total Expenses:</strong> KES {filteredTotal.toFixed(2)}
        {filteredExpenses.length !== expenses.length && (
          <span
            style={{ fontSize: "0.9em", color: "#666", marginLeft: "10px" }}
          >
            (Filtered: {filteredExpenses.length} of {expenses.length} records)
          </span>
        )}
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
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map((e) => (
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
            ))
          ) : (
            <tr>
              <td colSpan="5" className="text-center">
                {expenses.length === 0
                  ? "No expenses found"
                  : "No expenses match your search"}
              </td>
            </tr>
          )}
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
