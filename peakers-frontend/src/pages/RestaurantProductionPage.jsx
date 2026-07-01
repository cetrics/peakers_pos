import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/RestaurantProductionPage.css";

const RestaurantProductionPage = () => {
  const [products, setProducts] = useState([]);
  const [productions, setProductions] = useState([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);

  const [historySearch, setHistorySearch] = useState("");

  const [editingProduction, setEditingProduction] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchProductions();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/restaurant/production-products", {
        withCredentials: true,
      });
      setProducts(res.data.products || []);
    } catch {
      toast.error("Error loading products.");
    }
  };

  const fetchProductions = async () => {
    try {
      const res = await axios.get("/restaurant/productions", {
        withCredentials: true,
      });
      setProductions(res.data.productions || []);
    } catch {
      toast.error("Error loading production history.");
    }
  };

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) => String(product.product_id) === String(selectedProductId),
    );
  }, [products, selectedProductId]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim();

    return products.filter((product) =>
      `${product.product_name} ${product.unit || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [products, productSearch]);

  const filteredProductions = useMemo(() => {
    const query = historySearch.toLowerCase().trim();

    if (!query) return productions;

    return productions.filter((production) =>
      `${production.product_name || ""} ${production.quantity_produced || ""} ${
        production.total_cost || ""
      } ${production.unit_cost || ""} ${production.produced_by || ""} ${
        production.created_at || ""
      }`
        .toLowerCase()
        .includes(query),
    );
  }, [productions, historySearch]);

  const recipePreview = useMemo(() => {
    if (!selectedProduct || !quantity) return [];

    const qty = Number(quantity || 0);

    return (selectedProduct.recipe || []).map((item) => ({
      ...item,
      required_quantity: Number(item.quantity_required || 0) * qty,
      total_cost:
        Number(item.quantity_required || 0) * qty * Number(item.unit_cost || 0),
    }));
  }, [selectedProduct, quantity]);

  const totalCost = recipePreview.reduce(
    (sum, item) => sum + Number(item.total_cost || 0),
    0,
  );

  const costPerUnit =
    Number(quantity || 0) > 0 ? totalCost / Number(quantity || 0) : 0;

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.product_id);
    setProductSearch(product.product_name);
    setProductDropdownOpen(false);
  };

  const handleProduce = async (e) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error("Please select a product.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        "/restaurant/produce",
        {
          product_id: selectedProductId,
          quantity_produced: Number(quantity),
        },
        { withCredentials: true },
      );

      toast.success("Production saved successfully.");
      setSelectedProductId("");
      setProductSearch("");
      setQuantity("");
      fetchProducts();
      fetchProductions();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving production.");
    } finally {
      setLoading(false);
    }
  };

  const openEditProduction = (production) => {
    setEditingProduction(production);
    setEditQuantity(production.quantity_produced || "");
  };

  const handleUpdateProduction = async (e) => {
    e.preventDefault();

    if (!editingProduction) return;

    if (!editQuantity || Number(editQuantity) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    try {
      setEditLoading(true);

      await axios.put(
        `/restaurant/productions/${editingProduction.production_id}`,
        {
          quantity_produced: Number(editQuantity),
        },
        { withCredentials: true },
      );

      toast.success("Production updated successfully.");
      setEditingProduction(null);
      setEditQuantity("");
      fetchProducts();
      fetchProductions();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error updating production.");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="production-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="production-header">
        <div>
          <h2>Food Production</h2>
          <p>Produce finished food items from ingredients and recipes.</p>
        </div>

        <button onClick={fetchProductions}>Refresh</button>
      </div>

      <div className="production-layout">
        <form className="production-card" onSubmit={handleProduce}>
          <h3>Produce Batch</h3>

          <label>Product to Produce</label>

          <div className="searchable-select">
            <input
              type="text"
              placeholder="Search and select product..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProductId("");
                setProductDropdownOpen(true);
              }}
              onFocus={() => setProductDropdownOpen(true)}
            />

            {productDropdownOpen && (
              <div className="searchable-options">
                {filteredProducts.length === 0 ? (
                  <div className="searchable-empty">No product found</div>
                ) : (
                  filteredProducts.map((product) => (
                    <button
                      type="button"
                      key={product.product_id}
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.product_name}</span>
                      <small>{product.unit || ""}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <label>Quantity Produced</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onWheel={(e) => e.target.blur()}
          />

          <div className="recipe-preview">
            <h4>Ingredients Required</h4>

            {recipePreview.length === 0 ? (
              <p className="empty-text">Select product and quantity.</p>
            ) : (
              recipePreview.map((item) => (
                <div key={item.raw_material_id} className="recipe-row">
                  <span>{item.material_name}</span>
                  <strong>
                    {item.required_quantity.toFixed(2)} {item.unit || ""}
                  </strong>
                </div>
              ))
            )}
          </div>

          <div className="production-summary">
            <div>
              <span>Total Cost</span>
              <strong>Ksh {totalCost.toFixed(2)}</strong>
            </div>

            <div>
              <span>Cost Per Unit</span>
              <strong>Ksh {costPerUnit.toFixed(2)}</strong>
            </div>
          </div>

          <button className="produce-btn" type="submit" disabled={loading}>
            {loading ? "Producing..." : "Produce Batch"}
          </button>
        </form>

        <div className="production-card history-card">
          <div className="history-top">
            <h3>Production History</h3>

            <input
              type="text"
              placeholder="Search history..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          {filteredProductions.length === 0 ? (
            <p className="empty-text">No production records found.</p>
          ) : (
            <div className="production-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total Cost</th>
                    <th>Unit Cost</th>
                    <th>Produced By</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProductions.map((production) => (
                    <tr key={production.production_id}>
                      <td>{production.created_at}</td>
                      <td>{production.product_name}</td>
                      <td>{production.quantity_produced}</td>
                      <td>
                        Ksh {Number(production.total_cost || 0).toFixed(2)}
                      </td>
                      <td>
                        Ksh {Number(production.unit_cost || 0).toFixed(2)}
                      </td>
                      <td>{production.produced_by || "N/A"}</td>
                      <td>
                        <button
                          type="button"
                          className="edit-production-btn"
                          onClick={() => openEditProduction(production)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingProduction && (
        <div className="production-modal-overlay">
          <div className="production-modal">
            <button
              type="button"
              className="production-modal-close"
              onClick={() => setEditingProduction(null)}
              aria-label="Close"
            >
              &times;
            </button>

            <h3>Edit Production</h3>
            <p>{editingProduction.product_name}</p>

            <form onSubmit={handleUpdateProduction}>
              <label>Quantity Produced</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                onWheel={(e) => e.target.blur()}
              />

              <button type="submit" disabled={editLoading}>
                {editLoading ? "Updating..." : "Update Production"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantProductionPage;
