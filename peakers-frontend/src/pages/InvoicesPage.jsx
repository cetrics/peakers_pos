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
             .filter(
               (item) =>
                 !item.item_name
                   ?.toLowerCase()
                   .startsWith("previous balance from"),
             )
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

          ${(invoice.items || [])
            .filter((item) =>
              item.item_name?.toLowerCase().startsWith("previous balance from"),
            )
            .map(
              (item) => `
      <div style="margin-top:20px; padding:12px; background:#faf6f5; border:1px solid #ddd;">
        <strong>${item.item_name}</strong>
        <span style="float:right;">
          KES ${Number(item.subtotal || 0).toFixed(2)}
        </span>
      </div>
    `,
            )
            .join("")}

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
                <td colSpan="10">No invoices found.</td>
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
    </div>
  );
};

export default InvoicesPage;
