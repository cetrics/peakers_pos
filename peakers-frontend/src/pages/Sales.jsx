import { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles/SalesPage.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SalesPage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentType, setPaymentType] = useState("Mpesa");
  const [alertMessage, setAlertMessage] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
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
  const [vatRate, setVatRate] = useState(0.16);
  const [discount, setDiscount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  // Update cart badge in the nav
  const updateCartBadge = (updatedCart) => {
    const badge = document.getElementById("cartBadge");
    if (badge) {
      const totalItems = updatedCart.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      badge.textContent = totalItems > 0 ? totalItems : "";
    }
  };

  useEffect(() => {
    axios
      .get("/get-sales-products")
      .then((response) => {
        setProducts(response.data.products);
        setFilteredProducts(response.data.products);
      })
      .catch(() => setAlertMessage("❌ Error loading products."));
  }, []);

  useEffect(() => {
    const searchInput = document.getElementById("customerSearch");

    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();
        setSearchTerm(query);

        if (!query) {
          setFilteredProducts(products);
          return;
        }

        const filtered = products.filter(
          (product) =>
            product.product_name.toLowerCase().includes(query) ||
            product.product_id.toString().includes(query) ||
            product.product_price.toString().includes(query)
        );
        setFilteredProducts(filtered);
      };

      searchInput.addEventListener("input", handleSearch);
      return () => searchInput.removeEventListener("input", handleSearch);
    }
  }, [products]);

  const fetchCustomers = () => {
    const timestamp = new Date().getTime();
    axios
      .get(`/get-sales-customers?t=${timestamp}`)
      .then((response) => setCustomers(response.data.customers))
      .catch(() => setAlertMessage("❌ Error loading customers."));
  };

  useEffect(() => {
    const navLeft = document.querySelector(".cart-icon");

    const toggleCart = () => {
      if (window.innerWidth <= 768) {
        setCartOpen((prev) => !prev);
      }
    };

    if (navLeft) {
      navLeft.addEventListener("click", toggleCart);
    }

    return () => {
      if (navLeft) {
        navLeft.removeEventListener("click", toggleCart);
      }
    };
  }, []);

  useEffect(() => {
    axios
      .get("/get-company-details")
      .then((response) => setCompanyDetails(response.data))
      .catch(() => setAlertMessage("❌ Error loading company details."));
  }, []);

  const addToCart = (product) => {
    if (product.product_stock <= 0) {
      setAlertMessage("❌ This product is out of stock.");
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.product_id
    );

    let updatedCart;
    if (existing) {
      updatedCart = cart.map((item) =>
        item.product_id === product.product_id
          ? {
              ...item,
              quantity: item.quantity + 1,
              subtotal: (item.quantity + 1) * parseFloat(item.product_price),
            }
          : item
      );
    } else {
      updatedCart = [
        ...cart,
        {
          ...product,
          quantity: 1,
          subtotal: parseFloat(product.product_price),
        },
      ];
    }

    setCart(updatedCart);
    updateCartBadge(updatedCart);
  };

  const removeFromCart = (product_id) => {
    const updatedCart = cart.filter((item) => item.product_id !== product_id);
    setCart(updatedCart);
    updateCartBadge(updatedCart);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("❌ Cart is empty.");
      return;
    }

    if (!selectedCustomer) {
      toast.error("❌ Please select a customer.");
      return;
    }

    try {
      const totalAmount = cart.reduce(
        (sum, item) => sum + parseFloat(item.subtotal),
        0
      );

      const vat = totalAmount * vatRate;
      const finalTotal = totalAmount + vat - discount;

      const payload = {
        customer_id: selectedCustomer.id,
        payment_type: paymentType,
        cart_items: cart.map(
          ({ product_id, quantity, subtotal, is_bundle }) => ({
            product_id,
            quantity,
            subtotal,
            is_bundle,
          })
        ),

        vat: vat,
        discount: discount,
      };

      const response = await axios.post("/process-sale", payload);

      toast.success("✅ Sale processed successfully!");
      setCart([]);
      updateCartBadge([]);
      setSelectedCustomer(null);
      setVatRate(0.16);
      setDiscount(0);
      printReceipt(payload, totalAmount, vat, discount);
    } catch (error) {
      console.error("Error processing sale:", error.response?.data);

      const errorData = error.response?.data;

      if (errorData?.error === "INSUFFICIENT_STOCK") {
        toast.error(`❌ Stock error: ${errorData.message}`);
      } else {
        toast.error(
          `❌ ${errorData?.error || "Error processing sale. Try again."}`
        );
      }
    }
  };

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
                  ?.product_name || item.product_name
              }
${item.is_bundle ? "<strong> (Bundle)</strong>" : ""}


 - Ksh ${item.subtotal.toFixed(2)}

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

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim())
      return setAlertMessage("❌ Customer name is required.");

    try {
      const payload = {
        customer_name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        address: newCustomer.address,
      };

      const response = await axios.post("/add-sales-customer", payload);
      const addedCustomer = response.data.customer;

      const mappedCustomer = {
        id: addedCustomer.customer_id,
        name: addedCustomer.customer_name,
        phone: addedCustomer.phone || "N/A",
        email: addedCustomer.email || "N/A",
        address: addedCustomer.address || "N/A",
      };

      setSelectedCustomer(mappedCustomer);
      setCustomers((prevCustomers) => [mappedCustomer, ...prevCustomers]);
      await fetchCustomers();

      setCustomerModal(false);
      setAddingCustomer(false);
      setNewCustomer({ name: "", phone: "", email: "", address: "" });
      setAlertMessage("✅ Customer added successfully!");
    } catch (error) {
      console.error("Error adding customer:", error.response?.data);
      setAlertMessage(
        `❌ Error adding customer: ${
          error.response?.data?.error || "Unknown error"
        }`
      );
    }
  };

  return (
    <div className={styles.salesPage}>
      <ToastContainer position="top-right" autoClose={3000} />
      {/* Cart Section */}
      <div className={`${styles.cartSection} ${cartOpen ? styles.open : ""}`}>
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

        {/* Customer Modal - Now inside cart section */}
        {customerModal && (
          <div className={styles.customerModal}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeIcon}
                onClick={() => setCustomerModal(false)}
              >
                &times;
              </span>

              {addingCustomer ? (
                <>
                  <h2>Add New Customer</h2>
                  <form
                    onSubmit={handleAddCustomer}
                    className={styles.customerForm}
                  >
                    <label className={styles.customerLabel}>Name:</label>
                    <input
                      type="text"
                      className={styles.customerInput}
                      value={newCustomer.name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, name: e.target.value })
                      }
                      required
                    />

                    <label className={styles.customerLabel}>
                      Phone (optional):
                    </label>
                    <input
                      type="text"
                      className={styles.customerInput}
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          phone: e.target.value,
                        })
                      }
                    />

                    <label className={styles.customerLabel}>
                      Email (optional):
                    </label>
                    <input
                      type="email"
                      className={styles.customerInput}
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          email: e.target.value,
                        })
                      }
                    />

                    <label className={styles.customerLabel}>
                      Address (optional):
                    </label>
                    <input
                      type="text"
                      className={styles.customerInput}
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          address: e.target.value,
                        })
                      }
                    />

                    <div className={styles.centeredButton}>
                      <button type="submit">Save Customer</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h2>Select Customer</h2>
                  <input
                    id="customerModalSearch"
                    type="text"
                    placeholder="Search customer..."
                    className={styles.customerInput}
                    onChange={(e) =>
                      setCustomerSearchTerm(e.target.value.toLowerCase())
                    }
                  />

                  <ul className={styles.customerList}>
                    {customers
                      .filter((customer) =>
                        (customer.name || "")
                          .toLowerCase()
                          .includes(customerSearchTerm)
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

        <ul>
          {cart.length === 0 ? (
            <p>Cart is empty</p>
          ) : (
            cart.map((item) => (
              <li key={item.product_id}>
                {item.product_name} x {item.quantity}
                {item.is_bundle && (
                  <span className={styles.bundleBadge}> Bundle</span>
                )}
                = Ksh {item.subtotal.toFixed(2)}
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
          className={`${styles.checkoutBtn} ${
            !selectedCustomer || cart.length === 0 ? styles.disabled : ""
          }`}
          onClick={handleCheckout}
        >
          <i className="fas fa-check"></i> Checkout
        </button>
      </div>

      {/* Product Section */}
      <div className={styles.productContainer}>
        <div className={styles.productGrid}>
          {filteredProducts.length === 0 ? (
            <p>No products found matching your search.</p>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.product_id}
                className={styles.productCard}
                onClick={() => addToCart(product)}
              >
                <i className="fas fa-box"></i>
                <h4>{product.product_name}</h4>

                {product.is_bundle && (
                  <span className={styles.bundleBadge}>Bundle</span>
                )}

                <p>Ksh {product.product_price}</p>
                <p>
                  Stock:{" "}
                  {product.product_stock < 1 ? (
                    <span style={{ color: "red", fontWeight: "bold" }}>
                      Out of stock
                    </span>
                  ) : (
                    product.product_stock
                  )}
                </p>
                {product.is_bundle && <span>Qty: {product.quantity}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesPage;
