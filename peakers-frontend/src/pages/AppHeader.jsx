import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import "./styles/Header.css";

const AppHeader = ({ businessType, userRole }) => {
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const isOwner = userRole === "owner";

  const isSalesPage = location.pathname === "/sales-page";

  const closeMenus = () => {
    setMenuOpen(false);
    setOpenDropdown(null);
  };

  const handleLogout = async () => {
    try {
      await axios.get("/logout", { withCredentials: true });
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.replace("/login");
    }
  };

  return (
    <>
      <header className="top-nav">
        <div className="nav-left">
          <button
            className="menu-toggle"
            id="toggleButton"
            onClick={() => setMenuOpen((prev) => !prev)}
            type="button"
          >
            <i className="fas fa-bars"></i>
          </button>

          <div className="logo">
            <img src="/static/images/logos/main_logo.png" alt="Main Logo" />
            <div>
              <span>Peakers POS</span>
              <small>
                {businessType === "restaurant"
                  ? "Restaurant Mode"
                  : "Retail Mode"}
              </small>
            </div>
          </div>
        </div>

        <div className="nav-center">
          <div className="pos-status-pill">
            <i className="fas fa-cash-register"></i>
            <span>Point of Sale System</span>
          </div>
        </div>

        <div className="nav-right">
          {isSalesPage && (
            <>
              <div className="bell-wrapper">
                <i className="fas fa-bell"></i>
                <span id="cartBadge" className="cart-badge"></span>
              </div>

              <a href="#" className="cart-icon">
                <i className="fas fa-shopping-cart"></i>
              </a>
            </>
          )}

          <button
            className="user-button"
            type="button"
            onClick={() => setShowLogout((prev) => !prev)}
          >
            <i className="fas fa-user-circle"></i>
          </button>

          {showLogout && (
            <div className="logout-button" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i>
              Logout
            </div>
          )}
        </div>
      </header>

      <nav className={`category-bar ${menuOpen ? "active" : ""}`}>
        {businessType === "retail" && (
          <>
            <NavLink to="/" className="category" onClick={closeMenus}>
              <i className="fas fa-chart-line"></i>
              <span>Dashboard</span>
            </NavLink>

            <NavLink to="/sales-page" className="category" onClick={closeMenus}>
              <i className="fas fa-cash-register"></i>
              <span>Sales</span>
            </NavLink>

            <NavLink to="/products" className="category" onClick={closeMenus}>
              <i className="fas fa-box-open"></i>
              <span>Products</span>
            </NavLink>

            <NavLink
              to="/orders-page"
              className="category"
              onClick={closeMenus}
            >
              <i className="fas fa-receipt"></i>
              <span>Orders</span>
            </NavLink>

            <div className="category-dropdown">
              <button
                className={`category dropdown-toggle ${
                  openDropdown === "more" ? "active" : ""
                }`}
                type="button"
                onClick={() =>
                  setOpenDropdown(openDropdown === "more" ? null : "more")
                }
              >
                <i className="fas fa-layer-group"></i>
                <span>More</span>
                <i className="fas fa-chevron-down dropdown-arrow"></i>
              </button>

              {openDropdown === "more" && (
                <div className="dropdown-menu show">
                  <NavLink to="/suppliers-page" onClick={closeMenus}>
                    Suppliers
                  </NavLink>
                  <NavLink to="/invoice" onClick={closeMenus}>
                    Invoice
                  </NavLink>
                  <NavLink to="/expenses-page" onClick={closeMenus}>
                    Expenses
                  </NavLink>
                </div>
              )}
            </div>
          </>
        )}

        {businessType === "restaurant" && (
          <>
            <NavLink
              to="/restaurant_dashboard"
              className="category"
              onClick={closeMenus}
            >
              <i className="fas fa-chart-line"></i>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/restaurant-sales"
              className="category"
              onClick={closeMenus}
            >
              <i className="fas fa-cash-register"></i>
              <span>Sales</span>
            </NavLink>

            <NavLink
              to="/restaurant-kitchen"
              className="category"
              onClick={closeMenus}
            >
              <i className="fas fa-utensils"></i>
              <span>Kitchen</span>
            </NavLink>

            <NavLink
              to="/restaurant-orders"
              className="category"
              onClick={closeMenus}
            >
              <i className="fas fa-receipt"></i>
              <span>Orders</span>
            </NavLink>

            <div className="category-dropdown">
              <button
                className={`category dropdown-toggle ${
                  openDropdown === "restaurant" ? "active" : ""
                }`}
                type="button"
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "restaurant" ? null : "restaurant",
                  )
                }
              >
                <i className="fas fa-store"></i>
                <span>Restaurant</span>
                <i className="fas fa-chevron-down dropdown-arrow"></i>
              </button>

              {openDropdown === "restaurant" && (
                <div className="dropdown-menu show">
                  <NavLink to="/restaurant-setup" onClick={closeMenus}>
                    Setup
                  </NavLink>
                  <NavLink to="/restaurant_products" onClick={closeMenus}>
                    Products
                  </NavLink>
                  <NavLink to="/restaurant_suppliers" onClick={closeMenus}>
                    Suppliers
                  </NavLink>
                </div>
              )}
            </div>
          </>
        )}

        <NavLink to="/customers" className="category" onClick={closeMenus}>
          <i className="fas fa-users"></i>
          <span>Customers</span>
        </NavLink>

        <NavLink
          to="/container_inventory"
          className="category"
          onClick={closeMenus}
        >
          <i className="fas fa-boxes"></i>
          <span>Container Inventory</span>
        </NavLink>

        {isOwner && (
          <NavLink
            to="/register-business"
            className="category"
            onClick={closeMenus}
          >
            <i className="fas fa-building"></i>
            <span>Business Management</span>
          </NavLink>
        )}
      </nav>
    </>
  );
};

export default AppHeader;
