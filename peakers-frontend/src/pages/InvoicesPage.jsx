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
  const [customerPendingInvoices, setCustomerPendingInvoices] = useState([]);
  const [salesProducts, setSalesProducts] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const decimalUnits = ["kg", "g", "litre", "liter", "ml", "metre", "meter"];
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false);

  const allowsDecimal = (unit) => {
    return decimalUnits.includes(String(unit || "").toLowerCase());
  };

  const [formData, setFormData] = useState({
    customer_id: "",
    issue_date: "",
    due_date: "",
    items: [{ item_name: "", quantity: 1, unit_price: "" }],
    previous_balances: [],
    vat: "",
    discount: "",
    amount_paid: "",
    status: "unpaid",
    notes: "",
  });

  const sendInvoiceEmail = async (invoice) => {
    try {
      await axios.post(`/send-invoice-email/${invoice.invoice_id}`);
      toast.success("Invoice sent to customer email!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Error sending invoice.");
    }
  };

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

  const fetchCustomerPendingInvoices = async (customerId) => {
    try {
      const res = await axios.get(`/customer-pending-invoices/${customerId}`);
      setCustomerPendingInvoices(res.data.invoices || []);
    } catch {
      setCustomerPendingInvoices([]);
    }
  };

  const fetchSalesProducts = async () => {
    try {
      const res = await axios.get("/get-invoice-products");
      setSalesProducts(res.data.products || []);
    } catch {
      toast.error("Error loading products.");
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchSalesProducts();
  }, []);

  const resetForm = () => {
    setFormData({
      customer_id: "",
      issue_date: "",
      due_date: "",
      items: [
        {
          product_id: "",
          item_name: "",
          quantity: 1,
          unit_price: "",
          available_stock: 0,
        },
      ],
      previous_balances: [],
      vat: "",
      discount: "",
      amount_paid: "",
      status: "unpaid",
      notes: "",
    });
    setCustomerPendingInvoices([]);
  };

  const openModal = (invoice = null) => {
    if (invoice) {
      setCustomerSearch(invoice.customer_name || "");
      setEditingInvoice(invoice);
      setCustomerPendingInvoices([]);

      setFormData({
        customer_id: invoice.customer_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date || "",
        items: invoice.items?.length
          ? invoice.items
              .filter(
                (item) =>
                  !item.item_name
                    ?.toLowerCase()
                    .startsWith("previous balance from"),
              )
              .map((item) => {
                const matchedProduct = salesProducts.find(
                  (product) =>
                    String(product.product_id) === String(item.product_id) ||
                    product.product_name === item.item_name,
                );

                return {
                  product_id:
                    item.product_id || matchedProduct?.product_id || "",
                  item_name:
                    item.item_name || matchedProduct?.product_name || "",
                  quantity:
                    item.quantity !== undefined && item.quantity !== null
                      ? Number(item.quantity)
                      : 1,
                  unit_price:
                    item.unit_price || matchedProduct?.product_price || "",
                  available_stock:
                    Number(matchedProduct?.product_stock || 0) +
                    Number(item.quantity || 0),
                };
              })
          : [
              {
                product_id: "",
                item_name: "",
                quantity: 1,
                unit_price: "",
                available_stock: 0,
              },
            ],

        previous_balances: invoice.items?.length
          ? invoice.items
              .filter((item) =>
                item.item_name
                  ?.toLowerCase()
                  .startsWith("previous balance from"),
              )
              .map((item) => ({
                invoice_id: item.item_name,
                invoice_number: item.item_name.replace(
                  "Previous balance from ",
                  "",
                ),
                balance_due: item.subtotal || item.unit_price || 0,
                locked: true,
              }))
          : [],
        vat: invoice.vat || "",
        discount: invoice.discount || "",
        amount_paid: invoice.amount_paid || "",
        status: invoice.status || "unpaid",
        notes: invoice.notes || "",
      });
    } else {
      setCustomerSearch("");
      setEditingInvoice(null);
      resetForm();
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
      items: [
        ...prev.items,
        {
          product_id: "",
          item_name: "",
          quantity: 1,
          unit_price: "",
          available_stock: 0,
        },
      ],
    }));
  };

  const removeInvoiceItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const togglePreviousBalance = (invoiceObj) => {
    setFormData((prev) => {
      const exists = prev.previous_balances.some(
        (inv) => inv.invoice_id === invoiceObj.invoice_id,
      );

      return {
        ...prev,
        previous_balances: exists
          ? prev.previous_balances.filter(
              (inv) => inv.invoice_id !== invoiceObj.invoice_id,
            )
          : [...prev.previous_balances, invoiceObj],
      };
    });
  };

  const selectedPendingTotal = (formData.previous_balances || []).reduce(
    (sum, invoice) => sum + Number(invoice.balance_due || 0),
    0,
  );

  const currentItemsSubtotal = formData.items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);

  const currentInvoiceTotal =
    currentItemsSubtotal +
    Number(formData.vat || 0) -
    Number(formData.discount || 0) +
    selectedPendingTotal;

  const handleStatusChange = (e) => {
    const selectedStatus = e.target.value;

    setFormData((prev) => ({
      ...prev,
      status: selectedStatus,
      amount_paid: selectedStatus === "partial" ? prev.amount_paid : "",
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
        await axios.post("/add-invoice", {
          ...formData,
          linked_invoices: formData.previous_balances.map(
            (invoice) => invoice.invoice_id,
          ),
        });
        toast.success("Invoice created successfully!");
      }

      setShowModal(false);
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error saving invoice.");
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const query = invoiceSearch.toLowerCase();

    return (
      invoice.invoice_number?.toLowerCase().includes(query) ||
      invoice.customer_name?.toLowerCase().includes(query) ||
      invoice.status?.toLowerCase().includes(query) ||
      String(invoice.total_amount || "").includes(query) ||
      String(invoice.balance_due || "").includes(query)
    );
  });

  const updateStatus = async (invoice_id, status) => {
    try {
      await axios.post("/update-invoice-status", {
        invoice_id,
        status,
      });

      toast.success("Invoice status updated!");
      fetchInvoices();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Error updating invoice status.",
      );
    }
  };

  const getStatusBadge = (status) => {
    const value = String(status || "unpaid").toLowerCase();

    const styles = {
      paid: { label: "PAID", bg: "#16a34a" },
      partial: { label: "PARTIAL", bg: "#f59e0b" },
      unpaid: { label: "UNPAID", bg: "#dc2626" },
      cancelled: { label: "CANCELLED", bg: "#111827" },
    };

    return styles[value] || { label: value.toUpperCase(), bg: "#6b7280" };
  };

  const shareInvoiceWhatsApp = (invoice) => {
    const phone = invoice.customer_phone;

    if (!phone) {
      toast.error("Customer phone number not found.");
      return;
    }

    let cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.startsWith("0")) {
      cleanPhone = "254" + cleanPhone.slice(1);
    }

    if (!cleanPhone.startsWith("254")) {
      cleanPhone = "254" + cleanPhone;
    }

    const businessName =
      companyDetails.company_name ||
      companyDetails.company ||
      companyDetails.name ||
      "Your Business";

    const invoiceUrl = `https://peakerspointofsale.co.ke/public-invoice/${invoice.public_token}`;

    const message = `
*${businessName}*

Hello ${invoice.customer_name || "Valued Customer"},

Thank you for your business.

*Invoice Details*

Invoice No: ${invoice.invoice_number}
Total Amount: KSh ${Number(invoice.total_amount || 0).toLocaleString()}
Amount Paid: KSh ${Number(invoice.amount_paid || 0).toLocaleString()}
Balance Due: KSh ${Number(invoice.balance_due || 0).toLocaleString()}
Status: ${String(invoice.status || "").toUpperCase()}

*Download Invoice*

${invoiceUrl}

Thank you for choosing ${businessName}.
`;
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank");
  };

  const printInvoice = (invoice) => {
    const printWindow = window.open("", "_blank");
    const statusBadge = getStatusBadge(invoice.status);

    const companyName =
      companyDetails.name || companyDetails.company || "Company Name";

    const companyPhone =
      companyDetails.phone || companyDetails.company_phone || "";

    const companyEmail =
      companyDetails.email || companyDetails.company_email || "";

    const companyAddress =
      companyDetails.address || companyDetails.company_address || "";

    const companyCity = companyDetails.city || "";
    const companyCountry = companyDetails.country || "";

    const productRows = (invoice.items || [])
      .map(
        (item) => `
        <tr>
          <td>${item.item_name || ""}</td>
          <td class="right">${Number(item.quantity || 0).toFixed(2)}</td>
          <td class="right">KES ${Number(item.unit_price || 0).toFixed(2)}</td>
          <td class="right">KES ${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>
      `,
      )
      .join("");

    printWindow.document.write(`
    <html>
      <head>
        <title>${invoice.invoice_number}</title>

        <style>
          * {
            box-sizing: border-box;
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
            font-size: 42px;
            text-transform: uppercase;
          }

          .invoice-title-box h3 {
            margin: 8px 0 14px;
            color: #555;
          }

          .status-badge {
            display: inline-block;
            background: ${statusBadge.bg};
            color: #ffffff;
            font-weight: 900;
            padding: 12px 24px;
            border-radius: 999px;
            font-size: 20px;
            letter-spacing: 1.5px;
            text-transform: uppercase;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-top: 28px;
          }

          .info-card {
            background: #f1f4f8;
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
            background: #0b1446;
            color: white;
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
            background: #fff4e5;
            padding: 14px;
            border-radius: 8px;
            border-bottom: none;
            margin-top: 8px;
            font-weight: 900;
          }

          .notes {
            margin-top: 35px;
            background: #f8fafc;
            padding: 18px;
            border-radius: 10px;
          }

          .notes strong {
            color: #0b1446;
          }

          * {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
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

th {
  background-color: #0b1446 !important;
  color: #ffffff !important;
  padding: 13px;
  text-align: left;
  font-size: 14px;
}

.info-card {
  background-color: #f1f4f8 !important;
  padding: 18px;
  border-radius: 10px;
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
  background-color: #f8fafc !important;
}

          @media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  body {
    background: #ffffff !important;
    padding: 0;
  }

  .invoice-print-wrapper {
    box-shadow: none;
    border-radius: 0;
    max-width: 100%;
  }

  .status-badge,
  th,
  .info-card,
  .totals-row.due,
  .notes {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
        </style>
      </head>

      <body>
        <div class="invoice-print-wrapper">
          <div class="invoice-top">
            <div class="company-box">
              <h2>${companyName}</h2>
              <p>
                ${companyPhone}<br>
                ${companyEmail}<br>
                ${companyAddress}<br>
                ${companyCity}${companyCity && companyCountry ? ", " : ""}${companyCountry}
              </p>
            </div>

            <div class="invoice-title-box">
              <h1>Invoice</h1>
              <h3># ${invoice.invoice_number}</h3>
              <div class="status-badge">${statusBadge.label}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="info-card">
              <h3>Bill To</h3>
              <p>
                <strong>${invoice.customer_name || "Customer"}</strong>
              </p>
            </div>

            <div class="info-card">
              <h3>Invoice Details</h3>
              <p>
                <strong>Invoice Date:</strong> ${invoice.issue_date}<br>
                <strong>Due Date:</strong> ${invoice.due_date || "N/A"}<br>
                <strong>Status:</strong> ${statusBadge.label}
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
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
              <span>KES ${Number(invoice.subtotal || 0).toFixed(2)}</span>
            </div>

            <div class="totals-row">
              <strong>VAT</strong>
              <span>KES ${Number(invoice.vat || 0).toFixed(2)}</span>
            </div>

            <div class="totals-row">
              <strong>Discount</strong>
              <span>KES ${Number(invoice.discount || 0).toFixed(2)}</span>
            </div>

            <div class="totals-row total">
              <strong>Total</strong>
              <span>KES ${Number(invoice.total_amount || 0).toFixed(2)}</span>
            </div>

            <div class="totals-row">
              <strong>Amount Paid</strong>
              <span>KES ${Number(invoice.amount_paid || 0).toFixed(2)}</span>
            </div>

            <div class="totals-row due">
              <strong>Balance Due</strong>
              <span>KES ${Number(invoice.balance_due || 0).toFixed(2)}</span>
            </div>
          </div>

          <div class="notes">
            <strong>Notes:</strong>
            <p>${invoice.notes || "N/A"}</p>
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
  };
  const filteredCustomers = customers.filter((customer) =>
    customer.name?.toLowerCase().includes(customerSearch.toLowerCase()),
  );

  const openDeleteModal = (invoice) => {
    setInvoiceToDelete(invoice);
  };

  const closeDeleteModal = () => {
    if (deletingInvoice) return;
    setInvoiceToDelete(null);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setDeletingInvoice(true);

    try {
      await axios.delete(`/delete-invoice/${invoiceToDelete.invoice_id}`);
      toast.success("Invoice deleted and stock restored!");
      setInvoiceToDelete(null);
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error deleting invoice.");
    } finally {
      setDeletingInvoice(false);
    }
  };

  const openEmailPreview = async (invoice) => {
    try {
      const res = await axios.get(
        `/invoice-email-preview/${invoice.invoice_id}`,
      );
      setEmailPreview({
        invoice,
        ...res.data,
      });
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Error loading email preview.",
      );
    }
  };

  const confirmSendInvoiceEmail = async () => {
    if (!emailPreview?.invoice) return;

    setSendingInvoiceEmail(true);

    try {
      await axios.post(
        `/send-invoice-email/${emailPreview.invoice.invoice_id}`,
      );
      toast.success(`Invoice sent to ${emailPreview.to}`);
      setEmailPreview(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Error sending invoice.");
    } finally {
      setSendingInvoiceEmail(false);
    }
  };

  return (
    <div className="invoice-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="invoice-header">
        <h1>Invoices</h1>
        <button onClick={() => openModal()}>+ Add Invoice</button>
      </div>

      <div className="invoice-search-box">
        <input
          type="text"
          placeholder="Search invoice number, customer, status, amount..."
          value={invoiceSearch}
          onChange={(e) => setInvoiceSearch(e.target.value)}
        />
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
              <th>Email</th>
              <th>WhatsApp</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {invoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
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
                      className={`invoice-status invoice-status-${String(
                        invoice.status || "unpaid",
                      )
                        .toLowerCase()
                        .trim()}`}
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
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="print-btn"
                      onClick={() => openEmailPreview(invoice)}
                    >
                      Email
                    </button>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="whatsapp-btn"
                      onClick={() => shareInvoiceWhatsApp(invoice)}
                    >
                      WhatsApp
                    </button>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="delete-invoice-btn"
                      onClick={() => openDeleteModal(invoice)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="12">No invoices found.</td>
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
                      previous_balances: [],
                    }));
                    setCustomerPendingInvoices([]);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  required
                  disabled={editingInvoice}
                />

                {showCustomerDropdown && !editingInvoice && (
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
                              previous_balances: [],
                            }));

                            setCustomerSearch(customer.name);
                            setShowCustomerDropdown(false);
                            fetchCustomerPendingInvoices(customer.id);
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

              {!editingInvoice && customerPendingInvoices.length > 0 && (
                <div className="pending-invoices-box">
                  <h3>Include Previous Pending Invoices</h3>

                  {customerPendingInvoices.map((invoice) => (
                    <label
                      key={invoice.invoice_id}
                      className="pending-invoice-item"
                    >
                      <input
                        type="checkbox"
                        checked={formData.previous_balances.some(
                          (inv) => inv.invoice_id === invoice.invoice_id,
                        )}
                        onChange={() => togglePreviousBalance(invoice)}
                      />

                      <span>
                        {invoice.invoice_number} — Balance: Ksh{" "}
                        {Number(invoice.balance_due || 0).toFixed(2)}
                      </span>
                    </label>
                  ))}

                  <div className="pending-invoice-total">
                    Selected Previous Balance:{" "}
                    <strong>Ksh {selectedPendingTotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}

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
                    <div className="invoice-product-search-box">
                      <input
                        type="text"
                        placeholder="Search product..."
                        value={item.item_name || ""}
                        onChange={(e) => {
                          handleItemChange(index, "item_name", e.target.value);
                          handleItemChange(index, "showProductDropdown", true);
                        }}
                        onFocus={() =>
                          handleItemChange(index, "showProductDropdown", true)
                        }
                        required
                      />

                      {item.showProductDropdown && (
                        <div className="invoice-product-dropdown">
                          {salesProducts
                            .filter((product) =>
                              product.product_name
                                ?.toLowerCase()
                                .includes((item.item_name || "").toLowerCase()),
                            )
                            .map((product) => (
                              <div
                                key={product.product_id}
                                className="invoice-product-option"
                                onClick={() => {
                                  const updatedItems = [...formData.items];

                                  updatedItems[index] = {
                                    ...updatedItems[index],
                                    product_id: product.product_id,
                                    item_name: product.product_name,
                                    unit: product.unit,
                                    selling_price: Number(
                                      product.product_price || 0,
                                    ),
                                    unit_price: Number(
                                      product.product_price || 0,
                                    ),
                                    available_stock: Number(
                                      product.product_stock || 0,
                                    ),
                                    quantity:
                                      item.quantity !== undefined &&
                                      item.quantity !== null
                                        ? Number(item.quantity)
                                        : 1,

                                    amount:
                                      Number(
                                        item.quantity !== undefined &&
                                          item.quantity !== null
                                          ? item.quantity
                                          : 1,
                                      ) * Number(product.product_price || 0),
                                    showProductDropdown: false,
                                  };

                                  setFormData((prev) => ({
                                    ...prev,
                                    items: updatedItems,
                                  }));
                                }}
                              >
                                <span>{product.product_name}</span>
                                <small>
                                  Price: Ksh{" "}
                                  {Number(product.product_price || 0).toFixed(
                                    2,
                                  )}{" "}
                                  | Stock: {product.product_stock}
                                </small>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="number"
                      placeholder="Qty"
                      min="0"
                      step={allowsDecimal(item.unit) ? "0.01" : "1"}
                      max={item.available_stock || 1}
                      value={item.quantity}
                      onChange={(e) => {
                        let quantity = Number(e.target.value);
                        if (
                          !allowsDecimal(item.unit) &&
                          !Number.isInteger(quantity)
                        ) {
                          toast.error(
                            `${item.item_name} only allows whole number quantities.`,
                          );
                          return;
                        }
                        const availableStock = Number(
                          item.available_stock || 0,
                        );

                        if (quantity > availableStock) {
                          quantity = availableStock;
                          toast.info(
                            `Only ${availableStock} available for ${item.item_name}. Quantity adjusted.`,
                          );
                        }

                        const sellingPrice = Number(
                          item.selling_price || item.unit_price || 0,
                        );
                        const subtotal = quantity * sellingPrice;

                        handleItemChange(index, "quantity", quantity);

                        handleItemChange(
                          index,
                          "amount",
                          Number(
                            (quantity * Number(item.unit_price || 0)).toFixed(
                              2,
                            ),
                          ),
                        );
                        handleItemChange(index, "unit_price", sellingPrice);
                        handleItemChange(index, "subtotal", subtotal);
                      }}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Total"
                      value={
                        Number(item.quantity || 0) *
                        Number(item.unit_price || 0)
                      }
                      readOnly
                    />
                    <div className="invoice-stock-preview">
                      Qty Sent: {item.quantity || 0} | Available:{" "}
                      {item.available_stock || 0}
                    </div>

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
              {formData.previous_balances?.length > 0 && (
                <div className="previous-balance-box">
                  <h3>Previous Invoice Balances</h3>

                  {formData.previous_balances.map((invoice) => (
                    <div
                      key={invoice.invoice_id}
                      className="previous-balance-row"
                    >
                      <span>{invoice.invoice_number}</span>
                      <strong>
                        Ksh {Number(invoice.balance_due || 0).toFixed(2)}
                      </strong>
                    </div>
                  ))}

                  <div className="previous-balance-total">
                    Total Previous Balance:{" "}
                    <strong>Ksh {selectedPendingTotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}

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

              {formData.status === "partial" && (
                <input
                  type="number"
                  name="amount_paid"
                  placeholder="Amount Paid"
                  value={formData.amount_paid}
                  onChange={handleChange}
                />
              )}

              <div className="invoice-total-preview">
                <p>
                  Current Items Subtotal:{" "}
                  <strong>Ksh {currentItemsSubtotal.toFixed(2)}</strong>
                </p>
                <p>
                  Previous Selected Balance:{" "}
                  <strong>Ksh {selectedPendingTotal.toFixed(2)}</strong>
                </p>
                <p>
                  Estimated Invoice Total:{" "}
                  <strong>Ksh {currentInvoiceTotal.toFixed(2)}</strong>
                </p>
              </div>

              <select
                name="status"
                value={formData.status}
                onChange={handleStatusChange}
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

      {invoiceToDelete && (
        <div className="delete-modal-overlay">
          <div className="delete-modal-card">
            <div className="delete-modal-icon">!</div>

            <h2>Delete Invoice?</h2>

            <p>
              Are you sure you want to delete invoice{" "}
              <strong>{invoiceToDelete.invoice_number}</strong>?
            </p>

            <div className="delete-modal-warning">
              Any linked product stock will be added back automatically.
            </div>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="delete-cancel-btn"
                onClick={closeDeleteModal}
                disabled={deletingInvoice}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-confirm-btn"
                onClick={confirmDeleteInvoice}
                disabled={deletingInvoice}
              >
                {deletingInvoice ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailPreview && (
        <div className="delete-modal-overlay">
          <div className="delete-modal-card" style={{ maxWidth: "900px" }}>
            <h2>Send Invoice Email?</h2>

            <p>
              This invoice will be sent to:
              <br />
              <strong>{emailPreview.to}</strong>
            </p>

            <div
              className="invoice-email-preview-box"
              dangerouslySetInnerHTML={{ __html: emailPreview.html }}
            />

            <div className="delete-modal-actions">
              <button
                type="button"
                className="delete-cancel-btn"
                onClick={() => setEmailPreview(null)}
                disabled={sendingInvoiceEmail}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-confirm-btn"
                onClick={confirmSendInvoiceEmail}
                disabled={sendingInvoiceEmail}
              >
                {sendingInvoiceEmail ? "Sending..." : "Send Email + PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
