import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import axios from "axios";
import { FaPlus, FaUser, FaPhone, FaEnvelope, FaBoxOpen } from "react-icons/fa";
import AddSupplierModal from "./AddSupplierModal";
import "./styles/Supplier.css"; // White background theme

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const navigate = useNavigate(); // Initialize navigation

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get("/suppliers");
      setSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  return (
    <div className="supplier-container">
      {/* Floating Add Supplier Button */}
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

      <div className="supplier-grid">
        {suppliers.map((supplier) => (
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

            {/* View Products Icon - Navigates to Supplier Products Page */}
            <FaBoxOpen
              className="view-products-icon"
              title="View Supplied Products"
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the edit modal
                navigate(`/supplier_products/${supplier.supplier_id}`); // Navigate to SupplierProducts page
              }}
            />
          </div>
        ))}
      </div>

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
