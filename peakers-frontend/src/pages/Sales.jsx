import { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles/SalesPage.module.css";

const SalesPage = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentType, setPaymentType] = useState("Mpesa");
  const [alertMessage, setAlertMessage] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [companyDetails, setCompanyDetails] = useState({
    company: "",
    company_phone: "",
  });
  const [vatRate, setVatRate] = useState(0.16); // Default VAT rate (16%)
  const [discount, setDiscount] = useState(0); // Default discount

  // Fetch Products
  useEffect(() => {
    axios
      .get("/get-sales-products")
      .then((response) => setProducts(response.data.products))
      .catch(() => setAlertMessage("❌ Error loading products."));
  }, []);

  // Fetch Customers
  const fetchCustomers = () => {
    axios
      .get("/get-customers")
      .then((response) => setCustomers(response.data.customers))
      .catch(() => setAlertMessage("❌ Error loading customers."));
  };

  // Fetch Company Details
  useEffect(() => {
    axios
      .get("/get-company-details")
      .then((response) => setCompanyDetails(response.data))
      .catch(() => setAlertMessage("❌ Error loading company details."));
  }, []);

  // Add to Cart
  const addToCart = (product) => {
    if (product.product_stock <= 0) {
      setAlertMessage("❌ This product is out of stock.");
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.product_id
    );
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product_id === product.product_id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * parseFloat(item.product_price),
              }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          subtotal: parseFloat(product.product_price),
        },
      ]);
    }
  };

  // Remove from Cart
  const removeFromCart = (product_id) =>
    setCart(cart.filter((item) => item.product_id !== product_id));

  // Handle Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return setAlertMessage("❌ Cart is empty.");
    if (!selectedCustomer)
      return setAlertMessage("❌ Please select a customer.");

    console.log("Selected Customer:", selectedCustomer); // Debugging

    try {
      const totalAmount = cart.reduce(
        (sum, item) => sum + parseFloat(item.subtotal),
        0
      );

      // Calculate VAT and final total
      const vat = totalAmount * vatRate; // VAT amount
      const finalTotal = totalAmount + vat - discount; // Final total after VAT and discount

      const payload = {
        customer_id: selectedCustomer.id, // Use "id" as "customer_id"
        payment_type: paymentType,
        cart_items: cart.map(({ product_id, quantity, subtotal }) => ({
          product_id,
          quantity,
          subtotal,
        })),
        vat: vat, // Include VAT
        discount: discount, // Include discount
      };

      console.log("Sending payload:", payload); // Debugging

      const response = await axios.post("/process-sale", payload);

      setAlertMessage("✅ Sale processed successfully!");

      // Clear all fields after successful sale
      setCart([]); // Clear the cart
      setSelectedCustomer(null); // Clear selected customer
      setVatRate(0.16); // Reset VAT rate to default
      setDiscount(0); // Reset discount to 0

      // Generate and print receipt
      printReceipt(payload, totalAmount, vat, discount);
    } catch (error) {
      console.error("Error processing sale:", error.response?.data);
      setAlertMessage("❌ Error processing sale. Try again.");
    }
  };

  // Print Receipt
  const printReceipt = (saleData, totalAmount, vat, discount) => {
    const receiptContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; max-width: 300px; margin: 0 auto;">
        <h2 style="text-align: center;">${companyDetails.company}</h2>
        <p style="text-align: center;">${companyDetails.company_phone}</p>
        <hr />
        <h3 style="text-align: center;">Receipt</h3>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Customer:</strong> ${
          selectedCustomer ? selectedCustomer.name : "Guest"
        }</p>
        <hr />
        <h4>Items:</h4>
        <ul style="list-style: none; padding: 0;">
          ${saleData.cart_items
            .map(
              (item) => `
            <li>
              ${item.quantity} x ${
                products.find((p) => p.product_id === item.product_id)
                  ?.product_name || "Unknown Product"
              } - Ksh ${item.subtotal.toFixed(2)}
            </li>
          `
            )
            .join("")}
        </ul>
        <hr />
        <p><strong>Subtotal:</strong> Ksh ${totalAmount.toFixed(2)}</p>
        <p><strong>VAT (${(vatRate * 100).toFixed(
          0
        )}%):</strong> Ksh ${vat.toFixed(2)}</p>
        <p><strong>Discount:</strong> Ksh ${discount.toFixed(2)}</p>
        <p><strong>Total:</strong> Ksh ${(totalAmount + vat - discount).toFixed(
          2
        )}</p>
        <p><strong>Payment Type:</strong> ${saleData.payment_type}</p>
        <hr />
        <p style="text-align: center;">Thank you for shopping with us!</p>
      </div>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${receiptContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle Add Customer Form Submission
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim())
      return setAlertMessage("❌ Customer name is required.");

    try {
      const payload = {
        customer_name: newCustomer.name, // Map to backend's expected field
        phone: newCustomer.phone,
        email: newCustomer.email,
        address: newCustomer.address,
      };
      console.log("Sending payload:", payload); // Debugging

      const response = await axios.post("/add-sales-customer", payload);
      const addedCustomer = response.data.customer;

      // Map backend's customer_name to name for the frontend
      const mappedCustomer = {
        ...addedCustomer,
        id: addedCustomer.customer_id, // Ensure the correct ID is used
        name: addedCustomer.customer_name, // Map customer_name to name
      };

      setSelectedCustomer(mappedCustomer); // Update selectedCustomer with the mapped object
      setCustomers([...customers, mappedCustomer]); // Add the new customer to the list
      setCustomerModal(false);
      setAddingCustomer(false);
      setNewCustomer({ name: "", phone: "", email: "", address: "" }); // Reset form
      setAlertMessage("✅ Customer added successfully!");
    } catch (error) {
      console.error("Error adding customer:", error.response?.data); // Log backend error message
      setAlertMessage(
        `❌ Error adding customer: ${
          error.response?.data?.error || "Unknown error"
        }`
      );
    }
  };

  return (
    <div className={styles.salesPage}>
      {/* Cart Section */}
      <div className={styles.cartSection}>
        {alertMessage && (
          <div className={styles.alertMessage}>{alertMessage}</div>
        )}

        <div className={styles.cartHeader}>
          <i className="fas fa-shopping-cart"></i> Cart
        </div>

        <button
          className={styles.selectCustomerBtn}
          onClick={() => {
            fetchCustomers();
            setCustomerModal(true);
          }}
        >
          Select Customer
        </button>
        {selectedCustomer && (
          <p>
            Selected Customer: {selectedCustomer.name || "Unnamed Customer"}
          </p>
        )}

        <ul>
          {cart.length === 0 ? (
            <p>Cart is empty</p>
          ) : (
            cart.map((item) => (
              <li key={item.product_id}>
                {item.product_name} x {item.quantity} = Ksh {item.subtotal}
                <button
                  className={styles.removeBtn}
                  onClick={() => removeFromCart(item.product_id)}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </li>
            ))
          )}
        </ul>

        <h3>
          Total: Ksh{" "}
          {cart
            .reduce((sum, item) => sum + parseFloat(item.subtotal), 0)
            .toFixed(2)}
        </h3>

        {/* VAT and Discount Inputs */}
        <div className={styles.vatDiscountSection}>
          <label>
            VAT Rate (%):
            <input
              type="number"
              value={(vatRate * 100).toFixed(0)}
              onChange={(e) => setVatRate(parseFloat(e.target.value) / 100)}
              min="0"
              max="100"
              className={styles.smallInput}
            />
          </label>
          <label>
            Discount (Ksh):
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value))}
              min="0"
              className={styles.smallInput}
            />
          </label>
        </div>

        <label className={styles.paymentLabel}>
          <i className="fas fa-credit-card"></i> Payment Type:
        </label>
        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <option value="Mpesa">Mpesa</option>
          <option value="Cash">Cash</option>
        </select>

        <button
          className={styles.checkoutBtn}
          onClick={handleCheckout}
          disabled={!selectedCustomer || cart.length === 0} // Disable if no customer or cart is empty
        >
          <i className="fas fa-check"></i> Checkout
        </button>
      </div>

      {/* Product Section */}
      <div className={styles.productContainer}>
        <div className={styles.productGrid}>
          {products.map((product) => (
            <div
              key={product.product_id}
              className={styles.productCard}
              onClick={() => addToCart(product)}
            >
              <i className="fas fa-box"></i>
              <h4>{product.product_name}</h4>
              <p>Ksh {product.product_price}</p>
              <p>Stock: {product.product_stock}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Selection Modal */}
      {customerModal && (
        <div className={styles.customerModal}>
          <div className={styles.modalContent}>
            {/* Close Button (X Icon) */}
            <span
              className={styles.closeIcon}
              onClick={() => setCustomerModal(false)}
            >
              &times;
            </span>

            {addingCustomer ? (
              <>
                <h2>Add New Customer</h2>
                <form onSubmit={handleAddCustomer}>
                  <label>Name:</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                    required
                  />
                  <label>Phone (optional):</label>
                  <input
                    type="text"
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, phone: e.target.value })
                    }
                  />
                  <label>Email (optional):</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                  />
                  <label>Address (optional):</label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        address: e.target.value,
                      })
                    }
                  />
                  {/* Centered Save Customer Button */}
                  <div className={styles.centeredButton}>
                    <button type="submit">Save Customer</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>Select Customer</h2>
                <input
                  type="text"
                  placeholder="Search customer..."
                  onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                />
                <ul className={styles.customerList}>
                  {customers
                    .filter((customer) =>
                      (customer.name || "").toLowerCase().includes(searchTerm)
                    )
                    .map((customer) => (
                      <li
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerModal(false);
                        }}
                      >
                        {customer.name || "Unnamed"} -{" "}
                        {customer.phone || "No phone"}
                      </li>
                    ))}
                </ul>
                {/* Centered Add Customer Button */}
                <div className={styles.centeredButton}>
                  <button onClick={() => setAddingCustomer(true)}>
                    + Add Customer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;
