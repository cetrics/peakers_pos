import { useEffect, useState } from "react";
import axios from "axios";
import styles from "./styles/RestaurantSetupPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const RestaurantSetupPage = () => {
  const [tables, setTables] = useState([]);
  const [addons, setAddons] = useState([]);
  const [tableSearch, setTableSearch] = useState("");
  const [addonSearch, setAddonSearch] = useState("");
  const [recipeAddon, setRecipeAddon] = useState(null);
  const [addonRecipeRows, setAddonRecipeRows] = useState([
    { raw_material_id: "", quantity_required: "" },
  ]);
  const [materials, setMaterials] = useState([]);

  const [tableForm, setTableForm] = useState({
    table_name: "",
    capacity: 4,
    status: "Available",
  });

  const [addonForm, setAddonForm] = useState({
    addon_name: "",
    addon_price: "",
    status: "Active",
  });

  const [editingTableId, setEditingTableId] = useState(null);
  const [editingAddonId, setEditingAddonId] = useState(null);

  useEffect(() => {
    fetchTables();
    fetchAddons();
    fetchMaterials();
  }, []);

  const fetchTables = () => {
    axios
      .get("/restaurant-tables", { withCredentials: true })
      .then((res) => setTables(res.data.tables || []))
      .catch(() => toast.error("Error loading tables."));
  };

  const fetchAddons = () => {
    axios
      .get("/restaurant-addons", { withCredentials: true })
      .then((res) => setAddons(res.data.addons || []))
      .catch(() => toast.error("Error loading add-ons."));
  };

  const resetTableForm = () => {
    setTableForm({
      table_name: "",
      capacity: 4,
      status: "Available",
    });
    setEditingTableId(null);
  };

  const resetAddonForm = () => {
    setAddonForm({
      addon_name: "",
      addon_price: "",
      status: "Active",
    });
    setEditingAddonId(null);
  };

  const saveTable = async (e) => {
    e.preventDefault();

    if (!tableForm.table_name.trim()) {
      toast.error("Table name is required.");
      return;
    }

    try {
      if (editingTableId) {
        await axios.put(`/restaurant-tables/${editingTableId}`, tableForm, {
          withCredentials: true,
        });
        toast.success("Table updated successfully.");
      } else {
        await axios.post("/restaurant-tables", tableForm, {
          withCredentials: true,
        });
        toast.success("Table added successfully.");
      }

      resetTableForm();
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving table.");
    }
  };

  const saveAddon = async (e) => {
    e.preventDefault();

    if (!addonForm.addon_name.trim()) {
      toast.error("Add-on name is required.");
      return;
    }

    try {
      if (editingAddonId) {
        await axios.put(`/restaurant-addons/${editingAddonId}`, addonForm, {
          withCredentials: true,
        });
        toast.success("Add-on updated successfully.");
      } else {
        await axios.post("/restaurant-addons", addonForm, {
          withCredentials: true,
        });
        toast.success("Add-on added successfully.");
      }

      resetAddonForm();
      fetchAddons();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving add-on.");
    }
  };

  const editTable = (table) => {
    setEditingTableId(table.table_id);
    setTableForm({
      table_name: table.table_name || "",
      capacity: table.capacity || 4,
      status: table.status || "Available",
    });
  };

  const editAddon = (addon) => {
    setEditingAddonId(addon.addon_id);
    setAddonForm({
      addon_name: addon.addon_name || "",
      addon_price: addon.addon_price || "",
      status: addon.status || "Active",
    });
  };

  const deleteTable = async (tableId) => {
    if (!window.confirm("Delete this table?")) return;

    try {
      await axios.delete(`/restaurant-tables/${tableId}`, {
        withCredentials: true,
      });
      toast.success("Table deleted successfully.");
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error deleting table.");
    }
  };

  const deleteAddon = async (addonId) => {
    if (!window.confirm("Delete this add-on?")) return;

    try {
      await axios.delete(`/restaurant-addons/${addonId}`, {
        withCredentials: true,
      });
      toast.success("Add-on deleted successfully.");
      fetchAddons();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error deleting add-on.");
    }
  };
  const filteredTables = tables.filter((table) =>
    `${table.table_name} ${table.capacity} ${table.status}`
      .toLowerCase()
      .includes(tableSearch.toLowerCase()),
  );

  const filteredAddons = addons.filter((addon) =>
    `${addon.addon_name} ${addon.addon_price} ${addon.status}`
      .toLowerCase()
      .includes(addonSearch.toLowerCase()),
  );

  const fetchMaterials = () => {
    axios
      .get("/restaurant-materials", { withCredentials: true })
      .then((res) => setMaterials(res.data.materials || []))
      .catch(() => toast.error("Error loading materials."));
  };

  const openAddonRecipeModal = async (addon) => {
    setRecipeAddon(addon);

    try {
      const res = await axios.get(
        `/restaurant-addons/${addon.addon_id}/recipe`,
        {
          withCredentials: true,
        },
      );

      setAddonRecipeRows(
        res.data.recipe?.length
          ? res.data.recipe.map((row) => ({
              raw_material_id: row.raw_material_id,
              quantity_required: row.quantity_required,
            }))
          : [{ raw_material_id: "", quantity_required: "" }],
      );
    } catch {
      setAddonRecipeRows([{ raw_material_id: "", quantity_required: "" }]);
    }
  };

  const saveAddonRecipe = async () => {
    const cleanRows = addonRecipeRows.filter(
      (row) => row.raw_material_id && row.quantity_required,
    );

    if (!cleanRows.length) {
      toast.error("Add at least one material.");
      return;
    }

    try {
      await axios.post(
        `/restaurant-addons/${recipeAddon.addon_id}/recipe`,
        { recipe: cleanRows },
        { withCredentials: true },
      );

      toast.success("Add-on recipe saved.");
      setRecipeAddon(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving add-on recipe.");
    }
  };

  return (
    <div className={styles.setupPage}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.pageHeader}>
        <div>
          <h1>Restaurant Setup</h1>
          <p>Manage restaurant tables and food add-ons.</p>
        </div>
      </div>

      <div className={styles.setupGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Restaurant Tables</h2>
            <span>{tables.length} Tables</span>
          </div>
          <input
            type="text"
            placeholder="Search tables..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className={styles.searchInput}
          />

          <form className={styles.form} onSubmit={saveTable}>
            <input
              type="text"
              placeholder="Table name e.g. Table 1, VIP A"
              value={tableForm.table_name}
              onChange={(e) =>
                setTableForm({ ...tableForm, table_name: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Capacity"
              value={tableForm.capacity}
              onChange={(e) =>
                setTableForm({ ...tableForm, capacity: e.target.value })
              }
            />

            <select
              value={tableForm.status}
              onChange={(e) =>
                setTableForm({ ...tableForm, status: e.target.value })
              }
            >
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Reserved">Reserved</option>
            </select>

            <div className={styles.formActions}>
              <button type="submit">
                {editingTableId ? "Update Table" : "Add Table"}
              </button>

              {editingTableId && (
                <button type="button" onClick={resetTableForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className={styles.list}>
            {tables.length === 0 ? (
              <p className={styles.empty}>No tables added yet.</p>
            ) : (
              filteredTables.map((table) => (
                <div key={table.table_id} className={styles.listItem}>
                  <div>
                    <strong>{table.table_name}</strong>
                    <span>
                      Capacity: {table.capacity} • {table.status}
                    </span>
                  </div>

                  <div className={styles.itemActions}>
                    <button onClick={() => editTable(table)}>Edit</button>

                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteTable(table.table_id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Restaurant Add-ons</h2>
            <span>{addons.length} Add-ons</span>
          </div>
          <input
            type="text"
            placeholder="Search add-ons..."
            value={addonSearch}
            onChange={(e) => setAddonSearch(e.target.value)}
            className={styles.searchInput}
          />

          <form className={styles.form} onSubmit={saveAddon}>
            <input
              type="text"
              placeholder="Add-on name e.g. Ugali, Vegetables"
              value={addonForm.addon_name}
              onChange={(e) =>
                setAddonForm({ ...addonForm, addon_name: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Price"
              value={addonForm.addon_price}
              onChange={(e) =>
                setAddonForm({ ...addonForm, addon_price: e.target.value })
              }
            />

            <select
              value={addonForm.status}
              onChange={(e) =>
                setAddonForm({ ...addonForm, status: e.target.value })
              }
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <div className={styles.formActions}>
              <button type="submit">
                {editingAddonId ? "Update Add-on" : "Add Add-on"}
              </button>

              {editingAddonId && (
                <button type="button" onClick={resetAddonForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className={styles.list}>
            {addons.length === 0 ? (
              <p className={styles.empty}>No add-ons added yet.</p>
            ) : (
              filteredAddons.map((addon) => (
                <div key={addon.addon_id} className={styles.listItem}>
                  <div>
                    <strong>{addon.addon_name}</strong>
                    <span>
                      Ksh {Number(addon.addon_price || 0).toFixed(2)} •{" "}
                      {addon.status}
                    </span>
                  </div>

                  <div className={styles.itemActions}>
                    <button onClick={() => editAddon(addon)}>Edit</button>

                    <button onClick={() => openAddonRecipeModal(addon)}>
                      Recipe
                    </button>

                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteAddon(addon.addon_id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      {recipeAddon && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setRecipeAddon(null)}
            >
              ×
            </button>

            <h2>Recipe: {recipeAddon.addon_name}</h2>

            {addonRecipeRows.map((row, index) => (
              <div key={index} className={styles.recipeRow}>
                <select
                  value={row.raw_material_id}
                  onChange={(e) => {
                    const copy = [...addonRecipeRows];
                    copy[index].raw_material_id = e.target.value;
                    setAddonRecipeRows(copy);
                  }}
                >
                  <option value="">Select Material</option>
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
                  placeholder="Quantity"
                  value={row.quantity_required}
                  onChange={(e) => {
                    const copy = [...addonRecipeRows];
                    copy[index].quantity_required = e.target.value;
                    setAddonRecipeRows(copy);
                  }}
                />

                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() =>
                    setAddonRecipeRows(
                      addonRecipeRows.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              className={styles.secondaryBtn}
              onClick={() =>
                setAddonRecipeRows([
                  ...addonRecipeRows,
                  { raw_material_id: "", quantity_required: "" },
                ])
              }
            >
              Add Material
            </button>

            <button className={styles.primaryBtn} onClick={saveAddonRecipe}>
              Save Recipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantSetupPage;
