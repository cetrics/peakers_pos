import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles/RestaurantSupplierStockPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const emptyStockRow = {
  item_type: "material",
  restaurant_product_id: "",
  raw_material_id: "",
  quantity: "",
  buying_price: "",
};

const RestaurantSupplierStockPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");

  const [activeModal, setActiveModal] = useState(null);

  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [purchasePayments, setPurchasePayments] = useState([]);

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState("unpaid");
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [stockRows, setStockRows] = useState([emptyStockRow]);

  const [paymentForm, setPaymentForm] = useState({
    amount_paid: "",
    payment_method: "cash",
    payment_note: "",
  });

  const [supplierForm, setSupplierForm] = useState({
    supplier_name: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchMaterials();
    fetchPurchases();
  }, []);

  const fetchSuppliers = () => {
    axios
      .get("/restaurant-suppliers", { withCredentials: true })
      .then((res) => setSuppliers(res.data.suppliers || []))
      .catch(() => toast.error("Error loading suppliers."));
  };

  const fetchProducts = () => {
    axios
      .get("/restaurant-products", { withCredentials: true })
      .then((res) => setProducts(res.data.products || []))
      .catch(() => toast.error("Error loading products."));
  };

  const fetchMaterials = () => {
    axios
      .get("/restaurant-materials", { withCredentials: true })
      .then((res) => setMaterials(res.data.materials || []))
      .catch(() => toast.error("Error loading materials."));
  };

  const fetchPurchases = () => {
    axios
      .get("/restaurant-purchases", { withCredentials: true })
      .then((res) => setPurchases(res.data.purchases || []))
      .catch(() => toast.error("Error loading purchases."));
  };

  const filteredPurchases = useMemo(() => {
    const query = search.toLowerCase();

    return purchases.filter((purchase) =>
      `${purchase.invoice_number || ""} ${purchase.supplier_name || ""} ${
        purchase.status || ""
      } ${purchase.delivery_status || ""} ${purchase.total_amount || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [purchases, search]);

  const getStatusBadgeClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "paid" || value === "received") return styles.badgeGreen;
    if (value === "partial") return styles.badgeOrange;
    if (value === "cancelled") return styles.badgeDark;

    return styles.badgeRed;
  };

  const getStatusBadge = (status) => {
    const value = String(status || "unpaid").toLowerCase();

    const stylesMap = {
      paid: { label: "PAID", bg: "#16a34a" },
      partial: { label: "PARTIAL", bg: "#f59e0b" },
      unpaid: { label: "UNPAID", bg: "#dc2626" },
      cancelled: { label: "CANCELLED", bg: "#111827" },
    };

    return stylesMap[value] || { label: value.toUpperCase(), bg: "#6b7280" };
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const closeDetailsModal = () => {
    setSelectedPurchase(null);
    setPurchasePayments([]);
    setActiveModal(null);
  };

  const resetPurchaseForm = () => {
    setEditingPurchaseId(null);
    setSelectedSupplierId("");
    setPurchaseStatus("unpaid");
    setDeliveryStatus("pending");
    setPurchaseNotes("");
    setStockRows([emptyStockRow]);
  };

  const openAddPurchaseModal = () => {
    resetPurchaseForm();
    setSelectedPurchase(null);
    setPurchasePayments([]);
    setActiveModal("purchase");
  };

  const openPurchaseDetails = async (purchaseId) => {
    try {
      const purchaseRes = await axios.get(
        `/restaurant-purchases/${purchaseId}`,
        {
          withCredentials: true,
        },
      );

      const paymentsRes = await axios.get(
        `/restaurant-purchases/${purchaseId}/payments`,
        { withCredentials: true },
      );

      setSelectedPurchase(purchaseRes.data.purchase);
      setPurchasePayments(paymentsRes.data.payments || []);
      setActiveModal("details");
    } catch (error) {
      toast.error(error.response?.data?.error || "Error loading purchase.");
    }
  };

  const openEditPurchase = async (purchaseId) => {
    try {
      const res = await axios.get(`/restaurant-purchases/${purchaseId}`, {
        withCredentials: true,
      });

      const purchase = res.data.purchase;

      setEditingPurchaseId(purchase.purchase_id);
      setSelectedSupplierId(
        purchase.supplier_id ? String(purchase.supplier_id) : "",
      );
      setPurchaseStatus(purchase.status || "unpaid");
      setDeliveryStatus(purchase.delivery_status || "pending");
      setPurchaseNotes(purchase.notes || "");

      setStockRows(
        purchase.items?.length
          ? purchase.items.map((item) => ({
              item_type: item.item_type,
              restaurant_product_id: item.restaurant_product_id
                ? String(item.restaurant_product_id)
                : "",
              raw_material_id: item.raw_material_id
                ? String(item.raw_material_id)
                : "",
              quantity: String(item.quantity || ""),
              buying_price: String(item.buying_price || ""),
            }))
          : [emptyStockRow],
      );

      setActiveModal("purchase");
    } catch (error) {
      toast.error(error.response?.data?.error || "Error loading purchase.");
    }
  };

  const openPaymentModal = (purchase) => {
    setSelectedPurchase(purchase);
    setPaymentForm({
      amount_paid: "",
      payment_method: "cash",
      payment_note: "",
    });
    setActiveModal("payment");
  };

  const updateStockRow = (index, field, value) => {
    const copy = [...stockRows];

    copy[index] = {
      ...copy[index],
      [field]: value,
    };

    if (field === "item_type") {
      copy[index].restaurant_product_id = "";
      copy[index].raw_material_id = "";
    }

    setStockRows(copy);
  };

  const saveSupplier = async (e) => {
    e.preventDefault();

    if (!supplierForm.supplier_name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }

    try {
      await axios.post("/restaurant-suppliers", supplierForm, {
        withCredentials: true,
      });

      toast.success("Supplier added successfully.");
      setSupplierForm({
        supplier_name: "",
        phone: "",
        email: "",
        address: "",
      });
      setActiveModal(null);
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error adding supplier.");
    }
  };

  const savePurchase = async (e) => {
    e.preventDefault();

    const cleanRows = stockRows.filter((row) => {
      if (!row.quantity || Number(row.quantity) <= 0) return false;
      if (row.item_type === "product") return row.restaurant_product_id;
      if (row.item_type === "material") return row.raw_material_id;
      return false;
    });

    if (!cleanRows.length) {
      toast.error("Add at least one valid product or material.");
      return;
    }

    try {
      const payload = {
        supplier_id: selectedSupplierId,
        status: purchaseStatus,
        delivery_status: deliveryStatus,
        notes: purchaseNotes,
        items: cleanRows,
      };

      if (editingPurchaseId) {
        await axios.put(`/restaurant-purchases/${editingPurchaseId}`, payload, {
          withCredentials: true,
        });
        toast.success("Purchase updated successfully.");
      } else {
        await axios.post("/restaurant-purchases", payload, {
          withCredentials: true,
        });
        toast.success("Purchase created successfully.");
      }

      const currentPurchaseId = selectedPurchase?.purchase_id;

      resetPurchaseForm();
      setActiveModal(null);
      fetchProducts();
      fetchMaterials();
      fetchPurchases();

      if (currentPurchaseId) {
        openPurchaseDetails(currentPurchaseId);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving purchase.");
    }
  };

  const updatePurchaseStatus = async (purchaseId, payload) => {
    try {
      await axios.put(`/restaurant-purchases/${purchaseId}/status`, payload, {
        withCredentials: true,
      });

      toast.success("Status updated.");
      fetchPurchases();

      if (selectedPurchase?.purchase_id === purchaseId) {
        openPurchaseDetails(purchaseId);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Error updating status.");
    }
  };

  const savePayment = async (e) => {
    e.preventDefault();

    if (!selectedPurchase) return;

    if (!paymentForm.amount_paid || Number(paymentForm.amount_paid) <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    try {
      await axios.post(
        `/restaurant-purchases/${selectedPurchase.purchase_id}/payments`,
        paymentForm,
        { withCredentials: true },
      );

      toast.success("Payment recorded successfully.");
      fetchPurchases();
      openPurchaseDetails(selectedPurchase.purchase_id);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error recording payment.");
    }
  };

  const printSupplierInvoice = async (purchaseId) => {
    try {
      const res = await axios.get(`/restaurant-purchases/${purchaseId}`, {
        withCredentials: true,
      });

      const purchase = res.data.purchase;
      const statusBadge = getStatusBadge(purchase.status);
      const printWindow = window.open("", "_blank");

      const subtotal = Number(purchase.total_amount || 0);
      const amountPaid = Number(purchase.amount_paid || 0);
      const balanceDue =
        purchase.balance_due !== undefined && purchase.balance_due !== null
          ? Number(purchase.balance_due || 0)
          : Math.max(subtotal - amountPaid, 0);

      const productRows = (purchase.items || [])
        .map(
          (item) => `
            <tr>
              <td>${item.item_name || ""}</td>
              <td>${item.item_type || ""}</td>
              <td class="right">${Number(item.quantity || 0).toFixed(2)}</td>
              <td class="right">Ksh ${Number(item.buying_price || 0).toFixed(2)}</td>
              <td class="right">Ksh ${Number(item.total_cost || 0).toFixed(2)}</td>
            </tr>
          `,
        )
        .join("");

      printWindow.document.write(`
        <html>
          <head>
            <title>${purchase.invoice_number}</title>
            <style>
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }

              body {
                margin: 0;
                padding: 30px;
                background: #f6f7f9;
                color: #333;
                font-family: Arial, sans-serif;
              }

              .invoice-print-wrapper {
                max-width: 850px;
                margin: 0 auto;
                background: #ffffff;
                padding: 35px;
                border-radius: 14px;
              }

              .invoice-top {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 30px;
                border-bottom: 3px solid #0b1446;
                padding-bottom: 20px;
              }

              .company-box h2 {
                margin: 0 0 10px;
                color: #0b1446;
                font-size: 26px;
              }

              .company-box p {
                margin: 0;
                line-height: 1.7;
                color: #555;
              }

              .invoice-title-box {
                text-align: right;
              }

              .invoice-title-box h1 {
                margin: 0;
                color: #0b1446;
                font-size: 38px;
                text-transform: uppercase;
              }

              .invoice-title-box h3 {
                margin: 8px 0 14px;
                color: #555;
              }

              .status-badge {
                display: inline-block !important;
                background-color: ${statusBadge.bg} !important;
                color: #ffffff !important;
                font-weight: 900 !important;
                padding: 12px 24px !important;
                border-radius: 999px !important;
                font-size: 20px !important;
                letter-spacing: 1.5px !important;
                text-transform: uppercase !important;
              }

              .meta-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 25px;
                margin-top: 28px;
              }

              .info-card {
                background-color: #f1f4f8 !important;
                padding: 18px;
                border-radius: 10px;
              }

              .info-card h3 {
                margin: 0 0 10px;
                color: #0b1446;
              }

              .info-card p {
                margin: 0;
                line-height: 1.8;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 30px;
              }

              th {
                background-color: #0b1446 !important;
                color: #ffffff !important;
                padding: 13px;
                text-align: left;
                font-size: 14px;
              }

              td {
                padding: 12px;
                border-bottom: 1px solid #ddd;
                font-size: 14px;
              }

              .right {
                text-align: right;
              }

              .totals {
                width: 360px;
                margin-left: auto;
                margin-top: 25px;
              }

              .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
              }

              .totals-row.total {
                font-size: 18px;
                font-weight: 900;
                color: #0b1446;
              }

              .totals-row.due {
                background-color: #fff4e5 !important;
                padding: 14px;
                border-radius: 8px;
                border-bottom: none;
                margin-top: 8px;
                font-weight: 900;
              }

              .notes {
                margin-top: 35px;
                background-color: #f8fafc !important;
                padding: 18px;
                border-radius: 10px;
              }

              .notes strong {
                color: #0b1446;
              }

              @media print {
                body {
                  background: #ffffff !important;
                  padding: 0;
                }

                .invoice-print-wrapper {
                  box-shadow: none;
                  border-radius: 0;
                  max-width: 100%;
                }
              }
            </style>
          </head>

          <body>
            <div class="invoice-print-wrapper">
              <div class="invoice-top">
                <div class="company-box">
                  <h2>Peakers POS</h2>
                  <p>
                    Supplier Purchase Invoice<br>
                    Goods Delivery: ${String(purchase.delivery_status || "pending").toUpperCase()}<br>
                    Date: ${new Date(purchase.created_at).toLocaleString()}
                  </p>
                </div>

                <div class="invoice-title-box">
                  <h1>Supplier Invoice</h1>
                  <h3># ${purchase.invoice_number}</h3>
                  <div class="status-badge">${statusBadge.label}</div>
                </div>
              </div>

              <div class="meta-grid">
                <div class="info-card">
                  <h3>Supplier</h3>
                  <p>
                    <strong>${purchase.supplier_name || "No Supplier"}</strong>
                  </p>
                </div>

                <div class="info-card">
                  <h3>Invoice Details</h3>
                  <p>
                    <strong>Invoice Date:</strong> ${new Date(purchase.created_at).toLocaleDateString()}<br>
                    <strong>Payment Status:</strong> ${statusBadge.label}<br>
                    <strong>Delivery Status:</strong> ${String(purchase.delivery_status || "pending").toUpperCase()}
                  </p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th class="right">Qty</th>
                    <th class="right">Rate</th>
                    <th class="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>

              <div class="totals">
                <div class="totals-row">
                  <strong>Subtotal</strong>
                  <span>Ksh ${subtotal.toFixed(2)}</span>
                </div>

                <div class="totals-row total">
                  <strong>Total</strong>
                  <span>Ksh ${subtotal.toFixed(2)}</span>
                </div>

                <div class="totals-row">
                  <strong>Amount Paid</strong>
                  <span>Ksh ${amountPaid.toFixed(2)}</span>
                </div>

                <div class="totals-row due">
                  <strong>Balance Due</strong>
                  <span>Ksh ${balanceDue.toFixed(2)}</span>
                </div>
              </div>

              <div class="notes">
                <strong>Notes:</strong>
                <p>${purchase.notes || "N/A"}</p>
              </div>
            </div>

            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error printing invoice.");
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className={styles.header}>
        <div>
          <h1>Restaurant Purchases</h1>
          <p>Group supplier products and materials into purchase invoices.</p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" onClick={() => setActiveModal("supplier")}>
            Add Supplier
          </button>

          <button type="button" onClick={openAddPurchaseModal}>
            Add Purchase
          </button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Suppliers</span>
          <strong>{suppliers.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Products</span>
          <strong>{products.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Materials</span>
          <strong>{materials.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span>Purchases</span>
          <strong>{purchases.length}</strong>
        </div>
      </div>

      <div className={styles.searchBox}>
        <input
          placeholder="Search purchase invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Supplier</th>
              <th>Items</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Payment</th>
              <th>Delivery</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan="10" className={styles.emptyCell}>
                  No purchases found.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase) => (
                <tr key={purchase.purchase_id}>
                  <td>{new Date(purchase.created_at).toLocaleString()}</td>

                  <td>
                    <button
                      type="button"
                      className={styles.invoiceLink}
                      onClick={() => openPurchaseDetails(purchase.purchase_id)}
                    >
                      {purchase.invoice_number}
                    </button>
                  </td>

                  <td>{purchase.supplier_name || "—"}</td>
                  <td>{purchase.item_count}</td>
                  <td>
                    Ksh {Number(purchase.total_amount || 0).toLocaleString()}
                  </td>
                  <td>
                    Ksh {Number(purchase.amount_paid || 0).toLocaleString()}
                  </td>
                  <td>
                    Ksh {Number(purchase.balance_due || 0).toLocaleString()}
                  </td>

                  <td>
                    <span
                      className={`${styles.statusBadge} ${getStatusBadgeClass(
                        purchase.status,
                      )}`}
                    >
                      {purchase.status || "unpaid"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`${styles.statusBadge} ${getStatusBadgeClass(
                        purchase.delivery_status,
                      )}`}
                    >
                      {purchase.delivery_status || "pending"}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className={styles.viewBtn}
                      onClick={() => openPurchaseDetails(purchase.purchase_id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeModal && (
        <div className={styles.modalOverlay}>
          <div
            className={`${styles.modal} ${
              activeModal === "details" ? styles.detailsModal : ""
            }`}
          >
            <button
              type="button"
              className={styles.closeBtn}
              onClick={
                activeModal === "details" ? closeDetailsModal : closeModal
              }
            >
              &times;
            </button>

            {activeModal === "supplier" && (
              <>
                <h2>Add Supplier</h2>

                <form onSubmit={saveSupplier} className={styles.form}>
                  <input
                    placeholder="Supplier name"
                    value={supplierForm.supplier_name}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        supplier_name: e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Phone"
                    value={supplierForm.phone}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        phone: e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Email"
                    value={supplierForm.email}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        email: e.target.value,
                      })
                    }
                  />

                  <textarea
                    placeholder="Address"
                    value={supplierForm.address}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        address: e.target.value,
                      })
                    }
                  />

                  <button type="submit">Add Supplier</button>
                </form>
              </>
            )}

            {activeModal === "purchase" && (
              <>
                <h2>{editingPurchaseId ? "Edit Purchase" : "Add Purchase"}</h2>

                <form onSubmit={savePurchase} className={styles.form}>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="">Select Supplier Optional</option>
                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.supplier_id}
                        value={supplier.supplier_id}
                      >
                        {supplier.supplier_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={purchaseStatus}
                    onChange={(e) => setPurchaseStatus(e.target.value)}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value)}
                  >
                    <option value="pending">Pending Delivery</option>
                    <option value="received">Received</option>
                    <option value="partial">Partial Delivery</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <textarea
                    placeholder="Purchase notes"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                  />

                  <div className={styles.stockRowsWrapper}>
                    {stockRows.map((row, index) => (
                      <div key={index} className={styles.stockRow}>
                        <select
                          value={row.item_type}
                          onChange={(e) =>
                            updateStockRow(index, "item_type", e.target.value)
                          }
                        >
                          <option value="material">Raw Material</option>
                          <option value="product">Restaurant Product</option>
                        </select>

                        {row.item_type === "product" ? (
                          <select
                            value={row.restaurant_product_id}
                            onChange={(e) =>
                              updateStockRow(
                                index,
                                "restaurant_product_id",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">Select Product</option>
                            {products.map((product) => (
                              <option
                                key={product.restaurant_product_id}
                                value={product.restaurant_product_id}
                              >
                                {product.product_name} - Stock:{" "}
                                {product.product_stock}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={row.raw_material_id}
                            onChange={(e) =>
                              updateStockRow(
                                index,
                                "raw_material_id",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">Select Material</option>
                            {materials.map((material) => (
                              <option
                                key={material.raw_material_id}
                                value={material.raw_material_id}
                              >
                                {material.material_name} - Stock:{" "}
                                {material.stock_quantity} {material.unit}
                              </option>
                            ))}
                          </select>
                        )}

                        <input
                          type="number"
                          step="0.001"
                          placeholder="Quantity"
                          value={row.quantity}
                          onChange={(e) =>
                            updateStockRow(index, "quantity", e.target.value)
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                        />

                        <input
                          type="number"
                          step="0.01"
                          placeholder="Buying price"
                          value={row.buying_price}
                          onChange={(e) =>
                            updateStockRow(
                              index,
                              "buying_price",
                              e.target.value,
                            )
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                        />

                        {stockRows.length > 1 && (
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() =>
                              setStockRows(
                                stockRows.filter(
                                  (_, rowIndex) => rowIndex !== index,
                                ),
                              )
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() =>
                      setStockRows([...stockRows, { ...emptyStockRow }])
                    }
                  >
                    Add Another Item
                  </button>

                  <button type="submit">
                    {editingPurchaseId ? "Update Purchase" : "Create Purchase"}
                  </button>
                </form>
              </>
            )}

            {activeModal === "details" && selectedPurchase && (
              <>
                <div className={styles.detailsHeader}>
                  <div>
                    <h2>{selectedPurchase.invoice_number}</h2>
                    <p>{selectedPurchase.supplier_name || "No Supplier"}</p>
                  </div>

                  <div className={styles.detailsBadges}>
                    <span
                      className={`${styles.statusBadge} ${getStatusBadgeClass(
                        selectedPurchase.status,
                      )}`}
                    >
                      {selectedPurchase.status || "unpaid"}
                    </span>

                    <span
                      className={`${styles.statusBadge} ${getStatusBadgeClass(
                        selectedPurchase.delivery_status,
                      )}`}
                    >
                      {selectedPurchase.delivery_status || "pending"}
                    </span>
                  </div>
                </div>

                <div className={styles.detailsGrid}>
                  <div>
                    <span>Total</span>
                    <strong>
                      Ksh{" "}
                      {Number(
                        selectedPurchase.total_amount || 0,
                      ).toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span>Paid</span>
                    <strong>
                      Ksh{" "}
                      {Number(
                        selectedPurchase.amount_paid || 0,
                      ).toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span>Balance</span>
                    <strong>
                      Ksh{" "}
                      {Number(
                        selectedPurchase.balance_due || 0,
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <h3>Items</h3>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selectedPurchase.items || []).map((item) => (
                        <tr key={item.purchase_item_id}>
                          <td>{item.item_name}</td>
                          <td>{item.item_type}</td>
                          <td>{item.quantity}</td>
                          <td>
                            Ksh{" "}
                            {Number(item.buying_price || 0).toLocaleString()}
                          </td>
                          <td>
                            Ksh {Number(item.total_cost || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3>Payment History</h3>

                {purchasePayments.length === 0 ? (
                  <p className={styles.emptyText}>No payments recorded yet.</p>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>

                      <tbody>
                        {purchasePayments.map((payment) => (
                          <tr key={payment.payment_id}>
                            <td>
                              {new Date(payment.created_at).toLocaleString()}
                            </td>
                            <td>{payment.payment_method}</td>
                            <td>
                              Ksh{" "}
                              {Number(
                                payment.amount_paid || 0,
                              ).toLocaleString()}
                            </td>
                            <td>{payment.payment_note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedPurchase.notes && (
                  <>
                    <h3>Notes</h3>
                    <p className={styles.emptyText}>{selectedPurchase.notes}</p>
                  </>
                )}

                <div className={styles.detailsActions}>
                  <button
                    type="button"
                    onClick={() =>
                      openEditPurchase(selectedPurchase.purchase_id)
                    }
                  >
                    Edit Purchase
                  </button>

                  <button
                    type="button"
                    onClick={() => openPaymentModal(selectedPurchase)}
                  >
                    Record Payment
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      printSupplierInvoice(selectedPurchase.purchase_id)
                    }
                  >
                    Print Invoice
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updatePurchaseStatus(selectedPurchase.purchase_id, {
                        delivery_status: "received",
                      })
                    }
                  >
                    Mark Received
                  </button>
                </div>
              </>
            )}

            {activeModal === "payment" && selectedPurchase && (
              <>
                <h2>Record Supplier Payment</h2>
                <p>
                  Invoice: <strong>{selectedPurchase.invoice_number}</strong>
                </p>

                <form onSubmit={savePayment} className={styles.form}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount paid"
                    value={paymentForm.amount_paid}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount_paid: e.target.value,
                      })
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                  />

                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_method: e.target.value,
                      })
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">Mpesa</option>
                    <option value="bank">Bank</option>
                    <option value="cheque">Cheque</option>
                  </select>

                  <textarea
                    placeholder="Payment note"
                    value={paymentForm.payment_note}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_note: e.target.value,
                      })
                    }
                  />

                  <button type="submit">Save Payment</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantSupplierStockPage;
