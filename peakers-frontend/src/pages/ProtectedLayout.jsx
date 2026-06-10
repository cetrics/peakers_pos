import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import axios from "axios";
import AppHeader from "./AppHeader";

const ProtectedLayout = () => {
  const [checking, setChecking] = useState(true);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get("/check-session", {
          withCredentials: true,
        });

        if (res.status !== 200 || !res.data.logged_in) {
          window.location.href = "/login";
          return;
        }

        setSessionData(res.data);
        setChecking(false);
      } catch (err) {
        window.location.href = "/login";
      }
    };

    checkSession();
  }, []);

  if (checking) return null;

  return (
    <>
      <AppHeader
        businessType={sessionData?.business_type || "retail"}
        userRole={sessionData?.role}
      />

      <div className="main-content">
        <Outlet context={sessionData} />
      </div>
    </>
  );
};

export default ProtectedLayout;
