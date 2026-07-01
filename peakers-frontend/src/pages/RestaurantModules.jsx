import React from "react";
import { useNavigate } from "react-router-dom";
import "./styles/RestaurantModules.css";

const RestaurantModules = () => {
  const navigate = useNavigate();

  const openModule = (module, path) => {
    localStorage.setItem("restaurantModule", module);
    navigate(path);
  };

  return (
    <div className="restaurant-modules-page">
      <div className="modules-header">
        <img src="/static/images/logos/main_logo.png" alt="Peakers POS" />
        <h1>Choose Restaurant Module</h1>
        <p>Select the area you want to work on</p>
      </div>

      <div className="modules-grid">
        <button onClick={() => openModule("pos", "/restaurant-sales")}>
          <i className="fas fa-cash-register"></i>
          <h2>POS</h2>
          <p>Sales, kitchen, orders, tables and customers</p>
        </button>

        <button onClick={() => openModule("inventory", "/restaurant_products")}>
          <i className="fas fa-boxes"></i>
          <h2>Inventory</h2>
          <p>Products, ingredients, recipes, suppliers and stock</p>
        </button>

        <button onClick={() => openModule("finance", "/restaurant_expenses")}>
          <i className="fas fa-coins"></i>
          <h2>Finance</h2>
          <p>Expenses, purchases, reports and payments</p>
        </button>

        <button onClick={() => openModule("setup", "/restaurant-setup")}>
          <i className="fas fa-cogs"></i>
          <h2>Setup</h2>
          <p>Tables, categories, users and system settings</p>
        </button>
      </div>
    </div>
  );
};

export default RestaurantModules;
