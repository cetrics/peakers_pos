import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./styles/Auth.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(
        "/login",
        { username, password },
        { withCredentials: true },
      );

      if (res.data.success || res.data.logged_in) {
        window.location.href = "/";
      } else {
        setError(res.data.error || "Invalid login details.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-left">
          <div className="auth-brand">
            <img src="/static/images/logos/main_logo.png" alt="Peakers POS" />
            <div>
              <h1>Peakers POS</h1>
              <p>Smart. Simple. Powerful.</p>
            </div>
          </div>

          <div className="auth-hero-content">
            <h2>
              Manage your business <span>smarter</span>, not harder.
            </h2>

            <p>
              Peakers POS helps you streamline sales, manage inventory, track
              reports and grow your business effortlessly.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature">
                <div className="auth-feature-icon">📊</div>
                <div>
                  <h3>Real-time Reports</h3>
                  <p>Get insights that help you grow</p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">📦</div>
                <div>
                  <h3>Inventory Management</h3>
                  <p>Track stock and never run out</p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">🛒</div>
                <div>
                  <h3>Easy Sales</h3>
                  <p>Fast, simple and reliable POS</p>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-contact-card">
            <h3>Need Help? Contact Us</h3>
            <p>We’re here to help you succeed.</p>

            <a
              href="https://wa.me/254712345678"
              target="_blank"
              rel="noreferrer"
            >
              <span>🟢</span> +254 700 391 535
            </a>

            <a href="mailto:info@peakersdesign.co.ke">
              <span>✉️</span> info@peakersdesign.co.ke
            </a>

            <a
              href="https://peakersdesign.co.ke"
              target="_blank"
              rel="noreferrer"
            >
              <span>🌐</span> www.peakersdesign.co.ke
            </a>
          </div>

          <div className="auth-visual-card">
            <div className="mini-dashboard">
              <div className="mini-top"></div>
              <div className="mini-sales">KES 87,650</div>
              <div className="mini-chart"></div>
              <div className="mini-ring"></div>
            </div>

            <div className="mini-printer">
              <div></div>
              <span>Peakers POS</span>
            </div>

            <div className="mini-boxes">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-container">
            <div className="auth-logo">
              <img src="/static/images/logos/main_logo.png" alt="Main Logo" />
            </div>

            <h2>Peakers POS</h2>
            <p className="auth-subtitle">
              Welcome back! Please login to continue
            </p>

            {error && <div className="auth-alert error">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="auth-input-group">
                <label>Username or Email</label>
                <div className="auth-input-wrap">
                  <span>👤</span>
                  <input
                    type="text"
                    placeholder="Enter your username or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Password</label>
                <div className="auth-input-wrap">
                  <span>🔒</span>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-options">
                <label>
                  <input type="checkbox" defaultChecked /> Remember me
                </label>

                <Link to="/forgot_password">Forgot your password?</Link>
              </div>

              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="auth-secure">
              <div></div>
              <span>Secure and trusted</span>
              <div></div>
            </div>

            <p className="auth-safe">🛡️ Your data is safe with us</p>
          </div>
        </div>
      </div>

      <div className="auth-bottom">
        <span>© 2026 Peakers POS. All rights reserved.</span>
        <span>|</span>
      </div>
    </div>
  );
};

export default LoginPage;
