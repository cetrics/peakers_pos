import React, { useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import "./styles/Auth.css";

const ResetPasswordPage = () => {
  const { token } = useParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [alertType, setAlertType] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[@$!%*?&]/.test(password),
      match: password === confirmPassword && password !== "",
    };
  }, [password, confirmPassword]);

  const isValid = Object.values(rules).every(Boolean);

  const resetPassword = async () => {
    if (!isValid) return;

    setLoading(true);
    setMessage("");
    setAlertType("");

    try {
      const res = await axios.post(`/reset-password/${token}`, {
        password,
      });

      setMessage(res.data.message || "Password reset successful!");
      setAlertType("success");

      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Password reset failed.");
      setAlertType("error");
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ valid, text }) => (
    <span className={valid ? "valid" : "invalid"}>
      <i className={`fas ${valid ? "fa-check" : "fa-times"}`}></i>
      {text}
    </span>
  );

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/static/images/logos/main_logo.png" alt="Logo" />
        </div>

        <h2>Reset Password</h2>

        {message && <div className={`auth-alert ${alertType}`}>{message}</div>}

        <div className="auth-input-group password-group">
          <label>New Password</label>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
          />
          <i
            className={`fas ${
              showPassword ? "fa-eye-slash" : "fa-eye"
            } toggle-password`}
            onClick={() => setShowPassword((prev) => !prev)}
          ></i>

          <div className="password-requirements">
            <Requirement valid={rules.length} text="At least 8 characters" />
            <Requirement
              valid={rules.uppercase}
              text="At least 1 uppercase letter"
            />
            <Requirement
              valid={rules.lowercase}
              text="At least 1 lowercase letter"
            />
            <Requirement valid={rules.number} text="At least 1 number" />
            <Requirement
              valid={rules.special}
              text="At least 1 special character"
            />
          </div>
        </div>

        <div className="auth-input-group password-group">
          <label>Confirm Password</label>
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              borderColor: confirmPassword
                ? rules.match
                  ? "#28a745"
                  : "#dc3545"
                : "#ccc",
            }}
            placeholder="Confirm new password"
          />
          <i
            className={`fas ${
              showConfirm ? "fa-eye-slash" : "fa-eye"
            } toggle-password`}
            onClick={() => setShowConfirm((prev) => !prev)}
          ></i>
        </div>

        <button
          className="auth-btn"
          onClick={resetPassword}
          disabled={!isValid || loading}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
