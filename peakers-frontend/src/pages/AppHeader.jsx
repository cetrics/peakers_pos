import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import "./styles/Header.css";

const AppHeader = ({ businessType, userRole }) => {
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [restaurantModule, setRestaurantModule] = useState(null);
  const isOwner = userRole === "owner";
  const isSalesPage = location.pathname === "/sales-page";
  const isRestaurantModulesPage = location.pathname === "/restaurant-modules";

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

  useEffect(() => {
    if (window.Tawk_API) return;

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://embed.tawk.to/684ad70a33b91e191b553ae0/1iti5g0je";
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");

    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const path = location.pathname;

    if (path === "/restaurant-modules") {
      setRestaurantModule(null);
      return;
    }

    if (
      path.includes("restaurant-expenses") ||
      path.includes("purchases") ||
      path.includes("restaurant-reports")
    ) {
      setRestaurantModule("finance");
      localStorage.setItem("restaurantModule", "finance");
      return;
    }

    if (
      path.includes("restaurant_products") ||
      path.includes("restaurant_suppliers") ||
      path.includes("restaurant-production") ||
      path.includes("restaurant-stocktake") ||
      path.includes("wastage")
    ) {
      setRestaurantModule("inventory");
      localStorage.setItem("restaurantModule", "inventory");
      return;
    }

    if (
      path.includes("restaurant-sales") ||
      path.includes("restaurant-kitchen") ||
      path.includes("restaurant-orders") ||
      path.includes("restaurant_dashboard")
    ) {
      setRestaurantModule("pos");
      localStorage.setItem("restaurantModule", "pos");
      return;
    }

    if (path.includes("restaurant-setup")) {
      setRestaurantModule("setup");
      localStorage.setItem("restaurantModule", "setup");
    }
  }, [location.pathname]);

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

                  <NavLink to="/container_inventory" onClick={closeMenus}>
                    Containers
                  </NavLink>
                </div>
              )}
            </div>
          </>
        )}

        {businessType === "restaurant" && (
          <>
            <NavLink
              to="/restaurant-modules"
              className="category"
              onClick={closeMenus}
            >
              <i className="fas fa-th-large"></i>
              <span>Modules</span>
            </NavLink>

            {/* Everyone can access My Shift */}
            <NavLink to="/my-shift" className="category" onClick={closeMenus}>
              <i className="fas fa-clock"></i>
              <span>My Shift</span>
            </NavLink>

            {["owner", "admin", "manager"].includes(userRole) && (
              <NavLink
                to="/staff-attendance"
                className="category"
                onClick={closeMenus}
              >
                <i className="fas fa-user-clock"></i>
                <span>Attendance</span>
              </NavLink>
            )}

            {!isRestaurantModulesPage && (
              <>
                {restaurantModule === "pos" && (
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

                    <NavLink
                      to="/customers"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-users"></i>
                      <span>Customers</span>
                    </NavLink>
                  </>
                )}

                {restaurantModule === "inventory" && (
                  <>
                    <NavLink
                      to="/restaurant_products"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-box-open"></i>
                      <span>Products</span>
                    </NavLink>

                    <NavLink
                      to="/restaurant_suppliers"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-truck"></i>
                      <span>Suppliers</span>
                    </NavLink>

                    <NavLink
                      to="/restaurant-production"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-industry"></i>
                      <span>Production</span>
                    </NavLink>
                    <NavLink
                      to="/restaurant-stocktake"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-clipboard-check"></i>
                      <span>Stocktake</span>
                    </NavLink>

                    <NavLink
                      to="/wastage"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-trash-alt"></i>
                      <span>Wastage</span>
                    </NavLink>
                  </>
                )}

                {restaurantModule === "finance" && (
                  <>
                    <NavLink
                      to="/restaurant_expenses"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-wallet"></i>
                      <span>Expenses</span>
                    </NavLink>

                    <NavLink
                      to="/purchases"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-shopping-basket"></i>
                      <span>Purchases</span>
                    </NavLink>

                    <NavLink
                      to="/restaurant-reports"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-chart-pie"></i>
                      <span>Reports</span>
                    </NavLink>
                  </>
                )}

                {restaurantModule === "setup" && (
                  <>
                    <NavLink
                      to="/restaurant-setup"
                      className="category"
                      onClick={closeMenus}
                    >
                      <i className="fas fa-cogs"></i>
                      <span>Setup</span>
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
                  </>
                )}
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
};

export default AppHeader;
