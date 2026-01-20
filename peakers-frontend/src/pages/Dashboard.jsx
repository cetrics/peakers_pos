import React, { useEffect, useState, useRef } from "react";
import Chart from "chart.js/auto";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { FaFileCsv, FaFileExcel, FaFilePdf } from "react-icons/fa";
import "./styles/Main.css";

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    currentMonthSales: 0, // Added current month sales
    monthlyTarget: 500000,
    productsCount: 0,
    ordersCount: 0,
    customersCount: 0,
  });
  const [salesValue, setSalesValue] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const targetSales = metrics.monthlyTarget;
  const increment = Math.ceil(targetSales / 100);
  const chartRef = useRef(null);

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [salesRes, ordersRes] = await Promise.all([
        fetch("/sales-data"),
        fetch("/get-orders"),
      ]);

      const salesData = await salesRes.json();
      const ordersData = await ordersRes.json();

      if (salesData.metrics) {
        setMetrics({
          totalSales: salesData.metrics.total_sales || 0,
          currentMonthSales: salesData.metrics.current_month_sales || 0, // Added this
          monthlyTarget: salesData.metrics.monthly_target || 125000,
          productsCount: salesData.metrics.products_count || 0,
          ordersCount: salesData.metrics.orders_count || 0,
          customersCount: salesData.metrics.customers_count || 0,
        });
      }

      if (salesData.labels && salesData.sales) {
        renderSalesChart(salesData.labels, salesData.sales);
      }

      if (ordersData.orders) {
        const ordersMap = new Map();
        ordersData.orders.forEach((order) => {
          if (!ordersMap.has(order.sale_id)) {
            ordersMap.set(order.sale_id, {
              sale_id: order.sale_id,
              order_number: order.order_number, // ✅ Add this line
              customer_name: order.customer_name || "Walk-in",
              total_price: Number(order.total_price) || 0,
              payment_type: order.payment_type || "Unknown",
              sale_date: order.sale_date,
              status: order.status,
            });
          }
        });

        const sortedOrders = Array.from(ordersMap.values())
          .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
          .slice(0, 10);

        setRecentOrders(sortedOrders);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  const renderSalesChart = (labels, salesData) => {
    const ctx = document.getElementById("salesChart");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const maxValue = Math.max(...salesData) * 1.2;

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Sales Revenue (Ksh)",
            data: salesData,
            borderColor: "#F5A100",
            backgroundColor: "rgba(245, 161, 0, 0.2)",
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: "#F5A100",
            pointBorderColor: "#0B1446",
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1500,
          easing: "easeInOutBounce",
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxValue > 0 ? maxValue : 10000,
            grid: {
              color: "#ddd",
            },
            ticks: {
              color: "#333",
              callback: function (value) {
                return `Ksh.${value.toLocaleString()}`;
              },
            },
          },
          x: {
            grid: {
              color: "#ddd",
            },
            ticks: {
              color: "#333",
              autoSkip: false,
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: "#333",
              font: {
                size: 14,
              },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `Ksh.${context.parsed.y.toLocaleString()}`;
              },
            },
          },
        },
        elements: {
          line: {
            cubicInterpolationMode: "monotone",
          },
        },
      },
    });
  };

  // Status color mapping
  const getStatusColor = (status) => {
    if (!status) return "#9E9E9E";
    switch (status.toLowerCase()) {
      case "completed":
        return "darkgreen";
      case "voided":
        return "#F44336";
      case "refunded":
        return "#FF9800";
      default:
        return "#9E9E9E";
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `Ksh.${(Number(amount) || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Download functions
  const downloadCSV = () => {
    const headers = [
      "Order Number",
      "Customer",
      "Amount",
      "Payment",
      "Date",
      "Status",
    ];
    const data = recentOrders.map((order) => [
      order.order_number,
      order.customer_name,
      formatCurrency(order.total_price),
      order.payment_type,
      formatDate(order.sale_date),
      order.status || "N/A",
    ]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `recent_orders_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadExcel = () => {
    const data = recentOrders.map((order) => ({
      "Order Number": order.order_number,
      Customer: order.customer_name,
      Amount: order.total_price,
      Payment: order.payment_type,
      Date: formatDate(order.sale_date),
      Status: order.status || "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recent Orders");
    XLSX.writeFile(
      workbook,
      `recent_orders_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF();
      doc.text("Recent Orders Report", 14, 15);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

      const headers = [
        ["Order Number", "Customer", "Amount", "Payment", "Date", "Status"],
      ];
      const data = recentOrders.map((order) => [
        order.sale_id,
        order.customer_name,
        formatCurrency(order.total_price),
        order.payment_type,
        formatDate(order.sale_date),
        order.status || "N/A",
      ]);

      doc.autoTable({
        head: headers,
        body: data,
        startY: 30,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [61, 128, 133] },
        columnStyles: {
          2: { cellWidth: 25 },
          5: { cellWidth: 25 },
        },
      });

      doc.save(`recent_orders_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  useEffect(() => {
    fetchDashboardData();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let interval;
    const currentSales = metrics.currentMonthSales; // Changed from totalSales to currentMonthSales
    if (salesValue < currentSales) {
      interval = setInterval(() => {
        setSalesValue((prev) => Math.min(prev + increment, currentSales));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [salesValue, metrics.currentMonthSales, increment]);

  return (
    <div>
      <div className="dashboard-title">Dashboard Overview</div>

      <div className="cards">
        <div className="card">
          <div>
            <h3>{formatCurrency(metrics.totalSales)}</h3>
            <p>Total Sales</p>
          </div>
          <i className="fas fa-coins"></i>
        </div>
        <div className="card">
          <div>
            <h3>{metrics.productsCount}</h3>
            <p>Products Available</p>
          </div>
          <i className="fas fa-box-open"></i>
        </div>
        <div className="card">
          <div>
            <h3>{metrics.ordersCount}</h3>
            <p>Orders Processed</p>
          </div>
          <i className="fas fa-shopping-cart"></i>
        </div>
        <div className="card">
          <div>
            <h3>{metrics.customersCount}</h3>
            <p>Total Customers</p>
          </div>
          <i className="fas fa-users"></i>
        </div>
      </div>

      <div className="analytics">
        <h3>Sales Analytics</h3>
        <div className="chart-container" style={{ height: "400px" }}>
          <canvas id="salesChart"></canvas>
        </div>
      </div>

      <div className="card">
        <div>
          <h3>{formatCurrency(metrics.currentMonthSales)}</h3>{" "}
          {/* Changed to currentMonthSales */}
          <p>Current Month Sales</p> {/* Updated label */}
        </div>
        <i className="fas fa-chart-line"></i>
      </div>

      <div className="progress-section">
        <h3>Monthly Sales Progress</h3>
        <br />
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${(metrics.currentMonthSales / targetSales) * 100}%`, // Changed to use currentMonthSales
              backgroundColor:
                metrics.currentMonthSales >= targetSales
                  ? "#4CAF50"
                  : "#F5A100", // Changed to use currentMonthSales
            }}
          ></div>
        </div>
        <div className="progress-text">
          {Math.round((metrics.currentMonthSales / targetSales) * 100)}% of
          monthly target {/* Changed to use currentMonthSales */}
          <br />({formatCurrency(metrics.currentMonthSales)} of{" "}
          {formatCurrency(targetSales)}){" "}
          {/* Changed to use currentMonthSales */}
        </div>
      </div>

      <div className="recent-transactions">
        <div className="transactions-header">
          <h3>Recent Transactions</h3>
          <div className="report-buttons">
            <button onClick={downloadCSV} title="Download CSV">
              <FaFileCsv />
            </button>
            <button onClick={downloadExcel} title="Download Excel">
              <FaFileExcel />
            </button>
            <button onClick={downloadPDF} title="Download PDF">
              <FaFilePdf />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading transactions...</div>
        ) : recentOrders.length > 0 ? (
          <div className="transaction-list-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.order_number}>
                    <td>{order.order_number}</td>
                    <td>{order.customer_name}</td>
                    <td>{formatCurrency(order.total_price)}</td>
                    <td>{order.payment_type}</td>
                    <td>{formatDate(order.sale_date)}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: getStatusColor(order.status),
                        }}
                      >
                        {order.status || "N/A"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-transactions">No recent transactions found</div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
