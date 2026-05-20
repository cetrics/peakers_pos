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
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    issue_date: "",
    due_date: "",
    items: [{ item_name: "", quantity: 1, unit_price: "" }],
    vat: "",
    discount: "",
    amount_paid: "",
    status: "unpaid",
    notes: "",
  });

  const fetchInvoices = async () => {
    try {
      const res = await axios.get("/get-invoices");
      setInvoices(res.data.invoices || []);
      setCompanyDetails(res.data.company || {});
    } catch {
      toast.error("Error loading invoices.");
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`/get-sales-customers?t=${Date.now()}`);

      setCustomers(res.data.customers || []);
    } catch {
      toast.error("Error loading customers.");
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const openModal = (invoice = null) => {
    if (invoice) {
      setCustomerSearch(invoice.customer_name || "");
      setEditingInvoice(invoice);
      setFormData({
        customer_id: invoice.customer_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date || "",
        items: invoice.items?.length
          ? invoice.items
          : [{ item_name: "", quantity: 1, unit_price: "" }],
        vat: invoice.vat || "",
        discount: invoice.discount || "",
        amount_paid: invoice.amount_paid || "",
        status: invoice.status || "unpaid",
        notes: invoice.notes || "",
      });
    } else {
      setCustomerSearch("");
      setEditingInvoice(null);
      setFormData({
        customer_id: "",
        issue_date: "",
        due_date: "",
        items: [{ item_name: "", quantity: 1, unit_price: "" }],
        vat: "",
        discount: "",
        amount_paid: "",
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
    setFormData((prev) => ({ ...prev, items: updatedItems }));
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
      await axios.post("/update-invoice-status", { invoice_id, status });
      toast.success("Invoice status updated!");
      fetchInvoices();
    } catch {
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
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; }
            h1 { color: #b3362d; font-size: 44px; margin: 0; }
            .balance { text-align: right; margin-top: 10px; }
            .balance strong { font-size: 22px; }
            .company { margin-top: 60px; line-height: 1.5; }
            .meta { text-align: right; margin-top: 40px; line-height: 2; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th { background: #b9362e; color: white; padding: 12px; text-align: left; }
            td { padding: 12px; border-bottom: 1px solid #aaa; }
            .right { text-align: right; }
            .totals { width: 45%; margin-left: auto; margin-top: 20px; }
            .totals div { display: flex; justify-content: space-between; padding: 12px; }
            .due { background: #faf6f5; font-weight: bold; }
            .notes { margin-top: 60px; }
          </style>
        </head>
        <body>
          <div class="top">
            <div class="company">
              <h2>${companyDetails.company || "Company Name"}</h2>
              <p>${companyDetails.company_phone || ""}</p>
              <p>${companyDetails.company_email || ""}</p>
              <p>${companyDetails.company_address || ""}</p>
            </div>

            <div>
              <h1>Invoice</h1>
              <h3># ${invoice.invoice_number}</h3>
              <div class="balance">
                <p>Balance Due</p>
                <strong>KES ${Number(invoice.balance_due || 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div class="meta">
            <p><strong>Invoice Date:</strong> ${invoice.issue_date}</p>
            <p><strong>Due Date:</strong> ${invoice.due_date || "N/A"}</p>
            <p><strong>Status:</strong> ${invoice.status}</p>
          </div>

          <p><strong>${invoice.customer_name || "Customer"}</strong></p>

          <table>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
            ${(invoice.items || [])
              .map(
                (item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.item_name}</td>
                    <td class="right">${Number(item.quantity || 0).toFixed(2)}</td>
                    <td class="right">${Number(item.unit_price || 0).toFixed(2)}</td>
                    <td class="right">${Number(item.subtotal || 0).toFixed(2)}</td>
                  </tr>
                `,
              )
              .join("")}
          </table>

          <div class="totals">
            <div><strong>Sub Total</strong><span>${Number(invoice.subtotal || 0).toFixed(2)}</span></div>
            <div><strong>VAT</strong><span>${Number(invoice.vat || 0).toFixed(2)}</span></div>
            <div><strong>Discount</strong><span>${Number(invoice.discount || 0).toFixed(2)}</span></div>
            <div><strong>Total</strong><strong>KES ${Number(invoice.total_amount || 0).toFixed(2)}</strong></div>
            <div><strong>Amount Paid</strong><strong>KES ${Number(invoice.amount_paid || 0).toFixed(2)}</strong></div>
            <div class="due"><strong>Balance Due</strong><strong>KES ${Number(invoice.balance_due || 0).toFixed(2)}</strong></div>
          </div>

          <div class="notes">
            <strong>Notes:</strong>
            <p>${invoice.notes || "N/A"}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name?.toLowerCase().includes(customerSearch.toLowerCase()),
  );

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
              <th>Paid</th>
              <th>Balance</th>
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
                  <td>Ksh {Number(invoice.amount_paid || 0).toFixed(2)}</td>
                  <td>Ksh {Number(invoice.balance_due || 0).toFixed(2)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={invoice.status}
                      onChange={(e) =>
                        updateStatus(invoice.invoice_id, e.target.value)
                      }
                      className={`invoice-status ${invoice.status}`}
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
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
                <td colSpan="9">No invoices found.</td>
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
              <div className="invoice-customer-search-box">
                <label>Customer</label>

                <input
                  type="text"
                  placeholder="Search customer..."
                  value={
                    customerSearch ||
                    customers.find(
                      (customer) =>
                        String(customer.id) === String(formData.customer_id),
                    )?.name ||
                    ""
                  }
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                    setFormData((prev) => ({
                      ...prev,
                      customer_id: "",
                    }));
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  required
                />

                {showCustomerDropdown && (
                  <div className="invoice-customer-dropdown">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="invoice-customer-option"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              customer_id: customer.id,
                            }));
                            setCustomerSearch(customer.name);
                            setShowCustomerDropdown(false);
                          }}
                        >
                          {customer.name}
                        </div>
                      ))
                    ) : (
                      <div className="invoice-customer-no-result">
                        No customer found
                      </div>
                    )}
                  </div>
                )}
              </div>

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

              <input
                type="number"
                name="amount_paid"
                placeholder="Amount Paid"
                value={formData.amount_paid}
                onChange={handleChange}
              />

              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
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
