import { useEffect, useState } from "react";
import axios from "axios";
import styles from "./styles/RestaurantKitchenPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const RestaurantKitchenPage = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("active");

  useEffect(() => {
    fetchKitchenOrders();
  }, []);

  const fetchKitchenOrders = () => {
    axios
      .get("/restaurant/kitchen-orders", { withCredentials: true })
      .then((res) => setOrders(res.data.orders || []))
      .catch(() => toast.error("Error loading kitchen orders."));
  };

  const updateKitchenStatus = async (orderId, kitchenStatus) => {
    try {
      await axios.put(
        `/restaurant/orders/${orderId}/kitchen-status`,
        { kitchen_status: kitchenStatus },
        { withCredentials: true },
      );

      toast.success(`Order marked as ${kitchenStatus}`);
      fetchKitchenOrders();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error updating status.");
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "active") return order.kitchen_status !== "served";
    return order.kitchen_status === filter;
  });

  return (
    <div className={styles.kitchenPage}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.pageHeader}>
        <div>
          <h2>Kitchen Orders</h2>
          <p>View active and served orders for today</p>
        </div>

        <button onClick={fetchKitchenOrders}>Refresh</button>
      </div>

      <div className={styles.filterTabs}>
        <button
          className={filter === "active" ? styles.activeTab : ""}
          onClick={() => setFilter("active")}
        >
          Active
        </button>

        <button
          className={filter === "pending" ? styles.activeTab : ""}
          onClick={() => setFilter("pending")}
        >
          Pending
        </button>

        <button
          className={filter === "preparing" ? styles.activeTab : ""}
          onClick={() => setFilter("preparing")}
        >
          Preparing
        </button>

        <button
          className={filter === "ready" ? styles.activeTab : ""}
          onClick={() => setFilter("ready")}
        >
          Ready
        </button>

        <button
          className={filter === "served" ? styles.activeTab : ""}
          onClick={() => setFilter("served")}
        >
          Served Today
        </button>

        <button
          className={filter === "all" ? styles.activeTab : ""}
          onClick={() => setFilter("all")}
        >
          All Today
        </button>
      </div>

      <div className={styles.ordersGrid}>
        {filteredOrders.length === 0 ? (
          <div className={styles.emptyBox}>No kitchen orders found.</div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.restaurant_order_id} className={styles.orderCard}>
              <div className={styles.orderTop}>
                <div>
                  <h3>{order.order_number}</h3>
                  <p>{order.table_name || order.order_type}</p>
                </div>

                <span className={styles.statusBadge}>
                  {order.kitchen_status}
                </span>
              </div>

              <div className={styles.meta}>
                <span>Waiter: {order.waiter_name || "N/A"}</span>
                <span>
                  Kitchen: {order.kitchen_user_name || "Not assigned"}
                </span>
                <span>
                  Total: Ksh {Number(order.total_price || 0).toFixed(2)}
                </span>
              </div>

              <div className={styles.itemsList}>
                {order.items.map((item) => (
                  <div
                    key={item.restaurant_order_item_id}
                    className={styles.kitchenItem}
                  >
                    <div>
                      <strong>{item.quantity} x</strong> {item.product_name}
                    </div>

                    {item.addons && item.addons.length > 0 && (
                      <div className={styles.kitchenAddons}>
                        {item.addons.map((addon) => (
                          <small key={addon.order_item_addon_id}>
                            + {addon.addon_name}
                          </small>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {order.kitchen_status !== "served" && (
                <div className={styles.actions}>
                  <button
                    onClick={() =>
                      updateKitchenStatus(
                        order.restaurant_order_id,
                        "preparing",
                      )
                    }
                  >
                    Preparing
                  </button>

                  <button
                    onClick={() =>
                      updateKitchenStatus(order.restaurant_order_id, "ready")
                    }
                  >
                    Ready
                  </button>

                  <button
                    onClick={() =>
                      updateKitchenStatus(order.restaurant_order_id, "served")
                    }
                  >
                    Served
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RestaurantKitchenPage;
