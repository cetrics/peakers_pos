import React, { useEffect, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import styles from "./styles/OrdersPage.module.css";

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
      setFilteredOrders(processedOrders);

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

  useEffect(() => {
    fetchOrders();
  }, []);

  // Handle Date Filter
  const handleFilter = () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }

    const formattedStartDate = new Date(startDate).toISOString().split("T")[0];
    const formattedEndDate = new Date(endDate).toISOString().split("T")[0];
    fetchOrders(formattedStartDate, formattedEndDate);
  };

  // Filter by top customers with most orders
  const filterTopCustomers = () => {
    if (!showTopCustomers) {
      // Get top N customer names
      const topCustomerNames = customerOrderCounts
        .slice(0, topCustomersCount)
        .map((customer) => customer.name);

      // Filter orders to only include these top customers
      const filtered = orders.filter((order) =>
        topCustomerNames.includes(order.customer_name || "Guest")
      );

      // Sort by customer name (to group them) and then by date (newest first)
      filtered.sort((a, b) => {
        const customerA = a.customer_name || "Guest";
        const customerB = b.customer_name || "Guest";

        // First sort by customer name (alphabetically)
        if (customerA < customerB) return -1;
        if (customerA > customerB) return 1;

        // Then sort by date (newest first)
        return new Date(b.sale_date) - new Date(a.sale_date);
      });

      setFilteredOrders(filtered);
    } else {
      // Reset to all orders (sorted by date, newest first)
      const sortedOrders = [...orders].sort(
        (a, b) => new Date(b.sale_date) - new Date(a.sale_date)
      );
      setFilteredOrders(sortedOrders);
    }
    setShowTopCustomers(!showTopCustomers);
  };

  // Handle search from index page search bar
  useEffect(() => {
    const searchInput = document.getElementById("customerSearch");

    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();

        if (!query) {
          setFilteredOrders(orders); // Reset to all orders when search is cleared
          return;
        }

        const filtered = orders.filter(
          (order) =>
            order.sale_id.toString().includes(query) ||
            (order.customer_name &&
              order.customer_name.toLowerCase().includes(query)) ||
            (order.payment_type &&
              order.payment_type.toLowerCase().includes(query)) ||
            order.items.some(
              (item) =>
                item.product_name.toLowerCase().includes(query) ||
                item.product_id.toString().includes(query)
            )
        );
        setFilteredOrders(filtered);
      };

      searchInput.addEventListener("input", handleSearch);
      return () => searchInput.removeEventListener("input", handleSearch);
    }
  }, [orders]);

  // Download CSV Report
  const downloadCSV = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Total Price",
      "Payment Type",
      "Date",
      "VAT",
      "Discount",
      "Items Count",
    ];

    const data = filteredOrders.map((order) => [
      order.sale_id,
      order.customer_name || "Guest",
      `Ksh ${order.total_price.toFixed(2)}`,
      order.payment_type,
      new Date(order.sale_date).toLocaleString(),
      `Ksh ${order.vat.toFixed(2)}`,
      `Ksh ${order.discount.toFixed(2)}`,
      order.items.length,
    ]);

    // Add total row based on filtered orders
    data.push([
      "",
      "TOTAL",
      `Ksh ${calculateTotal().toFixed(2)}`, // Uses filtered orders total
      "",
      "",
      "",
      "",
      "",
    ]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `orders_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Download Excel Report
  const downloadExcel = () => {
    const data = filteredOrders.map((order) => ({
      "Order ID": order.sale_id,
      Customer: order.customer_name || "Guest",
      "Total Price": order.total_price,
      "Payment Type": order.payment_type,
      Date: new Date(order.sale_date).toLocaleString(),
      VAT: order.vat,
      Discount: order.discount,
      "Items Count": order.items.length,
    }));

    // Add total row based on filtered orders
    data.push({
      "Order ID": "",
      Customer: "TOTAL",
      "Total Price": calculateTotal(), // Uses filtered orders total
      "Payment Type": "",
      Date: "",
      VAT: "",
      Discount: "",
      "Items Count": "",
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
      doc.text(`Grand Total: Ksh ${calculateTotal().toFixed(2)}`, 100, 29); // Uses filtered orders total

      // Add filter info if top customers filter is applied
      if (showTopCustomers) {
        doc.text(
          `Showing top ${topCustomersCount} customers by order count`,
          14,
          36
        );
      }

      // Main table data
      const headers = [
        [
          "Order ID",
          "Customer",
          "Total Price",
          "Payment Type",
          "Date",
          "VAT",
          "Discount",
          "Items",
        ],
      ];

      const data = filteredOrders.map((order) => [
        order.sale_id,
        order.customer_name || "Guest",
        `Ksh ${order.total_price.toFixed(2)}`,
        order.payment_type,
        new Date(order.sale_date).toLocaleDateString(),
        `Ksh ${order.vat.toFixed(2)}`,
        `Ksh ${order.discount.toFixed(2)}`,
        order.items.map((i) => `${i.product_name} × ${i.quantity}`).join("\n"),
      ]);

      // Generate main table
      doc.autoTable({
        head: headers,
        body: data,
        startY: showTopCustomers ? 45 : 35,
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
          7: { cellWidth: 40 },
        },
        didDrawCell: (data) => {
          if (data.column.index === 7 && data.cell.section === "body") {
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
        },
      });

      // Add total row based on filtered orders
      doc.autoTable({
        body: [
          [
            "",
            "TOTAL",
            `Ksh ${calculateTotal().toFixed(2)}`, // Uses filtered orders total
            "",
            "",
            "",
            "",
            "",
          ],
        ],
        startY: doc.lastAutoTable.finalY + 5,
        styles: {
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 3,
        },
        columnStyles: {
          2: { fontStyle: "bold" },
        },
      });

      // Add detailed items on separate pages (only for filtered orders)
      filteredOrders.forEach((order) => {
        doc.addPage("landscape");

        // Order header
        doc.setFontSize(14);
        doc.text(`Order #${order.sale_id} Details`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Customer: ${order.customer_name || "Guest"}`, 14, 28);
        doc.text(
          `Date: ${new Date(order.sale_date).toLocaleString()}`,
          100,
          28
        );
        doc.text(`Payment: ${order.payment_type}`, 180, 28);
        doc.text(`Order Total: Ksh ${order.total_price.toFixed(2)}`, 14, 36);

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
          startY: 45,
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

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.ordersPage}>
      <h1>All Orders</h1>

      {/* Report Download Buttons */}
      <div className={styles.reportButtons}>
        <button onClick={downloadCSV}>Download CSV</button>
        <button onClick={downloadExcel}>Download Excel</button>
        <button onClick={downloadPDF}>Download PDF</button>
      </div>

      {/* Filters Section */}
      <div className={styles.filtersSection}>
        {/* Date Filter Inputs */}
        <div className={styles.dateFilter}>
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.dateInput}
            />
          </label>
          <label>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.dateInput}
            />
          </label>
          <button onClick={handleFilter}>Filter</button>
        </div>

        {/* Top Customers Filter */}
        <div className={styles.topCustomersFilter}>
          <label>
            Show Top Customers:
            <select
              value={topCustomersCount}
              onChange={(e) => setTopCustomersCount(Number(e.target.value))}
              disabled={showTopCustomers}
            >
              <option value="3">Top 3</option>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="15">Top 15</option>
            </select>
          </label>
          <button onClick={filterTopCustomers}>
            {showTopCustomers ? "Show All Customers" : "Filter Top Customers"}
          </button>
        </div>
      </div>

      {/* Customer Order Counts Table (visible when filtered) */}
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
        <p className={styles.noOrders}>No orders found.</p>
      ) : (
        <>
          {showTopCustomers && (
            <p className={styles.filterInfo}>
              Showing orders from top {topCustomersCount} customers by order
              count
            </p>
          )}
          <table className={styles.ordersTable}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total Price</th>
                <th>Payment Type</th>
                <th>Date</th>
                <th>VAT</th>
                <th>Discount</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.sale_id}>
                  <td>{order.sale_id}</td>
                  <td>{order.customer_name || "Guest"}</td>
                  <td>Ksh {order.total_price.toFixed(2)}</td>
                  <td>{order.payment_type}</td>
                  <td>{new Date(order.sale_date).toLocaleString()}</td>
                  <td>Ksh {order.vat.toFixed(2)}</td>
                  <td>Ksh {order.discount.toFixed(2)}</td>
                  <td>
                    <ul className={styles.itemsList}>
                      {order.items.map((item) => (
                        <li key={item.product_id}>
                          {item.product_name} × {item.quantity} @ Ksh{" "}
                          {item.product_price.toFixed(2)} = Ksh{" "}
                          {item.subtotal.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan="2">TOTAL</td>
                <td>Ksh {calculateTotal().toFixed(2)}</td>
                <td colSpan="5"></td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
};

export default OrdersPage;
