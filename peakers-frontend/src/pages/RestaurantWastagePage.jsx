import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./styles/RestaurantWastagePage.module.css";

const emptyForm = {
  item_type: "material",
  item_id: "",
  quantity: "",
  reason: "",
  notes: "",
};

const RestaurantWastagePage = () => {
  const [items, setItems] = useState([]);
  const [wastage, setWastage] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchWastage();
  }, []);

  const fetchItems = () => {
    axios
      .get("/restaurant-wastage-items", { withCredentials: true })
      .then((res) => setItems(res.data.items || []))
      .catch(() => toast.error("Error loading items."));
  };

  const fetchWastage = () => {
    axios
      .get("/restaurant-wastage", { withCredentials: true })
      .then((res) => setWastage(res.data.wastage || []))
      .catch(() => toast.error("Error loading wastage history."));
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.item_type === form.item_type);
  }, [items, form.item_type]);

  const selectedItem = useMemo(() => {
    return items.find(
      (item) =>
        item.item_type === form.item_type &&
        String(item.item_id) === String(form.item_id),
    );
  }, [items, form.item_type, form.item_id]);

  const filteredWastage = useMemo(() => {
    return wastage.filter((row) =>
      `${row.item_name} ${row.item_type} ${row.reason} ${row.notes}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [wastage, search]);

  const totals = useMemo(() => {
    const totalEntries = wastage.length;
    const productEntries = wastage.filter(
      (row) => row.item_type === "product",
    ).length;
    const materialEntries = wastage.filter(
      (row) => row.item_type === "material",
    ).length;

    const totalQty = wastage.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
      0,
    );

    return {
      totalEntries,
      productEntries,
      materialEntries,
      totalQty,
    };
  }, [wastage]);

  const saveWastage = async (e) => {
    e.preventDefault();

    if (!form.item_id) {
      toast.error("Select an item.");
      return;
    }

    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error("Enter a valid wastage quantity.");
      return;
    }

    if (
      selectedItem &&
      Number(form.quantity) > Number(selectedItem.current_stock)
    ) {
      toast.error("Wastage quantity cannot exceed current stock.");
      return;
    }

    try {
      setSaving(true);

      await axios.post("/restaurant-wastage", form, {
        withCredentials: true,
      });

      toast.success("Wastage recorded successfully.");
      setForm(emptyForm);
      fetchItems();
      fetchWastage();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error recording wastage.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Restaurant Inventory</span>
          <h1>Wastage Management</h1>
          <p>
            Record damaged, expired, spilled, missing, or wasted items and
            automatically reduce stock.
          </p>
        </div>

        <button type="button" onClick={fetchWastage}>
          Refresh
        </button>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Total Records</span>
          <strong>{totals.totalEntries}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Product Wastage</span>
          <strong>{totals.productEntries}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Material Wastage</span>
          <strong>{totals.materialEntries}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Total Quantity</span>
          <strong>{totals.totalQty.toFixed(3)}</strong>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <section className={styles.formCard}>
          <h2>Record Wastage</h2>
          <p>Select the wasted item and the quantity to deduct from stock.</p>

          <form onSubmit={saveWastage} className={styles.form}>
            <label>Item Type</label>
            <select
              value={form.item_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  item_type: e.target.value,
                  item_id: "",
                })
              }
            >
              <option value="material">Raw Material</option>
              <option value="product">Product</option>
            </select>

            <label>Item</label>
            <select
              value={form.item_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  item_id: e.target.value,
                })
              }
            >
              <option value="">Select item</option>
              {filteredItems.map((item) => (
                <option
                  key={`${item.item_type}-${item.item_id}`}
                  value={item.item_id}
                >
                  {item.item_name} - Stock: {item.current_stock} {item.unit}
                </option>
              ))}
            </select>

            {selectedItem && (
              <div className={styles.stockPreview}>
                <span>Current Stock</span>
                <strong>
                  {Number(selectedItem.current_stock || 0).toLocaleString()}{" "}
                  {selectedItem.unit}
                </strong>
              </div>
            )}

            <label>Wastage Quantity</label>
            <input
              type="number"
              step="0.001"
              placeholder="Enter quantity wasted"
              value={form.quantity}
              onChange={(e) =>
                setForm({
                  ...form,
                  quantity: e.target.value,
                })
              }
              onWheel={(e) => e.currentTarget.blur()}
            />

            <label>Reason</label>
            <select
              value={form.reason}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason: e.target.value,
                })
              }
            >
              <option value="">Select reason</option>
              <option value="Damaged">Damaged</option>
              <option value="Expired">Expired</option>
              <option value="Spillage">Spillage</option>
              <option value="Burnt">Burnt</option>
              <option value="Missing">Missing</option>
              <option value="Overproduction">Overproduction</option>
              <option value="Wrong preparation">Wrong preparation</option>
              <option value="Other">Other</option>
            </select>

            <label>Notes</label>
            <textarea
              placeholder="Optional note..."
              value={form.notes}
              onChange={(e) =>
                setForm({
                  ...form,
                  notes: e.target.value,
                })
              }
            />

            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Record Wastage"}
            </button>
          </form>
        </section>

        <section className={styles.historyCard}>
          <div className={styles.historyTop}>
            <div>
              <h2>Wastage History</h2>
              <p>Track all recorded wastage deductions.</p>
            </div>

            <input
              placeholder="Search wastage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Stock</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {filteredWastage.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.emptyCell}>
                      No wastage records found.
                    </td>
                  </tr>
                ) : (
                  filteredWastage.map((row) => (
                    <tr key={row.wastage_id}>
                      <td>{new Date(row.created_at).toLocaleString()}</td>

                      <td>
                        <strong>{row.item_name}</strong>
                        {row.notes && <span>{row.notes}</span>}
                      </td>

                      <td>
                        <span
                          className={`${styles.typeBadge} ${
                            row.item_type === "product"
                              ? styles.productBadge
                              : styles.materialBadge
                          }`}
                        >
                          {row.item_type}
                        </span>
                      </td>

                      <td>
                        <span className={styles.qtyBadge}>
                          -{Number(row.quantity || 0).toLocaleString()}{" "}
                          {row.unit}
                        </span>
                      </td>

                      <td>
                        {Number(row.old_stock || 0).toLocaleString()} →{" "}
                        {Number(row.new_stock || 0).toLocaleString()}
                      </td>

                      <td>{row.reason || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RestaurantWastagePage;
