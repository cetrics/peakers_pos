import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/AddProduct.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AddProductModal = ({ onClose, refreshProducts, product }) => {
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  const [productData, setProductData] = useState({
    product_number: "",
    product_name: "",
    product_price: "",
    buying_price: "",
    product_description: "",
    product_stock: "0",
    category_id_fk: "",
    unit: "",
    expiry_date: "",
    reorder_threshold: 0,
  });

  // Fetch categories and materials
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`/get-categories?_=${Date.now()}`);
        setCategories(response.data.categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    const fetchMaterials = async () => {
      try {
        const res = await axios.get("/get-materials");
        setMaterials(res.data.materials);
      } catch (err) {
        console.error("Failed to fetch materials", err);
      }
    };

    fetchCategories();
    fetchMaterials();
  }, []);

  // Populate form if editing
  useEffect(() => {
    if (product) {
      console.log("Editing product:", product); // debug log

      setProductData({
        product_number: product.product_number || "",
        product_name: product.product_name || "",
        product_price: product.product_price || "",
        buying_price: product.buying_price || "",
        product_description: product.product_description || "",
        product_stock: product.product_stock?.toString() || "0",
        category_id_fk: product.category_id_fk?.toString() || "",
        unit: product.unit || "",
        expiry_date: product.expiry_date
          ? String(product.expiry_date).slice(0, 10)
          : "",
        reorder_threshold: product.reorder_threshold || 0,
      });
    }
  }, [product]);

  // Fetch product ingredients when editing
  useEffect(() => {
    const fetchProductIngredients = async () => {
      if (product && product.product_id) {
        try {
          const res = await axios.get(
            `/get-product-ingredients/${product.product_id}`
          );
          const ingredientIds = res.data.ingredients.map(
            (ing) => ing.material_id
          );
          setSelectedMaterials(ingredientIds);
        } catch (error) {
          console.error("Failed to fetch product ingredients", error);
        }
      }
    };

    fetchProductIngredients();
  }, [product]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData((prevData) => ({
      ...prevData,
      [name]: name === "reorder_threshold" ? parseInt(value) : value,
    }));
  };

  const handleMaterialToggle = (material_id) => {
    setSelectedMaterials((prev) =>
      prev.includes(material_id)
        ? prev.filter((id) => id !== material_id)
        : [...prev, material_id]
    );
  };

  const handleSaveProduct = async () => {
    try {
      const payload = {
        ...productData,
        product_price: parseFloat(productData.product_price),
        buying_price: parseFloat(productData.buying_price),
        ingredients: selectedMaterials,
      };

      if (product) {
        await axios.put(`/updating-product/${product.product_id}`, payload);
        toast.success("Product updated successfully!", {
          containerId: "product-toast",
        });
      } else {
        await axios.post("/add-product", payload);
        toast.success("Product added successfully!", {
          containerId: "product-toast",
        });
      }

      refreshProducts();
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Error saving product!", { containerId: "product-toast" });
    }
  };

  return (
    <div className="add-product-modal-overlay">
      <div className="add-product-modal-container">
        <span className="add-product-modal-close-icon" onClick={onClose}>
          &times;
        </span>
        <h2>{product ? "Edit Product" : "Add Product"}</h2>

        <input
          type="text"
          name="product_number"
          placeholder="Product Number"
          value={productData.product_number}
          onChange={handleInputChange}
        />
        <input
          type="text"
          name="product_name"
          placeholder="Product Name"
          value={productData.product_name}
          onChange={handleInputChange}
        />
        <input
          type="number"
          name="buying_price"
          placeholder="Buying Price"
          value={productData.buying_price}
          onChange={handleInputChange}
        />
        <input
          type="number"
          name="product_price"
          placeholder="Selling Price"
          value={productData.product_price}
          onChange={handleInputChange}
        />
        <textarea
          name="product_description"
          placeholder="Description"
          value={productData.product_description}
          onChange={handleInputChange}
        />

        {!product && (
          <input
            type="text"
            name="unit"
            placeholder="Unit (e.g. kg, pcs)"
            value={productData.unit}
            onChange={handleInputChange}
          />
        )}

        <input
          type="date"
          name="expiry_date"
          placeholder="Expiry Date"
          value={productData.expiry_date}
          onChange={handleInputChange}
        />
        <input
          type="number"
          name="reorder_threshold"
          placeholder="Reorder Threshold"
          value={productData.reorder_threshold}
          onChange={handleInputChange}
        />
        <input
          type="number"
          name="product_stock"
          placeholder="Stock Count"
          value={productData.product_stock}
          disabled
        />

        <select
          name="category_id_fk"
          value={productData.category_id_fk}
          onChange={handleInputChange}
        >
          <option value="">Select Category</option>
          {categories.map((category) => (
            <option
              key={category.category_id}
              value={String(category.category_id)}
            >
              {category.category_name}
            </option>
          ))}
        </select>

        {/* Material selection */}
        <div className="add-product-modal-material-selection">
          <label>
            <strong>Materials (optional)</strong>
          </label>
          {materials.length === 0 ? (
            <p>Loading materials...</p>
          ) : (
            materials.map((mat) => (
              <div key={mat.material_id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(mat.material_id)}
                    onChange={() => handleMaterialToggle(mat.material_id)}
                  />
                  {mat.material_name} ({mat.unit})
                </label>
              </div>
            ))
          )}
        </div>

        <div className="add-product-modal-buttons">
          <button onClick={handleSaveProduct}>
            {product ? "Update Product" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
