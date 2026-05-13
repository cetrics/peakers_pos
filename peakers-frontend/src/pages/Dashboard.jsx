import React, { useEffect, useState, useRef } from "react";
import Chart from "chart.js/auto";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
  FaSignOutAlt,
  FaSyncAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./styles/Main.css"; // keep your existing CSS
import axios from "axios";

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    currentMonthSales: 0,
    monthlyTarget: 125000,
    productsCount: 0,
    ordersCount: 0,
    customersCount: 0,
  });
  const [salesValue, setSalesValue] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartLabels, setChartLabels] = useState([]); // NEW
  const [chartSales, setChartSales] = useState([]); // NEW
  const [userRole, setUserRole] = useState("");

  const targetSales = metrics.monthlyTarget;
  const increment = Math.ceil(targetSales / 100);
  const chartRef = useRef(null);

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState("");

  useEffect(() => {
    axios
      .get("/check-session", { withCredentials: true })
      .then((res) => {
        setUserRole(res.data.role || "");
      })
      .catch((err) => {
        console.error("Error checking session:", err);
      });
  }, []);

  useEffect(() => {
    axios
      .get("/super-admin-shops", {
        withCredentials: true,
        headers: {
          Accept: "application/json",
        },
      })
      .then((res) => {
        console.log("Super admin shops:", res.data);
        setShops(res.data.shops || []);
      })
      .catch((err) => {
        console.error(
          "Error loading super admin shops:",
          err.response?.data || err,
        );
      });
  }, []);

  const handleShopChange = async (e) => {
    const businessId = e.target.value;
    setSelectedShop(businessId);

    await axios.post(
      "/select-shop",
      { business_id: businessId },
      { withCredentials: true },
    );

    window.location.reload();
  };

  // Format currency (Ksh, no decimals, with commas)
  const formatCurrency = (amount) => {
    return `Ksh.${(Number(amount) || 0)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  // Format date (same as mobile: "11 May 2025")
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Status color mapping (exactly as mobile)
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

  // Render the line chart (same as before, but uses mobile data)
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
            grid: { color: "#ddd" },
            ticks: {
              color: "#333",
              callback: function (value) {
                return `Ksh.${value.toLocaleString()}`;
              },
            },
          },
          x: {
            grid: { color: "#ddd" },
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
            labels: { color: "#333", font: { size: 14 } },
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
          line: { cubicInterpolationMode: "monotone" },
        },
      },
    });
  };

  // Fetch all dashboard data (mirrors mobile fetchDashboardData)
  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const [salesRes, ordersRes] = await Promise.all([
        fetch("/sales-data"),
        fetch("/get-orders"),
      ]);

      const salesJson = await salesRes.json();
      const ordersJson = await ordersRes.json();

      if (salesJson.metrics) {
        setMetrics({
          totalSales: salesJson.metrics.total_sales || 0,
          currentMonthSales: salesJson.metrics.current_month_sales || 0,
          monthlyTarget: salesJson.metrics.monthly_target || 125000,
          productsCount: salesJson.metrics.products_count || 0,
          ordersCount: salesJson.metrics.orders_count || 0,
          customersCount: salesJson.metrics.customers_count || 0,
        });
      }

      // ✅ Store chart data in state instead of rendering directly
      if (salesJson.labels && salesJson.sales) {
        setChartLabels(salesJson.labels);
        setChartSales(salesJson.sales);
      }

      // Group orders by sale_id (exactly like mobile)
      if (ordersJson.orders) {
        const ordersMap = new Map();
        ordersJson.orders.forEach((order) => {
          if (!ordersMap.has(order.sale_id)) {
            ordersMap.set(order.sale_id, {
              sale_id: order.sale_id,
              order_number: order.order_number,
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
          .slice(0, 5); // only 5 most recent
        setRecentOrders(sortedOrders);
      }

      setLoading(false);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ NEW: Separate useEffect to render chart when chart data changes
  useEffect(() => {
    if (chartLabels.length > 0 && chartSales.length > 0) {
      renderSalesChart(chartLabels, chartSales);
    }
  }, [chartLabels, chartSales]);

  // Logout handler (same as mobile)
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("token");
      sessionStorage.clear();
      navigate("/login");
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchDashboardData();
  };

  // Animate sales value (same incremental effect)
  useEffect(() => {
    let interval;
    const currentSales = metrics.currentMonthSales;
    if (salesValue < currentSales) {
      interval = setInterval(() => {
        setSalesValue((prev) => Math.min(prev + increment, currentSales));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [salesValue, metrics.currentMonthSales, increment]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const progressPercent = Math.min(
    (metrics.currentMonthSales / targetSales) * 100,
    100,
  );

  return (
    <div>
      {/* New header with logout and refresh (styled to match your existing layout) */}
      <div
        className="dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div
          className="dashboard-title"
          style={{ fontSize: "24px", fontWeight: "bold" }}
        >
          Dashboard
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {shops.length > 0 && (
            <select value={selectedShop} onChange={handleShopChange}>
              <option value="">Select Shop</option>
              {shops.map((shop) => (
                <option key={shop.business_id} value={shop.business_id}>
                  {shop.company}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: "#0B1446",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaSyncAlt className={refreshing ? "spin" : ""} /> Refresh
          </button>

          {userRole === "owner" && (
            <button
              onClick={() => navigate("/register-business")}
              style={{
                background: "#F5A100",
                color: "#0B1446",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Manage Businesses
            </button>
          )}
        </div>
      </div>

      {/* Your existing cards (keep className="cards" etc.) */}
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

      {/* Sales Analytics chart */}
      <div className="analytics">
        <h3>Sales Analytics</h3>
        <div className="chart-container" style={{ height: "400px" }}>
          <canvas id="salesChart"></canvas>
        </div>
      </div>

      {/* Monthly progress bar (now uses currentMonthSales) */}
      <div className="card">
        <div>
          <h3>{formatCurrency(metrics.currentMonthSales)}</h3>
          <p>Current Month Sales</p>
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
              width: `${progressPercent}%`,
              backgroundColor:
                metrics.currentMonthSales >= targetSales
                  ? "#4CAF50"
                  : "#F5A100",
            }}
          ></div>
        </div>
        <div className="progress-text">
          {Math.round(progressPercent)}% of monthly target
          <br />({formatCurrency(metrics.currentMonthSales)} of{" "}
          {formatCurrency(targetSales)})
        </div>
      </div>

      {/* Recent Transactions (now only 5 items, grouped by sale_id, with status badges) */}
      <div className="recent-transactions">
        <div className="transactions-header">
          <h3>Recent Transactions</h3>
          <div className="report-buttons">
            <button
              onClick={() => {
                /* your existing CSV download */
              }}
              title="Download CSV"
            >
              <FaFileCsv />
            </button>
            <button
              onClick={() => {
                /* your existing Excel download */
              }}
              title="Download Excel"
            >
              <FaFileExcel />
            </button>
            <button
              onClick={() => {
                /* your existing PDF download */
              }}
              title="Download PDF"
            >
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
