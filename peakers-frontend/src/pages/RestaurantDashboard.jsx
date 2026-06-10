// RestaurantDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import Chart from "chart.js/auto";
import axios from "axios";
import { FaSyncAlt } from "react-icons/fa";
import "./styles/Main.css";

const RestaurantDashboard = () => {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    currentMonthSales: 0,
    monthlyTarget: 125000,
    menuProductsCount: 0,
    ordersCount: 0,
    customersCount: 0,
    materialsCount: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSales, setChartSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const chartRef = useRef(null);

  const formatCurrency = (amount) => {
    return `Ksh.${(Number(amount) || 0)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status) => {
    if (!status) return "#9E9E9E";

    switch (status.toLowerCase()) {
      case "completed":
      case "served":
        return "darkgreen";
      case "pending":
        return "#FF9800";
      case "cancelled":
      case "voided":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  };

  const renderSalesChart = (labels, salesData) => {
    const ctx = document.getElementById("restaurantSalesChart");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const maxValue = Math.max(...salesData, 0) * 1.2;

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Restaurant Sales Revenue (Ksh)",
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
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxValue > 0 ? maxValue : 10000,
            ticks: {
              callback: function (value) {
                return `Ksh.${value.toLocaleString()}`;
              },
            },
          },
        },
      },
    });
  };

  const fetchRestaurantDashboardData = async () => {
    try {
      setRefreshing(true);

      const res = await axios.get("/restaurant-dashboard-data", {
        withCredentials: true,
      });

      const data = res.data;

      setMetrics({
        totalSales: data.metrics?.total_sales || 0,
        currentMonthSales: data.metrics?.current_month_sales || 0,
        monthlyTarget: data.metrics?.monthly_target || 125000,
        menuProductsCount: data.metrics?.menu_products_count || 0,
        ordersCount: data.metrics?.orders_count || 0,
        customersCount: data.metrics?.customers_count || 0,
        materialsCount: data.metrics?.materials_count || 0,
      });

      setRecentOrders(data.recent_orders || []);
      setTopProducts(data.top_products || []);
      setChartLabels(data.labels || []);
      setChartSales(data.sales || []);
      setLoading(false);
    } catch (error) {
      console.error("Restaurant dashboard error:", error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRestaurantDashboardData();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (chartLabels.length > 0 && chartSales.length > 0) {
      renderSalesChart(chartLabels, chartSales);
    }
  }, [chartLabels, chartSales]);

  if (loading) {
    return <div className="loading">Loading restaurant dashboard...</div>;
  }

  const progressPercent = Math.min(
    (metrics.currentMonthSales / metrics.monthlyTarget) * 100,
    100,
  );

  return (
    <div>
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
          Restaurant Dashboard
        </div>

        <button
          onClick={fetchRestaurantDashboardData}
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
      </div>

      <div className="cards">
        <div className="card">
          <div>
            <h3>{formatCurrency(metrics.totalSales)}</h3>
            <p>Total Restaurant Sales</p>
          </div>
          <i className="fas fa-coins"></i>
        </div>

        <div className="card">
          <div>
            <h3>{metrics.menuProductsCount}</h3>
            <p>Menu Products</p>
          </div>
          <i className="fas fa-utensils"></i>
        </div>

        <div className="card">
          <div>
            <h3>{metrics.ordersCount}</h3>
            <p>Restaurant Orders</p>
          </div>
          <i className="fas fa-receipt"></i>
        </div>

        <div className="card">
          <div>
            <h3>{metrics.materialsCount}</h3>
            <p>Raw Materials</p>
          </div>
          <i className="fas fa-boxes"></i>
        </div>
      </div>

      <div className="analytics">
        <h3>Restaurant Sales Analytics</h3>
        <div className="chart-container" style={{ height: "400px" }}>
          <canvas id="restaurantSalesChart"></canvas>
        </div>
      </div>

      <div className="progress-section">
        <h3>Monthly Restaurant Sales Progress</h3>
        <br />
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progressPercent}%`,
              backgroundColor:
                metrics.currentMonthSales >= metrics.monthlyTarget
                  ? "#4CAF50"
                  : "#F5A100",
            }}
          ></div>
        </div>

        <div className="progress-text">
          {Math.round(progressPercent)}% of monthly target
          <br />
          {formatCurrency(metrics.currentMonthSales)} of{" "}
          {formatCurrency(metrics.monthlyTarget)}
        </div>
      </div>

      <div className="recent-transactions">
        <div className="transactions-header">
          <h3>Top Selling Menu Items</h3>
        </div>

        {topProducts.length > 0 ? (
          <div className="transaction-list-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity Sold</th>
                  <th>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item, index) => (
                  <tr key={index}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity_sold}</td>
                    <td>{formatCurrency(item.total_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-transactions">No top products found</div>
        )}
      </div>

      <div className="recent-transactions">
        <div className="transactions-header">
          <h3>Recent Restaurant Orders</h3>
        </div>

        {recentOrders.length > 0 ? (
          <div className="transaction-list-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Date</th>
                  <th>Kitchen</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.restaurant_order_id}>
                    <td>{order.order_number}</td>
                    <td>{order.customer_name || "Walk-in"}</td>
                    <td>{formatCurrency(order.total_price)}</td>
                    <td>{order.payment_type}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: getStatusColor(order.kitchen_status),
                        }}
                      >
                        {order.kitchen_status || "N/A"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-transactions">
            No recent restaurant orders found
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantDashboard;
