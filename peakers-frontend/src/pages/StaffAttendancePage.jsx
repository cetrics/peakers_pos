import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./styles/StaffAttendancePage.css";

const StaffAttendancePage = () => {
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    const res = await axios.get("/api/staff-sessions", {
      withCredentials: true,
    });

    setSessions(res.data.sessions || []);
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((item) => {
      const query = search.toLowerCase();

      const matchesSearch =
        !query ||
        item.full_name?.toLowerCase().includes(query) ||
        item.role?.toLowerCase().includes(query) ||
        item.status?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, search, statusFilter]);

  const activeCount = sessions.filter(
    (item) => item.status === "active",
  ).length;
  const closedCount = sessions.filter(
    (item) => item.status === "closed",
  ).length;

  const formatDuration = (minutes) => {
    const hrs = Math.floor(Number(minutes || 0) / 60);
    const mins = Number(minutes || 0) % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div>
          <span>Staff Management</span>
          <h1>Staff Attendance</h1>
          <p>View staff clock-in and clock-out records.</p>
        </div>

        <button onClick={fetchSessions}>Refresh</button>
      </div>

      <div className="attendance-summary">
        <div>
          <span>Total Sessions</span>
          <strong>{sessions.length}</strong>
        </div>

        <div>
          <span>Clocked In</span>
          <strong>{activeCount}</strong>
        </div>

        <div>
          <span>Clocked Out</span>
          <strong>{closedCount}</strong>
        </div>
      </div>

      <div className="attendance-filters">
        <input
          placeholder="Search staff..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Clocked In</option>
          <option value="closed">Clocked Out</option>
        </select>
      </div>

      <div className="attendance-table-card">
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-cell">
                  No attendance records found.
                </td>
              </tr>
            ) : (
              filteredSessions.map((item) => (
                <tr key={item.session_id}>
                  <td>
                    <strong>{item.full_name || "Unknown User"}</strong>
                  </td>

                  <td>{item.role}</td>

                  <td>{new Date(item.clock_in).toLocaleString()}</td>

                  <td>
                    {item.clock_out
                      ? new Date(item.clock_out).toLocaleString()
                      : "Still clocked in"}
                  </td>

                  <td>
                    {item.status === "active"
                      ? "In progress"
                      : formatDuration(item.duration_minutes)}
                  </td>

                  <td>
                    <span
                      className={
                        item.status === "active"
                          ? "status-badge active"
                          : "status-badge closed"
                      }
                    >
                      {item.status === "active" ? "Clocked In" : "Clocked Out"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffAttendancePage;
