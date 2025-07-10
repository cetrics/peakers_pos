import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./styles/Material.css";

const MaterialManagementPage = () => {
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({
    material_name: "",
    unit: "",
  });
  const [editingMaterial, setEditingMaterial] = useState(null);

  const fetchMaterials = async () => {
    try {
      const res = await axios.get("/get-materials");
      setMaterials(res.data?.materials || []);
    } catch (err) {
      console.error("Failed to fetch materials", err);
      setMaterials([]);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleSave = async () => {
    if (!newMaterial.material_name || !newMaterial.unit) return;
    try {
      if (editingMaterial) {
        await axios.put(
          `/update-material/${editingMaterial.material_id}`,
          newMaterial,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        await axios.post("/add-material", newMaterial);
      }
      setNewMaterial({ material_name: "", unit: "" });
      setEditingMaterial(null);
      await fetchMaterials();
    } catch (err) {
      console.error(
        "Failed to save material",
        err.response?.data || err.message
      );
    }
  };

  const handleEdit = (material) => {
    setNewMaterial({
      material_name: material.material_name,
      unit: material.unit,
    });
    setEditingMaterial(material);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this material?")) return;
    try {
      await axios.delete(`/delete-material/${id}`);
      await fetchMaterials();
    } catch (err) {
      console.error("Failed to delete material", err);
    }
  };

  return (
    <div className="page-container">
      <div className="action-buttons">
        <Link
          to="/suppliers-material-payment"
          className="circle-btn with-label"
        >
          <span className="btn-label">Manage Suppliers</span>👥
        </Link>
        <Link to="/material-inventory" className="circle-btn with-label">
          <span className="btn-label">View Inventory</span>📊
        </Link>
      </div>

      <div className="material-page-box wide">
        <h3>📋 Material Management</h3>

        {/* Add/Edit Material Form */}
        <div className="material-form">
          <input
            type="text"
            placeholder="Material Name"
            value={newMaterial.material_name}
            onChange={(e) =>
              setNewMaterial({ ...newMaterial, material_name: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Unit (e.g. grams, liters)"
            value={newMaterial.unit}
            onChange={(e) =>
              setNewMaterial({ ...newMaterial, unit: e.target.value })
            }
          />
          <button onClick={handleSave}>
            {editingMaterial ? "Update" : "Add"} Material
          </button>
          {editingMaterial && (
            <button
              className="cancel-btn"
              onClick={() => {
                setNewMaterial({ material_name: "", unit: "" });
                setEditingMaterial(null);
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Materials Table */}
        <table className="material-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {materials?.length > 0 ? (
              materials.map((mat) => (
                <tr key={mat.material_id}>
                  <td>{mat.material_name}</td>
                  <td>{mat.unit}</td>
                  <td>
                    <button onClick={() => handleEdit(mat)}>✏️ Edit</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="text-center">
                  No materials found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaterialManagementPage;
