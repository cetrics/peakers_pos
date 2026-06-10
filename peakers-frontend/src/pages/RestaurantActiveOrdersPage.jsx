import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import styles from "./styles/RestaurantActiveOrdersPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const RestaurantActiveOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [viewFilter, setViewFilter] = useState("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [checkoutPaymentType, setCheckoutPaymentType] = useState("Cash");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [viewFilter, paymentTypeFilter, statusFilter]);

  const fetchOrders = () => {
    axios
      .get("/restaurant/orders", {
        withCredentials: true,
        params: {
          view: viewFilter,
          payment_type: paymentTypeFilter,
          status: statusFilter,
          start_date: startDate,
          end_date: endDate,
        },
      })
      .then((res) => {
        setOrders(res.data.orders || []);
        setCurrentPage(1);
      })
      .catch(() => toast.error("Error loading restaurant orders."));
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    if (!query) return orders;

    return orders.filter((order) => {
      return (
        String(order.order_number || "")
          .toLowerCase()
          .includes(query) ||
        String(order.table_name || "")
          .toLowerCase()
          .includes(query) ||
        String(order.order_type || "")
          .toLowerCase()
          .includes(query) ||
        String(order.waiter_name || "")
          .toLowerCase()
          .includes(query) ||
        String(order.payment_type || "")
          .toLowerCase()
          .includes(query) ||
        String(order.order_status || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [orders, searchTerm]);

  const totalSales = useMemo(() => {
    return filteredOrders
      .filter((order) => order.order_status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  }, [filteredOrders]);

  const totalProfit = useMemo(() => {
    return filteredOrders
      .filter(
        (order) =>
          order.order_status !== "cancelled" &&
          order.order_status === "completed" &&
          order.payment_type,
      )
      .reduce((sum, order) => sum + Number(order.profit || 0), 0);
  }, [filteredOrders]);

  const activeOrdersCount = useMemo(() => {
    return filteredOrders.filter((order) =>
      ["pending", "held"].includes(order.order_status),
    ).length;
  }, [filteredOrders]);

  const currentOrders = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);

  const handleDateFilter = () => {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      toast.error("Please select both start and end date.");
      return;
    }

    fetchOrders();
  };

  const clearFilters = () => {
    setViewFilter("all");
    setPaymentTypeFilter("all");
    setStatusFilter("all");
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setRowsPerPage(15);
    setCurrentPage(1);
    setTimeout(fetchOrders, 100);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      if (newStatus === "completed") {
        await axios.put(
          `/restaurant/orders/${orderId}/checkout`,
          { payment_type: checkoutPaymentType },
          { withCredentials: true },
        );

        toast.success(`Order completed and paid via ${checkoutPaymentType}.`);
        fetchOrders();
        return;
      }

      await axios.put(
        `/restaurant/orders/${orderId}/status`,
        { order_status: newStatus },
        { withCredentials: true },
      );

      toast.success(`Order marked as ${newStatus}.`);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error updating status.");
    }
  };

  const checkoutOrder = async (orderId) => {
    try {
      await axios.put(
        `/restaurant/orders/${orderId}/checkout`,
        { payment_type: checkoutPaymentType },
        { withCredentials: true },
      );

      toast.success("Order checked out successfully.");
      fetchOrders();
      setSelectedOrder(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error checking out order.");
    }
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this restaurant order?")) return;

    try {
      await axios.put(
        `/restaurant/orders/${orderId}/cancel`,
        {},
        { withCredentials: true },
      );

      toast.success("Order cancelled successfully.");
      fetchOrders();
      setSelectedOrder(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error cancelling order.");
    }
  };

  const downloadCSV = () => {
    const headers = [
      "Order Number",
      "Table/Type",
      "Waiter",
      "Payment Type",
      "Status",
      "Kitchen Status",
      "Total",
      "Profit",
      "Date",
    ];

    const rows = filteredOrders.map((order) => [
      order.order_number,
      order.table_name || order.order_type,
      order.waiter_name || "N/A",
      order.payment_type || "Not Paid",
      order.order_status,
      order.kitchen_status,
      Number(order.total_price || 0).toFixed(2),
      order.order_status !== "completed" ||
      !order.payment_type ||
      order.order_status === "cancelled"
        ? "0.00"
        : Number(order.profit || 0).toFixed(2),
      new Date(order.created_at).toLocaleString(),
    ]);

    rows.push([
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      totalSales.toFixed(2),
      totalProfit.toFixed(2),
      "",
    ]);

    const csvContent =
      headers.join(",") + "\n" + rows.map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `restaurant_orders_${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const downloadExcel = () => {
    const data = filteredOrders.map((order) => ({
      "Order Number": order.order_number,
      "Table/Type": order.table_name || order.order_type,
      Waiter: order.waiter_name || "N/A",
      "Payment Type": order.payment_type || "Not Paid",
      Status: order.order_status,
      "Kitchen Status": order.kitchen_status,
      Total: Number(order.total_price || 0),
      Profit:
        order.order_status !== "completed" ||
        !order.payment_type ||
        order.order_status === "cancelled"
          ? 0
          : Number(order.profit || 0),
      Date: new Date(order.created_at).toLocaleString(),
    }));

    data.push({
      "Order Number": "",
      "Table/Type": "TOTAL",
      Total: totalSales,
      Profit: totalProfit,
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Restaurant Orders");
    XLSX.writeFile(
      workbook,
      `restaurant_orders_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text("Restaurant Orders Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Orders: ${filteredOrders.length}`, 14, 29);
      doc.text(`Total Sales: Ksh ${totalSales.toFixed(2)}`, 60, 29);
      doc.text(`Profit: Ksh ${totalProfit.toFixed(2)}`, 130, 29);

      doc.autoTable({
        startY: 38,
        head: [
          [
            "Order",
            "Table/Type",
            "Waiter",
            "Payment",
            "Status",
            "Kitchen",
            "Total",
            "Profit",
            "Date",
          ],
        ],
        body: filteredOrders.map((order) => [
          order.order_number,
          order.table_name || order.order_type,
          order.waiter_name || "N/A",
          order.payment_type || "Not Paid",
          order.order_status,
          order.kitchen_status,
          `Ksh ${Number(order.total_price || 0).toFixed(2)}`,
          `Ksh ${
            order.order_status !== "completed" ||
            !order.payment_type ||
            order.order_status === "cancelled"
              ? "0.00"
              : Number(order.profit || 0).toFixed(2)
          }`,
          new Date(order.created_at).toLocaleDateString(),
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [7, 20, 47],
          textColor: 255,
        },
      });

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [
          [
            "",
            "TOTAL",
            "",
            "",
            "",
            "",
            `Ksh ${totalSales.toFixed(2)}`,
            `Ksh ${totalProfit.toFixed(2)}`,
            "",
          ],
        ],
        styles: {
          fontSize: 9,
          fontStyle: "bold",
        },
      });

      doc.save(
        `restaurant_orders_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (error) {
      toast.error("Failed to generate PDF.");
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "completed":
        return styles.completed;
      case "cancelled":
        return styles.cancelled;
      case "held":
        return styles.held;
      case "pending":
        return styles.pending;
      default:
        return styles.defaultStatus;
    }
  };

  const downloadReceiptPDF = async (order) => {
    try {
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(7, 20, 47);
      doc.rect(0, 0, pageWidth, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("PEAKERS RESTAURANT", pageWidth / 2, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Official Restaurant Receipt", pageWidth / 2, 24, {
        align: "center",
      });

      doc.setTextColor(7, 20, 47);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Receipt: ${order.order_number}`, 14, 48);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 14, 58);
      doc.text(`Order Type: ${order.order_type || "N/A"}`, 14, 65);
      doc.text(`Table: ${order.table_name || "N/A"}`, 14, 72);
      doc.text(`Waiter: ${order.waiter_name || "N/A"}`, 14, 79);

      doc.text(`Payment: ${order.payment_type || "Not Paid"}`, 120, 58);
      doc.text(`Status: ${order.order_status}`, 120, 65);
      doc.text(`Kitchen: ${order.kitchen_status}`, 120, 72);

      doc.setFillColor(240, 245, 255);
      doc.rect(14, 90, pageWidth - 28, 10, "F");

      doc.setTextColor(7, 20, 47);
      doc.setFont("helvetica", "bold");
      doc.text("Item", 18, 97);
      doc.text("Qty", 105, 97);
      doc.text("Price", 125, 97);
      doc.text("Subtotal", 160, 97);

      let y = 108;

      doc.setFont("helvetica", "normal");

      order.items.forEach((item) => {
        doc.setTextColor(20, 20, 20);
        doc.text(String(item.product_name), 18, y);
        doc.text(String(item.quantity), 108, y);
        doc.text(`Ksh ${Number(item.unit_price || 0).toFixed(2)}`, 125, y);
        doc.text(`Ksh ${Number(item.subtotal || 0).toFixed(2)}`, 160, y);

        y += 8;
        if (item.addons && item.addons.length > 0) {
          item.addons.forEach((addon) => {
            doc.setTextColor(10, 143, 8);
            doc.setFontSize(9);
            doc.text(`+ ${addon.addon_name}`, 22, y);
            doc.text(
              `Ksh ${Number(addon.addon_price || 0).toFixed(2)}`,
              160,
              y,
            );
            y += 6;
          });
        }
      });

      y += 5;

      doc.setDrawColor(220, 220, 220);
      doc.line(14, y, pageWidth - 14, y);

      y += 10;

      doc.setFont("helvetica", "normal");
      doc.text("Subtotal:", 120, y);
      doc.text(`Ksh ${Number(order.subtotal || 0).toFixed(2)}`, 160, y);

      y += 8;
      doc.text("VAT:", 120, y);
      doc.text(`Ksh ${Number(order.vat || 0).toFixed(2)}`, 160, y);

      y += 8;
      doc.text("Discount:", 120, y);
      doc.text(`Ksh ${Number(order.discount || 0).toFixed(2)}`, 160, y);

      y += 10;

      doc.setFillColor(10, 143, 8);
      doc.roundedRect(115, y - 7, 75, 12, 3, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", 120, y);
      doc.text(`Ksh ${Number(order.total_price || 0).toFixed(2)}`, 150, y);

      y += 25;

      doc.setTextColor(7, 20, 47);
      doc.setFontSize(11);
      doc.text("Thank you for dining with us!", pageWidth / 2, y, {
        align: "center",
      });

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("Powered by Peakers POS", pageWidth / 2, y + 7, {
        align: "center",
      });

      doc.save(`receipt_${order.order_number}.pdf`);
    } catch (error) {
      toast.error("Failed to generate receipt.");
    }
  };

  const reopenOrder = async (orderId) => {
    if (
      !window.confirm("Reopen this completed order? Stock will be restored.")
    ) {
      return;
    }

    try {
      await axios.put(
        `/restaurant/orders/${orderId}/reopen`,
        {},
        { withCredentials: true },
      );

      toast.success("Order reopened successfully. Stock restored.");
      fetchOrders();
      setSelectedOrder(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error reopening order.");
    }
  };

  return (
    <div className={styles.ordersPage}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.pageHeader}>
        <div>
          <h1>Restaurant Orders</h1>
          <p>Manage orders, statuses, reports, payments, and profit.</p>
        </div>

        <div className={styles.reportButtons}>
          <button onClick={downloadCSV}>CSV</button>
          <button onClick={downloadExcel}>Excel</button>
          <button onClick={downloadPDF}>PDF</button>
          <button className={styles.refreshBtn} onClick={fetchOrders}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Total Orders</span>
          <strong>{filteredOrders.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Active Orders</span>
          <strong>{activeOrdersCount}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Total Sales</span>
          <strong>Ksh {totalSales.toFixed(2)}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Profit</span>
          <strong>Ksh {totalProfit.toFixed(2)}</strong>
        </div>
      </div>

      <div className={styles.filtersPanel}>
        <div>
          <label>View</label>
          <select
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value)}
          >
            <option value="all">All Orders</option>
            <option value="active">Active Orders</option>
          </select>
        </div>

        <div>
          <label>Payment</label>
          <select
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
          >
            <option value="all">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Mpesa">Mpesa</option>
            <option value="Bank">Bank</option>
            <option value="Credit">Credit</option>
          </select>
        </div>

        <div>
          <label>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="held">Held</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div>
          <label>Rows</label>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
          >
            <option value={15}>15</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <button onClick={handleDateFilter}>Apply</button>
        <button className={styles.clearBtn} onClick={clearFilters}>
          Clear
        </button>
      </div>

      <div className={styles.checkoutPaymentBox}>
        <label>Checkout Payment Type:</label>
        <select
          value={checkoutPaymentType}
          onChange={(e) => setCheckoutPaymentType(e.target.value)}
        >
          <option value="Cash">Cash</option>
          <option value="Mpesa">Mpesa</option>
          <option value="Bank">Bank</option>
          <option value="Credit">Credit</option>
        </select>
      </div>
      <div className={styles.searchBox}>
        <label>Search</label>
        <input
          type="text"
          placeholder="Search order, table, waiter..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Table/Type</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Profit</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {currentOrders.length === 0 ? (
              <tr>
                <td colSpan="7" className={styles.emptyCell}>
                  No restaurant orders found.
                </td>
              </tr>
            ) : (
              currentOrders.map((order) => (
                <tr key={order.restaurant_order_id}>
                  <td>{order.order_number}</td>
                  <td>{order.table_name || order.order_type}</td>
                  <td>
                    <select
                      value={order.order_status}
                      onChange={(e) =>
                        updateOrderStatus(
                          order.restaurant_order_id,
                          e.target.value,
                        )
                      }
                      className={`${styles.statusSelect} ${getStatusClass(order.order_status)}`}
                      disabled={order.order_status === "completed"}
                    >
                      <option value="pending">Pending</option>
                      <option value="held">Held</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>{order.payment_type || "Not Paid"}</td>
                  <td>Ksh {Number(order.total_price || 0).toFixed(2)}</td>
                  <td>
                    Ksh{" "}
                    {order.order_status !== "completed" ||
                    !order.payment_type ||
                    order.order_status === "cancelled"
                      ? "0.00"
                      : Number(order.profit || 0).toFixed(2)}
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button onClick={() => setSelectedOrder(order)}>
                        Details
                      </button>

                      {order.order_status !== "completed" &&
                        order.order_status !== "cancelled" && (
                          <>
                            <button
                              className={styles.checkoutBtn}
                              onClick={() =>
                                checkoutOrder(order.restaurant_order_id)
                              }
                            >
                              Checkout
                            </button>

                            <button
                              className={styles.cancelBtn}
                              onClick={() =>
                                cancelOrder(order.restaurant_order_id)
                              }
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      {order.order_status === "completed" && (
                        <button
                          className={styles.reopenBtn}
                          onClick={() => reopenOrder(order.restaurant_order_id)}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan="4">TOTAL</td>
              <td>Ksh {totalSales.toFixed(2)}</td>
              <td>Ksh {totalProfit.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>

          <span>
            Page {currentPage} of {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {selectedOrder && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>Order {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailsGrid}>
                <p>
                  <strong>Order Type:</strong> {selectedOrder.order_type}
                </p>
                <p>
                  <strong>Table:</strong> {selectedOrder.table_name || "N/A"}
                </p>
                <p>
                  <strong>Waiter:</strong> {selectedOrder.waiter_name || "N/A"}
                </p>
                <p>
                  <strong>Status:</strong> {selectedOrder.order_status}
                </p>
                <p>
                  <strong>Kitchen:</strong> {selectedOrder.kitchen_status}
                </p>
                <p>
                  <strong>Payment:</strong>{" "}
                  {selectedOrder.payment_type || "Not Paid"}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
                <p>
                  <strong>Subtotal:</strong> Ksh{" "}
                  {selectedOrder.subtotal.toFixed(2)}
                </p>
                <p>
                  <strong>VAT:</strong> Ksh {selectedOrder.vat.toFixed(2)}
                </p>
                <p>
                  <strong>Discount:</strong> Ksh{" "}
                  {selectedOrder.discount.toFixed(2)}
                </p>
                <p>
                  <strong>Total:</strong> Ksh{" "}
                  {selectedOrder.total_price.toFixed(2)}
                </p>
                <p>
                  <strong>Profit:</strong> Ksh{" "}
                  {selectedOrder.order_status !== "completed" ||
                  !selectedOrder.payment_type ||
                  selectedOrder.order_status === "cancelled"
                    ? "0.00"
                    : Number(selectedOrder.profit || 0).toFixed(2)}
                </p>
              </div>

              <h4>Items</h4>
              <div className={styles.modalItems}>
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.restaurant_order_item_id}
                    className={styles.modalItemBlock}
                  >
                    <div className={styles.modalItem}>
                      <span>
                        {item.quantity} × {item.product_name}
                      </span>
                      <span>Ksh {Number(item.subtotal || 0).toFixed(2)}</span>
                    </div>

                    {item.addons && item.addons.length > 0 && (
                      <div className={styles.orderAddons}>
                        {item.addons.map((addon) => (
                          <small key={addon.order_item_addon_id}>
                            + {addon.addon_name} — Ksh{" "}
                            {Number(addon.addon_price || 0).toFixed(2)}
                          </small>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                className={styles.receiptBtn}
                onClick={() => downloadReceiptPDF(selectedOrder)}
              >
                Download Receipt
              </button>

              {selectedOrder.order_status !== "completed" &&
                selectedOrder.order_status !== "cancelled" && (
                  <div className={styles.modalActions}>
                    <button
                      className={styles.checkoutBtn}
                      onClick={() =>
                        checkoutOrder(selectedOrder.restaurant_order_id)
                      }
                    >
                      Checkout
                    </button>

                    <button
                      className={styles.cancelBtn}
                      onClick={() =>
                        cancelOrder(selectedOrder.restaurant_order_id)
                      }
                    >
                      Cancel
                    </button>
                  </div>
                )}
              {selectedOrder.order_status === "completed" && (
                <button
                  className={styles.reopenBtn}
                  onClick={() => reopenOrder(selectedOrder.restaurant_order_id)}
                >
                  Reopen Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantActiveOrdersPage;
