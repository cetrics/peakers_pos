import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./styles/RestaurantSalesPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const categories = [
  "Meals",
  "Breakfast",
  "Snacks",
  "Drinks",
  "Soups",
  "Desserts",
];
const orderTypes = ["Dine In", "Take Away", "Delivery"];

const RestaurantSalesPage = () => {
  const navigate = useNavigate();

  const [restaurantStats, setRestaurantStats] = useState({
    pendingKitchen: 0,
    heldOrders: 0,
    lastOrder: null,
  });
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [tables, setTables] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Meals");
  const [orderType, setOrderType] = useState("Dine In");
  const [selectedTable, setSelectedTable] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [discount, setDiscount] = useState(0);
  const vatRate = 0;
  const [addons, setAddons] = useState([]);
  const [addonModal, setAddonModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchRestaurantTables();
    fetchRestaurantStats();
    fetchRestaurantAddons();

    axios
      .get("/check-session", { withCredentials: true })
      .then((res) => {
        setLoggedInUserId(res.data.user_id);
        setWaiterName(res.data.username || res.data.user || "Logged User");
      })
      .catch(() => toast.error("Session error. Please login again."));
  }, []);

  const fetchProducts = () => {
    axios
      .get("/restaurant-products", { withCredentials: true })
      .then((res) => setProducts(res.data.products || []))
      .catch(() => toast.error("Error loading restaurant products."));
  };

  const fetchCustomers = () => {
    axios
      .get(`/get-sales-customers?t=${Date.now()}`)
      .then((res) => setCustomers(res.data.customers || []))
      .catch(() => toast.error("Error loading customers."));
  };

  const fetchRestaurantTables = () => {
    axios
      .get("/restaurant-tables")
      .then((res) => {
        setTables(res.data.tables || []);
      })
      .catch(() => toast.error("Error loading tables."));
  };
  const fetchRestaurantAddons = () => {
    axios
      .get("/restaurant-addons", { withCredentials: true })
      .then((res) => setAddons(res.data.addons || []))
      .catch(() => toast.error("Error loading add-ons."));
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const name = product.product_name?.toLowerCase() || "";
      const category = product.category || product.category_name || "Meals";

      const matchesSearch =
        !searchTerm ||
        name.includes(searchTerm.toLowerCase()) ||
        String(product.product_id).includes(searchTerm);

      const matchesCategory =
        activeCategory === "All" ||
        category === activeCategory ||
        !product.category;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.subtotal || 0),
    0,
  );
  const vat = subtotal * vatRate;
  const total = subtotal + vat - Number(discount || 0);

  const addToCart = (product) => {
    const stock = Number(product.product_stock) || 0;
    const price = Number(product.product_price) || 0;

    if (stock <= 0) {
      toast.error("This item is out of stock.");
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.product_id,
    );

    if (existing) {
      const newQty = Number(existing.quantity) + 1;

      if (newQty > stock) {
        toast.error(`Only ${stock} available in stock.`);
        return;
      }

      setCart(
        cart.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: newQty, subtotal: newQty * price }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          subtotal: price,
          addons: [],
        },
      ]);
    }
  };

  const removeFromCart = (cartItemId) => {
    setCart(cart.filter((item) => item.cart_item_id !== cartItemId));
  };

  const buildRestaurantPayload = () => ({
    customer_id: selectedCustomer?.id || null,
    payment_type: paymentType,
    user_id: loggedInUserId,
    cart_items: cart.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      subtotal: Number(item.subtotal),
      is_bundle: !!item.is_bundle,
      addons: item.addons || [],
    })),
    vat,
    discount: Number(discount || 0),
    order_type: orderType,
    table_name: orderType === "Dine In" ? selectedTable : null,
    waiter_name: waiterName,
  });

  const resetRestaurantCart = () => {
    setCart([]);
    setDiscount(0);
    setSelectedCustomer(null);
    setSelectedTable("");
    fetchProducts();
    fetchRestaurantTables();
    fetchRestaurantStats();
  };

  const validateRestaurantOrder = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return false;
    }

    if (!loggedInUserId) {
      toast.error("User not logged in.");
      return false;
    }

    if (orderType === "Dine In" && !selectedTable) {
      toast.error("Please select a table.");
      return false;
    }

    return true;
  };

  const sendToKitchen = async () => {
    if (!validateRestaurantOrder()) return;

    try {
      const payload = buildRestaurantPayload();

      const res = await axios.post("/restaurant/send-to-kitchen", payload, {
        withCredentials: true,
      });

      toast.success(`Order sent to kitchen. ${res.data.order_number}`);
      resetRestaurantCart();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Error sending order to kitchen.",
      );
    }
  };

  const holdOrder = async () => {
    if (!validateRestaurantOrder()) return;

    try {
      const payload = buildRestaurantPayload();

      const res = await axios.post("/restaurant/hold-order", payload, {
        withCredentials: true,
      });

      toast.success(`Order held successfully. ${res.data.order_number}`);
      resetRestaurantCart();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Error holding order.",
      );
    }
  };

  const checkout = async () => {
    if (!validateRestaurantOrder()) return;

    try {
      const payload = buildRestaurantPayload();

      const res = await axios.post("/restaurant/checkout", payload, {
        withCredentials: true,
      });

      toast.success(`Checkout successful. ${res.data.order_number}`);
      resetRestaurantCart();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Error checking out.",
      );
    }
  };

  const fetchRestaurantStats = () => {
    axios
      .get("/restaurant/orders", {
        withCredentials: true,
        params: {
          view: "all",
          payment_type: "all",
          status: "all",
        },
      })
      .then((res) => {
        const orders = res.data.orders || [];

        const pendingKitchen = orders.filter((order) =>
          ["pending", "preparing", "ready"].includes(order.kitchen_status),
        ).length;

        const heldOrders = orders.filter(
          (order) => order.order_status === "held",
        ).length;

        const lastOrder = orders[0] || null;

        setRestaurantStats({
          pendingKitchen,
          heldOrders,
          lastOrder,
        });
      })
      .catch(() => toast.error("Error loading restaurant stats."));
  };

  const addProductWithAddonsToCart = () => {
    if (!selectedProduct) return;

    const stock = Number(selectedProduct.product_stock) || 0;
    const price = Number(selectedProduct.product_price) || 0;

    if (stock <= 0) {
      toast.error("This item is out of stock.");
      return;
    }

    const addonsTotal = selectedAddons.reduce(
      (sum, addon) => sum + Number(addon.addon_price || 0),
      0,
    );

    const cartItemId = `${selectedProduct.product_id}-${Date.now()}`;

    const newItem = {
      ...selectedProduct,
      cart_item_id: cartItemId,
      quantity: 1,
      base_price: price,
      addons: selectedAddons,
      subtotal: price + addonsTotal,
    };

    setCart([...cart, newItem]);
    setAddonModal(false);
    setSelectedProduct(null);
    setSelectedAddons([]);
  };

  return (
    <div className={styles.restaurantPage}>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className={styles.mainGrid}>
        <aside className={styles.cartPanel}>
          <label>Order Type</label>
          <div className={styles.orderButtons}>
            {orderTypes.map((type) => (
              <button
                key={type}
                className={orderType === type ? styles.activeGreen : ""}
                onClick={() => setOrderType(type)}
              >
                {type === "Dine In" && <i className="fas fa-utensils"></i>}
                {type === "Take Away" && (
                  <i className="fas fa-shopping-bag"></i>
                )}
                {type === "Delivery" && <i className="fas fa-truck"></i>}
                {type}
              </button>
            ))}
          </div>

          <div className={styles.selectRow}>
            <div>
              <label>Table</label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                <option value="">Select Table</option>

                {tables.map((table) => (
                  <option key={table.table_id} value={table.table_name}>
                    {table.table_name} ({table.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Waiter</label>
              <div className={styles.waiterBox}>
                <i className="fas fa-user"></i>
                <span>{waiterName || "Logged User"}</span>
              </div>
            </div>
          </div>

          <div className={styles.cartTitle}>
            <h3>
              <i className="fas fa-shopping-cart"></i> Cart
            </h3>

            <button onClick={() => setCustomerModal(true)}>
              Select Customer
            </button>
          </div>

          {selectedCustomer && (
            <div className={styles.selectedCustomerCard}>
              <strong>Customer:</strong> {selectedCustomer.name}
              {selectedCustomer.phone && (
                <span> • {selectedCustomer.phone}</span>
              )}
            </div>
          )}

          <div className={styles.cartTable}>
            <div className={styles.cartHead}>
              <span>Item</span>
              <span>Qty</span>
              <span>Price</span>
              <span></span>
            </div>

            {cart.map((item) => (
              <div className={styles.cartItem} key={item.cart_item_id}>
                <strong>{item.product_name}</strong>
                {item.addons && item.addons.length > 0 && (
                  <div className={styles.cartAddons}>
                    {item.addons.map((addon) => (
                      <small key={addon.addon_id}>
                        + {addon.addon_name} - Ksh{" "}
                        {Number(addon.addon_price).toFixed(2)}
                      </small>
                    ))}
                  </div>
                )}
                <span>{item.quantity}</span>
                <span>Ksh {Number(item.subtotal).toFixed(2)}</span>
                <button onClick={() => removeFromCart(item.cart_item_id)}>
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
          </div>

          <div className={styles.totals}>
            <p>
              <span>Subtotal</span>
              <strong>Ksh {subtotal.toFixed(2)}</strong>
            </p>
            <p>
              <span>Discount (Ksh):</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </p>
            <p>
              <span>VAT (0%):</span>
              <strong>Ksh {vat.toFixed(2)}</strong>
            </p>
            <h3>
              <span>Total:</span>
              <strong>Ksh {total.toFixed(2)}</strong>
            </h3>
          </div>

          <select
            className={styles.paymentSelect}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="Cash">Cash</option>
            <option value="Mpesa">Mpesa</option>
            <option value="Bank">Bank</option>
            <option value="Credit">Credit</option>
          </select>

          <button className={styles.kitchenBtn} onClick={sendToKitchen}>
            <i className="fas fa-paper-plane"></i> Send to Kitchen
          </button>

          <div className={styles.actionRow}>
            <button className={styles.checkoutBtn} onClick={checkout}>
              <i className="fas fa-check"></i> Checkout
            </button>
            <button className={styles.holdBtn} onClick={holdOrder}>
              <i className="fas fa-pause"></i> Hold Order
            </button>
          </div>
        </aside>

        <section className={styles.menuPanel}>
          <div className={styles.filters}>
            <strong>Order Type:</strong>
            {orderTypes.map((type) => (
              <button
                key={type}
                className={orderType === type ? styles.activeGreen : ""}
                onClick={() => setOrderType(type)}
              >
                {type}
              </button>
            ))}

            <span className={styles.divider}></span>

            <strong>Tables:</strong>
            {tables.map((table) => (
              <button
                key={table.table_id}
                className={
                  selectedTable === table.table_name ? styles.activeGreen : ""
                }
                onClick={() => setSelectedTable(table.table_name)}
              >
                {table.table_name}
              </button>
            ))}
          </div>

          <div className={styles.searchBar}>
            <i className="fas fa-search"></i>

            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.categoryRow}>
            <strong>Categories:</strong>
            {categories.map((cat) => (
              <button
                key={cat}
                className={activeCategory === cat ? styles.activeGreen : ""}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.productGrid}>
            {filteredProducts.map((product) => (
              <div className={styles.productCard} key={product.product_id}>
                <div className={styles.foodImage}>
                  {product.product_image ? (
                    <img
                      src={`/static/uploads/${product.product_image}`}
                      alt={product.product_name}
                    />
                  ) : (
                    <i className="fas fa-utensils"></i>
                  )}
                </div>

                <h4>{product.product_name}</h4>
                <p>Ksh {Number(product.product_price).toFixed(2)}</p>
                <span>Stock: {product.product_stock}</span>

                <button
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedAddons([]);
                    setAddonModal(true);
                  }}
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.bottomCards}>
        <div className={styles.statusCard}>
          <strong>Kitchen Status</strong>
          <span>{restaurantStats.pendingKitchen} Orders Pending</span>
          <button onClick={() => navigate("/restaurant-kitchen")}>
            View Kitchen
          </button>
        </div>

        <div className={styles.heldCard}>
          <strong>Held Orders</strong>
          <span>{restaurantStats.heldOrders} Orders Held</span>
          <button onClick={() => navigate("/restaurant-orders?status=held")}>
            View Held Orders
          </button>
        </div>

        <div className={styles.lastCard}>
          <strong>Last Order</strong>
          <span>
            {restaurantStats.lastOrder
              ? `${restaurantStats.lastOrder.table_name || restaurantStats.lastOrder.order_type} • Ksh ${Number(
                  restaurantStats.lastOrder.total_price || 0,
                ).toFixed(2)}`
              : "No orders yet"}
          </span>
          <button onClick={() => navigate("/restaurant-orders")}>
            View Orders
          </button>
        </div>
      </div>
      {customerModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeBtn}
              onClick={() => setCustomerModal(false)}
            >
              ×
            </button>
            <h2>Select Customer</h2>

            <input
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />

            <div className={styles.customerList}>
              {customers
                .filter((c) =>
                  (c.name || "")
                    .toLowerCase()
                    .includes(customerSearch.toLowerCase()),
                )
                .map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerModal(false);
                    }}
                  >
                    {customer.name} - {customer.phone || "No phone"}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
      {addonModal && selectedProduct && (
        <div className={styles.modalOverlay}>
          <div className={styles.addonModal}>
            <button
              className={styles.closeBtn}
              onClick={() => setAddonModal(false)}
            >
              ×
            </button>

            <h2>{selectedProduct.product_name}</h2>
            <p>
              Base Price: Ksh{" "}
              {Number(selectedProduct.product_price || 0).toFixed(2)}
            </p>

            <h3>Select Add-ons</h3>

            <div className={styles.addonsList}>
              {addons.map((addon) => {
                const checked = selectedAddons.some(
                  (a) => a.addon_id === addon.addon_id,
                );

                return (
                  <label key={addon.addon_id} className={styles.addonItem}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAddons([
                            ...selectedAddons,
                            {
                              addon_id: addon.addon_id,
                              addon_name: addon.addon_name,
                              addon_price: Number(addon.addon_price),
                              quantity: 1,
                            },
                          ]);
                        } else {
                          setSelectedAddons(
                            selectedAddons.filter(
                              (a) => a.addon_id !== addon.addon_id,
                            ),
                          );
                        }
                      }}
                    />

                    <span>{addon.addon_name}</span>
                    <strong>Ksh {Number(addon.addon_price).toFixed(2)}</strong>
                  </label>
                );
              })}
            </div>

            <div className={styles.addonTotal}>
              <span>Total:</span>
              <strong>
                Ksh{" "}
                {(
                  Number(selectedProduct.product_price || 0) +
                  selectedAddons.reduce(
                    (sum, addon) => sum + Number(addon.addon_price || 0),
                    0,
                  )
                ).toFixed(2)}
              </strong>
            </div>

            <button
              className={styles.addToCartBtn}
              onClick={addProductWithAddonsToCart}
            >
              Add To Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantSalesPage;
