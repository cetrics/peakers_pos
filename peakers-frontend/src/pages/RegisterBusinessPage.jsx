import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles/RegisterBusinessPage.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const RegisterBusinessPage = () => {
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowedAccess, setAllowedAccess] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingBusinessId, setEditingBusinessId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("businesses");
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [businessSearch, setBusinessSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedSuperAdminShops, setSelectedSuperAdminShops] = useState([]);

  // Business registration form
  const [businessFormData, setBusinessFormData] = useState({
    business_name: "",
    business_email: "",
    business_phone: "",
    address: "",
    city: "",
    country: "Kenya",
    business_type: "retail",

    logo: null,

    has_stk_api: false,
    stk_app_id: "",
    stk_api_key: "",
    stk_callback_url: "",
    stk_error_callback_url: "",
    language: "en",
    currency: "KES",
  });

  // User registration form
  const [userFormData, setUserFormData] = useState({
    username: "",
    user_email: "",
    password: "",
    role: "admin",
    business_id: "",
  });

  // Business edit data (inline)
  const [businessEditData, setBusinessEditData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "Kenya",
    subscription_plan: "free",
    subscription_status: "active",
  });

  const handleShopCheckboxChange = (businessId) => {
    setSelectedSuperAdminShops((prev) =>
      prev.includes(businessId)
        ? prev.filter((id) => id !== businessId)
        : [...prev, businessId],
    );
  };

  // User edit data (inline)
  const [userEditData, setUserEditData] = useState({
    username: "",
    user_email: "",
    password: "",
    role: "admin",
    business_id: "",
  });

  // --- Fetch data ---
  const fetchBusinesses = async () => {
    try {
      const res = await axios.get("/get-businesses");
      setBusinesses(res.data.businesses || []);
    } catch (error) {
      toast.error("Error loading businesses.");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get("/get-users");
      setUsers(res.data.users || []);
    } catch (error) {
      toast.error("Error loading users.");
    }
  };

  useEffect(() => {
    axios
      .get("/check-session", { withCredentials: true })
      .then((res) => {
        if (res.data.role === "owner") {
          setAllowedAccess(true);
          fetchBusinesses();
          fetchUsers();
        } else {
          toast.error("You are not authorized to access this page.");
          navigate("/");
        }
      })
      .catch(() => {
        toast.error("Please login first.");
        navigate("/login");
      })
      .finally(() => {
        setCheckingAccess(false);
      });
  }, []);

  // --- Business registration ---
  const handleBusinessChange = (e) => {
    setBusinessFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setBusinessFormData((prev) => ({
        ...prev,
        logo: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  const handleRegisterBusiness = async (e) => {
    e.preventDefault();

    try {
      if (editingBusinessId) {
        const formData = new FormData();

        formData.append("name", businessFormData.business_name);
        formData.append("email", businessFormData.business_email);
        formData.append("phone", businessFormData.business_phone);
        formData.append("address", businessFormData.address);
        formData.append("city", businessFormData.city);
        formData.append("country", businessFormData.country);
        formData.append("business_type", businessFormData.business_type);
        formData.append("subscription_plan", "basic");
        formData.append("subscription_status", "active");

        formData.append("has_stk_api", businessFormData.has_stk_api);
        formData.append("stk_app_id", businessFormData.stk_app_id);
        formData.append("stk_api_key", businessFormData.stk_api_key);
        formData.append("stk_callback_url", businessFormData.stk_callback_url);
        formData.append("language", businessFormData.language);
        formData.append("currency", businessFormData.currency);
        formData.append(
          "stk_error_callback_url",
          businessFormData.stk_error_callback_url,
        );

        if (businessFormData.logo instanceof File) {
          formData.append("logo", businessFormData.logo);
        }

        await axios.put(`/update-business/${editingBusinessId}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        toast.success("Business updated successfully!");
      } else {
        const formData = new FormData();

        formData.append("business_name", businessFormData.business_name);
        formData.append("business_email", businessFormData.business_email);
        formData.append("business_phone", businessFormData.business_phone);
        formData.append("address", businessFormData.address);
        formData.append("city", businessFormData.city);
        formData.append("country", businessFormData.country);
        formData.append("business_type", businessFormData.business_type);

        formData.append("has_stk_api", businessFormData.has_stk_api);
        formData.append("stk_app_id", businessFormData.stk_app_id);
        formData.append("stk_api_key", businessFormData.stk_api_key);
        formData.append("stk_callback_url", businessFormData.stk_callback_url);
        formData.append("language", businessFormData.language);
        formData.append("currency", businessFormData.currency);
        formData.append(
          "stk_error_callback_url",
          businessFormData.stk_error_callback_url,
        );

        if (businessFormData.logo) {
          formData.append("logo", businessFormData.logo);
        }

        await axios.post("/register-business", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        toast.success("Business registered successfully!");
      }

      setIsBusinessModalOpen(false);
      setEditingBusinessId(null);

      setBusinessFormData({
        business_name: "",
        business_email: "",
        business_phone: "",
        address: "",
        city: "",
        country: "Kenya",
        business_type: "retail",

        logo: null,

        has_stk_api: false,
        stk_app_id: "",
        stk_api_key: "",
        stk_callback_url: "",
        stk_error_callback_url: "",
      });

      fetchBusinesses();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Business save failed.");
    }
  };

  // --- User registration ---
  const handleUserChange = (e) => {
    setUserFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegisterUser = async (e) => {
    e.preventDefault();

    try {
      const response = editingUserId
        ? await axios.put(`/update-user/${editingUserId}`, userFormData)
        : await axios.post("/register-user", userFormData);

      const userId = editingUserId || response.data.user_id;

      // Assign shops if super admin
      if (userFormData.role === "super_admin") {
        await axios.post(`/assign-super-admin-shops/${userId}`, {
          business_ids: selectedSuperAdminShops,
        });
      }

      toast.success(
        editingUserId
          ? "User updated successfully!"
          : "User registered successfully!",
      );

      setIsUserModalOpen(false);

      setUserFormData({
        username: "",
        user_email: "",
        password: "",
        role: "admin",
        business_id: "",
      });

      setSelectedSuperAdminShops([]);

      setEditingUserId(null);

      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || "User registration failed.");
    }
  };

  // --- Inline edit handlers: Business ---
  const startEditBusiness = (business) => {
    setEditingBusinessId(business.id);

    setBusinessFormData({
      business_name: business.name || "",
      business_email: business.email || "",
      business_phone: business.phone || "",
      address: business.address || "",
      city: business.city || "",
      country: business.country || "Kenya",
      business_type: business.business_type || "retail",

      logo: business.logo || null,

      has_stk_api: Boolean(business.has_stk_api),
      stk_app_id: business.stk_app_id || "",
      stk_api_key: business.stk_api_key || "",
      stk_callback_url: business.stk_callback_url || "",
      stk_error_callback_url: business.stk_error_callback_url || "",
    });
    setIsBusinessModalOpen(true);
  };
  const handleBusinessEditChange = (e) => {
    setBusinessEditData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const updateBusiness = async (businessId) => {
    try {
      await axios.put(`/update-business/${businessId}`, businessEditData);
      toast.success("Business updated successfully!");
      setEditingBusinessId(null);
      fetchBusinesses();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error updating business.");
    }
  };

  // --- Inline edit handlers: User ---
  const startEditUser = (user) => {
    setEditingUserId(user.user_id);

    setUserFormData({
      username: user.username || "",
      user_email: user.user_email || "",
      password: "",
      role: user.role || "admin",
      business_id: user.business_id || "",
    });

    if (user.role === "super_admin") {
      axios.get(`/get-super-admin-shops/${user.user_id}`).then((res) => {
        setSelectedSuperAdminShops(res.data.business_ids || []);
      });
    } else {
      setSelectedSuperAdminShops([]);
    }

    setIsUserModalOpen(true);
  };

  const handleUserEditChange = (e) => {
    setUserEditData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const updateUser = async (userId) => {
    try {
      await axios.put(`/update-user/${userId}`, userEditData);
      toast.success("User updated successfully!");
      setEditingUserId(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Error updating user.");
    }
  };

  // --- Search filtering ---
  const filteredBusinesses = businesses.filter((b) =>
    Object.values({
      name: b.name,
      email: b.email,
      phone: b.phone,
      city: b.city,
    }).some(
      (val) => val && val.toLowerCase().includes(businessSearch.toLowerCase()),
    ),
  );

  const filteredUsers = users.filter((u) =>
    Object.values({
      username: u.username,
      email: u.user_email,
      role: u.role,
      business: u.business_name || u.company,
    }).some(
      (val) => val && val.toLowerCase().includes(userSearch.toLowerCase()),
    ),
  );

  if (checkingAccess) {
    return <div className="loading">Checking access...</div>;
  }

  if (!allowedAccess) {
    return null;
  }

  return (
    <div className="register-business-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="management-container">
        {/* Header & Buttons */}
        <div className="header-actions">
          <h1>Business Management</h1>
          <div className="button-group">
            <button
              className="btn-primary"
              onClick={() => setIsBusinessModalOpen(true)}
            >
              + Register Business
            </button>
            <button
              className="btn-secondary"
              onClick={() => setIsUserModalOpen(true)}
            >
              + Register User
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === "businesses" ? "active" : ""}`}
            onClick={() => setActiveTab("businesses")}
          >
            Businesses
          </button>
          <button
            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
        </div>

        {/* Tab content: Businesses */}
        {activeTab === "businesses" && (
          <div className="tab-pane">
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Search businesses by name, email, phone or city..."
                value={businessSearch}
                onChange={(e) => setBusinessSearch(e.target.value)}
              />
            </div>
            <div className="cards-grid">
              {filteredBusinesses.length > 0 ? (
                filteredBusinesses.map((business) => (
                  <div key={business.id} className="card">
                    <>
                      <div className="business-card-header">
                        <img
                          src={
                            business.logo ||
                            "/static/images/default-retail-logo.png"
                          }
                          alt={business.name || "Business Logo"}
                          className="business-logo"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "/static/images/default-retail-logo.png";
                          }}
                        />
                        <h3>
                          {business.name ||
                            business.business_name ||
                            "NO BUSINESS NAME"}
                        </h3>
                        <span
                          className={`plan-badge ${business.subscription_plan}`}
                        >
                          {business.subscription_plan}
                        </span>
                      </div>

                      <div className="card-details">
                        <p>
                          <strong>Email:</strong> {business.email || "N/A"}
                        </p>
                        <p>
                          <strong>Phone:</strong> {business.phone || "N/A"}
                        </p>
                        <p>
                          <strong>Address:</strong> {business.address || "N/A"}
                        </p>
                        <p>
                          <strong>City:</strong> {business.city || "N/A"}
                        </p>
                        <p>
                          <strong>Country:</strong>{" "}
                          {business.country || "Kenya"}
                        </p>

                        <p>
                          <strong>Status:</strong>{" "}
                          {business.subscription_status}
                        </p>
                        <p>
                          <strong>Type:</strong>{" "}
                          {business.business_type === "restaurant"
                            ? "Restaurant"
                            : "Retail"}
                        </p>
                      </div>

                      <div className="card-actions">
                        <button
                          onClick={() => startEditBusiness(business)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  </div>
                ))
              ) : (
                <div className="no-results">
                  No businesses match your search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab content: Users */}
        {activeTab === "users" && (
          <div className="tab-pane">
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Search users by username, email, role or business name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div className="cards-grid">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div key={user.user_id} className="card">
                    <>
                      <div className="user-card-header">
                        <h3>{user.username || "NO USERNAME"}</h3>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </div>

                      <div className="card-details">
                        <p>
                          <strong>Email:</strong> {user.user_email}
                        </p>
                        <p>
                          <strong>Business:</strong>{" "}
                          {user.business_name || user.company || "N/A"}
                        </p>
                        <p>
                          <strong>Password:</strong> ••••••
                        </p>
                      </div>

                      <div className="card-actions">
                        <button
                          onClick={() => startEditUser(user)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  </div>
                ))
              ) : (
                <div className="no-results">No users match your search.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Register Business */}
      {isBusinessModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsBusinessModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingBusinessId ? "Edit Business" : "Register New Business"}
              </h2>
              <button
                className="close-modal"
                onClick={() => setIsBusinessModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleRegisterBusiness}>
              <div className="form-row">
                <input
                  type="text"
                  name="business_name"
                  placeholder="Business Name *"
                  value={businessFormData.business_name}
                  onChange={handleBusinessChange}
                  required
                />
                <input
                  type="email"
                  name="business_email"
                  placeholder="Business Email"
                  value={businessFormData.business_email}
                  onChange={handleBusinessChange}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  name="business_phone"
                  placeholder="Business Phone"
                  value={businessFormData.business_phone}
                  onChange={handleBusinessChange}
                />
                <input
                  type="text"
                  name="address"
                  placeholder="Address"
                  value={businessFormData.address}
                  onChange={handleBusinessChange}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  value={businessFormData.city}
                  onChange={handleBusinessChange}
                />
                <input
                  type="text"
                  name="country"
                  placeholder="Country"
                  value={businessFormData.country}
                  onChange={handleBusinessChange}
                />
              </div>
              <div className="form-row">
                <select
                  name="business_type"
                  value={businessFormData.business_type}
                  onChange={handleBusinessChange}
                  required
                >
                  <option value="retail">Retail Business</option>
                  <option value="restaurant">Restaurant Business</option>
                </select>
              </div>
              <div className="form-row">
                <select
                  name="language"
                  value={businessFormData.language}
                  onChange={handleBusinessChange}
                >
                  <option value="en">English</option>
                  <option value="sw">Kiswahili</option>
                </select>

                <select
                  name="currency"
                  value={businessFormData.currency}
                  onChange={handleBusinessChange}
                >
                  <option value="KES">KES - Kenya Shillings</option>
                  <option value="TZS">TZS - Tanzania Shillings</option>
                </select>
              </div>
              <div className="form-row">
                <input
                  type="file"
                  name="logo"
                  accept="image/*"
                  onChange={(e) =>
                    setBusinessFormData((prev) => ({
                      ...prev,
                      logo: e.target.files[0],
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label className="stk-checkbox">
                  <input
                    type="checkbox"
                    name="has_stk_api"
                    checked={businessFormData.has_stk_api}
                    onChange={(e) =>
                      setBusinessFormData((prev) => ({
                        ...prev,
                        has_stk_api: e.target.checked,
                      }))
                    }
                  />
                  Enable STK Push API for this business
                </label>
              </div>

              {businessFormData.has_stk_api && (
                <>
                  <div className="form-row">
                    <input
                      type="text"
                      name="stk_app_id"
                      placeholder="STK App ID"
                      value={businessFormData.stk_app_id}
                      onChange={handleBusinessChange}
                    />

                    <input
                      type="password"
                      name="stk_api_key"
                      placeholder="STK API Key"
                      value={businessFormData.stk_api_key}
                      onChange={handleBusinessChange}
                    />
                  </div>

                  <div className="form-row">
                    <input
                      type="text"
                      name="stk_callback_url"
                      placeholder="Callback URL"
                      value={businessFormData.stk_callback_url}
                      onChange={handleBusinessChange}
                    />

                    <input
                      type="text"
                      name="stk_error_callback_url"
                      placeholder="Error Callback URL"
                      value={businessFormData.stk_error_callback_url}
                      onChange={handleBusinessChange}
                    />
                  </div>
                </>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsBusinessModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingBusinessId ? "Update Business" : "Register Business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register User */}
      {isUserModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsUserModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUserId ? "Edit User" : "Register New User"}</h2>
              <button
                className="close-modal"
                onClick={() => setIsUserModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleRegisterUser}>
              <div className="form-row">
                <input
                  type="text"
                  name="username"
                  placeholder="Username *"
                  value={userFormData.username}
                  onChange={handleUserChange}
                  required
                />
                <input
                  type="email"
                  name="user_email"
                  placeholder="Email *"
                  value={userFormData.user_email}
                  onChange={handleUserChange}
                  required
                />
              </div>
              <div className="form-row">
                <input
                  type="password"
                  name="password"
                  placeholder="Password *"
                  value={userFormData.password}
                  onChange={handleUserChange}
                  required
                />
                <select
                  name="role"
                  value={userFormData.role}
                  onChange={handleUserChange}
                >
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              {userFormData.role === "super_admin" && (
                <div className="super-admin-shops-box">
                  <label>
                    <strong>Select shops this Super Admin can view:</strong>
                  </label>

                  {businesses.map((business) => (
                    <label key={business.id} className="shop-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedSuperAdminShops.includes(business.id)}
                        onChange={() => handleShopCheckboxChange(business.id)}
                      />
                      {business.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="form-row">
                <select
                  name="business_id"
                  value={userFormData.business_id}
                  onChange={handleUserChange}
                  required
                >
                  <option value="">Select Business *</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUserId ? "Update User" : "Register User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterBusinessPage;
