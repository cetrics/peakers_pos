import React, { useEffect, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { FaFileCsv, FaFileExcel, FaFilePdf } from "react-icons/fa";
import styles from "./styles/OrdersPage.module.css";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

dayjs.extend(utc);
dayjs.extend(timezone);

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [topCustomersCount, setTopCustomersCount] = useState(5);
  const [showTopCustomers, setShowTopCustomers] = useState(false);
  const [customerOrderCounts, setCustomerOrderCounts] = useState([]);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredOrder, setHoveredOrder] = useState(null);

  // Calculate total price for currently filtered orders
  const calculateTotal = () => {
    return filteredOrders.reduce((sum, order) => sum + order.total_price, 0);
  };

  // Fetch Orders
  const fetchOrders = async (startDate = "", endDate = "") => {
    try {
      setLoading(true);
      const response = await axios.get("/get-orders", {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      const processedOrders = response.data.orders.map((order) => ({
        ...order,
        total_price: Number(order.total_price),
        vat: Number(order.vat),
        discount: Number(order.discount),
        items: order.items.map((item) => ({
          ...item,
          product_price: Number(item.product_price),
          subtotal: Number(item.subtotal),
        })),
      }));

      setOrders(processedOrders);

      // Calculate customer order counts
      const counts = processedOrders.reduce((acc, order) => {
        const customer = order.customer_name || "Guest";
        acc[customer] = (acc[customer] || 0) + 1;
        return acc;
      }, {});

      // Convert to array and sort by order count (descending)
      const sortedCounts = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setCustomerOrderCounts(sortedCounts);
      setLoading(false);
    } catch (err) {
      setError("❌ Error loading orders.");
      setLoading(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (saleId, newStatus) => {
    try {
      await axios.post("/update-order-status", {
        sale_id: saleId,
        status: newStatus,
      });

      // Update local state
      setOrders(
        orders.map((order) =>
          order.sale_id === saleId ? { ...order, status: newStatus } : order
        )
      );

      setFilteredOrders(
        filteredOrders.map((order) =>
          order.sale_id === saleId ? { ...order, status: newStatus } : order
        )
      );

      // ✅ Show success notification
      toast.success(`Order marked as ${newStatus.toUpperCase()} successfully!`);
    } catch (err) {
      console.error("Failed to update order status:", err);
      toast.error("❌ Failed to update order status. Please try again.");
    }
  };

  // Get color based on status
  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "darkgreen"; // Green
      case "voided":
        return "red"; // Red
      case "refunded":
        return "darkorange"; // Orange
      default:
        return "#9E9E9E"; // Gray
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Apply all filters whenever dependencies change
  useEffect(() => {
    let result = [...orders];

    // Apply date filter if dates are selected
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Set to start of day

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set to end of day

      result = result.filter((order) => {
        const orderDate = new Date(order.sale_date);
        return orderDate >= start && orderDate <= end;
      });
    }

    // Apply top customers filter if active
    if (showTopCustomers) {
      const topCustomerNames = customerOrderCounts
        .slice(0, topCustomersCount)
        .map((customer) => customer.name);
      result = result.filter((order) =>
        topCustomerNames.includes(order.customer_name || "Guest")
      );
    }

    // Apply payment type filter if not "all"
    if (paymentTypeFilter !== "all") {
      result = result.filter(
        (order) => order.payment_type === paymentTypeFilter
      );
    }

    // Apply status filter if not "all"
    if (statusFilter !== "all") {
      result = result.filter(
        (order) => (order.status || "completed") === statusFilter
      );
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));

    setFilteredOrders(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [
    orders,
    startDate,
    endDate,
    showTopCustomers,
    topCustomersCount,
    paymentTypeFilter,
    statusFilter,
  ]);

  // Handle Date Filter button click
  const handleFilter = () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }
    fetchOrders(startDate, endDate);
  };

  // Toggle top customers filter
  const filterTopCustomers = () => {
    setShowTopCustomers(!showTopCustomers);
  };

  // Handle search from index page search bar
  useEffect(() => {
    const searchInput = document.getElementById("customerSearch");

    if (!searchInput) return;

    const handleSearch = (event) => {
      const query = event.target.value.trim().toLowerCase();

      if (!query) {
        setFilteredOrders(orders);
        return;
      }

      const filtered = orders.filter(
        (order) =>
          (order.order_number ?? "").toString().includes(query) ||
          (order.customer_name ?? "").toLowerCase().includes(query)
      );

      setFilteredOrders(filtered);
      setCurrentPage(1);
    };

    searchInput.addEventListener("input", handleSearch);

    return () => {
      searchInput.removeEventListener("input", handleSearch);
    };
  }, [orders]);

  // Download CSV Report
  const downloadCSV = () => {
    const headers = [
      "Order Number",
      "Customer",
      "Total Price",
      "Payment Type",
      "Date",
      "Status",
      "VAT",
      "Discount",
      "Items Count",
      "Profit",
    ];

    const data = filteredOrders.map((order) => [
      order.order_number,
      order.customer_name || "Guest",
      order.total_price,
      order.payment_type,
      new Date(order.sale_date).toLocaleString(),
      order.status || "completed",
      order.vat,
      order.discount,
      order.items.length,
      order.profit || 0,
    ]);

    // Add total row
    data.push([
      "",
      "TOTAL",
      calculateTotal(),
      "",
      "",
      "",
      "",
      "",
      "",
      calculateTotalProfit(),
    ]);

    // Convert data to CSV string
    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => {
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `orders_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Download Excel Report
  const downloadExcel = () => {
    const data = filteredOrders.map((order) => ({
      "Order Number": order.order_number,
      Customer: order.customer_name || "Guest",
      "Total Price": order.total_price,
      "Payment Type": order.payment_type,
      Date: new Date(order.sale_date).toLocaleString(),
      Status: order.status || "completed",
      VAT: order.vat,
      Discount: order.discount,
      "Items Count": order.items.length,
      Profit: order.profit || 0, // ✅ Include Profit here
    }));

    // Add total row based on filtered orders
    data.push({
      "Order Number": "",
      Customer: "TOTAL",
      "Total Price": calculateTotal(),
      "Payment Type": "",
      Date: "",
      Status: "",
      VAT: "",
      Discount: "TOTAL PROFIT",
      "Items Count": "",
      Profit: calculateTotalProfit(), // ✅ Now this aligns with the column
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    XLSX.writeFile(
      workbook,
      `orders_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Download PDF Report
  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "landscape",
      });

      // Title and Date
      doc.setFontSize(16);
      doc.text("Orders Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Orders: ${filteredOrders.length}`, 14, 29);
      doc.text(`Grand Total: Ksh ${calculateTotal().toFixed(2)}`, 100, 29);

      // Add filter info
      let filterInfo = [];
      if (showTopCustomers) {
        filterInfo.push(`Top ${topCustomersCount} customers by order count`);
      }
      if (paymentTypeFilter !== "all") {
        filterInfo.push(`Payment type: ${paymentTypeFilter}`);
      }
      if (statusFilter !== "all") {
        filterInfo.push(`Status: ${statusFilter}`);
      }
      if (filterInfo.length > 0) {
        doc.text(`Filters: ${filterInfo.join(", ")}`, 14, 36);
      }

      // Main table data
      const headers = [
        [
          "Order Number",
          "Customer",
          "Total Price",
          "Payment Type",
          "Date",
          "Status",
          "VAT",
          "Discount",
          "Items",
          "Profit", // ⬅️ Add this
        ],
      ];

      const data = filteredOrders.map((order) => [
        order.order_number,
        order.customer_name || "Guest",
        `Ksh ${order.total_price.toFixed(2)}`,
        order.payment_type,
        new Date(order.sale_date).toLocaleDateString(),
        order.status || "completed",
        `Ksh ${order.vat.toFixed(2)}`,
        `Ksh ${order.discount.toFixed(2)}`,
        order.items.map((i) => `${i.product_name} × ${i.quantity}`).join("\n"),
        `Ksh ${(order.profit || 0).toFixed(2)}`, // ⬅️ Add this
      ]);

      // Generate main table
      doc.autoTable({
        head: headers,
        body: data,
        startY: filterInfo.length > 0 ? 45 : 35,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: "middle",
        },
        headStyles: {
          fillColor: [61, 128, 133],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          8: { cellWidth: 40 },
        },
        didDrawCell: (data) => {
          if (data.column.index === 8 && data.cell.section === "body") {
            const lines = data.cell.raw.split("\n").length;
            if (lines > 1) {
              const lineHeight = data.row.height / lines;
              for (let i = 1; i < lines; i++) {
                doc.line(
                  data.cell.x,
                  data.cell.y + lineHeight * i,
                  data.cell.x + data.cell.width,
                  data.cell.y + lineHeight * i
                );
              }
            }
          }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.fontStyle = "bold";
          }
          if (data.section === "body" && data.column.index === 5) {
            data.cell.styles.fillColor = getStatusColor(data.cell.raw);
            data.cell.styles.textColor = [255, 255, 255];
          }
        },
      });

      // Add total row
      doc.autoTable({
        body: [
          [
            "", // Order ID
            "TOTAL", // Customer
            `Ksh ${calculateTotal().toFixed(2)}`, // Total Price
            "", // Payment Type
            "", // Date
            "", // Status
            "", // VAT
            "", // Discount
            "",
            "PROFIT", // Items
            `Ksh ${calculateTotalProfit().toFixed(2)}`, // ✅ Profit
          ],
        ],
        startY: doc.lastAutoTable.finalY + 5,
        styles: {
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 3,
        },
        columnStyles: {
          2: { fontStyle: "bold" }, // Highlight Total Price column
          9: { fontStyle: "bold" }, // Highlight Profit column
        },
      });

      // Add detailed items on separate pages
      filteredOrders.forEach((order) => {
        doc.addPage("landscape");

        // Order header
        doc.setFontSize(14);
        doc.text(`Order #${order.order_number} Details`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Customer: ${order.customer_name || "Guest"}`, 14, 28);
        doc.text(
          `Date: ${new Date(order.sale_date).toLocaleString()}`,
          100,
          28
        );
        doc.text(`Payment: ${order.payment_type}`, 180, 28);
        doc.text(`Status: ${order.status || "completed"}`, 14, 36);
        doc.text(`Order Total: Ksh ${order.total_price.toFixed(2)}`, 14, 44);

        // Items table
        const itemsHeaders = [["Product", "Qty", "Unit Price", "Subtotal"]];
        const itemsData = order.items.map((item) => [
          item.product_name,
          item.quantity,
          `Ksh ${item.product_price.toFixed(2)}`,
          `Ksh ${item.subtotal.toFixed(2)}`,
        ]);

        // Add item total
        itemsData.push([
          "",
          "",
          "TOTAL:",
          `Ksh ${order.items
            .reduce((sum, item) => sum + item.subtotal, 0)
            .toFixed(2)}`,
        ]);

        doc.autoTable({
          head: itemsHeaders,
          body: itemsData,
          startY: 55,
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [22, 160, 133],
          },
          didParseCell: (data) => {
            if (data.row.index === itemsData.length - 1) {
              data.cell.styles.fontStyle = "bold";
            }
          },
        });

        // Summary
        const summaryY = doc.lastAutoTable.finalY + 10;
        doc.text(`Total Items: ${order.items.length}`, 14, summaryY);
        doc.text(
          `Subtotal: Ksh ${(
            order.total_price -
            order.vat +
            order.discount
          ).toFixed(2)}`,
          14,
          summaryY + 7
        );
        doc.text(`VAT: Ksh ${order.vat.toFixed(2)}`, 14, summaryY + 14);
        doc.text(
          `Discount: Ksh ${order.discount.toFixed(2)}`,
          14,
          summaryY + 21
        );
        doc.setFont("helvetica", "bold");
        doc.text(
          `Total: Ksh ${order.total_price.toFixed(2)}`,
          14,
          summaryY + 28
        );
        doc.setFont("helvetica", "normal");
      });

      doc.save(`orders_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Pagination logic
  const indexOfLastOrder = currentPage * rowsPerPage;
  const indexOfFirstOrder = indexOfLastOrder - rowsPerPage;
  const currentOrders = filteredOrders.slice(
    indexOfFirstOrder,
    indexOfLastOrder
  );
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const calculateTotalProfit = () => {
    return filteredOrders.reduce((sum, order) => sum + (order.profit || 0), 0);
  };

  return (
    <div className={styles.ordersPage}>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>All Orders</h1>
        <div className={styles.reportButtons}>
          <button className={styles.reportButton} onClick={downloadCSV}>
            <i
              className={`fas fa-file-csv ${styles.reportIcon}`}
              style={{ color: "#217346" }}
            ></i>
            <span>Download CSV</span>
          </button>
          <button className={styles.reportButton} onClick={downloadExcel}>
            <i
              className={`fas fa-file-excel ${styles.reportIcon}`}
              style={{ color: "#217346" }}
            ></i>
            <span>Download Excel</span>
          </button>
          <button className={styles.reportButton} onClick={downloadPDF}>
            <i
              className={`fas fa-file-pdf ${styles.reportIcon}`}
              style={{ color: "#d24726" }}
            ></i>
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      <div className={styles.filtersPanel}>
        <h2>Filters</h2>

        <div className={styles.filterGroup}>
          <label>Date Range</label>
          <div className={styles.dateFilter}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.filterInput}
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.filterInput}
            />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>Payment Type</label>
          <select
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Payment Types</option>
            <option value="Cash">Cash</option>
            <option value="Mpesa">M-Pesa</option>
            <option value="Credit Card">Credit Card</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Top Customers</label>
          <select
            value={topCustomersCount}
            onChange={(e) => setTopCustomersCount(Number(e.target.value))}
            disabled={showTopCustomers}
            className={styles.filterSelect}
          >
            <option value="3">Top 3</option>
            <option value="5">Top 5</option>
            <option value="10">Top 10</option>
            <option value="15">Top 15</option>
          </select>
          <button
            className={styles.filterButton}
            onClick={filterTopCustomers}
            style={{ marginTop: "10px" }}
          >
            {showTopCustomers ? "Show All Customers" : "Filter Top Customers"}
          </button>
        </div>

        <div className={styles.filterGroup}>
          <label>Rows Per Page</label>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            className={styles.filterSelect}
          >
            <option value={15}>15</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={501}>All (500+)</option>
          </select>
        </div>
      </div>

      <div className={styles.contentPanel}>
        {/* Filter info and customer stats */}
        {(showTopCustomers ||
          paymentTypeFilter !== "all" ||
          statusFilter !== "all") && (
          <div className={styles.filterInfo}>
            Active filters:{" "}
            {showTopCustomers && `Top ${topCustomersCount} customers`}
            {showTopCustomers &&
              (paymentTypeFilter !== "all" || statusFilter !== "all") &&
              ", "}
            {paymentTypeFilter !== "all" && `Payment: ${paymentTypeFilter}`}
            {paymentTypeFilter !== "all" && statusFilter !== "all" && ", "}
            {statusFilter !== "all" && `Status: ${statusFilter}`}
          </div>
        )}

        {showTopCustomers && customerOrderCounts.length > 0 && (
          <div className={styles.customerStats}>
            <h3>Top {topCustomersCount} Customers by Order Count</h3>
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Order Count</th>
                </tr>
              </thead>
              <tbody>
                {customerOrderCounts
                  .slice(0, topCustomersCount)
                  .map((customer) => (
                    <tr key={customer.name}>
                      <td>{customer.name}</td>
                      <td>{customer.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className={styles.noOrders}>
            No orders found matching your filters.
          </div>
        ) : (
          <div className={styles.contentPanel}>
            <div className={styles.tableContainer}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Customer</th>
                    <th>Total Price</th>
                    <th>Payment Type</th>
                    <th>Date</th>
                    <th>Profit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrders.map((order) => (
                    <tr
                      key={order.sale_id}
                      onMouseEnter={(e) =>
                        setHoveredOrder({
                          ...order,
                          clientX: e.clientX,
                          clientY: e.clientY,
                        })
                      }
                      onMouseLeave={() => setHoveredOrder(null)}
                      className={styles.orderRow}
                    >
                      <td>{order.order_number || order.sale_id}</td>
                      <td>{order.customer_name || "Guest"}</td>
                      <td>Ksh {order.total_price.toFixed(2)}</td>
                      <td>{order.payment_type}</td>
                      <td>
                        {dayjs
                          .utc(order.sale_date)
                          .tz("Africa/Nairobi")
                          .format("YYYY-MM-DD HH:mm")}
                      </td>
                      <td>Ksh {Number(order.profit || 0).toFixed(2)}</td>
                      <td>
                        <select
                          value={order.status || "completed"}
                          onChange={(e) =>
                            handleStatusChange(order.sale_id, e.target.value)
                          }
                          className={styles.statusSelect}
                          style={{
                            backgroundColor: getStatusColor(
                              order.status || "completed"
                            ),
                            color: "white",
                            padding: "5px",
                            borderRadius: "4px",
                            border: "none",
                          }}
                        >
                          <option value="completed">Completed</option>
                          <option value="voided">Voided</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.totalRow}>
                    <td colSpan="2">TOTAL</td>
                    <td>Ksh {calculateTotal().toFixed(2)}</td>
                    <td colSpan="3">PROFIT</td>
                    <td>Ksh {calculateTotalProfit().toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Order details tooltip */}
            {hoveredOrder && (
              <div
                className={styles.orderTooltip}
                style={{
                  top: `${hoveredOrder.clientY + 10}px`,
                  left: `${hoveredOrder.clientX + 10}px`,
                }}
              >
                <h4>Order #{hoveredOrder.sale_id} Details</h4>
                <p>
                  <strong>VAT:</strong> Ksh {hoveredOrder.vat.toFixed(2)}
                </p>
                <p>
                  <strong>Discount:</strong> Ksh{" "}
                  {hoveredOrder.discount.toFixed(2)}
                </p>
                <div>
                  <strong>Items ({hoveredOrder.items.length}):</strong>
                  <ul className={styles.itemsList}>
                    {hoveredOrder.items.map((item) => (
                      <li key={item.product_id}>
                        {item.product_name} × {item.quantity}
                        {item.quantity} @ Ksh {item.product_price.toFixed(2)}
                        {item.buying_price &&
                          `(Cost: Ksh ${item.buying_price.toFixed(2)})`}
                        = Ksh {item.subtotal.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {/* Pagination controls */}
            {filteredOrders.length > rowsPerPage && (
              <div className={styles.pagination}>
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, currentPage - 3),
                    Math.min(totalPages, currentPage + 2)
                  )
                  .map((number) => (
                    <button
                      key={number}
                      onClick={() => paginate(number)}
                      className={
                        currentPage === number ? styles.activePage : ""
                      }
                    >
                      {number}
                    </button>
                  ))}

                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
