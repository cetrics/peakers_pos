import { useEffect, useState } from "react";
import axios from "axios";
import styles from "./styles/RestaurantKitchenPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const RestaurantKitchenPage = () => {
  const [orders, setOrders] = useState([]);

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

  return (
    <div className={styles.kitchenPage}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.pageHeader}>
        <h2>Kitchen Orders</h2>
        <button onClick={fetchKitchenOrders}>Refresh</button>
      </div>

      <div className={styles.ordersGrid}>
        {orders.length === 0 ? (
          <div className={styles.emptyBox}>No kitchen orders found.</div>
        ) : (
          orders.map((order) => (
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
                <span>Total: Ksh {Number(order.total_price).toFixed(2)}</span>
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

              <div className={styles.actions}>
                <button
                  onClick={() =>
                    updateKitchenStatus(order.restaurant_order_id, "preparing")
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
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RestaurantKitchenPage;
