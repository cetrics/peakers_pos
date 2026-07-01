import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./styles/MyShiftPage.css";

const MyShiftPage = () => {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClockStatus();

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchClockStatus = async () => {
    const res = await axios.get("/api/my-clock-status", {
      withCredentials: true,
    });

    setClockedIn(res.data.clocked_in);
    setClockInTime(res.data.clock_in ? new Date(res.data.clock_in) : null);
  };

  const workedTime = useMemo(() => {
    if (!clockedIn || !clockInTime) return "00:00:00";

    const seconds = Math.max(Math.floor((now - clockInTime) / 1000), 0);
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");

    return `${h}:${m}:${s}`;
  }, [now, clockedIn, clockInTime]);

  const clockIn = async () => {
    try {
      setLoading(true);
      const res = await axios.post(
        "/api/clock-in",
        {},
        {
          withCredentials: true,
        },
      );

      setClockedIn(true);
      setClockInTime(new Date(res.data.clock_in));
    } catch (error) {
      alert(error.response?.data?.error || "Failed to clock in");
    } finally {
      setLoading(false);
    }
  };

  const clockOut = async () => {
    try {
      setLoading(true);
      await axios.post(
        "/api/clock-out",
        {},
        {
          withCredentials: true,
        },
      );

      setClockedIn(false);
      setClockInTime(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to clock out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-shift-page">
      <div className="shift-card">
        <div className="shift-header">
          <div>
            <span>Staff Attendance</span>
            <h1>My Shift</h1>
            <p>
              Clock in when you start work and clock out when your shift ends.
            </p>
          </div>

          <div className={clockedIn ? "shift-status active" : "shift-status"}>
            {clockedIn ? "Active" : "Not Clocked In"}
          </div>
        </div>

        {clockedIn ? (
          <>
            <div className="timer-box">
              <span>Time Worked</span>
              <strong>{workedTime}</strong>
            </div>

            <div className="shift-info">
              <span>Clocked In</span>
              <strong>{clockInTime?.toLocaleString()}</strong>
            </div>

            <button
              className="clock-out-btn"
              onClick={clockOut}
              disabled={loading}
            >
              {loading ? "Please wait..." : "Clock Out"}
            </button>
          </>
        ) : (
          <>
            <div className="empty-shift">
              <i className="fas fa-clock"></i>
              <h2>You are not clocked in</h2>
              <p>You can use the system without clocking in.</p>
            </div>

            <button
              className="clock-in-btn"
              onClick={clockIn}
              disabled={loading}
            >
              {loading ? "Please wait..." : "Clock In"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MyShiftPage;
