import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./styles/RestaurantStocktakePage.module.css";

const RestaurantStocktakePage = () => {
  const [items, setItems] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("stocktake");

  useEffect(() => {
    fetchItems();
    fetchAdjustments();
  }, []);

  const fetchItems = () => {
    axios
      .get("/restaurant-stocktake-items", { withCredentials: true })
      .then((res) => {
        const loadedItems = (res.data.items || []).map((item) => ({
          ...item,
          physical_stock: item.system_stock,
          adjustment_reason: "",
        }));

        setItems(loadedItems);
      })
      .catch(() => toast.error("Error loading stocktake items."));
  };

  const fetchAdjustments = () => {
    axios
      .get("/restaurant-stock-adjustments", { withCredentials: true })
      .then((res) => setAdjustments(res.data.adjustments || []))
      .catch(() => toast.error("Error loading adjustments."));
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = `${item.item_name} ${item.item_type} ${item.unit}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "all" ? true : item.item_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  const totals = useMemo(() => {
    if (activeTab === "adjustments") {
      let increases = 0;
      let decreases = 0;

      adjustments.forEach((adjustment) => {
        if (adjustment.adjustment_type === "increase") {
          increases += 1;
        }

        if (adjustment.adjustment_type === "decrease") {
          decreases += 1;
        }
      });

      return {
        counted: adjustments.length,
        variances: adjustments.length,
        increases,
        decreases,
      };
    }

    let counted = 0;
    let variances = 0;
    let increases = 0;
    let decreases = 0;

    items.forEach((item) => {
      const systemStock = Number(item.system_stock || 0);
      const physicalStock = Number(item.physical_stock || 0);
      const difference = physicalStock - systemStock;

      if (item.physical_stock !== "" && item.physical_stock !== null) {
        counted += 1;
      }

      if (difference !== 0) variances += 1;
      if (difference > 0) increases += 1;
      if (difference < 0) decreases += 1;
    });

    return {
      counted,
      variances,
      increases,
      decreases,
    };
  }, [items, adjustments, activeTab]);

  const updateItem = (itemIndex, field, value) => {
    const copy = [...items];
    copy[itemIndex] = {
      ...copy[itemIndex],
      [field]: value,
    };
    setItems(copy);
  };

  const getItemRealIndex = (targetItem) => {
    return items.findIndex(
      (item) =>
        item.item_type === targetItem.item_type &&
        item.item_id === targetItem.item_id,
    );
  };

  const resetPhysicalToSystem = () => {
    setItems(
      items.map((item) => ({
        ...item,
        physical_stock: item.system_stock,
        adjustment_reason: "",
      })),
    );
    toast.info("Physical stock reset to system stock.");
  };

  const saveStocktake = async () => {
    const hasInvalid = items.some(
      (item) =>
        item.physical_stock === "" ||
        item.physical_stock === null ||
        Number(item.physical_stock) < 0,
    );

    if (hasInvalid) {
      toast.error("Physical stock cannot be empty or negative.");
      return;
    }

    try {
      setSaving(true);

      await axios.post(
        "/restaurant-stocktakes",
        {
          notes,
          items,
        },
        { withCredentials: true },
      );

      toast.success("Stocktake saved and stock adjusted successfully.");
      setNotes("");
      fetchItems();
      fetchAdjustments();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving stocktake.");
    } finally {
      setSaving(false);
    }
  };

  const getDifferenceClass = (difference) => {
    if (difference > 0) return styles.positive;
    if (difference < 0) return styles.negative;
    return styles.neutral;
  };

  return (
    <div className={styles.page}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Restaurant Inventory</span>
          <h1>Stocktake & Adjustments</h1>
          <p>
            Count physical stock, compare with system stock, and automatically
            create stock adjustments.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.lightBtn}
            onClick={fetchItems}
          >
            Refresh
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={saveStocktake}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Stocktake"}
          </button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Items Counted</span>
          <strong>{totals.counted}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Variances</span>
          <strong>{totals.variances}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Increases</span>
          <strong>{totals.increases}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Decreases</span>
          <strong>{totals.decreases}</strong>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={activeTab === "stocktake" ? styles.activeTab : ""}
          onClick={() => setActiveTab("stocktake")}
        >
          Stocktake
        </button>

        <button
          type="button"
          className={activeTab === "adjustments" ? styles.activeTab : ""}
          onClick={() => setActiveTab("adjustments")}
        >
          Adjustment History
        </button>
      </div>

      {activeTab === "stocktake" && (
        <>
          <div className={styles.toolbar}>
            <input
              placeholder="Search item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Items</option>
              <option value="product">Products</option>
              <option value="material">Raw Materials</option>
            </select>

            <button type="button" onClick={resetPhysicalToSystem}>
              Reset Count
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={saveStocktake}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Stocktake"}
            </button>
          </div>

          <div className={styles.notesBox}>
            <label>Stocktake Notes</label>
            <textarea
              placeholder="Example: End month stocktake, kitchen count, damaged items review..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>System Stock</th>
                  <th>Physical Stock</th>
                  <th>Difference</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.emptyCell}>
                      No stocktake items found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const realIndex = getItemRealIndex(item);
                    const difference =
                      Number(item.physical_stock || 0) -
                      Number(item.system_stock || 0);

                    return (
                      <tr key={`${item.item_type}-${item.item_id}`}>
                        <td>
                          <div className={styles.itemName}>
                            <strong>{item.item_name}</strong>
                            <span>{item.unit}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`${styles.typeBadge} ${
                              item.item_type === "product"
                                ? styles.productBadge
                                : styles.materialBadge
                            }`}
                          >
                            {item.item_type === "product"
                              ? "Product"
                              : "Material"}
                          </span>
                        </td>

                        <td>
                          {Number(item.system_stock || 0).toLocaleString()}{" "}
                          {item.unit}
                        </td>

                        <td>
                          <input
                            type="number"
                            step="0.001"
                            value={item.physical_stock}
                            onChange={(e) =>
                              updateItem(
                                realIndex,
                                "physical_stock",
                                e.target.value,
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                          />
                        </td>

                        <td>
                          <span
                            className={`${styles.diffBadge} ${getDifferenceClass(
                              difference,
                            )}`}
                          >
                            {difference > 0 ? "+" : ""}
                            {difference.toFixed(3)} {item.unit}
                          </span>
                        </td>

                        <td>
                          <input
                            placeholder="Reason e.g. damage, missing, recount"
                            value={item.adjustment_reason}
                            onChange={(e) =>
                              updateItem(
                                realIndex,
                                "adjustment_reason",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "adjustments" && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Type</th>
                <th>Adjustment</th>
                <th>Old Stock</th>
                <th>New Stock</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.emptyCell}>
                    No stock adjustments yet.
                  </td>
                </tr>
              ) : (
                adjustments.map((adjustment) => (
                  <tr key={adjustment.adjustment_id}>
                    <td>{new Date(adjustment.created_at).toLocaleString()}</td>

                    <td>
                      <strong>{adjustment.item_name}</strong>
                    </td>

                    <td>
                      <span
                        className={`${styles.typeBadge} ${
                          adjustment.item_type === "product"
                            ? styles.productBadge
                            : styles.materialBadge
                        }`}
                      >
                        {adjustment.item_type}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`${styles.diffBadge} ${
                          adjustment.adjustment_type === "increase"
                            ? styles.positive
                            : styles.negative
                        }`}
                      >
                        {adjustment.adjustment_type === "increase" ? "+" : "-"}
                        {Number(adjustment.quantity || 0).toLocaleString()}
                      </span>
                    </td>

                    <td>
                      {Number(adjustment.old_stock || 0).toLocaleString()}
                    </td>
                    <td>
                      {Number(adjustment.new_stock || 0).toLocaleString()}
                    </td>
                    <td>{adjustment.reason || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RestaurantStocktakePage;
