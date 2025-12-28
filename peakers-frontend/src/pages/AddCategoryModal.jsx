import React, { useState } from "react";
import axios from "axios";
import "./styles/AddCategoryModal.css";

const AddCategoryModal = ({ onClose, refreshCategories }) => {
  const [categoryName, setCategoryName] = useState("");
  const [isButtonDisabled, setIsButtonDisabled] = useState(false); // ✅ Track button state

  const handleInputChange = (e) => {
    setCategoryName(e.target.value);
    setIsButtonDisabled(false); // ✅ Re-enable button when user types
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      showAlert("Category name is required.", "error");
      return;
    }

    setIsButtonDisabled(true); // ✅ Disable button on submit

    try {
      await axios.post("/add-category", { category_name: categoryName });

      showAlert("Category added successfully!", "success");

      setTimeout(() => {
        refreshCategories();
        onClose();
      }, 2000);
    } catch (error) {
      showAlert(
        error.response?.data?.error || "Failed to add category.",
        "error"
      );
    }
  };

  // ✅ Show alert and freeze button during error duration
  const showAlert = (message, type) => {
    document.dispatchEvent(
      new CustomEvent("showAlert", {
        detail: { message, type },
      })
    );

    if (type === "error") {
      setIsButtonDisabled(true); // ✅ Keep button disabled during error
      setTimeout(() => {
        setIsButtonDisabled(false); // ✅ Re-enable button after error disappears
      }, 3000);
    }
  };

  return (
    <div className="add-category-modal-overlay">
      <div className="add-category-modal-container">
        <span className="add-category-modal-close" onClick={onClose}>
          &times;
        </span>
        <h2 className="add-category-modal-title">Add Category</h2>

        <input
          type="text"
          name="category_name"
          placeholder="Category Name"
          value={categoryName}
          onChange={handleInputChange}
          className="add-category-modal-input"
        />

        <div className="add-category-modal-button-wrapper">
          <button
            onClick={handleAddCategory}
            disabled={isButtonDisabled}
            className="add-category-modal-button"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCategoryModal;
