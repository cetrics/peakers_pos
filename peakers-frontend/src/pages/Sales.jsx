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
  const [vatRate, setVatRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState(null);

  const updateCartBadge = (updatedCart) => {
    const badge = document.getElementById("cartBadge");
    if (badge) {
      const totalItems = updatedCart.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      badge.textContent = totalItems > 0 ? totalItems : "";
    }
  };

  const fetchProducts = () => {
    axios
      .get("/get-sales-products")
      .then((response) => {
        setProducts(response.data.products);
        setFilteredProducts(response.data.products);
      })
      .catch(() => toast.error("❌ Error loading products."));
  };

  const fetchCustomers = () => {
    const timestamp = new Date().getTime();
    axios
      .get(`/get-sales-customers?t=${timestamp}`)
      .then((response) => setCustomers(response.data.customers))
      .catch(() => toast.error("❌ Error loading customers."));
  };

  // ---- Initial data loads ----
  useEffect(() => {
    fetchProducts();
    fetchCustomers();

    axios
      .get("/get-company-details")
      .then((response) => setCompanyDetails(response.data))
      .catch(() => toast.error("❌ Error loading company details."));

    axios
      .get("/check-session", { withCredentials: true })
      .then((response) => {
        setLoggedInUserId(response.data.user_id);
      })
      .catch(() => toast.error("❌ Session error. Please login again."));
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
            product.product_price.toString().includes(query),
        );
        setFilteredProducts(filtered);
      };
      searchInput.addEventListener("input", handleSearch);
      return () => searchInput.removeEventListener("input", handleSearch);
    }
  }, [products]);

  useEffect(() => {
    const navLeft = document.querySelector(".cart-icon");
    const toggleCart = () => {
      if (window.innerWidth <= 768) setCartOpen((prev) => !prev);
    };
    if (navLeft) navLeft.addEventListener("click", toggleCart);
    return () => {
      if (navLeft) navLeft.removeEventListener("click", toggleCart);
    };
  }, []);

  const addToCart = (product) => {
    const stock = Number(product.product_stock) || 0;
    const price = Number(product.product_price) || 0;

    if (stock <= 0) {
      toast.error("❌ This product is out of stock.");
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.product_id,
    );

    let updatedCart;

    if (existing) {
      const addQty = stock < 1 ? stock : 1;
      const newQty = Number(existing.quantity) + addQty;

      if (newQty > stock) {
        toast.error(`❌ Only ${stock} available in stock`);
        return;
      }

      updatedCart = cart.map((item) =>
        item.product_id === product.product_id
          ? {
              ...item,
              quantity: newQty,
              subtotal: newQty * price,
            }
          : item,
      );
    } else {
      const initialQty = stock < 1 ? stock : 1;

      updatedCart = [
        ...cart,
        {
          ...product,
          quantity: initialQty,
          subtotal: initialQty * price,
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

  const updateCartQuantity = (product_id, newQuantity) => {
    // Allow user to empty the input while typing
    if (newQuantity === "") {
      const updatedCart = cart.map((item) =>
        item.product_id === product_id
          ? {
              ...item,
              quantity: "",
              subtotal: 0,
            }
          : item,
      );

      setCart(updatedCart);
      updateCartBadge(updatedCart);
      return;
    }

    let qty = Number(newQuantity);

    if (isNaN(qty) || qty < 0) {
      qty = 0;
    }

    const updatedCart = cart.map((item) => {
      if (item.product_id === product_id) {
        const stock = Number(item.product_stock) || 0;
        const price = Number(item.product_price) || 0;

        if (qty > stock) {
          toast.error(`❌ Only ${stock} available in stock`);
          return item;
        }

        return {
          ...item,
          quantity: qty,
          subtotal: qty * price,
        };
      }

      return item;
    });

    setCart(updatedCart);
    updateCartBadge(updatedCart);
  };

  const updateCartAmount = (product_id, amountValue) => {
    if (amountValue === "") {
      const updatedCart = cart.map((item) =>
        item.product_id === product_id
          ? { ...item, subtotal: "", quantity: "" }
          : item,
      );

      setCart(updatedCart);
      updateCartBadge(updatedCart);
      return;
    }

    if (!/^\d*\.?\d*$/.test(amountValue)) return;

    const amount = Number(amountValue);

    const updatedCart = cart.map((item) => {
      if (item.product_id !== product_id) return item;

      const price = Number(item.product_price) || 0;
      const stock = Number(item.product_stock) || 0;

      if (price <= 0) return item;

      const calculatedQty = Number((amount / price).toFixed(2));

      if (calculatedQty > stock) {
        toast.error(`❌ Only ${stock} available in stock`);
        return item;
      }

      return {
        ...item,
        quantity: calculatedQty,
        subtotal: amount,
      };
    });

    setCart(updatedCart);
    updateCartBadge(updatedCart);
  };
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("❌ Cart is empty.");
      return;
    }

    // Prevent empty or zero quantities
    const invalidItem = cart.find(
      (item) =>
        item.quantity === "" ||
        Number(item.quantity) <= 0 ||
        isNaN(Number(item.quantity)),
    );

    if (invalidItem) {
      toast.error(
        `❌ Please enter a valid quantity for ${invalidItem.product_name}`,
      );
      return;
    }

    if (!selectedCustomer) {
      toast.error("❌ Please select a customer.");
      return;
    }

    if (!loggedInUserId) {
      toast.error("❌ User not logged in. Please login again.");
      return;
    }

    try {
      const totalAmount = cart.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      );

      const safeVatRate = Number(vatRate) || 0;
      const safeDiscount = Number(discount) || 0;
      const vat = totalAmount * safeVatRate;

      const payload = {
        customer_id: selectedCustomer.id,
        payment_type: paymentType,
        user_id: loggedInUserId,
        cart_items: cart.map(
          ({ product_id, quantity, subtotal, is_bundle }) => ({
            product_id,
            quantity: Number(quantity) || 1,
            subtotal: Number(subtotal) || 0,
            is_bundle: !!is_bundle,
          }),
        ),
        vat,
        discount: safeDiscount,
      };

      const response = await axios.post("/process-sale", payload, {
        withCredentials: true,
      });

      const orderNumber = response.data.order_number;

      toast.success("✅ Sale processed successfully!");

      fetchProducts();
      setCart([]);
      updateCartBadge([]);
      setSelectedCustomer(null);
      setVatRate(0);
      setDiscount(0);

      printReceipt(payload, totalAmount, vat, safeDiscount, orderNumber);
    } catch (error) {
      console.error("Error processing sale:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      const errorData = error.response?.data;

      if (errorData?.error === "INSUFFICIENT_STOCK") {
        toast.error(`❌ Stock error: ${errorData.message}`);
      } else {
        toast.error(
          `❌ ${errorData?.error || errorData?.message || "Error processing sale. Try again."}`,
        );
      }
    }
  };

  const printReceipt = (saleData, totalAmount, vat, discount, orderNumber) => {
    const receiptContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; max-width: 300px; margin: 0 auto;">
        <h2 style="text-align: center;">${companyDetails.company}</h2>
        <p style="text-align: center;">${companyDetails.company_phone}</p>
        <hr />
        <h3 style="text-align: center;">Receipt</h3>
        <p><strong>Order No:</strong> ${orderNumber}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Customer:</strong> ${selectedCustomer ? selectedCustomer.name : "Guest"}</p>
        <hr />
        <h4>Items:</h4>
        <ul style="list-style: none; padding: 0;">
          ${saleData.cart_items
            .map((item) => {
              const productName =
                products.find((p) => p.product_id === item.product_id)
                  ?.product_name || item.product_name;
              return `
                <li>
                  ${item.quantity} x ${productName} ${item.is_bundle ? "<strong>(Bundle)</strong>" : ""}
                  - Ksh ${(Number(item.subtotal) || 0).toFixed(2)}
                </li>
              `;
            })
            .join("")}
        </ul>
        <hr />
        <p><strong>Subtotal:</strong> Ksh ${totalAmount.toFixed(2)}</p>
        <p><strong>VAT (${(Number(vatRate || 0) * 100).toFixed(0)}%):</strong> Ksh ${vat.toFixed(2)}</p>
        <p><strong>Discount:</strong> Ksh ${(Number(discount) || 0).toFixed(2)}</p>
        <p><strong>Total:</strong> Ksh ${(totalAmount + vat - discount).toFixed(2)}</p>
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
          <style>body { font-family: Arial, sans-serif; } @media print { body { margin: 0; padding: 0; } }</style>
        </head>
        <body>${receiptContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      toast.error("❌ Customer name is required.");
      return;
    }
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
      await fetchCustomers();
      setCustomerModal(false);
      setAddingCustomer(false);
      setNewCustomer({ name: "", phone: "", email: "", address: "" });
      toast.success("✅ Customer added successfully!");
    } catch (error) {
      toast.error(
        `❌ Error adding customer: ${error.response?.data?.error || "Unknown error"}`,
      );
    }
  };

  return (
    <div className={styles.salesPage}>
      <ToastContainer position="top-right" autoClose={3000} />

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
                          .includes(customerSearchTerm),
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

        <ul className={styles.cartList}>
          {cart.length === 0 ? (
            <p>Cart is empty</p>
          ) : (
            cart.map((item) => (
              <li key={item.product_id} className={styles.cartItem}>
                <div className={styles.cartItemInfo}>
                  <strong>{item.product_name}</strong>
                  {item.is_bundle && (
                    <span className={styles.bundleBadge}> Bundle</span>
                  )}
                  <div className={styles.qtyPriceRow}>
                    <span>
                      Qty:
                      <input
                        type="number"
                        min="0"
                        max={item.product_stock}
                        value={item.quantity}
                        className={styles.qtyInput}
                        onChange={(e) =>
                          updateCartQuantity(item.product_id, e.target.value)
                        }
                        step="1"
                      />
                    </span>
                    {item.editingAmount ? (
                      <input
                        type="number"
                        min="0"
                        value={item.subtotal}
                        className={styles.amountInput}
                        autoFocus
                        onChange={(e) =>
                          updateCartAmount(item.product_id, e.target.value)
                        }
                        onBlur={() => {
                          setCart((prevCart) =>
                            prevCart.map((cartItem) =>
                              cartItem.product_id === item.product_id
                                ? { ...cartItem, editingAmount: false }
                                : cartItem,
                            ),
                          );
                        }}
                      />
                    ) : (
                      <strong
                        className={styles.clickableAmount}
                        onClick={() => {
                          setCart((prevCart) =>
                            prevCart.map((cartItem) =>
                              cartItem.product_id === item.product_id
                                ? { ...cartItem, editingAmount: true }
                                : cartItem,
                            ),
                          );
                        }}
                      >
                        Ksh {(Number(item.subtotal) || 0).toFixed(2)}
                      </strong>
                    )}
                  </div>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeFromCart(item.product_id)}
                  title="Remove item"
                >
                  ❌
                </button>
              </li>
            ))
          )}
        </ul>

        <h3>
          Total: Ksh{" "}
          {cart
            .reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
            .toFixed(2)}
        </h3>

        <div className={styles.vatDiscountSection}>
          <label>
            VAT Rate (%):
            <input
              type="number"
              value={Number.isFinite(vatRate) ? (vatRate * 100).toFixed(0) : ""}
              onChange={(e) => {
                const value = e.target.value;
                setVatRate(value === "" ? 0 : Number(value) / 100);
              }}
              min="0"
              max="100"
              className={styles.smallInput}
            />
          </label>
          <label>
            Discount (Ksh):
            <input
              type="number"
              value={Number.isFinite(discount) ? discount : 0}
              onChange={(e) => {
                const value = e.target.value;
                setDiscount(value === "" ? 0 : Number(value));
              }}
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
          <option value="Bank">Bank</option>
          <option value="Credit">Credit</option>
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
                  {Number(product.product_stock) <= 0 ? (
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
