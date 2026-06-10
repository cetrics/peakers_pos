import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles/RestaurantProductsPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const emptyProduct = {
  product_name: "",
  product_price: "",
  buying_price: "",
  category_id: "",
  unit: "plate",
  description: "",
  status: "Active",
};

const emptyCategory = {
  category_name: "",
  status: "Active",
};

const emptyMaterial = {
  material_name: "",
  unit: "kg",
  reorder_level: 5,
  status: "Active",
};

const RestaurantProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);

  const [activeSection, setActiveSection] = useState("products");
  const [search, setSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");

  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [materialForm, setMaterialForm] = useState(emptyMaterial);

  const [editingProductId, setEditingProductId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingMaterialId, setEditingMaterialId] = useState(null);

  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  const [recipeProduct, setRecipeProduct] = useState(null);
  const [recipeRows, setRecipeRows] = useState([
    { raw_material_id: "", quantity_required: "" },
  ]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchMaterials();
  }, []);

  const fetchProducts = () => {
    axios
      .get("/restaurant-products", { withCredentials: true })
      .then((res) => setProducts(res.data.products || []))
      .catch(() => toast.error("Error loading restaurant products."));
  };

  const fetchCategories = () => {
    axios
      .get("/restaurant-categories", { withCredentials: true })
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => toast.error("Error loading categories."));
  };

  const fetchMaterials = () => {
    axios
      .get("/restaurant-materials", { withCredentials: true })
      .then((res) => setMaterials(res.data.materials || []))
      .catch(() => toast.error("Error loading materials."));
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      `${product.product_name} ${product.category_name} ${product.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [products, search]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) =>
      `${material.material_name} ${material.unit} ${material.status}`
        .toLowerCase()
        .includes(materialSearch.toLowerCase()),
    );
  }, [materials, materialSearch]);

  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingCategoryId(category.category_id);
      setCategoryForm({
        category_name: category.category_name || "",
        status: category.status || "Active",
      });
    } else {
      setEditingCategoryId(null);
      setCategoryForm(emptyCategory);
    }

    setShowCategoryModal(true);
  };

  const openMaterialModal = (material = null) => {
    if (material) {
      setEditingMaterialId(material.raw_material_id);
      setMaterialForm({
        material_name: material.material_name || "",
        unit: material.unit || "kg",
        reorder_level: material.reorder_level || 5,
        status: material.status || "Active",
      });
    } else {
      setEditingMaterialId(null);
      setMaterialForm(emptyMaterial);
    }

    setShowMaterialModal(true);
  };

  const openProductModal = (product = null) => {
    if (product) {
      setEditingProductId(product.restaurant_product_id);
      setProductForm({
        product_name: product.product_name || "",
        product_price: product.product_price || "",
        buying_price: product.buying_price || "",
        category_id: product.category_id || "",
        unit: product.unit || "plate",
        description: product.description || "",
        status: product.status || "Active",
      });
    } else {
      setEditingProductId(null);
      setProductForm(emptyProduct);
    }

    setShowProductModal(true);
  };

  const saveCategory = async (e) => {
    e.preventDefault();

    if (!categoryForm.category_name.trim()) {
      toast.error("Category name is required.");
      return;
    }

    try {
      if (editingCategoryId) {
        await axios.put(
          `/restaurant-categories/${editingCategoryId}`,
          categoryForm,
          { withCredentials: true },
        );
        toast.success("Category updated.");
      } else {
        await axios.post("/restaurant-categories", categoryForm, {
          withCredentials: true,
        });
        toast.success("Category added.");
      }

      setCategoryForm(emptyCategory);
      setEditingCategoryId(null);
      setShowCategoryModal(false);
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving category.");
    }
  };

  const saveMaterial = async (e) => {
    e.preventDefault();

    if (!materialForm.material_name.trim()) {
      toast.error("Material name is required.");
      return;
    }

    try {
      if (editingMaterialId) {
        await axios.put(
          `/restaurant-materials/${editingMaterialId}`,
          materialForm,
          { withCredentials: true },
        );
        toast.success("Material updated.");
      } else {
        await axios.post("/restaurant-materials", materialForm, {
          withCredentials: true,
        });
        toast.success("Material added.");
      }

      setMaterialForm(emptyMaterial);
      setEditingMaterialId(null);
      setShowMaterialModal(false);
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving material.");
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();

    if (!productForm.product_name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    if (!productForm.product_price) {
      toast.error("Selling price is required.");
      return;
    }

    try {
      if (editingProductId) {
        await axios.put(
          `/restaurant-products/${editingProductId}`,
          productForm,
          { withCredentials: true },
        );
        toast.success("Product updated.");
      } else {
        await axios.post("/restaurant-products", productForm, {
          withCredentials: true,
        });
        toast.success("Product added.");
      }

      setProductForm(emptyProduct);
      setEditingProductId(null);
      setShowProductModal(false);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving product.");
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this restaurant product?")) return;

    try {
      await axios.delete(`/restaurant-products/${id}`, {
        withCredentials: true,
      });
      toast.success("Product deleted.");
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error deleting product.");
    }
  };

  const openRecipeModal = async (product) => {
    setRecipeProduct(product);

    try {
      const res = await axios.get(
        `/restaurant-products/${product.restaurant_product_id}/recipe`,
        { withCredentials: true },
      );

      setRecipeRows(
        res.data.recipe?.length
          ? res.data.recipe.map((row) => ({
              raw_material_id: row.raw_material_id,
              quantity_required: row.quantity_required,
            }))
          : [{ raw_material_id: "", quantity_required: "" }],
      );
    } catch {
      setRecipeRows([{ raw_material_id: "", quantity_required: "" }]);
    }
  };

  const saveRecipe = async () => {
    const cleanRows = recipeRows.filter(
      (row) => row.raw_material_id && row.quantity_required,
    );

    if (!cleanRows.length) {
      toast.error("Add at least one material.");
      return;
    }

    try {
      await axios.post(
        `/restaurant-products/${recipeProduct.restaurant_product_id}/recipe`,
        { recipe: cleanRows },
        { withCredentials: true },
      );

      toast.success("Recipe saved.");
      setRecipeProduct(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving recipe.");
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.header}>
        <div>
          <h1>Restaurant Products</h1>
          <p>Manage menu items, categories, materials, and recipes.</p>
        </div>
      </div>

      <div className={styles.notice}>
        Stock cannot be edited here. Product and material stock should only
        increase through supplier supply records.
      </div>

      <div className={styles.sectionTabs}>
        <button
          className={activeSection === "products" ? styles.activeTab : ""}
          onClick={() => setActiveSection("products")}
        >
          Products
        </button>

        <button
          className={activeSection === "materials" ? styles.activeTab : ""}
          onClick={() => setActiveSection("materials")}
        >
          Materials & Categories
        </button>
      </div>

      {activeSection === "products" && (
        <section className={styles.fullCard}>
          <div className={styles.sectionTop}>
            <h2>Menu Products</h2>

            <div className={styles.topActions}>
              <input
                className={styles.search}
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button onClick={() => openProductModal()}>Add Product</button>
            </div>
          </div>

          <div className={styles.productGrid}>
            {filteredProducts.map((product) => (
              <div
                key={product.restaurant_product_id}
                className={styles.productCard}
              >
                <h3>{product.product_name}</h3>
                <p>Ksh {Number(product.product_price || 0).toFixed(2)}</p>

                <span>
                  Buying Price: Ksh{" "}
                  {Number(product.buying_price || 0).toFixed(2)}
                </span>

                <span>
                  Profit: Ksh{" "}
                  {(
                    Number(product.product_price || 0) -
                    Number(product.buying_price || 0)
                  ).toFixed(2)}
                </span>
                <span>{product.category_name || "No Category"}</span>
                <span>
                  Stock: {Number(product.product_stock || 0)} {product.unit}
                </span>

                <div className={styles.cardActions}>
                  <button onClick={() => openProductModal(product)}>
                    Edit
                  </button>
                  <button onClick={() => openRecipeModal(product)}>
                    Recipe
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteProduct(product.restaurant_product_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "materials" && (
        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardTop}>
              <h2>Categories</h2>
              <button onClick={() => openCategoryModal()}>Add Category</button>
            </div>

            <div className={styles.list}>
              {categories.map((category) => (
                <div key={category.category_id} className={styles.listItem}>
                  <div>
                    <strong>{category.category_name}</strong>
                    <span>{category.status}</span>
                  </div>
                  <button onClick={() => openCategoryModal(category)}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTop}>
              <h2>Raw Materials</h2>
              <button onClick={() => openMaterialModal()}>Add Material</button>
            </div>

            <input
              className={styles.materialSearch}
              placeholder="Search material..."
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
            />

            <div className={styles.list}>
              {filteredMaterials.map((material) => (
                <div key={material.raw_material_id} className={styles.listItem}>
                  <div>
                    <strong>{material.material_name}</strong>
                    <span>
                      Stock: {material.stock_quantity || 0} {material.unit}
                    </span>
                  </div>
                  <button onClick={() => openMaterialModal(material)}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {showCategoryModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setShowCategoryModal(false)}
            >
              ×
            </button>

            <h2>{editingCategoryId ? "Edit Category" : "Add Category"}</h2>

            <form onSubmit={saveCategory} className={styles.modalForm}>
              <input
                placeholder="Category name e.g. Meals"
                value={categoryForm.category_name}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    category_name: e.target.value,
                  })
                }
              />

              <select
                value={categoryForm.status}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, status: e.target.value })
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button>
                {editingCategoryId ? "Update Category" : "Add Category"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showMaterialModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setShowMaterialModal(false)}
            >
              ×
            </button>

            <h2>{editingMaterialId ? "Edit Material" : "Add Material"}</h2>

            <form onSubmit={saveMaterial} className={styles.modalForm}>
              <input
                placeholder="Material e.g. Chicken, Flour, Oil"
                value={materialForm.material_name}
                onChange={(e) =>
                  setMaterialForm({
                    ...materialForm,
                    material_name: e.target.value,
                  })
                }
              />

              <input
                placeholder="Unit e.g. kg, litre, pcs"
                value={materialForm.unit}
                onChange={(e) =>
                  setMaterialForm({ ...materialForm, unit: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Reorder level"
                value={materialForm.reorder_level}
                onChange={(e) =>
                  setMaterialForm({
                    ...materialForm,
                    reorder_level: e.target.value,
                  })
                }
              />

              <select
                value={materialForm.status}
                onChange={(e) =>
                  setMaterialForm({ ...materialForm, status: e.target.value })
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button>
                {editingMaterialId ? "Update Material" : "Add Material"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setShowProductModal(false)}
            >
              ×
            </button>

            <h2>{editingProductId ? "Edit Product" : "Add Product"}</h2>

            <form onSubmit={saveProduct} className={styles.modalForm}>
              <input
                placeholder="Product name e.g. Chicken Ugali"
                value={productForm.product_name}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    product_name: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="Selling price"
                value={productForm.product_price}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    product_price: e.target.value,
                  })
                }
              />
              <input
                type="number"
                placeholder="Buying price"
                value={productForm.buying_price}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    buying_price: e.target.value,
                  })
                }
              />

              <select
                value={productForm.category_id}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    category_id: e.target.value,
                  })
                }
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option
                    key={category.category_id}
                    value={category.category_id}
                  >
                    {category.category_name}
                  </option>
                ))}
              </select>

              <input
                placeholder="Unit e.g. plate, cup, pcs"
                value={productForm.unit}
                onChange={(e) =>
                  setProductForm({ ...productForm, unit: e.target.value })
                }
              />

              <select
                value={productForm.status}
                onChange={(e) =>
                  setProductForm({ ...productForm, status: e.target.value })
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <textarea
                placeholder="Description"
                value={productForm.description}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    description: e.target.value,
                  })
                }
              />

              <button>
                {editingProductId ? "Update Product" : "Add Product"}
              </button>
            </form>
          </div>
        </div>
      )}

      {recipeProduct && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setRecipeProduct(null)}
            >
              ×
            </button>

            <h2>Recipe: {recipeProduct.product_name}</h2>

            {recipeRows.map((row, index) => (
              <div key={index} className={styles.recipeRow}>
                <select
                  value={row.raw_material_id}
                  onChange={(e) => {
                    const copy = [...recipeRows];
                    copy[index].raw_material_id = e.target.value;
                    setRecipeRows(copy);
                  }}
                >
                  <option value="">Select material</option>
                  {materials.map((material) => (
                    <option
                      key={material.raw_material_id}
                      value={material.raw_material_id}
                    >
                      {material.material_name} ({material.unit})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Qty required"
                  value={row.quantity_required}
                  onChange={(e) => {
                    const copy = [...recipeRows];
                    copy[index].quantity_required = e.target.value;
                    setRecipeRows(copy);
                  }}
                />

                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() =>
                    setRecipeRows(recipeRows.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              className={styles.secondaryBtn}
              onClick={() =>
                setRecipeRows([
                  ...recipeRows,
                  { raw_material_id: "", quantity_required: "" },
                ])
              }
            >
              Add Material
            </button>

            <button className={styles.primaryBtn} onClick={saveRecipe}>
              Save Recipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantProductsPage;
