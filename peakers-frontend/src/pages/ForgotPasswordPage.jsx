import React, { useState } from "react";
import axios from "axios";
import "./styles/Auth.css";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [alertType, setAlertType] = useState("");
  const [loading, setLoading] = useState(false);

  const sendResetLink = async () => {
    setMessage("");
    setAlertType("");

    if (!email) {
      setMessage("Please enter your email.");
      setAlertType("error");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post("/forgot-password", { email });
      setMessage(res.data.message || "Reset link sent successfully.");
      setAlertType("success");
      setEmail("");
    } catch (err) {
      setMessage(err.response?.data?.error || "An error occurred.");
      setAlertType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/static/images/logos/main_logo.png" alt="Logo" />
        </div>

        <h2>Forgot Password</h2>

        {message && <div className={`auth-alert ${alertType}`}>{message}</div>}

        <div className="auth-input-group">
          <label>Enter your email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email address"
          />
        </div>

        <button className="auth-btn" onClick={sendResetLink} disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
