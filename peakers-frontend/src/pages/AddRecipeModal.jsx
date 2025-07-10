import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/Recipe.css";

const AddRecipeModal = ({ product, onClose, showAlert }) => {
  const [recipe, setRecipe] = useState([]);
  const productId = product?.product_id;

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const res = await axios.get(`/get-recipe/${productId}`);
        setRecipe(res.data.recipe || []);
      } catch (err) {
        console.error("Error fetching recipe:", err);
        showAlert?.("Failed to load recipe", "error");
      }
    };

    fetchRecipe();
  }, [productId, showAlert]);

  const handleQuantityChange = (material_id, inputValue) => {
    let quantity = parseFloat(inputValue);
    if (isNaN(quantity) || quantity < 0) {
      quantity = 0;
    }

    setRecipe((prev) =>
      prev.map((mat) =>
        mat.material_id === material_id ? { ...mat, quantity } : mat
      )
    );
  };

  const handleSaveRecipe = async () => {
    const validMaterials = recipe
      .filter((item) => !isNaN(item.quantity) && item.quantity >= 0)
      .map(({ material_id, quantity }) => ({
        material_id,
        quantity: parseFloat(quantity),
      }));

    if (validMaterials.length === 0) {
      showAlert?.(
        "Please enter at least one valid ingredient quantity.",
        "warning"
      );
      return;
    }

    try {
      await axios.post("/add-recipe", {
        product_id: productId,
        materials: validMaterials,
      });
      showAlert?.("Recipe updated successfully!", "success");
      onClose();
    } catch (err) {
      console.error("Error saving recipe:", err);
      const errorMsg = err.response?.data?.error || "Failed to save recipe";
      showAlert?.(errorMsg, "error");
    }
  };

  return (
    <div className="add-recipe-modal-overlay">
      <div className="add-recipe-modal-container">
        <button className="add-recipe-modal-close" onClick={onClose}>
          &times;
        </button>
        <h3 className="add-recipe-modal-title">
          Update Recipe for: {product?.product_name}
        </h3>

        {recipe.length === 0 ? (
          <p className="add-recipe-modal-empty-msg">
            No ingredients selected for this product.
          </p>
        ) : (
          recipe.map((mat) => (
            <div key={mat.material_id} className="add-recipe-modal-input-row">
              <label className="add-recipe-modal-label">
                {mat.material_name} ({mat.unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mat.quantity}
                onChange={(e) =>
                  handleQuantityChange(mat.material_id, e.target.value)
                }
                className="add-recipe-modal-input"
              />
            </div>
          ))
        )}

        <div className="add-recipe-modal-button-wrapper">
          <button
            className="add-recipe-modal-button"
            onClick={handleSaveRecipe}
          >
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddRecipeModal;
