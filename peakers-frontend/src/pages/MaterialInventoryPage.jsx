import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./styles/Material.css";

const MaterialInventoryPage = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMaterialInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get("/api/v1/material-inventory");

      if (res.data.status === "success") {
        setMaterials(res.data.materials);
      } else {
        throw new Error(res.data.message || "Invalid response from server");
      }
    } catch (err) {
      console.error("Failed to fetch material inventory", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load inventory data"
      );
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterialInventory();
  }, []);

  return (
    <div className="page-container">
      <div className="action-buttons">
        <Link to="/material-page" className="circle-btn with-label">
          <span className="btn-label">Back to Materials</span>📋
        </Link>
        <button
          className="circle-btn with-label"
          onClick={fetchMaterialInventory}
        >
          <span className="btn-label">Refresh</span>🔄
        </button>
      </div>

      <div className="material-page-box wide">
        <h3>📦 Material Inventory Summary</h3>

        {loading ? (
          <div className="text-center">Loading inventory data...</div>
        ) : error ? (
          <div className="text-center error-message">
            {error}
            <button onClick={fetchMaterialInventory} className="retry-btn">
              Retry
            </button>
          </div>
        ) : (
          <table className="material-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th>Total Supplied</th>
                <th>Total Used</th>
                <th>Current Stock</th>
                <th>Total Cost</th>
                <th>Avg. Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {materials.length > 0 ? (
                materials.map((material) => (
                  <tr key={material.material_id}>
                    <td>{material.material_name}</td>
                    <td>{material.unit}</td>
                    <td>{material.total_supplied.toLocaleString()}</td>
                    <td>{material.total_used.toLocaleString()}</td>
                    <td
                      className={
                        material.current_stock < material.total_supplied * 0.2
                          ? "text-warning"
                          : ""
                      }
                    >
                      {material.current_stock.toLocaleString()}
                    </td>
                    <td>KES {material.total_cost.toLocaleString()}</td>
                    <td>KES {material.avg_unit_cost.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center">
                    No material inventory data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MaterialInventoryPage;
