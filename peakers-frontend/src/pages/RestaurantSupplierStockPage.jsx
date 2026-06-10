import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles/RestaurantSupplierStockPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const RestaurantSupplierStockPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [search, setSearch] = useState("");

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    supplier_name: "",
    phone: "",
    email: "",
    address: "",
  });

  const [stockForm, setStockForm] = useState({
    supplier_id: "",
    item_type: "material",
    restaurant_product_id: "",
    raw_material_id: "",
    quantity: "",
    buying_price: "",
    notes: "",
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchMaterials();
    fetchSupplyHistory();
  }, []);

  const fetchSuppliers = () => {
    axios
      .get("/restaurant-suppliers", { withCredentials: true })
      .then((res) => setSuppliers(res.data.suppliers || []))
      .catch(() => toast.error("Error loading suppliers."));
  };

  const fetchProducts = () => {
    axios
      .get("/restaurant-products", { withCredentials: true })
      .then((res) => setProducts(res.data.products || []))
      .catch(() => toast.error("Error loading products."));
  };

  const fetchMaterials = () => {
    axios
      .get("/restaurant-materials", { withCredentials: true })
      .then((res) => setMaterials(res.data.materials || []))
      .catch(() => toast.error("Error loading materials."));
  };

  const fetchSupplyHistory = () => {
    axios
      .get("/restaurant-stock-supply", { withCredentials: true })
      .then((res) => setSupplies(res.data.supplies || []))
      .catch(() => toast.error("Error loading supply history."));
  };

  const filteredSupplies = useMemo(() => {
    return supplies.filter((supply) =>
      `${supply.item_name} ${supply.supplier_name} ${supply.item_type}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [supplies, search]);

  const saveSupplier = async (e) => {
    e.preventDefault();

    if (!supplierForm.supplier_name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }

    try {
      await axios.post("/restaurant-suppliers", supplierForm, {
        withCredentials: true,
      });

      toast.success("Supplier added successfully.");
      setSupplierForm({
        supplier_name: "",
        phone: "",
        email: "",
        address: "",
      });
      setShowSupplierModal(false);
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error adding supplier.");
    }
  };

  const saveStock = async (e) => {
    e.preventDefault();

    if (!stockForm.quantity || Number(stockForm.quantity) <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    if (stockForm.item_type === "product" && !stockForm.restaurant_product_id) {
      toast.error("Select a restaurant product.");
      return;
    }

    if (stockForm.item_type === "material" && !stockForm.raw_material_id) {
      toast.error("Select a raw material.");
      return;
    }

    try {
      await axios.post("/restaurant-stock-supply", stockForm, {
        withCredentials: true,
      });

      toast.success("Stock added successfully.");

      setStockForm({
        supplier_id: "",
        item_type: "material",
        restaurant_product_id: "",
        raw_material_id: "",
        quantity: "",
        buying_price: "",
        notes: "",
      });

      setShowStockModal(false);
      fetchProducts();
      fetchMaterials();
      fetchSupplyHistory();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error adding stock.");
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.header}>
        <div>
          <h1>Restaurant Supplier Stock</h1>
          <p>Add stock for restaurant products and raw materials.</p>
        </div>

        <div className={styles.headerActions}>
          <button onClick={() => setShowSupplierModal(true)}>
            Add Supplier
          </button>
          <button onClick={() => setShowStockModal(true)}>Add Stock</button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Suppliers</span>
          <strong>{suppliers.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Products</span>
          <strong>{products.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Materials</span>
          <strong>{materials.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Supply Records</span>
          <strong>{supplies.length}</strong>
        </div>
      </div>

      <div className={styles.searchBox}>
        <input
          placeholder="Search supply history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Type</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Buying Price</th>
              <th>Total Cost</th>
              <th>Notes</th>
            </tr>
          </thead>

          <tbody>
            {filteredSupplies.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyCell}>
                  No supply records found.
                </td>
              </tr>
            ) : (
              filteredSupplies.map((supply) => (
                <tr key={supply.stock_id}>
                  <td>{new Date(supply.created_at).toLocaleString()}</td>
                  <td>{supply.supplier_name}</td>
                  <td>{supply.item_type}</td>
                  <td>{supply.item_name}</td>
                  <td>{supply.quantity}</td>
                  <td>Ksh {Number(supply.buying_price).toFixed(2)}</td>
                  <td>Ksh {Number(supply.total_cost).toFixed(2)}</td>
                  <td>{supply.notes || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showSupplierModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setShowSupplierModal(false)}
            >
              &times;
            </button>

            <h2>Add Supplier</h2>

            <form onSubmit={saveSupplier} className={styles.form}>
              <input
                placeholder="Supplier name"
                value={supplierForm.supplier_name}
                onChange={(e) =>
                  setSupplierForm({
                    ...supplierForm,
                    supplier_name: e.target.value,
                  })
                }
              />

              <input
                placeholder="Phone"
                value={supplierForm.phone}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, phone: e.target.value })
                }
              />

              <input
                placeholder="Email"
                value={supplierForm.email}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, email: e.target.value })
                }
              />

              <textarea
                placeholder="Address"
                value={supplierForm.address}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, address: e.target.value })
                }
              />

              <button>Add Supplier</button>
            </form>
          </div>
        </div>
      )}

      {showStockModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setShowStockModal(false)}
            >
              ×
            </button>

            <h2>Add Restaurant Stock</h2>

            <form onSubmit={saveStock} className={styles.form}>
              <select
                value={stockForm.supplier_id}
                onChange={(e) =>
                  setStockForm({ ...stockForm, supplier_id: e.target.value })
                }
              >
                <option value="">Select Supplier Optional</option>
                {suppliers.map((supplier) => (
                  <option
                    key={supplier.supplier_id}
                    value={supplier.supplier_id}
                  >
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>

              <select
                value={stockForm.item_type}
                onChange={(e) =>
                  setStockForm({
                    ...stockForm,
                    item_type: e.target.value,
                    restaurant_product_id: "",
                    raw_material_id: "",
                  })
                }
              >
                <option value="material">Raw Material</option>
                <option value="product">Restaurant Product</option>
              </select>

              {stockForm.item_type === "product" && (
                <select
                  value={stockForm.restaurant_product_id}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      restaurant_product_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option
                      key={product.restaurant_product_id}
                      value={product.restaurant_product_id}
                    >
                      {product.product_name} - Stock: {product.product_stock}
                    </option>
                  ))}
                </select>
              )}

              {stockForm.item_type === "material" && (
                <select
                  value={stockForm.raw_material_id}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      raw_material_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select Material</option>
                  {materials.map((material) => (
                    <option
                      key={material.raw_material_id}
                      value={material.raw_material_id}
                    >
                      {material.material_name} - Stock:{" "}
                      {material.stock_quantity} {material.unit}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="number"
                step="0.001"
                placeholder="Quantity"
                value={stockForm.quantity}
                onChange={(e) =>
                  setStockForm({ ...stockForm, quantity: e.target.value })
                }
              />

              <input
                type="number"
                step="0.01"
                placeholder="Buying price per unit"
                value={stockForm.buying_price}
                onChange={(e) =>
                  setStockForm({ ...stockForm, buying_price: e.target.value })
                }
              />

              <textarea
                placeholder="Notes"
                value={stockForm.notes}
                onChange={(e) =>
                  setStockForm({ ...stockForm, notes: e.target.value })
                }
              />

              <button>Add Stock</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantSupplierStockPage;
