import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaPlus, FaUser, FaPhone, FaEnvelope, FaBoxOpen } from "react-icons/fa";
import AddSupplierModal from "./AddSupplierModal";
import "./styles/Supplier.css";

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    // Attach search event listener AFTER suppliers are fetched
    const searchInput = document.getElementById("customerSearch");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    return () => {
      if (searchInput) {
        searchInput.removeEventListener("input", handleSearch);
      }
    };
  }, [suppliers]); // ✅ Attach listener only AFTER suppliers are set

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get("/suppliers");
      setSuppliers(response.data);
      setFilteredSuppliers(response.data); // ✅ Ensure filteredSuppliers has initial data
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  // 🔍 Search Function (Triggered by Index Page Search Bar)
  const handleSearch = (e) => {
    if (!suppliers.length) return; // ✅ Prevent search before data is loaded

    const query = e.target.value.toLowerCase();
    const filtered = suppliers.filter(
      (supplier) =>
        supplier.supplier_name.toLowerCase().includes(query) ||
        supplier.contact_person.toLowerCase().includes(query) ||
        supplier.phone_number.toLowerCase().includes(query) ||
        supplier.email.toLowerCase().includes(query)
    );
    setFilteredSuppliers(filtered);
  };

  return (
    <div className="supplier-container">
      {/* ➕ Floating Add Supplier Button */}
      <button
        className="add-btn"
        onClick={() => {
          setSelectedSupplier(null);
          setIsModalOpen(true);
        }}
      >
        <i className="fas fa-plus"></i>
        <span className="btn-text">Add Supplier</span>
      </button>

      {/* 🏢 Supplier Grid */}
      <div className="supplier-grid">
        {filteredSuppliers.length > 0 ? (
          filteredSuppliers.map((supplier) => (
            <div key={supplier.supplier_id} className="supplier-card">
              <div
                className="supplier-info"
                onClick={() => {
                  setSelectedSupplier(supplier);
                  setIsModalOpen(true);
                }}
              >
                <h3>{supplier.supplier_name}</h3>
                <p>
                  <FaUser className="icon" /> {supplier.contact_person}
                </p>
                <p>
                  <FaPhone className="icon" /> {supplier.phone_number}
                </p>
                <p>
                  <FaEnvelope className="icon" /> {supplier.email}
                </p>
              </div>

              {/* 📦 View Products Icon */}
              <FaBoxOpen
                className="view-products-icon"
                title="View Supplied Products"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/supplier_products/${supplier.supplier_id}`);
                }}
              />
            </div>
          ))
        ) : (
          <p className="no-results">No suppliers found.</p>
        )}
      </div>

      {/* 🏠 Add/Edit Supplier Modal */}
      {isModalOpen && (
        <AddSupplierModal
          onClose={() => setIsModalOpen(false)}
          refreshSuppliers={fetchSuppliers}
          supplierData={selectedSupplier}
        />
      )}
    </div>
  );
};

export default SupplierList;
