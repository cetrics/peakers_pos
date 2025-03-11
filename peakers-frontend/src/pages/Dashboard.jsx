import React, { useEffect, useState } from "react";
import Chart from "chart.js/auto";
import "./styles/Main.css"; // Create this file for styling

const Dashboard = () => {
  const [salesValue, setSalesValue] = useState(0);
  const targetSales = 12500;
  const increment = Math.ceil(targetSales / 100);

  useEffect(() => {
    // Fetch sales data and initialize Chart.js
    fetch("/sales-data")
      .then((response) => response.json())
      .then((data) => {
        const ctx = document.getElementById("salesChart").getContext("2d");

        new Chart(ctx, {
          type: "line",
          data: {
            labels: data.labels,
            datasets: [
              {
                label: "Sales Revenue ($)",
                data: data.sales,
                borderColor: "#F5A100",
                backgroundColor: "rgba(245, 161, 0, 0.2)",
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#F5A100",
                pointBorderColor: "#0B1446",
                pointRadius: 5,
              },
            ],
          },
          options: {
            responsive: true,
            animation: { duration: 1500, easing: "easeInOutBounce" },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: "#ddd" },
                ticks: { color: "#333" },
              },
              x: {
                grid: { color: "#ddd" },
                ticks: { color: "#333" },
              },
            },
            plugins: {
              legend: { labels: { color: "#333" } },
            },
          },
        });
      })
      .catch((error) => console.error("Error fetching sales data:", error));
  }, []);

  useEffect(() => {
    let interval;
    if (salesValue < targetSales) {
      interval = setInterval(() => {
        setSalesValue((prev) =>
          prev + increment > targetSales ? targetSales : prev + increment
        );
      }, 50);
    }
    return () => clearInterval(interval);
  }, [salesValue]);

  return (
    <div>
      <div className="dashboard-title">Dashboard Overview</div>

      {/* Cards Section */}
      <div className="cards">
        <div className="card">
          <div>
            <h3>Ksh.12,500</h3>
            <p>Total Sales</p>
          </div>
          <i className="fas fa-coins"></i>
        </div>
        <div className="card">
          <div>
            <h3>120</h3>
            <p>Products Available</p>
          </div>
          <i className="fas fa-box-open"></i>
        </div>
        <div className="card">
          <div>
            <h3>85</h3>
            <p>Orders Processed</p>
          </div>
          <i className="fas fa-shopping-cart"></i>
        </div>
        <div className="card">
          <div>
            <h3>200</h3>
            <p>Total Customers</p>
          </div>
          <i className="fas fa-users"></i>
        </div>
      </div>

      {/* Sales Analytics (Move this up) */}
      <div className="analytics">
        <h3>Sales Analytics</h3>
        <div className="chart-container">
          <canvas id="salesChart"></canvas>
        </div>
      </div>

      {/* Live Sales */}
      <div className="card">
        <div>
          <h3>Ksh.{salesValue.toLocaleString()}</h3>
          <p>Live Sales</p>
        </div>
        <i className="fas fa-chart-line"></i>
      </div>

      {/* Daily Sales Progress */}
      <div className="progress-section">
        <h3>Daily Sales Progress</h3>
        <br></br>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(salesValue / targetSales) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="recent-transactions">
        <h3>Recent Transactions</h3>
        <div className="transaction-list">
          <div className="transaction">
            <span>Order #12345</span>
            <span>Ksh.50.00</span>
          </div>
          <div className="transaction">
            <span>Order #12346</span>
            <span>Ksh.30.00</span>
          </div>
          <div className="transaction">
            <span>Order #12347</span>
            <span>Ksh.120.00</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
