import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import axios from "axios";

const ProtectedLayout = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true); // ⏳ Wait before rendering

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get("/check-session");
        if (res.status !== 200 || !res.data.logged_in) {
          window.location.href = "/login"; // 🔁 Redirect via full reload
        } else {
          setChecking(false); // ✅ Allow rendering
        }
      } catch (err) {
        window.location.href = "/login"; // 🔁 On error, redirect
      }
    };

    checkSession();
  }, []);

  if (checking) return null; // ⏳ Don't show anything while checking session

  return <Outlet />; // ✅ Now safe to render protected routes
};

export default ProtectedLayout;
