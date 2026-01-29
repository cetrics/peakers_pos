import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./styles/Material.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
        );
        toast.success("Material updated successfully", {
          containerId: "material-toast",
        });
      } else {
        await axios.post("/add-material", newMaterial);
        toast.success("Material added successfully", {
          containerId: "material-toast",
        });
      }
      setNewMaterial({ material_name: "", unit: "" });
      setEditingMaterial(null);
      fetchMaterials();
    } catch (err) {
      toast.error("Failed to save material", {
        containerId: "material-toast",
      });
    }
  };

  const handleEdit = (material) => {
    setNewMaterial({
      material_name: material.material_name,
      unit: material.unit,
    });
    setEditingMaterial(material);
  };

  return (
    <div className="page-container">
      <ToastContainer containerId="material-toast" autoClose={3000} />

      {/* Floating Action Buttons */}
      <div className="action-buttons">
        <Link to="/suppliers-material-payment" className="circle-btn">
          <span className="btn-label">Manage Suppliers</span>👥
        </Link>
        <Link to="/material-inventory" className="circle-btn">
          <span className="btn-label">View Inventory</span>📊
        </Link>
      </div>

      {/* Page Box */}
      <div className="material-page-box wide">
        <h3>📋 Material Management</h3>

        <div className="material-content">
          {/* Form */}
          <div className="material-form">
            <input
              type="text"
              placeholder="Material Name"
              value={newMaterial.material_name}
              onChange={(e) =>
                setNewMaterial({
                  ...newMaterial,
                  material_name: e.target.value,
                })
              }
            />
            <input
              type="text"
              placeholder="Unit"
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
                  setEditingMaterial(null);
                  setNewMaterial({ material_name: "", unit: "" });
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="material-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.length ? (
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
                    <td colSpan="3">No materials found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialManagementPage;
