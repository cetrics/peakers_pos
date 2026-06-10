import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./styles/Auth.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/static/images/logos/main_logo.png" alt="Main Logo" />
        </div>

        <h2>Peakers POS</h2>

        {error && <div className="auth-alert error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="auth-input-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="auth-input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/forgot-password">Forgot your password?</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
