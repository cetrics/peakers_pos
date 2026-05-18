import React, { useState } from "react";

const ProductSelectorModal = ({ products, loading, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const filtered = products.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content product-selector"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Select Product</h3>
          <button className="close-modal" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="form-group">
          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No products found</div>
        ) : (
          <ul className="product-list">
            {filtered.map((p) => (
              <li key={p.product_id} onClick={() => onSelect(p.product_id)}>
                <span>{p.product_name}</span>
                <span className="stock">Stock: {p.product_stock}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProductSelectorModal;
