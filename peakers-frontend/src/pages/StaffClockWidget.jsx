import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./styles/StaffClockWidget.css";

const StaffClockWidget = () => {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClockStatus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchClockStatus = async () => {
    try {
      const res = await axios.get("/api/my-clock-status", {
        withCredentials: true,
      });

      setClockedIn(res.data.clocked_in);
      setClockInTime(res.data.clock_in ? new Date(res.data.clock_in) : null);
    } catch (error) {
      console.error("Clock status error:", error);
    }
  };

  const workedTime = useMemo(() => {
    if (!clockedIn || !clockInTime) return "00:00:00";

    const diffMs = now - clockInTime;
    const totalSeconds = Math.max(Math.floor(diffMs / 1000), 0);

    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
      2,
      "0",
    );
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }, [now, clockedIn, clockInTime]);

  const handleClockIn = async () => {
    try {
      setLoading(true);

      const res = await axios.post(
        "/api/clock-in",
        {},
        { withCredentials: true },
      );

      setClockedIn(true);
      setClockInTime(new Date(res.data.clock_in));
    } catch (error) {
      alert(error.response?.data?.error || "Failed to clock in.");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setLoading(true);

      await axios.post("/api/clock-out", {}, { withCredentials: true });

      setClockedIn(false);
      setClockInTime(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to clock out.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-clock-card">
      <div className="staff-clock-top">
        <div>
          <span>Staff Shift</span>
          <h4>{clockedIn ? "Active Shift" : "Not Clocked In"}</h4>
        </div>

        <div className={clockedIn ? "clock-dot active" : "clock-dot"}></div>
      </div>

      {clockedIn ? (
        <>
          <div className="clock-info">
            <span>Clocked In</span>
            <strong>{clockInTime?.toLocaleTimeString()}</strong>
          </div>

          <div className="clock-timer">{workedTime}</div>

          <button
            type="button"
            className="clock-out-btn"
            onClick={handleClockOut}
            disabled={loading}
          >
            {loading ? "Please wait..." : "Clock Out"}
          </button>
        </>
      ) : (
        <>
          <p className="clock-muted">
            Click clock in when you are starting your shift.
          </p>

          <button
            type="button"
            className="clock-in-btn"
            onClick={handleClockIn}
            disabled={loading}
          >
            {loading ? "Please wait..." : "Clock In"}
          </button>
        </>
      )}
    </div>
  );
};

export default StaffClockWidget;
