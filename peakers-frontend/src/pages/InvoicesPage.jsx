import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/InvoicesPage.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [companyDetails, setCompanyDetails] = useState({});

  const [formData, setFormData] = useState({
    customer_id: "",
    issue_date: "",
    due_date: "",
    items: [{ item_name: "", quantity: 1, unit_price: "" }],
    vat: "",
    discount: "",
    status: "unpaid",
    notes: "",
  });

  const fetchInvoices = async () => {
    try {
      const res = await axios.get("/get-invoices");
      setInvoices(res.data.invoices || []);
      setCompanyDetails(res.data.company || {});
    } catch (error) {
      toast.error("Error loading invoices.");
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`/get-sales-customers?t=${Date.now()}`);
      setCustomers(res.data.customers || []);
    } catch (error) {
      toast.error("Error loading customers.");
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const openModal = (invoice = null) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setFormData({
        customer_id: invoice.customer_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date || "",
        items:
          invoice.items && invoice.items.length > 0
            ? invoice.items
            : [{ item_name: "", quantity: 1, unit_price: "" }],
        vat: invoice.vat,
        discount: invoice.discount,
        status: invoice.status,
        notes: invoice.notes || "",
      });
    } else {
      setEditingInvoice(null);
      setFormData({
        customer_id: "",
        issue_date: "",
        due_date: "",
        items: [{ item_name: "", quantity: 1, unit_price: "" }],
        vat: "",
        discount: "",
        status: "unpaid",
        notes: "",
      });
    }

    setShowModal(true);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index][field] = value;

    setFormData((prev) => ({
      ...prev,
      items: updatedItems,
    }));
  };

  const addInvoiceItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { item_name: "", quantity: 1, unit_price: "" }],
    }));
  };

  const removeInvoiceItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingInvoice) {
        await axios.put(
          `/update-invoice/${editingInvoice.invoice_id}`,
          formData,
        );
        toast.success("Invoice updated successfully!");
      } else {
        await axios.post("/add-invoice", formData);
        toast.success("Invoice created successfully!");
      }

      setShowModal(false);
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving invoice.");
    }
  };

  const updateStatus = async (invoice_id, status) => {
    try {
      await axios.post("/update-invoice-status", {
        invoice_id,
        status,
      });

      toast.success("Invoice status updated!");
      fetchInvoices();
    } catch (error) {
      toast.error("Error updating invoice status.");
    }
  };

  const printInvoice = (invoice) => {
    const printWindow = window.open("", "_blank");

    printWindow.document.write(`
      <html>
        <head>
          <title>${invoice.invoice_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              color: #0f0f0f;
            }
            .invoice-box {
              max-width: 800px;
              margin: auto;
              border: 1px solid #ddd;
              padding: 30px;
              border-radius: 8px;
            }
            h1, h2 {
              color: #0b1446;
            }
            .company-details {
              margin-bottom: 20px;
            }
            .badge {
              padding: 6px 12px;
              border-radius: 5px;
              color: white;
              background: #f5a100;
              text-transform: uppercase;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            td, th {
              border: 1px solid #ddd;
              padding: 10px;
            }
            th {
              background: #0b1446;
              color: white;
            }
            .total {
              font-weight: bold;
              color: #0b1446;
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="company-details">
              <h1>${companyDetails.company || "Company Name"}</h1>
              <p>${companyDetails.company_phone || ""}</p>
              <p>${companyDetails.company_email || ""}</p>
              <p>${companyDetails.company_address || ""}</p>
            </div>

            <hr />

            <h2>Invoice</h2>
            <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
            <p><strong>Customer:</strong> ${invoice.customer_name || "N/A"}</p>
            <p><strong>Issue Date:</strong> ${invoice.issue_date}</p>
            <p><strong>Due Date:</strong> ${invoice.due_date || "N/A"}</p>
            <p><strong>Status:</strong> <span class="badge">${invoice.status}</span></p>

            <table>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
              ${(invoice.items || [])
                .map(
                  (item) => `
                    <tr>
                      <td>${item.item_name}</td>
                      <td>${item.quantity}</td>
                      <td>Ksh ${Number(item.unit_price || 0).toFixed(2)}</td>
                      <td>Ksh ${Number(item.subtotal || 0).toFixed(2)}</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr>
                <td colspan="3">Subtotal</td>
                <td>Ksh ${Number(invoice.subtotal || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="3">VAT</td>
                <td>Ksh ${Number(invoice.vat || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="3">Discount</td>
                <td>Ksh ${Number(invoice.discount || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="3" class="total">Total</td>
                <td class="total">Ksh ${Number(invoice.total_amount || 0).toFixed(2)}</td>
              </tr>
            </table>

            <p><strong>Notes:</strong></p>
            <p>${invoice.notes || "N/A"}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="invoice-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="invoice-header">
        <h1>Invoices</h1>
        <button onClick={() => openModal()}>+ Add Invoice</button>
      </div>

      <div className="invoice-table-card">
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Print</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <tr key={invoice.invoice_id} onClick={() => openModal(invoice)}>
                  <td>{invoice.invoice_number}</td>
                  <td>{invoice.customer_name || "N/A"}</td>
                  <td>{invoice.issue_date}</td>
                  <td>{invoice.due_date || "N/A"}</td>
                  <td>Ksh {Number(invoice.total_amount || 0).toFixed(2)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={invoice.status}
                      onChange={(e) =>
                        updateStatus(invoice.invoice_id, e.target.value)
                      }
                      className={`invoice-status ${invoice.status}`}
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="print-btn"
                      onClick={() => printInvoice(invoice)}
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">No invoices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <span className="invoice-close" onClick={() => setShowModal(false)}>
              &times;
            </span>

            <h2>{editingInvoice ? "Edit Invoice" : "Add Invoice"}</h2>

            <form onSubmit={handleSubmit}>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>

              <div className="invoice-date-group">
                <label>Issue Date</label>
                <input
                  type="date"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="invoice-date-group">
                <label>Due Date</label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                />
              </div>

              <div className="invoice-items-section">
                <h3>Invoice Items</h3>

                {formData.items.map((item, index) => (
                  <div className="invoice-item-row" key={index}>
                    <input
                      type="text"
                      placeholder="Item / Service"
                      value={item.item_name}
                      onChange={(e) =>
                        handleItemChange(index, "item_name", e.target.value)
                      }
                      required
                    />

                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                      required
                    />

                    <input
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleItemChange(index, "unit_price", e.target.value)
                      }
                      required
                    />

                    <button
                      type="button"
                      onClick={() => removeInvoiceItem(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button type="button" onClick={addInvoiceItem}>
                  + Add Item
                </button>
              </div>

              <input
                type="number"
                name="vat"
                placeholder="VAT"
                value={formData.vat}
                onChange={handleChange}
              />

              <input
                type="number"
                name="discount"
                placeholder="Discount"
                value={formData.discount}
                onChange={handleChange}
              />

              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <textarea
                name="notes"
                placeholder="Notes"
                value={formData.notes}
                onChange={handleChange}
              />

              <button type="submit">
                {editingInvoice ? "Update Invoice" : "Save Invoice"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
