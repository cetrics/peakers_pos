import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/ContainerInventory.css";

const ContainerInventory = () => {
  const [containers, setContainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    container_name: "",
    container_type: "",
    size: "",
    empty_quantity: 0,
    filled_quantity: 0,
    damaged_quantity: 0,
    notes: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const fetchContainers = async () => {
    try {
      const res = await axios.get("/container-inventory");
      setContainers(res.data);
    } catch (err) {
      toast.error("Failed to fetch container inventory");
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const filteredContainers = useMemo(() => {
    if (!searchTerm) return containers;

    return containers.filter((item) => {
      return (
        item.container_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.container_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.size?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [containers, searchTerm]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({
      container_name: "",
      container_type: "",
      size: "",
      empty_quantity: 0,
      filled_quantity: 0,
      damaged_quantity: 0,
      notes: "",
    });

    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        await axios.put(`/container-inventory/${editingId}`, form);

        toast.success("Container updated successfully");
      } else {
        await axios.post("/container-inventory", form);

        toast.success("Container added successfully");
      }

      resetForm();
      setShowModal(false);
      fetchContainers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save container");
    }
  };

  const editContainer = (container) => {
    setEditingId(container.container_id);

    setForm({
      container_name: container.container_name,
      container_type: container.container_type || "",
      size: container.size || "",
      empty_quantity: container.empty_quantity,
      filled_quantity: container.filled_quantity,
      damaged_quantity: container.damaged_quantity,
      notes: container.notes || "",
    });

    setShowModal(true);
  };

  const deleteContainer = async (id) => {
    if (!window.confirm("Delete this container record?")) return;

    try {
      await axios.delete(`/container-inventory/${id}`);

      toast.success("Container deleted successfully");

      fetchContainers();
    } catch (err) {
      toast.error("Failed to delete container");
    }
  };

  const performAction = async (id, action) => {
    try {
      await axios.post(`/container-inventory/${id}/action`, {
        action,
        quantity,
      });

      toast.success("Action completed successfully");

      fetchContainers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const totals = containers.reduce(
    (acc, item) => {
      acc.empty += Number(item.empty_quantity || 0);
      acc.filled += Number(item.filled_quantity || 0);
      acc.damaged += Number(item.damaged_quantity || 0);

      return acc;
    },
    { empty: 0, filled: 0, damaged: 0 },
  );

  // CSV DOWNLOAD
  const downloadCSV = () => {
    const headers = [
      "Container Name",
      "Type",
      "Size",
      "Empty Quantity",
      "Filled Quantity",
      "Damaged Quantity",
      "Notes",
    ];

    const data = filteredContainers.map((item) => [
      item.container_name,
      item.container_type || "N/A",
      item.size || "N/A",
      item.empty_quantity,
      item.filled_quantity,
      item.damaged_quantity,
      item.notes || "",
    ]);

    let csvContent = headers.join(",") + "\n";

    data.forEach((row) => {
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(
      blob,
      `container_inventory_${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  // EXCEL DOWNLOAD
  const downloadExcel = () => {
    const data = filteredContainers.map((item) => ({
      "Container Name": item.container_name,
      Type: item.container_type || "N/A",
      Size: item.size || "N/A",
      "Empty Quantity": item.empty_quantity,
      "Filled Quantity": item.filled_quantity,
      "Damaged Quantity": item.damaged_quantity,
      Notes: item.notes || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Container Inventory");

    XLSX.writeFile(
      workbook,
      `container_inventory_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  // PDF DOWNLOAD
  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "landscape",
      });

      doc.setFontSize(18);
      doc.text("Container Inventory Report", 14, 20);

      doc.setFontSize(10);

      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

      const tableColumn = [
        "Container Name",
        "Type",
        "Size",
        "Empty",
        "Filled",
        "Damaged",
        "Notes",
      ];

      const tableRows = filteredContainers.map((item) => [
        item.container_name,
        item.container_type || "N/A",
        item.size || "N/A",
        item.empty_quantity,
        item.filled_quantity,
        item.damaged_quantity,
        item.notes || "",
      ]);

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: {
          fontSize: 9,
        },
        headStyles: {
          fillColor: [11, 31, 58],
        },
      });

      doc.save(
        `container_inventory_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="container-inventory-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="container-header">
        <div>
          <h2>Container Inventory</h2>
          <p>Manage empty, filled, damaged, and returnable containers.</p>
        </div>
      </div>
      <div className="container-summary">
        <div className="summary-card">
          <h4>Empty Containers</h4>
          <h2>{totals.empty}</h2>
        </div>

        <div className="summary-card filled">
          <h4>Filled Containers</h4>
          <h2>{totals.filled}</h2>
        </div>

        <div className="summary-card damaged">
          <h4>Damaged Containers</h4>
          <h2>{totals.damaged}</h2>
        </div>
      </div>

      {/* TOP ACTIONS */}
      <div className="container-top-actions">
        <div className="container-report-buttons">
          <button onClick={downloadCSV}>
            <i className="fas fa-file-csv"></i> CSV
          </button>

          <button onClick={downloadExcel}>
            <i className="fas fa-file-excel"></i> Excel
          </button>

          <button onClick={downloadPDF}>
            <i className="fas fa-file-pdf"></i> PDF
          </button>
        </div>

        <button
          className="open-container-modal-btn"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + Add Container
        </button>
      </div>
      {/* SEARCH */}
      <div className="container-search-wrapper">
        <input
          type="text"
          placeholder="Search by name, type or size..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="container-search-input"
        />
      </div>
      {/* MODAL */}
      {showModal && (
        <div className="container-modal-overlay">
          <div className="container-modal">
            <div className="container-modal-header">
              <h3>{editingId ? "Update Container" : "Add Container"}</h3>

              <button
                type="button"
                className="container-modal-close"
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
              >
                ×
              </button>
            </div>

            <form className="container-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Container Name</label>

                <input
                  name="container_name"
                  placeholder="e.g. Total Gas Cylinder"
                  value={form.container_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Container Type</label>

                <input
                  name="container_type"
                  placeholder="e.g. Gas, Water, Crate"
                  value={form.container_type}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Container Size</label>

                <input
                  name="size"
                  placeholder="e.g. 6KG, 13KG, 20L"
                  value={form.size}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Empty Quantity</label>

                <input
                  type="number"
                  name="empty_quantity"
                  placeholder="0"
                  value={form.empty_quantity}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Filled Quantity</label>

                <input
                  type="number"
                  name="filled_quantity"
                  placeholder="0"
                  value={form.filled_quantity}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Damaged Quantity</label>

                <input
                  type="number"
                  name="damaged_quantity"
                  placeholder="0"
                  value={form.damaged_quantity}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group full-width">
                <label>Notes</label>

                <textarea
                  name="notes"
                  placeholder="Additional notes..."
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>

              <div className="form-actions">
                <button type="submit">
                  {editingId ? "Update Container" : "Add Container"}
                </button>

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    resetForm();
                    setShowModal(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="action-quantity">
        <label>Action Quantity:</label>

        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>

      <div className="container-table-wrapper">
        <table className="container-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Empty</th>
              <th>Filled</th>
              <th>Damaged</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredContainers.length > 0 ? (
              filteredContainers.map((item) => (
                <tr key={item.container_id}>
                  <td>{item.container_name}</td>

                  <td>{item.container_type || "N/A"}</td>

                  <td>{item.size || "N/A"}</td>

                  <td>{item.empty_quantity}</td>

                  <td>{item.filled_quantity}</td>

                  <td>{item.damaged_quantity}</td>

                  <td className="table-actions">
                    <button
                      onClick={() =>
                        performAction(item.container_id, "add_empty")
                      }
                    >
                      Add Empty
                    </button>

                    <button
                      onClick={() =>
                        performAction(item.container_id, "add_filled")
                      }
                    >
                      Add Filled
                    </button>

                    <button
                      onClick={() => performAction(item.container_id, "refill")}
                    >
                      Refill
                    </button>

                    <button
                      onClick={() =>
                        performAction(item.container_id, "exchange")
                      }
                    >
                      Exchange
                    </button>

                    <button
                      onClick={() =>
                        performAction(item.container_id, "sell_filled")
                      }
                    >
                      Sell Filled
                    </button>

                    <button
                      onClick={() =>
                        performAction(item.container_id, "mark_damaged")
                      }
                    >
                      Damaged
                    </button>

                    <button
                      className="edit-btn"
                      onClick={() => editContainer(item)}
                    >
                      Edit
                    </button>

                    <button
                      className="delete-btn"
                      onClick={() => deleteContainer(item.container_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty-row">
                  No container inventory found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContainerInventory;
