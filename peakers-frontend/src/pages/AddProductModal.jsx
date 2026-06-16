import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/AddProduct.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AddProductModal = ({ onClose, refreshProducts, product }) => {
  const [categories, setCategories] = useState([]);
  const [isBundle, setIsBundle] = useState(false);
  const [products, setProducts] = useState([]);
  const [bundleItems, setBundleItems] = useState([]);
  const [bundleSellingPrice, setBundleSellingPrice] = useState("");
  const isEditing = Boolean(product);
  const isEditingBundle = Boolean(product?.is_bundle);
  const isEditingProduct = isEditing && !product?.is_bundle;

  const [productData, setProductData] = useState({
    product_number: "PRD-0000",
    product_name: "",
    product_price: "",
    buying_price: 0, // ✅ FORCE 0
    product_description: "",
    product_stock: "0",
    category_id_fk: "",
    unit: "",
    expiry_date: "",
    reorder_threshold: 5,
  });

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`/get-categories?_=${Date.now()}`);

        const fetchedCategories = Array.isArray(response.data)
          ? response.data
          : response.data.categories || [];

        setCategories(fetchedCategories);

        console.log("Fetched categories:", fetchedCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error("Failed to fetch categories.", {
          containerId: "product-toast",
        });
      }
    };

    fetchCategories();
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
        reorder_threshold: 5,
      });
    }
  }, [product]);

  useEffect(() => {
    if (!isBundle) return;

    const fetchProducts = async () => {
      try {
        const res = await axios.get("/get-products?page=1");
        setProducts(res.data.products || []);
      } catch (err) {
        console.error("Failed to fetch products", err);
      }
    };

    fetchProducts();
  }, [isBundle]);

  useEffect(() => {
    if (product?.is_bundle) {
      setIsBundle(true);
      setBundleSellingPrice(product.product_price);
      setBundleItems(product.items || []);
    }
  }, [product]);

  useEffect(() => {
    // Only reset when switching to bundle mode AND NOT editing an existing bundle
    if (isBundle && !product?.is_bundle) {
      setBundleItems([]);
      setBundleSellingPrice("");
      setProductData((prev) => ({
        ...prev,
        product_number: "",
        unit: "",
        expiry_date: "",
        reorder_threshold: 5,
      }));
    }
  }, [isBundle, product]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData((prevData) => ({
      ...prevData,
      [name]: name === "reorder_threshold" ? parseInt(value) : value,
    }));
  };

  const handleBundleToggle = (productId) => {
    setBundleItems((prev) =>
      prev.some((item) => item.product_id === productId)
        ? prev.filter((item) => item.product_id !== productId)
        : [...prev, { product_id: productId, quantity: 1 }],
    );
  };

  const updateBundleQty = (productId, qty) => {
    setBundleItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: parseInt(qty) || 1 }
          : item,
      ),
    );
  };

  const handleSaveProduct = async () => {
    try {
      // 1️⃣ BUNDLE FLOW
      if (isBundle) {
        if (bundleItems.length === 0) {
          toast.error("Please select products for the bundle.", {
            containerId: "product-toast",
          });
          return;
        }

        if (bundleItems.length === 1 && Number(bundleItems[0].quantity) === 1) {
          toast.error(
            "A bundle must contain more than one product or quantity greater than 1.",
            {
              containerId: "product-toast",
            },
          );
          return;
        }

        const bundlePayload = {
          bundle_items: bundleItems,
          selling_price: parseFloat(bundleSellingPrice),
        };

        if (product?.is_bundle) {
          await axios.put(
            `/update-bundle/${product.product_id.replace("bundle-", "")}`,
            bundlePayload,
          );
          toast.success("Bundle updated successfully!", {
            containerId: "product-toast",
          });
        } else {
          await axios.post("/add-bundle", bundlePayload);
          toast.success("Bundle added successfully!", {
            containerId: "product-toast",
          });
        }
      }

      // 2️⃣ INDIVIDUAL PRODUCT FLOW (your original logic)
      else {
        const productPayload = {
          ...productData,
          product_price: parseFloat(productData.product_price || 0),
          buying_price: parseFloat(productData.buying_price || 0),
        };

        if (product) {
          await axios.put(
            `/updating-product/${product.product_id}`,
            productPayload,
          );
          toast.success("Product updated successfully!", {
            containerId: "product-toast",
          });
        } else {
          await axios.post("/add-product", productPayload);
          toast.success("Product added successfully!", {
            containerId: "product-toast",
          });
        }
      }

      refreshProducts();
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error saving product";

      toast.error(message, {
        containerId: "product-toast",
      });
    }
  };
  return (
    <div className="add-product-modal-overlay">
      <div className="add-product-modal-container">
        <span className="add-product-modal-close-icon" onClick={onClose}>
          &times;
        </span>
        <h2>
          {isBundle
            ? product
              ? "Edit Bundle"
              : "Add Bundle"
            : product
              ? "Edit Product"
              : "Add Product"}
        </h2>

        {/* Only show bundle checkbox when ADDING a product */}
        {/*
{!isEditing && (
  <label className="checkbox-label right-checkbox">
    <span>This product is a bundle / crate</span>
    <input
      type="checkbox"
      checked={isBundle}
      onChange={(e) => setIsBundle(e.target.checked)}
    />
  </label>
)}
*/}

        {!isBundle && (
          <input
            type="text"
            name="product_number"
            placeholder="Product Number"
            value={productData.product_number}
            onChange={handleInputChange}
          />
        )}
        {!isBundle && (
          <input
            type="text"
            name="product_name"
            placeholder="Product Name"
            value={productData.product_name}
            onChange={handleInputChange}
          />
        )}
        {!isBundle && (
          <input
            type="number"
            name="product_price"
            placeholder="Selling Price"
            value={productData.product_price}
            onChange={handleInputChange}
          />
        )}

        {!isBundle && (
          <input
            type="number"
            name="buying_price"
            placeholder="Buying Price"
            value={productData.buying_price}
            onChange={handleInputChange}
          />
        )}
        {!isBundle && (
          <textarea
            name="product_description"
            placeholder="Description"
            value={productData.product_description}
            onChange={handleInputChange}
          />
        )}
        {!isBundle && (
          <select
            name="unit"
            value={productData.unit}
            onChange={handleInputChange}
          >
            <option value="">Select Unit</option>
            <option value="pcs">Pieces (pcs)</option>
            <option value="bottle">Bottle</option>
            <option value="packet">Packet</option>
            <option value="box">Box</option>
            <option value="crate">Crate</option>
            <option value="plate">Plate</option>
            <option value="cup">Cup</option>
            <option value="kg">Kilogram (kg)</option>
            <option value="g">Gram (g)</option>
            <option value="litre">Litre (L)</option>
            <option value="ml">Millilitre (ml)</option>
            <option value="metre">Metre (m)</option>
          </select>
        )}
        {!isBundle && (
          <input
            type="date"
            name="expiry_date"
            placeholder="Expiry Date"
            value={productData.expiry_date}
            onChange={handleInputChange}
          />
        )}
        {!isBundle && (
          <input
            type="number"
            name="product_stock"
            placeholder="Stock Count"
            value={productData.product_stock}
            disabled
          />
        )}
        {!isBundle && (
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
        )}

        {isBundle && (
          <input
            type="number"
            placeholder="Bundle Selling Price"
            value={bundleSellingPrice}
            onChange={(e) => setBundleSellingPrice(e.target.value)}
          />
        )}

        {isBundle && (
          <div className="bundle-section">
            <h4>Bundle Products</h4>

            {products
              .filter((p) => p.product_id !== product?.product_id)
              .map((p) => (
                <div key={p.product_id}>
                  <label className="checkbox-label right-checkbox">
                    <span>{p.product_name}</span>
                    <input
                      type="checkbox"
                      checked={bundleItems.some(
                        (item) => item.product_id === p.product_id,
                      )}
                      onChange={() => handleBundleToggle(p.product_id)}
                    />
                  </label>

                  {bundleItems.some(
                    (item) => item.product_id === p.product_id,
                  ) && (
                    <input
                      type="number"
                      min="1"
                      value={
                        bundleItems.find(
                          (item) => item.product_id === p.product_id,
                        )?.quantity || 1
                      }
                      onChange={(e) =>
                        updateBundleQty(p.product_id, e.target.value)
                      }
                    />
                  )}
                </div>
              ))}
          </div>
        )}

        <div className="add-product-modal-buttons">
          <button onClick={handleSaveProduct}>
            {isBundle
              ? product
                ? "Update Bundle"
                : "Add Bundle"
              : product
                ? "Update Product"
                : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
