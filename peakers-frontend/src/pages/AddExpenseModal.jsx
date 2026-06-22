import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import ProductSelectorModal from "./ProductSelectorModal";

const AddExpenseModal = ({ onClose, onSubmit, editExpense }) => {
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const user_id = 1; // same as parent

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const businessId = localStorage.getItem("business_id");
      const res = await axios.get("/get-products?page=1", {
        headers: { "X-Business-ID": businessId },
      });
      setProducts(res.data.products || []);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (editExpense) {
      setCategory(editExpense.category);
      setDescription(editExpense.description || "");
      setAmount(editExpense.amount.toString());
      setPaymentMethod(editExpense.payment_method || "Cash");
      if (editExpense.category === "Waste") {
        setSelectedProductId(editExpense.product_id);
        setWasteQuantity(editExpense.waste_quantity?.toString() || "");
      }
    }
  }, [editExpense]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (category === "Waste") {
      if (!selectedProductId) {
        toast.error("Select a product for waste");
        return;
      }
      if (!wasteQuantity || Number(wasteQuantity) <= 0) {
        toast.error("Enter valid waste quantity");
        return;
      }
    }

    const payload = {
      user_id,
      category,
      description,
      amount: Number(amount),
      payment_method: paymentMethod,
      product_id: category === "Waste" ? selectedProductId : null,
      waste_quantity: category === "Waste" ? Number(wasteQuantity) : 0,
    };

    try {
      const businessId = localStorage.getItem("business_id");
      const headers = { "X-Business-ID": businessId };
      if (editExpense) {
        await axios.put(`/expenses/${editExpense.expense_id}`, payload, {
          headers,
        });
        toast.success("Expense updated successfully");
      } else {
        await axios.post("/expenses", payload, { headers });
        toast.success("Expense added successfully");
      }
      onSubmit(payload);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save expense");
    }
  };

  const selectedProduct = products.find(
    (p) => p.product_id === selectedProductId,
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editExpense ? "Edit Expense" : "Add Expense"}</h3>
          <button className="close-modal" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Category buttons - always visible */}
          <div className="form-group">
            <label>Category</label>
            <div className="category-buttons">
              {[
                "General",
                "Rent",
                "Transport",
                "Supplier Payment",
                "Waste",
              ].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`category-chip ${category === cat ? "active" : ""}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {category === "Waste" && (
            <>
              <div className="form-group">
                <label>Product</label>
                <button
                  type="button"
                  className="product-select-btn"
                  onClick={() => setShowProductSelector(true)}
                >
                  {selectedProduct
                    ? selectedProduct.product_name
                    : "Select a product"}
                </button>
              </div>
              <div className="form-group">
                <label>Waste Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={wasteQuantity}
                  onChange={(e) => setWasteQuantity(e.target.value)}
                  placeholder="e.g., 5"
                  required={category === "Waste"}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Amount (KES)</label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Payment Method</label>
            <div className="category-buttons">
              {["Cash", "Mpesa", "Bank"].map((method) => (
                <button
                  type="button"
                  key={method}
                  className={`category-chip ${paymentMethod === method ? "active" : ""}`}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              {editExpense ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>

      {showProductSelector && (
        <ProductSelectorModal
          products={products}
          loading={loadingProducts}
          onSelect={(productId) => {
            setSelectedProductId(productId);
            setShowProductSelector(false);
          }}
          onClose={() => setShowProductSelector(false)}
        />
      )}
    </div>
  );
};

export default AddExpenseModal;
