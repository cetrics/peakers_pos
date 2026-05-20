# app.py
from flask import Flask, render_template, request, g, redirect, url_for, session, jsonify, make_response
import smtplib
from email.message import EmailMessage
import hashlib
from itsdangerous import URLSafeTimedSerializer
from flask_cors import CORS
from datetime import datetime, timedelta
import random
from werkzeug.utils import secure_filename
import os
from zoneinfo import ZoneInfo
import traceback
import logging
from decimal import Decimal
import pytz
from sqlalchemy import text

from db import get_db, execute_query, execute_insert, execute_update, get_pool_status

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Change this to a secure key
CORS(app)

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Email Configuration
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_ADDRESS = "peakersdesign@gmail.com"
EMAIL_PASSWORD = "kcve sdei nljz aoix"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.before_request
def before_request():
    """Make database name available to all requests"""
    logger.debug(f"Request to: {request.path}")
    logger.debug(f"Session has business_id: {'business_id' in session}")
    if 'business_id' in session:
        logger.debug(f"Using business_id: {session['business_id']}")

# ==================== HELPER FUNCTIONS ====================

def get_business_id():
    """Get business_id from session or header"""
    business_id = session.get('business_id')
    if not business_id:
        business_id = request.headers.get('X-Business-ID')
    return business_id

def generate_token(email):
    serializer = URLSafeTimedSerializer(app.secret_key)
    return serializer.dumps(email, salt="password-reset")

def verify_token(token, expiration=1800):
    serializer = URLSafeTimedSerializer(app.secret_key)
    try:
        email = serializer.loads(token, salt="password-reset", max_age=expiration)
        return email
    except Exception:
        return None

def send_email(to_email, subject, body):
    msg = EmailMessage()
    msg["From"] = EMAIL_ADDRESS
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

def generate_order_number():
    """Generate unique order number"""
    while True:
        number = str(random.randint(0, 999999)).zfill(6)
        order_number = "ORD" + number
        result = execute_query(
            "SELECT 1 FROM sales WHERE order_number = :order_number",
            {"order_number": order_number},
            fetch_all=True
        )
        if not result:
            return order_number

def get_business_id():
    if session.get("role") == "super_admin":
        return session.get("selected_business_id") or session.get("business_id")

    return session.get("business_id")

# ==================== API ENDPOINTS ====================


@app.route("/super-admin-shops", methods=["GET"])
def super_admin_shops():
    if session.get("role") != "super_admin":
        return jsonify({"shops": []}), 200

    user_id = session.get("user_id")

    try:
        shops = execute_query(
            """
            SELECT DISTINCT 
                b.id AS business_id,
                b.name AS company
            FROM super_admin_shops sas
            JOIN businesses b ON sas.business_id = b.id
            WHERE sas.user_id = :user_id
            ORDER BY b.name ASC
            """,
            {"user_id": user_id},
            fetch_all=True
        )

        return jsonify({"shops": shops}), 200

    except Exception as e:
        print("❌ Error fetching super admin shops:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500



@app.route("/get-super-admin-shops/<int:user_id>", methods=["GET"])
def get_super_admin_shops(user_id):
    try:
        rows = execute_query(
            """
            SELECT business_id
            FROM super_admin_shops
            WHERE user_id = :user_id
            """,
            {"user_id": user_id},
            fetch_all=True
        )

        return jsonify({
            "business_ids": [row["business_id"] for row in rows]
        }), 200

    except Exception as e:
        print("❌ Error fetching assigned shops:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/assign-super-admin-shops/<int:user_id>", methods=["POST"])
def assign_super_admin_shops(user_id):
    data = request.json
    business_ids = data.get("business_ids", [])

    try:
        execute_update(
            """
            DELETE FROM super_admin_shops
            WHERE user_id = :user_id
            """,
            {"user_id": user_id}
        )

        for business_id in business_ids:
            execute_insert(
                """
                INSERT INTO super_admin_shops (user_id, business_id)
                VALUES (:user_id, :business_id)
                """,
                {
                    "user_id": user_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Super admin shops assigned successfully"}), 200

    except Exception as e:
        print("❌ Error assigning shops:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/select-shop", methods=["POST"])
def select_shop():
    if session.get("role") != "super_admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    selected_business_id = data.get("business_id")

    if not selected_business_id:
        return jsonify({"error": "Business ID is required"}), 400

    user_id = session.get("user_id")

    try:
        selected_business_id = int(selected_business_id)

        allowed = execute_query(
            """
            SELECT sas.id
            FROM super_admin_shops sas
            JOIN businesses b ON sas.business_id = b.id
            WHERE sas.user_id = :user_id
            AND sas.business_id = :business_id
            """,
            {
                "user_id": user_id,
                "business_id": selected_business_id,
            },
            fetch_all=True,
        )

        if not allowed:
            return jsonify({"error": "You are not allowed to access this shop"}), 403

        # Save selected shop in session
        session["selected_business_id"] = selected_business_id

        # Also update business_id because /check-session reads this
        session["business_id"] = selected_business_id

        # Force Flask to save session changes
        session.modified = True

        return jsonify({
            "message": "Shop selected successfully",
            "business_id": selected_business_id,
            "selected_business_id": selected_business_id,
        }), 200

    except ValueError:
        return jsonify({"error": "Invalid business ID"}), 400

    except Exception as e:
        print("❌ Error selecting shop:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ---------------------------
# 1. Register only a business
# ---------------------------
@app.route("/register-business", methods=["POST"])
def register_business():
    data = request.json

    business_name = data.get("business_name", "").strip()
    business_email = data.get("business_email", "").strip()
    business_phone = data.get("business_phone", "").strip()
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()
    country = data.get("country", "Kenya").strip()

    if not business_name:
        return jsonify({"error": "Business name is required"}), 400

    try:
        # ✅ Check duplicate business name (case insensitive)
        existing_business = execute_query(
            """
            SELECT id
            FROM businesses
            WHERE LOWER(name) = LOWER(:name)
            LIMIT 1
            """,
            {"name": business_name},
            fetch_all=True
        )

        if existing_business:
            return jsonify({
                "error": "A business with this name already exists"
            }), 409

        # ✅ Check duplicate business email (case insensitive)
        if business_email:
            existing_email = execute_query(
                """
                SELECT id
                FROM businesses
                WHERE LOWER(email) = LOWER(:email)
                LIMIT 1
                """,
                {"email": business_email},
                fetch_all=True
            )

            if existing_email:
                return jsonify({
                    "error": "Business email already exists"
                }), 409

        business_id = execute_insert(
            """
            INSERT INTO businesses (
                name, email, phone, subscription_plan, subscription_status,
                address, city, country, logo, created_at, updated_at
            )
            VALUES (
                :name, :email, :phone, :subscription_plan, :subscription_status,
                :address, :city, :country, :logo, NOW(), NOW()
            )
            """,
            {
                "name": business_name,
                "email": business_email,
                "phone": business_phone,
                "subscription_plan": "basic",
                "subscription_status": "active",
                "address": address,
                "city": city,
                "country": country,
                "logo": "default-logo.png",
            }
        )

        return jsonify({
            "message": "Business registered successfully",
            "business_id": business_id
        }), 201

    except Exception as e:
        print("❌ Error registering business:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ---------------------------
# 2. Register only a user (linked to existing business)
# ---------------------------
@app.route("/register-user", methods=["POST"])
def register_user():
    data = request.json

    username = data.get("username", "").strip()
    user_email = data.get("user_email", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "admin").strip()
    business_id = data.get("business_id", "").strip()

    if not username or not user_email or not password:
        return jsonify({
            "error": "Username, email and password are required"
        }), 400

    if not business_id:
        return jsonify({"error": "Business ID is required"}), 400

    try:
        # ✅ Check duplicate username (case insensitive)
        existing_username = execute_query(
            """
            SELECT user_id
            FROM users
            WHERE LOWER(username) = LOWER(:username)
            LIMIT 1
            """,
            {"username": username},
            fetch_all=True
        )

        if existing_username:
            return jsonify({
                "error": "Username already exists"
            }), 409

        # ✅ Check duplicate user email (case insensitive)
        existing_email = execute_query(
            """
            SELECT user_id
            FROM users
            WHERE LOWER(user_email) = LOWER(:email)
            LIMIT 1
            """,
            {"email": user_email},
            fetch_all=True
        )

        if existing_email:
            return jsonify({
                "error": "User email already exists"
            }), 409

        # ✅ Fetch business details
        business = execute_query(
            """
            SELECT name, phone
            FROM businesses
            WHERE id = :business_id
            LIMIT 1
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        if not business:
            return jsonify({"error": "Business not found"}), 404

        company_name = business[0]["name"]
        company_phone = business[0]["phone"]

        hashed_password = hashlib.sha256(password.encode()).hexdigest()

        user_id = execute_insert(
            """
            INSERT INTO users (
                username, user_email, role, user_password,
                company, company_phone, business_id
            )
            VALUES (
                :username, :user_email, :role, :user_password,
                :company, :company_phone, :business_id
            )
            """,
            {
                "username": username,
                "user_email": user_email,
                "role": role,
                "user_password": hashed_password,
                "company": company_name,
                "company_phone": company_phone,
                "business_id": business_id,
            }
        )

        return jsonify({
            "message": "User registered successfully",
            "user_id": user_id
        }), 201

    except Exception as e:
        print("❌ Error registering user:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/get-businesses", methods=["GET"])
def get_businesses():
    try:
        businesses = execute_query(
            """
            SELECT 
                id,
                name,
                email,
                phone,
                subscription_plan,
                subscription_status,
                address,
                city,
                country
            FROM businesses
            ORDER BY created_at DESC
            """,
            fetch_all=True
        )

        return jsonify({"businesses": businesses}), 200

    except Exception as e:
        print("❌ Error fetching businesses:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/get-users", methods=["GET"])
def get_users():
    try:
        users = execute_query(
            """
            SELECT 
                u.user_id,
                u.username,
                u.user_email,
                u.role,
                u.company,
                u.company_phone,
                u.business_id,
                b.name AS business_name
            FROM users u
            LEFT JOIN businesses b ON u.business_id = b.id
            ORDER BY u.user_id DESC
            """,
            fetch_all=True
        )

        return jsonify({"users": users}), 200

    except Exception as e:
        print("❌ Error fetching users:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/update-business/<int:business_id>", methods=["PUT"])
def update_business(business_id):
    data = request.json

    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()
    country = data.get("country", "Kenya").strip()
    subscription_plan = data.get("subscription_plan", "free").strip()
    subscription_status = data.get("subscription_status", "active").strip()

    if not name:
        return jsonify({"error": "Business name is required"}), 400

    try:
        # ✅ Check duplicate business name, excluding current business
        existing_name = execute_query(
            """
            SELECT id
            FROM businesses
            WHERE LOWER(name) = LOWER(:name)
            AND id != :business_id
            LIMIT 1
            """,
            {
                "name": name,
                "business_id": business_id
            },
            fetch_all=True
        )

        if existing_name:
            return jsonify({
                "error": "A business with this name already exists"
            }), 409

        # ✅ Check duplicate business email, excluding current business
        if email:
            existing_email = execute_query(
                """
                SELECT id
                FROM businesses
                WHERE LOWER(email) = LOWER(:email)
                AND id != :business_id
                LIMIT 1
                """,
                {
                    "email": email,
                    "business_id": business_id
                },
                fetch_all=True
            )

            if existing_email:
                return jsonify({
                    "error": "Business email already exists"
                }), 409

        execute_update(
            """
            UPDATE businesses
            SET name = :name,
                email = :email,
                phone = :phone,
                subscription_plan = :subscription_plan,
                subscription_status = :subscription_status,
                address = :address,
                city = :city,
                country = :country,
                updated_at = NOW()
            WHERE id = :business_id
            """,
            {
                "name": name,
                "email": email,
                "phone": phone,
                "subscription_plan": subscription_plan,
                "subscription_status": subscription_status,
                "address": address,
                "city": city,
                "country": country,
                "business_id": business_id,
            }
        )

        execute_update(
            """
            UPDATE users
            SET company = :company,
                company_phone = :company_phone
            WHERE business_id = :business_id
            """,
            {
                "company": name,
                "company_phone": phone,
                "business_id": business_id,
            }
        )

        return jsonify({"message": "Business updated successfully"}), 200

    except Exception as e:
        print("❌ Error updating business:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/update-user/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json

    username = data.get("username", "").strip()
    user_email = data.get("user_email", "").strip()
    role = data.get("role", "admin").strip()
    business_id = data.get("business_id")
    password = data.get("password", "").strip()

    if not username or not user_email or not business_id:
        return jsonify({"error": "Username, email and business are required"}), 400

    try:
        # ✅ Check duplicate username, excluding current user
        existing_username = execute_query(
            """
            SELECT user_id
            FROM users
            WHERE LOWER(username) = LOWER(:username)
            AND user_id != :user_id
            LIMIT 1
            """,
            {
                "username": username,
                "user_id": user_id
            },
            fetch_all=True
        )

        if existing_username:
            return jsonify({
                "error": "Username already exists"
            }), 409

        # ✅ Check duplicate user email, excluding current user
        existing_email = execute_query(
            """
            SELECT user_id
            FROM users
            WHERE LOWER(user_email) = LOWER(:email)
            AND user_id != :user_id
            LIMIT 1
            """,
            {
                "email": user_email,
                "user_id": user_id
            },
            fetch_all=True
        )

        if existing_email:
            return jsonify({
                "error": "User email already exists"
            }), 409

        business = execute_query(
            """
            SELECT id, name, phone
            FROM businesses
            WHERE id = :business_id
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        if not business:
            return jsonify({"error": "Selected business not found"}), 404

        if password:
            hashed_password = hashlib.sha256(password.encode()).hexdigest()

            execute_update(
                """
                UPDATE users
                SET username = :username,
                    user_email = :user_email,
                    role = :role,
                    user_password = :user_password,
                    company = :company,
                    company_phone = :company_phone,
                    business_id = :business_id
                WHERE user_id = :user_id
                """,
                {
                    "username": username,
                    "user_email": user_email,
                    "role": role,
                    "user_password": hashed_password,
                    "company": business[0]["name"],
                    "company_phone": business[0]["phone"],
                    "business_id": business_id,
                    "user_id": user_id,
                }
            )
        else:
            execute_update(
                """
                UPDATE users
                SET username = :username,
                    user_email = :user_email,
                    role = :role,
                    company = :company,
                    company_phone = :company_phone,
                    business_id = :business_id
                WHERE user_id = :user_id
                """,
                {
                    "username": username,
                    "user_email": user_email,
                    "role": role,
                    "company": business[0]["name"],
                    "company_phone": business[0]["phone"],
                    "business_id": business_id,
                    "user_id": user_id,
                }
            )

        return jsonify({"message": "User updated successfully"}), 200

    except Exception as e:
        print("❌ Error updating user:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500



@app.route("/login", methods=["GET", "POST"])
def login():
    error_message = None

    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        try:
            with get_db() as conn:
                query = text("""
                    SELECT user_id, username, user_password, business_id, role
                    FROM users
                    WHERE username = :username OR user_email = :email
                """)

                result = conn.execute(
                    query,
                    {
                        "username": username,
                        "email": username
                    }
                )

                user = result.mappings().fetchone()

                hashed_password = hashlib.sha256(
                    password.encode()
                ).hexdigest()

                if user and user["user_password"] == hashed_password:

                    # Basic session data
                    session["user_id"] = user["user_id"]
                    session["user"] = user["username"]
                    session["username"] = user["username"]
                    session["role"] = user["role"]

                    # Super admin starts without a selected shop
                    if user["role"] == "super_admin":
                        session.pop("business_id", None)
                        session.pop("selected_business_id", None)

                    else:
                        # Regular users keep their assigned business
                        session["business_id"] = user["business_id"]

                    session.modified = True

                    return redirect(url_for("dashboard"))

                else:
                    error_message = (
                        "Invalid credentials. Please try again."
                    )

        except Exception as e:
            print(f"❌ Error during login: {e}")
            error_message = "An error occurred during login."

    response = make_response(
        render_template(
            "login.html",
            error_message=error_message
        )
    )

    response.headers["Cache-Control"] = (
        "no-store, no-cache, must-revalidate, max-age=0"
    )
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    return response

@app.route("/check-session")
def check_session():
    if "user" not in session:
        return jsonify({
            "logged_in": False
        }), 401

    return jsonify({
        "logged_in": True,
        "user_id": session.get("user_id"),
        "username": session.get("username"),
        "role": session.get("role"),
        "business_id": session.get("business_id")
    }), 200



@app.route("/")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login"))
    return render_template("index.html")

@app.route('/<path:path>')
def catch_all(path):
    return render_template('index.html')  # Serve React app for unknown paths


@app.route("/logout")
def logout():
    session.pop("user", None)

    # Create a response to prevent back navigation
    response = make_response(redirect(url_for("login")))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    return response

# Generate a secure token (Valid for 30 minutes)
def generate_token(email):
    serializer = URLSafeTimedSerializer(app.secret_key)
    return serializer.dumps(email, salt="password-reset")

# Verify the token (Expires in 30 minutes)
def verify_token(token, expiration=1800):  # 1800 seconds = 30 minutes
    serializer = URLSafeTimedSerializer(app.secret_key)
    try:
        email = serializer.loads(token, salt="password-reset", max_age=expiration)
        return email
    except Exception:
        return None  # Token expired or invalid



def send_email(to_email, subject, body):
    msg = EmailMessage()
    msg["From"] = EMAIL_ADDRESS
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False


# ✅ Forgot Password Route
@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    BASE_URL = "https://peakerspointofsale.co.ke/"

    if request.method == "POST":
        data = request.json
        email = data.get("email")

        try:
            with get_db() as conn:
                query = text("SELECT * FROM users WHERE user_email = :email")
                result = conn.execute(query, {"email": email})
                user = result.mappings().fetchone()

                if user:
                    token = generate_token(email)
                    reset_link = f"{BASE_URL}/reset-password/{token}"

                    email_message = f"""
                    <p>Hello {user['username']},</p>
                    <p>Click the link below to reset your password:</p>
                    <p><a href="{reset_link}">Reset Password</a></p>
                    <p>This link will expire in 30 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    """

                    if send_email(email, "Password Reset Request", email_message):
                        return jsonify({"message": "Password reset link sent to your email."}), 200
                    else:
                        return jsonify({"error": "Failed to send email."}), 500
                else:
                    return jsonify({"error": "Email not found."}), 400

        except Exception as e:
            print("❌ Error during forgot password:", e)
            return jsonify({"error": "Internal server error"}), 500

    return render_template("forgot_password.html")

# Reset Password Page
@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    email = verify_token(token)
    print(f"Debug: Token={token}, Email={email}")

    if not email:
        return jsonify({"error": "Invalid or expired token"}), 400

    if request.method == 'POST':
        if not request.is_json:
            return jsonify({"error": "Missing JSON in request"}), 400

        data = request.get_json()
        new_password = data.get("password")

        print(f"Debug: Received password={new_password}")

        if not new_password:
            return jsonify({"error": "Password is required"}), 400

        hashed_password = hashlib.sha256(new_password.encode()).hexdigest()

        try:
            with get_db() as conn:
                query = text("""
                    UPDATE users 
                    SET user_password = :password 
                    WHERE user_email = :email
                """)

                conn.execute(query, {
                    "password": hashed_password,
                    "email": email.lower()
                })

                conn.commit()

                print("✅ Password updated successfully")

                return jsonify({
                    "message": "Password reset successful!"
                }), 200

        except Exception as e:
            conn.rollback()
            print(f"❌ Error updating password: {e}")

            return jsonify({
                "error": "Database update failed"
            }), 500

    return render_template("reset_password.html", token=token)

@app.route("/")
def api_info():
    """API information endpoint"""
    return jsonify({
        "name": "Peakers POS API",
        "version": "1.0",
        "status": "operational",
        "endpoints": [
            "/api/login",
            "/health",
            "/sales-data",
            "/get-products",
            "/get-bundles",
            "/get-categories",
            "/get-sales-products",
            "/get-sales-customers",
            "/get-orders",
            "/forgot-password",
            "/reset-password/<token>",
            "/api/v1/material-inventory",
            "/expenses"
        ]
    })

@app.route("/sales-data")
def sales_data():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        current_date = datetime.now()
        first_day_of_month = current_date.replace(day=1).strftime('%Y-%m-%d')
        last_day_of_month = (current_date.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        last_day_str = last_day_of_month.strftime('%Y-%m-%d')

        # Get date range for chart (last 6 months)
        date_range_query = """
            SELECT 
                DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH), '%Y-%m-01') AS start_date,
                LAST_DAY(CURRENT_DATE()) AS end_date
        """
        date_range = execute_query(date_range_query, fetch_all=True)[0]

        # Generate all months in range
        all_months_query = """
            WITH RECURSIVE months AS (
                SELECT :start_date AS month_start
                UNION ALL
                SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
                FROM months
                WHERE month_start < :end_date
            )
            SELECT DATE_FORMAT(month_start, '%b') AS month_abbr,
                   DATE_FORMAT(month_start, '%Y-%m') AS month_key
            FROM months
            ORDER BY month_start
            LIMIT 6
        """
        all_months = execute_query(
            all_months_query, 
            {"start_date": date_range['start_date'], "end_date": date_range['end_date']},
            fetch_all=True
        )

        # Get sales data for chart
        sales_query = """
            SELECT 
                DATE_FORMAT(s.sale_date, '%b') AS month,
                DATE_FORMAT(s.sale_date, '%Y-%m') AS month_key,
                SUM(s.total_price) AS total_sales
            FROM sales s
            WHERE s.sale_date >= :start_date
                AND s.sale_date <= :end_date
                AND s.status = 'completed'
                AND s.business_id = :business_id
            GROUP BY month_key, month
        """
        sales_data = execute_query(
            sales_query,
            {"start_date": date_range['start_date'], "end_date": date_range['end_date'], "business_id": business_id},
            fetch_all=True
        )
        
        sales_dict = {row['month_key']: row for row in sales_data}

        # Prepare chart data
        labels = []
        sales_values = []
        for month in all_months:
            labels.append(month['month_abbr'])
            if month['month_key'] in sales_dict:
                sales_values.append(float(sales_dict[month['month_key']]['total_sales']))
            else:
                sales_values.append(0.0)

        # Get metrics data
        metrics_query = """
            SELECT 
                (SELECT COUNT(*) FROM products WHERE business_id = :business_id) AS products_count,
                (SELECT COUNT(*) FROM sales WHERE status = 'completed' AND business_id = :business_id) AS orders_count,
                (SELECT COUNT(*) FROM customers WHERE business_id = :business_id) AS customers_count,
                (SELECT SUM(total_price) FROM sales WHERE status = 'completed' AND business_id = :business_id) AS total_sales,
                (SELECT SUM(total_price) FROM sales 
                 WHERE status = 'completed'
                 AND sale_date BETWEEN :first_day AND :last_day
                 AND business_id = :business_id) AS current_month_sales
        """
        metrics = execute_query(
            metrics_query,
            {
                "business_id": business_id,
                "first_day": first_day_of_month,
                "last_day": last_day_str
            },
            fetch_all=True
        )[0]

        return jsonify({
            "labels": labels,
            "sales": sales_values,
            "metrics": {
                "total_sales": float(metrics['total_sales']) if metrics['total_sales'] else 0.0,
                "current_month_sales": float(metrics['current_month_sales']) if metrics['current_month_sales'] else 0.0,
                "monthly_target": 500000.0,
                "products_count": metrics['products_count'],
                "orders_count": metrics['orders_count'],
                "customers_count": metrics['customers_count']
            }
        })

    except Exception as e:
        print("Error in /sales-data:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/get-products", methods=["GET"])
def manage_products():
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    include_deleted = (
        request.args.get("include_deleted", "false").lower() == "true"
    )

    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # WHERE clause for count query
        count_where_clause = "WHERE business_id = :business_id"

        if not include_deleted:
            count_where_clause += " AND deleted_at IS NULL"

        # WHERE clause for products query (with alias p)
        products_where_clause = "WHERE p.business_id = :business_id"

        if not include_deleted:
            products_where_clause += " AND p.deleted_at IS NULL"

        # Count total products
        count_query = f"""
            SELECT COUNT(*) AS total
            FROM products
            {count_where_clause}
        """

        total_result = execute_query(
            count_query,
            {"business_id": business_id},
            fetch_all=True
        )

        total_products = total_result[0]["total"] if total_result else 0

        # Fetch products
        products_query = f"""
            SELECT 
                p.product_id,
                p.product_number,
                p.product_name,
                p.product_price,
                p.buying_price,
                p.product_stock,
                p.product_description,
                p.unit,
                p.expiry_date,
                p.created_at,
                p.category_id_fk,
                c.category_name,
                COUNT(DISTINCT pr.material_id) AS ingredients_count

            FROM products p

            LEFT JOIN categories c
                ON p.category_id_fk = c.category_id

            LEFT JOIN product_recipes pr
                ON p.product_id = pr.product_id

            {products_where_clause}

            GROUP BY 
                p.product_id,
                p.product_number,
                p.product_name,
                p.product_price,
                p.buying_price,
                p.product_stock,
                p.product_description,
                p.unit,
                p.expiry_date,
                p.created_at,
                p.category_id_fk,
                c.category_name

            ORDER BY p.created_at DESC

            LIMIT :limit OFFSET :offset
        """

        products = execute_query(
            products_query,
            {
                "business_id": business_id,
                "limit": per_page,
                "offset": offset
            },
            fetch_all=True
        )

        formatted_products = []

        for row in products:
            formatted_products.append({
                "product_id": row["product_id"],
                "product_number": row["product_number"],
                "product_name": row["product_name"],
                "product_price": float(row["product_price"] or 0),
                "buying_price": float(row["buying_price"] or 0),
                "product_stock": float(row["product_stock"] or 0),
                "product_description": row["product_description"],
                "unit": row["unit"],

                "expiry_date": (
                    row["expiry_date"].strftime("%Y-%m-%d")
                    if row["expiry_date"]
                    else None
                ),

                "created_at": (
                    row["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                    if row["created_at"]
                    else None
                ),

                "category_id_fk": row["category_id_fk"],
                "category_name": row["category_name"],
                "ingredients_count": row["ingredients_count"],
            })

        return jsonify({
            "products": formatted_products,
            "total_products": total_products,
            "page": page
        }), 200

    except Exception as e:
        print("Error fetching products:", e)
        traceback.print_exc()

        return jsonify({
            "error": str(e)
        }), 500


@app.route("/get-bundles", methods=["GET"])
def get_bundles():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Get active (non-deleted) bundles only
        bundles_query = """
            SELECT 
                pb.bundle_id,

                MIN(
                    FLOOR(p.product_stock / pb.quantity)
                ) AS bundle_stock,

                MAX(pb.selling_price) AS selling_price,

                MAX(pb.bundle_buying_price) AS buying_price,

                SUM(pb.quantity) AS products_count

            FROM product_bundles pb

            JOIN products p
                ON p.product_id = pb.child_product_id
                AND p.business_id = :business_id
                AND p.deleted_at IS NULL

            WHERE pb.business_id = :business_id
            AND pb.deleted_at IS NULL

            GROUP BY pb.bundle_id
        """

        bundles = execute_query(
            bundles_query,
            {"business_id": business_id},
            fetch_all=True
        )

        result = []

        for bundle in bundles:
            bundle_id = bundle["bundle_id"]

            # Get bundle items
            items_query = """
                SELECT 
                    p.product_id,
                    p.product_name,
                    p.product_price,
                    pb.quantity

                FROM product_bundles pb

                JOIN products p
                    ON p.product_id = pb.child_product_id
                    AND p.business_id = :business_id
                    AND p.deleted_at IS NULL

                WHERE pb.bundle_id = :bundle_id
                AND pb.business_id = :business_id
                AND pb.deleted_at IS NULL
            """

            items = execute_query(
                items_query,
                {
                    "business_id": business_id,
                    "bundle_id": bundle_id
                },
                fetch_all=True
            )

            # Create readable bundle name
            if items:
                bundle_name = "Bundle of " + " + ".join(
                    f"{item['quantity']}×{item['product_name']}"
                    for item in items
                )
            else:
                bundle_name = f"Bundle #{bundle_id}"

            result.append({
                "bundle_id": bundle_id,
                "product_name": bundle_name,
                "product_price": float(bundle["selling_price"] or 0),
                "buying_price": float(bundle["buying_price"] or 0),
                "product_stock": int(bundle["bundle_stock"] or 0),
                "products_count": int(bundle["products_count"] or 0),
                "is_bundle": True,
                "items": items
            })

        return jsonify(result), 200

    except Exception as e:
        print(f"❌ Error in get_bundles: {str(e)}")
        traceback.print_exc()

        return jsonify({
            "error": str(e)
        }), 500

@app.route("/add-product", methods=["POST"])
def add_product():
    try:
        data = request.json
        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        buying_price = data.get("buying_price", 0)
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")
        unit = data.get("unit")
        expiry_date = data.get("expiry_date")
        reorder_threshold = data.get("reorder_threshold", 5)
        ingredients = data.get("ingredients")
        
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not all([product_number, product_name, product_price, category_id_fk]):
            return jsonify({"error": "All fields except description are required"}), 400

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        product_stock = 0

        # Insert product
        insert_query = """
            INSERT INTO products (
                product_number, product_name, product_price, buying_price, product_stock,
                product_description, created_at, category_id_fk,
                unit, expiry_date, reorder_threshold, business_id
            )
            VALUES (
                :product_number, :product_name, :product_price, :buying_price, :product_stock,
                :product_description, :created_at, :category_id_fk,
                :unit, :expiry_date, :reorder_threshold, :business_id
            )
        """
        
        product_id = execute_insert(insert_query, {
            "product_number": product_number,
            "product_name": product_name,
            "product_price": product_price,
            "buying_price": buying_price,
            "product_stock": product_stock,
            "product_description": product_description,
            "created_at": created_at,
            "category_id_fk": category_id_fk,
            "unit": unit,
            "expiry_date": expiry_date,
            "reorder_threshold": reorder_threshold,
            "business_id": business_id
        })

        # Insert optional ingredients
        if ingredients and isinstance(ingredients, list):
            for material_id in ingredients:
                execute_insert(
                    "INSERT INTO product_recipes (product_id, material_id, quantity) VALUES (:product_id, :material_id, 0)",
                    {"product_id": product_id, "material_id": material_id}
                )

        return jsonify({
            "message": "Product added successfully",
            "product": {
                "product_id": product_id,
                "product_number": product_number,
                "product_name": product_name,
                "product_price": product_price,
                "buying_price": buying_price,
                "product_stock": product_stock,
                "product_description": product_description,
                "category_id_fk": category_id_fk,
                "unit": unit,
                "expiry_date": expiry_date,
                "reorder_threshold": reorder_threshold,
                "created_at": created_at,
                "business_id": business_id
            }
        }), 201

    except Exception as e:
        print("Error adding product:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/add-bundle", methods=["POST"])
def add_bundle():
    try:
        data = request.json
        bundle_items = data.get("bundle_items", [])
        selling_price = data.get("selling_price")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not bundle_items:
            return jsonify({"error": "Bundle must contain products"}), 400

        if selling_price is None:
            return jsonify({"error": "Selling price is required"}), 400

        child_product_ids = [item["product_id"] for item in bundle_items]

        # Prevent adding products that are already part of another ACTIVE bundle
        combination_check_query = """
            SELECT DISTINCT child_product_id
            FROM product_bundles
            WHERE child_product_id IN ({})
            AND business_id = :business_id
            AND deleted_at IS NULL
        """.format(",".join([f":check_id{i}" for i in range(len(child_product_ids))]))

        combination_params = {
            f"check_id{i}": pid for i, pid in enumerate(child_product_ids)
        }
        combination_params["business_id"] = business_id

        existing_bundle_products = execute_query(
            combination_check_query,
            combination_params,
            fetch_all=True
        )

        if existing_bundle_products:
            conflicting_ids = [
                str(row["child_product_id"])
                for row in existing_bundle_products
            ]

            return jsonify({
                "error": (
                    "Some selected products are already used in another bundle "
                    f"(Product IDs: {', '.join(conflicting_ids)}). "
                    "Combination products cannot be bundled again."
                )
            }), 400

        # Check for duplicate ACTIVE bundle only
        format_strings = ",".join([f":id{i}" for i in range(len(child_product_ids))])
        params = {f"id{i}": pid for i, pid in enumerate(child_product_ids)}
        params["business_id"] = business_id

        duplicate_check = f"""
            SELECT 1
            FROM product_bundles pb
            JOIN products p ON p.product_id = pb.child_product_id
            WHERE pb.child_product_id IN ({format_strings})
            AND p.business_id = :business_id
            AND pb.business_id = :business_id
            AND pb.deleted_at IS NULL
            LIMIT 1
        """

        result = execute_query(duplicate_check, params, fetch_all=True)

        if result:
            return jsonify({"error": "The product bundle is already available"}), 409

        # Calculate total buying price and validate each product has buying_price
        total_buying_price = 0
        products_without_price = []

        for item in bundle_items:
            product_id = item["product_id"]
            quantity = item.get("quantity", 1)

            price_query = """
                SELECT buying_price
                FROM products
                WHERE product_id = :product_id
                AND business_id = :business_id
                AND deleted_at IS NULL
            """

            price_result = execute_query(
                price_query,
                {
                    "product_id": product_id,
                    "business_id": business_id
                },
                fetch_all=True
            )

            if not price_result:
                return jsonify({"error": f"Product ID {product_id} not found"}), 404

            product_cost = price_result[0]["buying_price"]

            if not product_cost or product_cost == 0:
                name_query = """
                    SELECT product_name
                    FROM products
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                    AND deleted_at IS NULL
                """

                name_result = execute_query(
                    name_query,
                    {
                        "product_id": product_id,
                        "business_id": business_id
                    },
                    fetch_all=True
                )

                product_name = (
                    name_result[0]["product_name"]
                    if name_result
                    else f"ID {product_id}"
                )

                products_without_price.append(f"{product_name} (ID: {product_id})")
            else:
                total_buying_price += product_cost * quantity

        if products_without_price:
            return jsonify({
                "error": "Cannot create bundle. The following products do not have a buying price:",
                "products": products_without_price
            }), 400

        max_id_query = "SELECT IFNULL(MAX(bundle_id), 0) + 1 AS next_id FROM product_bundles"
        max_id_result = execute_query(max_id_query, fetch_all=True)
        bundle_id = max_id_result[0]["next_id"] if max_id_result else 1

        for item in bundle_items:
            execute_insert("""
                INSERT INTO product_bundles (
                    bundle_id, parent_product_id, child_product_id,
                    quantity, selling_price, bundle_buying_price, business_id
                )
                VALUES (
                    :bundle_id, :bundle_id, :child_product_id,
                    :quantity, :selling_price, :bundle_buying_price, :business_id
                )
            """, {
                "bundle_id": bundle_id,
                "child_product_id": item["product_id"],
                "quantity": item["quantity"],
                "selling_price": selling_price,
                "bundle_buying_price": total_buying_price,
                "business_id": business_id
            })

        return jsonify({
            "message": "Bundle created successfully",
            "bundle_id": bundle_id,
            "buying_price": total_buying_price
        }), 201

    except Exception as e:
        print("❌ Error adding bundle:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route("/update-bundle/<int:bundle_id>", methods=["PUT"])
def update_bundle(bundle_id):
    try:
        data = request.json
        bundle_items = data.get("bundle_items", [])
        selling_price = data.get("selling_price")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not bundle_items:
            return jsonify({"error": "Bundle must contain products"}), 400

        if selling_price is None:
            return jsonify({"error": "Selling price is required"}), 400

        existing_bundle = execute_query(
            """
            SELECT bundle_buying_price
            FROM product_bundles
            WHERE bundle_id = :bundle_id
            AND business_id = :business_id
            AND deleted_at IS NULL
            LIMIT 1
            """,
            {
                "bundle_id": bundle_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        if not existing_bundle:
            return jsonify({"error": "Bundle not found"}), 404

        existing_buying_price = existing_bundle[0]["bundle_buying_price"] or 0

        execute_update(
            """
            DELETE FROM product_bundles
            WHERE bundle_id = :bundle_id
            AND business_id = :business_id
            """,
            {
                "bundle_id": bundle_id,
                "business_id": business_id
            }
        )

        for item in bundle_items:
            execute_insert(
                """
                INSERT INTO product_bundles (
                    bundle_id,
                    parent_product_id,
                    child_product_id,
                    quantity,
                    selling_price,
                    bundle_buying_price,
                    business_id
                )
                VALUES (
                    :bundle_id,
                    :bundle_id,
                    :child_product_id,
                    :quantity,
                    :selling_price,
                    :bundle_buying_price,
                    :business_id
                )
                """,
                {
                    "bundle_id": bundle_id,
                    "child_product_id": item["product_id"],
                    "quantity": item["quantity"],
                    "selling_price": selling_price,
                    "bundle_buying_price": existing_buying_price,
                    "business_id": business_id
                }
            )

        return jsonify({
            "message": "Bundle updated successfully",
            "buying_price": float(existing_buying_price)
        }), 200

    except Exception as e:
        print("Error updating bundle:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route("/updating-product/<int:product_id>", methods=["PUT"])
def updating_product(product_id):
    try:
        data = request.json

        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")
        unit = data.get("unit")
        expiry_date = data.get("expiry_date")
        reorder_threshold = data.get("reorder_threshold", 0)
        ingredients = data.get("ingredients")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not all([product_number, product_name, product_price, category_id_fk]):
            return jsonify({"error": "Missing required fields"}), 400

        check_query = """
            SELECT product_id
            FROM products
            WHERE product_id = :product_id
            AND business_id = :business_id
        """

        check_result = execute_query(
            check_query,
            {
                "product_id": product_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        if not check_result:
            return jsonify({"error": "Product not found or access denied"}), 404

        update_query = """
            UPDATE products
            SET product_number = :product_number,
                product_name = :product_name,
                product_price = :product_price,
                product_description = :product_description,
                category_id_fk = :category_id_fk,
                unit = :unit,
                expiry_date = :expiry_date,
                reorder_threshold = :reorder_threshold
            WHERE product_id = :product_id
            AND business_id = :business_id
        """

        execute_update(update_query, {
            "product_number": product_number,
            "product_name": product_name,
            "product_price": product_price,
            "product_description": product_description,
            "category_id_fk": category_id_fk,
            "unit": unit,
            "expiry_date": expiry_date,
            "reorder_threshold": reorder_threshold,
            "product_id": product_id,
            "business_id": business_id
        })

        if ingredients is not None and isinstance(ingredients, list):
            existing_query = """
                SELECT material_id
                FROM product_recipes
                WHERE product_id = :product_id
            """

            existing_result = execute_query(
                existing_query,
                {"product_id": product_id},
                fetch_all=True
            )

            existing_set = {row["material_id"] for row in existing_result}
            selected_set = set(ingredients)

            to_delete = existing_set - selected_set
            for mat_id in to_delete:
                execute_update(
                    """
                    DELETE FROM product_recipes
                    WHERE product_id = :product_id
                    AND material_id = :material_id
                    """,
                    {
                        "product_id": product_id,
                        "material_id": mat_id
                    }
                )

            to_add = selected_set - existing_set
            for mat_id in to_add:
                execute_insert(
                    """
                    INSERT INTO product_recipes
                    (product_id, material_id, quantity)
                    VALUES (:product_id, :material_id, 0)
                    """,
                    {
                        "product_id": product_id,
                        "material_id": mat_id
                    }
                )

        return jsonify({"message": "Product updated successfully"}), 200

    except Exception as e:
        print("Error updating product:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/get-product-ingredients/<int:product_id>", methods=["GET"])
def get_product_ingredients(product_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify product belongs to business
        check_query = "SELECT product_id FROM products WHERE product_id = :product_id AND business_id = :business_id"
        check_result = execute_query(check_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)
        
        if not check_result:
            return jsonify({"error": "Product not found or access denied"}), 404

        # Fetch ingredients
        ingredients_query = """
            SELECT m.material_id, m.material_name, m.unit
            FROM product_recipes pr
            JOIN raw_materials m ON pr.material_id = m.material_id AND m.business_id = :business_id
            WHERE pr.product_id = :product_id
        """
        ingredients = execute_query(
            ingredients_query,
            {"product_id": product_id, "business_id": business_id},
            fetch_all=True
        )

        return jsonify({"ingredients": ingredients}), 200

    except Exception as e:
        print("Error fetching ingredients:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/add-material", methods=["POST"])
def add_material():
    data = request.json
    material_name = data.get("material_name")
    unit = data.get("unit")

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not material_name or not unit:
        return jsonify({"error": "Material name and unit are required"}), 400

    try:
        execute_insert(
            "INSERT INTO raw_materials (material_name, unit, business_id) VALUES (:material_name, :unit, :business_id)",
            {"material_name": material_name, "unit": unit, "business_id": business_id}
        )
        return jsonify({"message": "Material added successfully"}), 201
    except Exception as e:
        print("❌ Error in /add-material:", e)
        return jsonify({"error": "Failed to add material"}), 500

@app.route("/get-materials", methods=["GET"])
def get_materials():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        materials = execute_query(
            "SELECT * FROM raw_materials WHERE business_id = :business_id",
            {"business_id": business_id},
            fetch_all=True
        )
        return jsonify({"materials": materials}), 200
    except Exception as e:
        print("❌ Error in /get-materials:", e)
        return jsonify({"error": "Failed to retrieve materials"}), 500

@app.route("/add-recipe", methods=["POST"])
def add_recipe():
    try:
        data = request.json
        product_id = data.get("product_id")
        new_materials = data.get("materials")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not product_id or not new_materials:
            return jsonify({"error": "Product ID and materials are required"}), 400

        # Get current product stock
        stock_query = "SELECT product_stock FROM products WHERE product_id = :product_id AND business_id = :business_id"
        stock_result = execute_query(stock_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)
        
        if not stock_result:
            return jsonify({"error": "Product not found"}), 404
            
        product_stock = stock_result[0]["product_stock"]

        # Get existing recipe
        existing_query = "SELECT material_id, quantity FROM product_recipes WHERE product_id = :product_id"
        existing_result = execute_query(existing_query, {"product_id": product_id}, fetch_all=True)
        existing_recipe = {row["material_id"]: row["quantity"] for row in existing_result}

        # Calculate material differences
        material_diffs = {}
        for item in new_materials:
            material_id = item.get("material_id")
            new_quantity_per_unit = item.get("quantity", 0)
            old_quantity_per_unit = existing_recipe.get(material_id, 0)
            diff = (new_quantity_per_unit - old_quantity_per_unit) * product_stock
            material_diffs[material_id] = diff

        # Check if materials are sufficient for increase
        for material_id, diff_qty in material_diffs.items():
            if diff_qty > 0:
                material_query = """
                    SELECT quantity FROM material_supplies 
                    WHERE material_id = :material_id AND business_id = :business_id
                """
                material_result = execute_query(
                    material_query,
                    {"material_id": material_id, "business_id": business_id},
                    fetch_all=True
                )
                available_qty = material_result[0]["quantity"] if material_result else 0

                if available_qty < diff_qty:
                    return jsonify({
                        "error": f"Insufficient stock for material ID {material_id}. Needed: {diff_qty}, Available: {available_qty}"
                    }), 400

        # Start transaction
        with get_db() as db:
            # Revert material stock from old recipe
            for material_id, old_quantity_per_unit in existing_recipe.items():
                db.execute(
                    text("""
                        UPDATE material_supplies
                        SET quantity = quantity + :qty
                        WHERE material_id = :material_id AND business_id = :business_id
                    """),
                    {"qty": old_quantity_per_unit * product_stock, "material_id": material_id, "business_id": business_id}
                )

            # Apply material stock changes for new recipe
            for item in new_materials:
                material_id = item["material_id"]
                quantity_per_unit = item["quantity"]
                used_total = quantity_per_unit * product_stock

                db.execute(
                    text("""
                        UPDATE material_supplies
                        SET quantity = quantity - :qty
                        WHERE material_id = :material_id AND business_id = :business_id
                    """),
                    {"qty": used_total, "material_id": material_id, "business_id": business_id}
                )

            # Clear old recipe
            db.execute(text("DELETE FROM product_recipes WHERE product_id = :product_id"), {"product_id": product_id})

            # Insert updated recipe
            for item in new_materials:
                db.execute(
                    text("""
                        INSERT INTO product_recipes (product_id, material_id, quantity)
                        VALUES (:product_id, :material_id, :quantity)
                    """),
                    {"product_id": product_id, "material_id": item["material_id"], "quantity": item["quantity"]}
                )

        return jsonify({"message": "Recipe updated successfully"}), 201

    except Exception as e:
        print("❌ Error adding recipe:", str(e))
        return jsonify({"error": "Internal server error"}), 500

@app.route("/getting-recipe/<int:product_id>", methods=["GET"])
def getting_recipe(product_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify product belongs to business
        check_query = "SELECT product_id FROM products WHERE product_id = :product_id AND business_id = :business_id"
        check_result = execute_query(check_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)
        
        if not check_result:
            return jsonify({"error": "Product not found or access denied"}), 404

        # Fetch recipe
        recipe_query = """
            SELECT rm.material_name, rm.unit, pr.quantity
            FROM product_recipes pr
            JOIN raw_materials rm ON pr.material_id = rm.material_id AND rm.business_id = :business_id
            WHERE pr.product_id = :product_id
        """
        recipe = execute_query(recipe_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)
        
        return jsonify({"recipe": recipe}), 200
    except Exception as e:
        print("❌ Error fetching recipe:", str(e))
        return jsonify({"error": "Failed to fetch recipe"}), 500

@app.route("/get-recipe/<int:product_id>", methods=["GET"])
def get_recipe(product_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify product belongs to business
        check_query = "SELECT product_id FROM products WHERE product_id = :product_id AND business_id = :business_id"
        check_result = execute_query(check_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)
        
        if not check_result:
            return jsonify({"error": "Product not found or access denied"}), 404

        # Fetch recipe
        recipe_query = """
            SELECT r.material_id, r.quantity, m.material_name, m.unit
            FROM product_recipes r
            JOIN raw_materials m ON r.material_id = m.material_id AND m.business_id = :business_id
            WHERE r.product_id = :product_id
        """
        recipe = execute_query(recipe_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)

        return jsonify({"recipe": recipe}), 200

    except Exception as e:
        print("❌ Error in get_recipe:", str(e))
        return jsonify({"error": "Internal server error"}), 500

@app.route("/update-material/<int:material_id>", methods=["PUT"])
def update_material(material_id):
    data = request.json

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not data.get("material_name") or not data.get("unit"):
        return jsonify({"error": "Material name and unit are required"}), 400

    try:
        rows_affected = execute_update("""
            UPDATE raw_materials
            SET material_name = :material_name, unit = :unit
            WHERE material_id = :material_id AND business_id = :business_id
        """, {
            "material_name": data["material_name"],
            "unit": data["unit"],
            "material_id": material_id,
            "business_id": business_id
        })

        if rows_affected == 0:
            return jsonify({"error": "Material not found or access denied"}), 404

        return jsonify({"message": "Material updated"}), 200
    except Exception as e:
        print("❌ Error updating material:", str(e))
        return jsonify({"error": "Failed to update material"}), 500

@app.route("/add-material-supply", methods=["POST"])
def add_material_supply():
    try:
        data = request.json
        material_id = data.get("material_id")
        supplier_name = data.get("supplier_name")
        quantity = data.get("quantity")
        unit_price = data.get("unit_price")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not all([material_id, quantity, unit_price]):
            return jsonify({"error": "Missing required fields"}), 400

        total_cost = float(quantity) * float(unit_price)

        # Verify material belongs to business
        check_query = "SELECT material_id FROM raw_materials WHERE material_id = :material_id AND business_id = :business_id"
        check_result = execute_query(check_query, {"material_id": material_id, "business_id": business_id}, fetch_all=True)
        
        if not check_result:
            return jsonify({"error": "Material not found or access denied"}), 404

        # Insert supply
        execute_insert("""
            INSERT INTO material_supplies (material_id, supplier_name, quantity, unit_price, total_cost, business_id)
            VALUES (:material_id, :supplier_name, :quantity, :unit_price, :total_cost, :business_id)
        """, {
            "material_id": material_id,
            "supplier_name": supplier_name,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_cost": total_cost,
            "business_id": business_id
        })

        return jsonify({"message": "Material supply recorded successfully"}), 201

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/pay-material-supply", methods=["POST"])
def pay_material_supply():
    try:
        data = request.json
        supply_id = data.get("supply_id")
        amount_paid = data.get("amount_paid")
        payment_type = data.get("payment_type")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not all([supply_id, amount_paid, payment_type]):
            return jsonify({"error": "Missing payment fields"}), 400

        # Verify supply belongs to business
        check_query = """
            SELECT ms.supply_id 
            FROM material_supplies ms
            JOIN raw_materials rm ON ms.material_id = rm.material_id
            WHERE ms.supply_id = :supply_id AND rm.business_id = :business_id
        """
        check_result = execute_query(check_query, {"supply_id": supply_id, "business_id": business_id}, fetch_all=True)
        
        if not check_result:
            return jsonify({"error": "Supply not found or access denied"}), 404

        # Insert payment
        execute_insert("""
            INSERT INTO material_payments (supply_id, amount_paid, payment_type, business_id)
            VALUES (:supply_id, :amount_paid, :payment_type, :business_id)
        """, {
            "supply_id": supply_id,
            "amount_paid": amount_paid,
            "payment_type": payment_type,
            "business_id": business_id
        })

        return jsonify({"message": "Payment recorded successfully"}), 201

    except Exception as e:
        print("Payment error:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route('/get-material-payments/<int:supply_id>', methods=['GET'])
def get_material_payments(supply_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify supply belongs to business
        check_query = """
            SELECT ms.supply_id 
            FROM material_supplies ms
            JOIN raw_materials rm ON ms.material_id = rm.material_id
            WHERE ms.supply_id = :supply_id AND rm.business_id = :business_id
        """
        check_result = execute_query(check_query, {"supply_id": supply_id, "business_id": business_id}, fetch_all=True)
        
        if not check_result:
            return jsonify({"error": "Supply not found or access denied"}), 404

        # Get payments
        payments_query = """
            SELECT amount_paid, payment_type, payment_date 
            FROM material_payments 
            WHERE supply_id = :supply_id AND business_id = :business_id
            ORDER BY payment_date DESC
        """
        payments = execute_query(payments_query, {"supply_id": supply_id, "business_id": business_id}, fetch_all=True)
        
        return jsonify({"payments": payments})
    except Exception as e:
        print("❌ Failed to fetch payments:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route('/get-suppliers', methods=['GET'])
def get_material_suppliers():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        query = """
            SELECT 
                ms.supplier_name,
                ms.material_id,
                m.material_name,
                m.unit,
                ms.supply_id,
                SUM(ms.quantity) AS total_quantity,
                SUM(ms.quantity * ms.unit_price) AS total_supplied_value,
                COALESCE(mp.total_paid, 0) AS total_paid,
                (SUM(ms.quantity * ms.unit_price) - COALESCE(mp.total_paid, 0)) AS balance
            FROM material_supplies ms
            JOIN raw_materials m ON ms.material_id = m.material_id AND m.business_id = :business_id
            LEFT JOIN (
                SELECT supply_id, SUM(amount_paid) AS total_paid
                FROM material_payments
                WHERE business_id = :business_id
                GROUP BY supply_id
            ) mp ON ms.supply_id = mp.supply_id
            WHERE ms.business_id = :business_id
            GROUP BY ms.supply_id
            ORDER BY ms.supplier_name ASC
        """
        suppliers = execute_query(query, {"business_id": business_id}, fetch_all=True)
        return jsonify({"suppliers": suppliers})
    except Exception as e:
        print("❌ Failed to fetch suppliers:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/get-categories", methods=["GET"])
def get_categories():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        categories = execute_query(
            "SELECT category_id, category_name FROM categories WHERE business_id = :business_id ORDER BY category_name ASC",
            {"business_id": business_id},
            fetch_all=True
        )

        response = make_response(jsonify({"categories": categories}), 200)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        return response
    except Exception as e:
        print("❌ Error fetching categories:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/add-category", methods=["POST"])
def add_category():
    try:
        data = request.get_json()
        category_name = data.get("category_name")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not category_name:
            return jsonify({"error": "Category name is required."}), 400

        # Check if category already exists
        check_query = "SELECT category_id FROM categories WHERE category_name = :category_name AND business_id = :business_id"
        existing = execute_query(check_query, {"category_name": category_name, "business_id": business_id}, fetch_all=True)

        if existing:
            return jsonify({"error": "Category already exists for this business."}), 400

        # Insert new category
        execute_insert(
            "INSERT INTO categories (category_name, business_id) VALUES (:category_name, :business_id)",
            {"category_name": category_name, "business_id": business_id}
        )

        return jsonify({"message": "Category added successfully"}), 201

    except Exception as e:
        print("❌ Error in /add-category:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/update-product/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify product belongs to business
        check_query = "SELECT product_id FROM products WHERE product_id = :product_id AND business_id = :business_id"
        check_result = execute_query(check_query, {"product_id": product_id, "business_id": business_id}, fetch_all=True)

        if not check_result:
            return jsonify({"error": "Product not found or access denied"}), 404

        # Update product
        execute_update(
            """
            UPDATE products
            SET product_number = :product_number,
                product_name = :product_name,
                product_price = :product_price,
                product_description = :product_description,
                category_id_fk = :category_id_fk
            WHERE product_id = :product_id
            """,
            {
                "product_number": data["product_number"],
                "product_name": data["product_name"],
                "product_price": data["product_price"],
                "product_description": data["product_description"],
                "category_id_fk": data["category_id_fk"] if data["category_id_fk"] else None,
                "product_id": product_id
            }
        )

        return jsonify({"message": "Product updated successfully!"}), 200

    except Exception as e:
        print("Error updating product:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/suppliers", methods=["GET"])
def get_suppliers():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        suppliers = execute_query(
            "SELECT * FROM suppliers WHERE business_id = :business_id AND deleted_at IS NULL",
            {"business_id": business_id},
            fetch_all=True
        )
        return jsonify(suppliers), 200

    except Exception as e:
        print("Error fetching suppliers:", e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/check-supplier-exists/<supplier_name>", methods=["GET"])
def check_supplier_exists(supplier_name):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        count_query = "SELECT COUNT(*) as count FROM suppliers WHERE supplier_name = :supplier_name AND business_id = :business_id"
        result = execute_query(count_query, {"supplier_name": supplier_name, "business_id": business_id}, fetch_all=True)
        count = result[0]["count"] if result else 0
        return jsonify({"exists": count > 0})
    except Exception as e:
        print("Error checking supplier existence:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/add-supplier", methods=["POST"])
def add_supplier():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        data = request.json
        supplier_name = data.get("supplier_name", "").strip()
        contact_person = data.get("contact_person", "").strip()
        phone = data.get("phone_number", "").strip()
        email = data.get("email", "").strip()
        address = data.get("address", "").strip()

        if not supplier_name:
            return jsonify({"error": "Supplier name is required"}), 400

        with get_db() as db:
            # Check for existing supplier (active or deleted)
            existing = db.execute(
                text("""
                    SELECT supplier_id, deleted_at
                    FROM suppliers
                    WHERE LOWER(supplier_name) = LOWER(:supplier_name)
                      AND business_id = :business_id
                    LIMIT 1
                """),
                {"supplier_name": supplier_name, "business_id": business_id}
            ).fetchone()

            if existing:
                supplier_id = existing[0]
                deleted_at = existing[1]

                if deleted_at is None:
                    return jsonify({"error": "This supplier already exists"}), 409
                else:
                    # Restore soft-deleted supplier
                    db.execute(
                        text("""
                            UPDATE suppliers
                            SET deleted_at = NULL,
                                contact_person = :contact_person,
                                phone_number = :phone,
                                email = :email,
                                address = :address
                            WHERE supplier_id = :supplier_id
                        """),
                        {
                            "supplier_id": supplier_id,
                            "contact_person": contact_person,
                            "phone": phone,
                            "email": email,
                            "address": address
                        }
                    )
                    db.commit()
                    return jsonify({"message": "Supplier restored successfully!"}), 200

            # Insert new supplier
            db.execute(
                text("""
                    INSERT INTO suppliers 
                    (supplier_name, contact_person, phone_number, email, address, business_id) 
                    VALUES (:supplier_name, :contact_person, :phone, :email, :address, :business_id)
                """),
                {
                    "supplier_name": supplier_name,
                    "contact_person": contact_person,
                    "phone": phone,
                    "email": email,
                    "address": address,
                    "business_id": business_id
                }
            )
            db.commit()

        return jsonify({"message": "Supplier added successfully!"}), 201

    except Exception as e:
        print("Error adding supplier:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
   

@app.route("/update-supplier/<int:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        data = request.json
        supplier_name = data.get("supplier_name")
        contact_person = data.get("contact_person", "")
        phone_number = data.get("phone_number", "")
        email = data.get("email", "")
        address = data.get("address", "")

        if not supplier_name or not supplier_id:
            return jsonify({"error": "Invalid supplier data"}), 400

        # Check if supplier exists
        check_query = "SELECT * FROM suppliers WHERE supplier_id = :supplier_id AND business_id = :business_id"
        existing = execute_query(check_query, {"supplier_id": supplier_id, "business_id": business_id}, fetch_all=True)

        if not existing:
            return jsonify({"error": "Supplier not found or access denied"}), 404

        # Check for duplicate name
        duplicate_check = """
            SELECT supplier_id FROM suppliers 
            WHERE LOWER(supplier_name) = LOWER(:supplier_name) 
            AND supplier_id != :supplier_id 
            AND business_id = :business_id
        """
        duplicate = execute_query(
            duplicate_check,
            {"supplier_name": supplier_name, "supplier_id": supplier_id, "business_id": business_id},
            fetch_all=True
        )

        if duplicate:
            return jsonify({"error": "Supplier name already exists"}), 400

        # Update supplier
        execute_update(
            """
            UPDATE suppliers 
            SET supplier_name = :supplier_name,
                contact_person = :contact_person,
                phone_number = :phone_number,
                email = :email,
                address = :address
            WHERE supplier_id = :supplier_id AND business_id = :business_id
            """,
            {
                "supplier_name": supplier_name,
                "contact_person": contact_person,
                "phone_number": phone_number,
                "email": email,
                "address": address,
                "supplier_id": supplier_id,
                "business_id": business_id
            }
        )

        return jsonify({"message": "Supplier updated successfully!"}), 200

    except Exception as e:
        print("Error updating supplier:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/supplier-products/<int:supplier_id>', methods=['GET'])
def get_supplier_products(supplier_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify supplier belongs to business
        check_query = "SELECT supplier_id FROM suppliers WHERE supplier_id = :supplier_id AND business_id = :business_id"
        check_result = execute_query(check_query, {"supplier_id": supplier_id, "business_id": business_id}, fetch_all=True)

        if not check_result:
            return jsonify({"error": "Supplier not found or access denied"}), 404

        # Get supplier products
        query = """
            SELECT sp.supplier_product_id, p.product_id, p.product_name, sp.price, sp.stock_supplied, sp.supply_date
            FROM supplier_products sp
            JOIN products p ON sp.product_id = p.product_id AND p.business_id = :business_id
            WHERE sp.supplier_id = :supplier_id
        """
        products = execute_query(query, {"supplier_id": supplier_id, "business_id": business_id}, fetch_all=True)

        for product in products:
            if product["supply_date"]:
                product["supply_date"] = product["supply_date"].strftime("%Y-%m-%d")

        response = make_response(jsonify(products))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    except Exception as e:
        print("Error fetching supplier products:", e)
        return jsonify({"error": "Database error"}), 500

@app.route("/supplier-products/<int:supplier_id>/add", methods=["POST"])
def add_supplier_product(supplier_id):
    try:
        data = request.json

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if not all(key in data for key in ["product_id", "stock_supplied", "price", "supply_date"]):
            return jsonify({"error": "Missing required fields"}), 400

        product_id = int(data["product_id"])
        stock_supplied = Decimal(str(data["stock_supplied"]))
        price = Decimal(str(data["price"]))
        supply_date = data["supply_date"]

        if stock_supplied <= 0:
            return jsonify({"error": "Stock supplied must be greater than 0"}), 400

        price_per_unit = price / stock_supplied

        with get_db() as db:
            supplier_check = db.execute(
                text("""
                    SELECT supplier_id
                    FROM suppliers
                    WHERE supplier_id = :supplier_id
                    AND business_id = :business_id
                """),
                {"supplier_id": supplier_id, "business_id": business_id}
            ).fetchone()

            if not supplier_check:
                return jsonify({"error": "Supplier not found or access denied"}), 404

            product_check = db.execute(
                text("""
                    SELECT product_id
                    FROM products
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                """),
                {"product_id": product_id, "business_id": business_id}
            ).fetchone()

            if not product_check:
                return jsonify({"error": "Product not found or access denied"}), 404

            recipes = db.execute(
                text("""
                    SELECT material_id, quantity
                    FROM product_recipes
                    WHERE product_id = :product_id
                """),
                {"product_id": product_id}
            ).fetchall()

            if recipes:
                for material_id, material_qty_per_unit in recipes:
                    material_qty_per_unit = Decimal(str(material_qty_per_unit or 0))
                    total_needed = material_qty_per_unit * stock_supplied
                    remaining = total_needed

                    supplies = db.execute(
                        text("""
                            SELECT supply_id, quantity
                            FROM material_supplies
                            WHERE material_id = :material_id
                            AND quantity > 0
                            AND business_id = :business_id
                            ORDER BY supply_date ASC
                            FOR UPDATE
                        """),
                        {"material_id": material_id, "business_id": business_id}
                    ).fetchall()

                    for supply_id, available_qty in supplies:
                        available_qty = Decimal(str(available_qty or 0))
                        deduct = min(available_qty, remaining)
                        remaining -= deduct

                        if remaining <= 0:
                            break

                    if remaining > 0:
                        material = db.execute(
                            text("""
                                SELECT material_name
                                FROM raw_materials
                                WHERE material_id = :material_id
                                AND business_id = :business_id
                            """),
                            {"material_id": material_id, "business_id": business_id}
                        ).fetchone()

                        material_name = material[0] if material else "material"

                        return jsonify({
                            "error": f"❌ Insufficient {material_name}. Short by {float(remaining)} units"
                        }), 400

            current_product = db.execute(
                text("""
                    SELECT product_stock, buying_price
                    FROM products
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                    FOR UPDATE
                """),
                {"product_id": product_id, "business_id": business_id}
            ).fetchone()

            current_stock = Decimal(str(current_product[0] or 0)) if current_product else Decimal("0")
            current_buying_price = Decimal(str(current_product[1] or 0)) if current_product else Decimal("0")

            current_stock_value = current_stock * current_buying_price
            new_stock_value = stock_supplied * price_per_unit

            total_stock = current_stock + stock_supplied
            total_value = current_stock_value + new_stock_value

            new_buying_price = (
                total_value / total_stock
                if total_stock > 0
                else Decimal("0")
            )

            print("========== BUYING PRICE DEBUG ==========")
            print("product_id:", product_id)
            print("business_id:", business_id)
            print("current_stock:", current_stock)
            print("current_buying_price:", current_buying_price)
            print("stock_supplied:", stock_supplied)
            print("price:", price)
            print("price_per_unit:", price_per_unit)
            print("current_stock_value:", current_stock_value)
            print("new_stock_value:", new_stock_value)
            print("total_stock:", total_stock)
            print("total_value:", total_value)
            print("new_buying_price:", new_buying_price)
            print("========================================")

            db.execute(
                text("""
                    INSERT INTO supplier_products
                    (supplier_id, product_id, stock_supplied, price, supply_date, business_id)
                    VALUES (:supplier_id, :product_id, :stock_supplied, :price, :supply_date, :business_id)
                """),
                {
                    "supplier_id": supplier_id,
                    "product_id": product_id,
                    "stock_supplied": stock_supplied,
                    "price": price,
                    "supply_date": supply_date,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE products
                    SET product_stock = product_stock + :stock_supplied,
                        buying_price = :new_buying_price
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "stock_supplied": stock_supplied,
                    "new_buying_price": new_buying_price,
                    "product_id": product_id,
                    "business_id": business_id
                }
            )

            for material_id, material_qty_per_unit in recipes:
                material_qty_per_unit = Decimal(str(material_qty_per_unit or 0))
                total_needed = material_qty_per_unit * stock_supplied
                remaining = total_needed

                supplies = db.execute(
                    text("""
                        SELECT supply_id, quantity
                        FROM material_supplies
                        WHERE material_id = :material_id
                        AND quantity > 0
                        AND business_id = :business_id
                        ORDER BY supply_date ASC
                        FOR UPDATE
                    """),
                    {"material_id": material_id, "business_id": business_id}
                ).fetchall()

                for supply_id, available_qty in supplies:
                    if remaining <= 0:
                        break

                    available_qty = Decimal(str(available_qty or 0))
                    deduct = min(available_qty, remaining)

                    db.execute(
                        text("""
                            UPDATE material_supplies
                            SET quantity = quantity - :deduct
                            WHERE supply_id = :supply_id
                        """),
                        {"deduct": deduct, "supply_id": supply_id}
                    )

                    remaining -= deduct

        return jsonify({
            "message": "✅ Supply added, materials deducted, and buying price updated successfully",
            "product_id": product_id,
            "stock_added": float(stock_supplied),
            "price_per_unit": round(float(price_per_unit), 2),
            "new_buying_price": round(float(new_buying_price), 2)
        }), 201

    except Exception as e:
        print("Error:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal Server Error"}), 500

@app.route("/supplier-payments", methods=["POST"])
def add_supplier_payment():
    try:
        data = request.json

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        supplier_id = data.get("supplier_id")
        supplier_product_id = data.get("supplier_product_id")
        amount = Decimal(str(data.get("amount")))
        payment_method = data.get("payment_method")
        reference = data.get("reference")
        payment_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Verify supplier belongs to business
        supplier_check = "SELECT supplier_id FROM suppliers WHERE supplier_id = :supplier_id AND business_id = :business_id"
        supplier_result = execute_query(supplier_check, {"supplier_id": supplier_id, "business_id": business_id}, fetch_all=True)

        if not supplier_result:
            return jsonify({"error": "Supplier not found or access denied"}), 404

        # Verify supplier product belongs to business
        product_check = """
            SELECT sp.price, sp.supplier_product_id 
            FROM supplier_products sp
            JOIN suppliers s ON sp.supplier_id = s.supplier_id
            WHERE sp.supplier_product_id = :supplier_product_id AND s.business_id = :business_id
        """
        product_result = execute_query(product_check, {"supplier_product_id": supplier_product_id, "business_id": business_id}, fetch_all=True)

        if not product_result:
            return jsonify({"error": "Supplier product not found or access denied."}), 404

        product_price = Decimal(product_result[0]["price"])

        # Get total paid so far
        paid_query = """
            SELECT COALESCE(SUM(amount), 0) AS total_paid 
            FROM supplier_payments sp
            JOIN suppliers s ON sp.supplier_id = s.supplier_id
            WHERE sp.supplier_product_id = :supplier_product_id AND s.business_id = :business_id
        """
        paid_result = execute_query(paid_query, {"supplier_product_id": supplier_product_id, "business_id": business_id}, fetch_all=True)
        total_paid = Decimal(paid_result[0]["total_paid"]) if paid_result else Decimal(0)

        # Insert payment
        execute_insert("""
            INSERT INTO supplier_payments (supplier_id, supplier_product_id, amount, payment_date, payment_method, reference, business_id)
            VALUES (:supplier_id, :supplier_product_id, :amount, :payment_date, :payment_method, :reference, :business_id)
        """, {
            "supplier_id": supplier_id,
            "supplier_product_id": supplier_product_id,
            "amount": amount,
            "payment_date": payment_date,
            "payment_method": payment_method,
            "reference": reference,
            "business_id": business_id
        })

        new_total_paid = total_paid + amount
        balance_remaining = product_price - new_total_paid

        return jsonify({
            "message": "Payment recorded successfully!",
            "balance_remaining": float(balance_remaining)
        }), 201

    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": "Failed to record payment.", "details": str(e)}), 500

@app.route("/supplier-payments/<int:supplier_id>/<int:supplier_product_id>", methods=["GET"])
def get_supplier_payments(supplier_id, supplier_product_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Verify supplier belongs to business
        supplier_check = "SELECT supplier_id FROM suppliers WHERE supplier_id = :supplier_id AND business_id = :business_id"
        supplier_result = execute_query(supplier_check, {"supplier_id": supplier_id, "business_id": business_id}, fetch_all=True)

        if not supplier_result:
            return jsonify({"error": "Supplier not found or access denied"}), 404

        # Verify supplier product belongs to business
        product_check = """
            SELECT sp.price, sp.supplier_product_id 
            FROM supplier_products sp
            JOIN suppliers s ON sp.supplier_id = s.supplier_id
            WHERE sp.supplier_product_id = :supplier_product_id AND s.business_id = :business_id
        """
        product_result = execute_query(product_check, {"supplier_product_id": supplier_product_id, "business_id": business_id}, fetch_all=True)

        if not product_result:
            return jsonify({"error": "Supplier product not found or access denied."}), 404

        product_price = float(product_result[0]["price"])

        # Get payments
        payments_query = """
            SELECT sp.payment_id, sp.amount, sp.payment_date, sp.payment_method, sp.reference
            FROM supplier_payments sp
            JOIN suppliers s ON sp.supplier_id = s.supplier_id
            WHERE sp.supplier_product_id = :supplier_product_id AND s.business_id = :business_id
            ORDER BY sp.payment_date DESC
        """
        payments = execute_query(payments_query, {"supplier_product_id": supplier_product_id, "business_id": business_id}, fetch_all=True)

        # Get total paid
        paid_query = """
            SELECT COALESCE(SUM(sp.amount), 0) AS total_paid 
            FROM supplier_payments sp
            JOIN suppliers s ON sp.supplier_id = s.supplier_id
            WHERE sp.supplier_product_id = :supplier_product_id AND s.business_id = :business_id
        """
        paid_result = execute_query(paid_query, {"supplier_product_id": supplier_product_id, "business_id": business_id}, fetch_all=True)
        total_paid = float(paid_result[0]["total_paid"]) if paid_result else 0.0

        balance_remaining = product_price - total_paid

        return jsonify({
            "payments": payments,
            "total_paid": total_paid,
            "balance_remaining": balance_remaining
        }), 200

    except Exception as e:
        print("Error fetching supplier payments:", str(e))
        return jsonify({"error": "Failed to fetch payment history.", "details": str(e)}), 500

@app.route('/api/v1/supplier/<int:supplier_id>', methods=['GET'])
def get_supplier_name(supplier_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        supplier = execute_query(
            "SELECT supplier_name FROM suppliers WHERE supplier_id = :supplier_id AND business_id = :business_id",
            {"supplier_id": supplier_id, "business_id": business_id},
            fetch_all=True
        )

        if supplier:
            response = make_response(jsonify(supplier[0]))
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        else:
            return jsonify({"error": "Supplier not found"}), 404

    except Exception as e:
        print(f"Database Error: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/api/v1/update-supplier-product/<int:supplier_product_id>', methods=['PUT'])
def update_supplier_product(supplier_product_id):
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        data = request.json

        new_stock_supplied = Decimal(str(data.get("stock_supplied") or 0))
        new_price = Decimal(str(data.get("price") or 0))
        new_supply_date = data.get("supply_date")

        if new_stock_supplied <= 0:
            return jsonify({"error": "Stock supplied must be greater than 0"}), 400

        new_price_per_unit = new_price / new_stock_supplied

        with get_db() as db:
            existing = db.execute(
                text("""
                    SELECT 
                        sp.stock_supplied,
                        sp.price,
                        sp.product_id,
                        p.product_stock,
                        p.buying_price,
                        p.business_id
                    FROM supplier_products sp
                    JOIN products p ON sp.product_id = p.product_id
                    WHERE sp.supplier_product_id = :supplier_product_id
                    AND p.business_id = :business_id
                    FOR UPDATE
                """),
                {
                    "supplier_product_id": supplier_product_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not existing:
                return jsonify({"error": "Product not found or access denied"}), 404

            old_stock_supplied = Decimal(str(existing[0] or 0))
            product_id = existing[2]
            current_stock = Decimal(str(existing[3] or 0))
            current_buying_price = Decimal(str(existing[4] or 0))

            stock_difference = new_stock_supplied - old_stock_supplied
            new_total_stock = current_stock + stock_difference

            if new_total_stock < 0:
                return jsonify({
                    "error": "Cannot reduce stock below current available stock"
                }), 400

            current_stock_value = current_stock * current_buying_price
            new_stock_value = stock_difference * new_price_per_unit

            if stock_difference > 0:
                total_value = current_stock_value + new_stock_value
                weighted_buying_price = (
                    total_value / new_total_stock
                    if new_total_stock > 0
                    else Decimal("0")
                )
            else:
                weighted_buying_price = current_buying_price

            db.execute(
                text("""
                    UPDATE supplier_products 
                    SET stock_supplied = :stock_supplied,
                        price = :price,
                        supply_date = :supply_date 
                    WHERE supplier_product_id = :supplier_product_id
                """),
                {
                    "stock_supplied": new_stock_supplied,
                    "price": new_price,
                    "supply_date": new_supply_date,
                    "supplier_product_id": supplier_product_id
                }
            )

            db.execute(
                text("""
                    UPDATE products 
                    SET product_stock = product_stock + :stock_difference,
                        buying_price = :buying_price
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "stock_difference": stock_difference,
                    "buying_price": weighted_buying_price,
                    "product_id": product_id,
                    "business_id": business_id
                }
            )

            has_recipes = db.execute(
                text("""
                    SELECT EXISTS(
                        SELECT 1
                        FROM product_recipes pr
                        JOIN products p ON pr.product_id = p.product_id
                        WHERE pr.product_id = :product_id
                        AND p.business_id = :business_id
                    ) AS has_recipes
                """),
                {
                    "product_id": product_id,
                    "business_id": business_id
                }
            ).fetchone()[0]

            if stock_difference != 0 and has_recipes:
                recipes = db.execute(
                    text("""
                        SELECT pr.material_id, pr.quantity, rm.material_name
                        FROM product_recipes pr
                        JOIN raw_materials rm 
                            ON pr.material_id = rm.material_id
                            AND rm.business_id = :business_id
                        WHERE pr.product_id = :product_id
                    """),
                    {
                        "business_id": business_id,
                        "product_id": product_id
                    }
                ).fetchall()

                material_adjustment = abs(stock_difference)
                operation = "deduct" if stock_difference > 0 else "add"

                for recipe in recipes:
                    material_id = recipe[0]
                    quantity_per_product = Decimal(str(recipe[1] or 0))
                    material_name = recipe[2]
                    total_adjustment = quantity_per_product * material_adjustment

                    if operation == "deduct":
                        material_supplies = db.execute(
                            text("""
                                SELECT supply_id, quantity 
                                FROM material_supplies 
                                WHERE material_id = :material_id
                                AND quantity > 0
                                AND business_id = :business_id
                                ORDER BY supply_date ASC
                                FOR UPDATE
                            """),
                            {
                                "material_id": material_id,
                                "business_id": business_id
                            }
                        ).fetchall()

                        remaining = total_adjustment

                        for supply in material_supplies:
                            if remaining <= 0:
                                break

                            supply_id = supply[0]
                            available_qty = Decimal(str(supply[1] or 0))
                            deduct = min(available_qty, remaining)

                            db.execute(
                                text("""
                                    UPDATE material_supplies 
                                    SET quantity = quantity - :deduct 
                                    WHERE supply_id = :supply_id
                                """),
                                {
                                    "deduct": deduct,
                                    "supply_id": supply_id
                                }
                            )

                            remaining -= deduct

                        if remaining > 0:
                            return jsonify({
                                "error": f"Insufficient {material_name} (short by {float(remaining)} units)"
                            }), 400

                    else:
                        recent_supply = db.execute(
                            text("""
                                SELECT supply_id 
                                FROM material_supplies 
                                WHERE material_id = :material_id
                                AND business_id = :business_id
                                ORDER BY supply_date DESC
                                LIMIT 1
                            """),
                            {
                                "material_id": material_id,
                                "business_id": business_id
                            }
                        ).fetchone()

                        if recent_supply:
                            db.execute(
                                text("""
                                    UPDATE material_supplies 
                                    SET quantity = quantity + :adjustment 
                                    WHERE supply_id = :supply_id
                                """),
                                {
                                    "adjustment": total_adjustment,
                                    "supply_id": recent_supply[0]
                                }
                            )
                        else:
                            db.execute(
                                text("""
                                    INSERT INTO material_supplies 
                                    (material_id, quantity, supply_date, business_id) 
                                    VALUES (:material_id, :quantity, CURDATE(), :business_id)
                                """),
                                {
                                    "material_id": material_id,
                                    "quantity": total_adjustment,
                                    "business_id": business_id
                                }
                            )

        return jsonify({
            "message": "Supplier product updated successfully",
            "stock_adjusted": float(stock_difference),
            "buying_price": round(float(weighted_buying_price), 2),
            "has_recipes": bool(has_recipes),
            "product_id": product_id
        }), 200

    except Exception as e:
        print(f"Error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

        

@app.route("/process-sale", methods=["POST"])
def process_sale():
    data = request.json
    customer_id = data.get("customer_id")
    payment_type = data.get("payment_type")
    cart_items = data.get("cart_items")
    vat = float(data.get("vat", 0.00))
    discount = float(data.get("discount", 0.00))
    status = "completed"
    
    # Get the user_id from the request
    user_id = data.get("user_id")

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not cart_items or payment_type not in ["Mpesa", "Cash", "Bank", "Credit"]:
        return jsonify({"error": "Invalid request"}), 400
    
    # Validate user_id
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    try:
        with get_db() as db:
            # Calculate totals
            total_amount = sum(float(item["subtotal"]) for item in cart_items)
            final_total = total_amount + vat - discount

            # Generate order number
            order_number = generate_order_number()

            # Insert sale with user_id
            result = db.execute(
                text("""
                    INSERT INTO sales (customer_id, total_price, payment_type, vat, discount, status, order_number, business_id, user_id)
                    VALUES (:customer_id, :total_price, :payment_type, :vat, :discount, :status, :order_number, :business_id, :user_id)
                """),
                {
                    "customer_id": customer_id if customer_id else None,
                    "total_price": final_total,
                    "payment_type": payment_type,
                    "vat": vat,
                    "discount": discount,
                    "status": status,
                    "order_number": order_number,
                    "business_id": business_id,
                    "user_id": user_id
                }
            )
            sale_id = result.lastrowid

            # Calculate discount ratio
            discount_ratio = discount / total_amount if total_amount > 0 else 0

            # Process cart items
            for item in cart_items:
                product_id = item["product_id"]
                quantity = float(item["quantity"])
                subtotal = float(item["subtotal"])
                
                item_discount = subtotal * discount_ratio

                # Bundle products
                if isinstance(product_id, str) and product_id.startswith("bundle-"):
                    bundle_id = int(product_id.replace("bundle-", ""))

                    # Get bundle buying price
                    bundle_result = db.execute(
                        text("""
                            SELECT pb.bundle_buying_price 
                            FROM product_bundles pb
                            JOIN products p ON pb.child_product_id = p.product_id
                            WHERE pb.bundle_id = :bundle_id AND p.business_id = :business_id
                            LIMIT 1
                        """),
                        {"bundle_id": bundle_id, "business_id": business_id}
                    ).fetchone()
                    
                    bundle_buying_price = float(bundle_result[0]) if bundle_result else 0
                    
                    # Calculate cost and profit
                    cost = quantity * bundle_buying_price
                    profit = subtotal - cost - item_discount

                    # Lock child products
                    bundle_items = db.execute(
                        text("""
                            SELECT 
                                pb.child_product_id,
                                pb.quantity,
                                p.product_stock
                            FROM product_bundles pb
                            JOIN products p ON pb.child_product_id = p.product_id AND p.business_id = :business_id
                            WHERE pb.bundle_id = :bundle_id
                            FOR UPDATE
                        """),
                        {"business_id": business_id, "bundle_id": bundle_id}
                    ).fetchall()

                    if not bundle_items:
                        return jsonify({"error": "Invalid bundle"}), 400

                    # Check bundle stock
                    max_bundles = min(
                        float(item_stock) / float(child_qty)
                        for (_, child_qty, item_stock) in bundle_items
                    )
                    if max_bundles < quantity:
                        return jsonify({"error": "Insufficient stock for bundle"}), 400

                    # Insert sale item for bundle
                    db.execute(
                        text("""
                            INSERT INTO sales_items (sale_id, product_id, bundle_id, quantity, subtotal, buying_price, profit, business_id)
                            VALUES (:sale_id, NULL, :bundle_id, :quantity, :subtotal, :buying_price, :profit, :business_id)
                        """),
                        {
                            "sale_id": sale_id,
                            "bundle_id": bundle_id,
                            "quantity": quantity,
                            "subtotal": subtotal,
                            "buying_price": bundle_buying_price,
                            "profit": profit,
                            "business_id": business_id
                        }
                    )

                    # Deduct child stock
                    for child_id, child_qty, _ in bundle_items:
                        db.execute(
                            text("""
                                UPDATE products
                                SET product_stock = product_stock - :deduct_qty
                                WHERE product_id = :product_id AND business_id = :business_id
                            """),
                            {
                                "deduct_qty": float(child_qty) * quantity,
                                "product_id": child_id,
                                "business_id": business_id
                            }
                        )

                # Normal products
                else:
                    # Get product info
                    product = db.execute(
                        text("""
                            SELECT product_stock, buying_price
                            FROM products
                            WHERE product_id = :product_id AND business_id = :business_id
                            FOR UPDATE
                        """),
                        {"product_id": product_id, "business_id": business_id}
                    ).fetchone()

                    if not product or float(product[0]) < quantity:
                        return jsonify({
                            "error": "INSUFFICIENT_STOCK",
                            "message": f"Only {product[0] if product else 0} item(s) left in stock",
                            "product_id": product_id,
                            "requested": quantity,
                            "available": product[0] if product else 0
                        }), 400

                    buying_price = float(product[1]) if product[1] else 0
                    
                    # Calculate cost and profit
                    cost = quantity * buying_price
                    profit = subtotal - cost - item_discount

                    # Insert sale item
                    db.execute(
                        text("""
                            INSERT INTO sales_items (sale_id, product_id, bundle_id, quantity, subtotal, buying_price, profit, business_id)
                            VALUES (:sale_id, :product_id, NULL, :quantity, :subtotal, :buying_price, :profit, :business_id)
                        """),
                        {
                            "sale_id": sale_id,
                            "product_id": product_id,
                            "quantity": quantity,
                            "subtotal": subtotal,
                            "buying_price": buying_price,
                            "profit": profit,
                            "business_id": business_id
                        }
                    )

                    # Deduct stock
                    db.execute(
                        text("""
                            UPDATE products
                            SET product_stock = product_stock - :quantity
                            WHERE product_id = :product_id AND business_id = :business_id
                        """),
                        {"quantity": quantity, "product_id": product_id, "business_id": business_id}
                    )

            # Commit the transaction (automatically handled by 'with get_db() as db' if configured for autocommit)
            # If not using autocommit, uncomment the next line:
            # db.commit()

        return jsonify({
            "message": "Sale processed successfully",
            "order_number": order_number
        }), 201

    except Exception as e:
        print("❌ ERROR in process_sale:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500
        
@app.route("/get-sales-products", methods=["GET"])
def get_sales_products():
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Fetch active normal products only
        products_query = """
            SELECT 
                p.product_id,
                p.product_name,
                p.product_price,
                p.product_stock,
                p.unit
            FROM products p
            WHERE p.business_id = :business_id
            AND p.deleted_at IS NULL
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """

        products = execute_query(
            products_query,
            {
                "business_id": business_id,
                "limit": per_page,
                "offset": offset
            },
            fetch_all=True
        )

        formatted_products = [
            {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "product_price": float(row["product_price"] or 0),
                "product_stock": float(row["product_stock"] or 0),
                "unit": row["unit"],
                "is_bundle": False
            }
            for row in products
        ]

        # Fetch active bundles only
        bundles_query = """
            SELECT
                pb.bundle_id,
                MAX(pb.selling_price) AS selling_price,
                MIN(pb.quantity) AS quantity,
                MIN(FLOOR(p.product_stock / pb.quantity)) AS bundle_stock
            FROM product_bundles pb
            JOIN products p 
                ON p.product_id = pb.child_product_id
                AND p.business_id = :business_id
                AND p.deleted_at IS NULL
            WHERE pb.business_id = :business_id
            AND pb.deleted_at IS NULL
            GROUP BY pb.bundle_id
        """

        bundles = execute_query(
            bundles_query,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted_bundles = []

        for bundle in bundles:
            bundle_id = bundle["bundle_id"]

            product_info = execute_query(
                """
                SELECT 
                    p.product_name,
                    p.unit
                FROM product_bundles pb
                JOIN products p 
                    ON p.product_id = pb.child_product_id
                    AND p.business_id = :business_id
                    AND p.deleted_at IS NULL
                WHERE pb.bundle_id = :bundle_id
                AND pb.business_id = :business_id
                AND pb.deleted_at IS NULL
                ORDER BY pb.child_product_id
                LIMIT 1
                """,
                {
                    "business_id": business_id,
                    "bundle_id": bundle_id
                },
                fetch_all=True
            )

            if not product_info:
                continue

            formatted_bundles.append({
                "product_id": f"bundle-{bundle_id}",
                "product_name": product_info[0]["product_name"],
                "product_price": float(bundle["selling_price"] or 0),
                "product_stock": int(bundle["bundle_stock"] or 0),
                "quantity": bundle["quantity"],
                "unit": product_info[0]["unit"],
                "is_bundle": True
            })

        combined_products = formatted_products + formatted_bundles

        return jsonify({
            "products": combined_products,
            "total_products": len(combined_products),
            "page": page
        }), 200

    except Exception as e:
        print("❌ ERROR in get_sales_products:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/suppliers/<int:supplier_id>/soft-delete", methods=["DELETE"])
def soft_delete_supplier(supplier_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            supplier = db.execute(
                text("""
                    SELECT supplier_id
                    FROM suppliers
                    WHERE supplier_id = :supplier_id
                    AND business_id = :business_id
                    AND deleted_at IS NULL
                """),
                {
                    "supplier_id": supplier_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not supplier:
                return jsonify({"error": "Supplier not found or already deleted"}), 404

            db.execute(
                text("""
                    UPDATE suppliers
                    SET deleted_at = NOW()
                    WHERE supplier_id = :supplier_id
                    AND business_id = :business_id
                """),
                {
                    "supplier_id": supplier_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Supplier deleted successfully"}), 200

    except Exception as e:
        print("Error deleting supplier:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route("/get-sales-customers", methods=["GET"])
def get_sales_customers():
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        count_query = "SELECT COUNT(*) AS total FROM customers WHERE business_id = :business_id"
        count_result = execute_query(count_query, {"business_id": business_id}, fetch_all=True)
        total_customers = count_result[0]["total"] if count_result else 0

        customers_query = """
            SELECT customer_id, customer_name, phone, email, address 
            FROM customers 
            WHERE business_id = :business_id
            ORDER BY created_at DESC 
            LIMIT :limit OFFSET :offset
        """
        customers = execute_query(
            customers_query,
            {"business_id": business_id, "limit": per_page, "offset": offset},
            fetch_all=True
        )

        formatted_customers = [
            {
                "id": row["customer_id"],
                "name": row["customer_name"],
                "phone": row["phone"] if row["phone"] else "N/A",
                "email": row["email"] if row["email"] else "N/A",
                "address": row["address"] if row["address"] else "N/A",
            }
            for row in customers
        ]

        response = jsonify(
            {"customers": formatted_customers, "total_customers": total_customers, "page": page}
        )
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response, 200

    except Exception as e:
        print("❌ ERROR in get_sales_customers:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/add-sales-customer", methods=["POST"])
def add_sales_customer():
    data = request.json
    customer_name = data.get("customer_name", "").strip() or None
    phone = data.get("phone", "").strip() or None
    email = data.get("email", "").strip() or None
    address = data.get("address", "").strip() or None

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not customer_name:
        return jsonify({"error": "Customer name is required"}), 400

    try:
        customer_id = execute_insert(
            """
            INSERT INTO customers (customer_name, phone, email, address, created_at, business_id)
            VALUES (:customer_name, :phone, :email, :address, NOW(), :business_id)
            """,
            {
                "customer_name": customer_name,
                "phone": phone,
                "email": email,
                "address": address,
                "business_id": business_id
            }
        )

        # Fetch the newly added customer
        new_customer = execute_query(
            "SELECT customer_id, customer_name, phone, email, address FROM customers WHERE customer_id = :customer_id AND business_id = :business_id",
            {"customer_id": customer_id, "business_id": business_id},
            fetch_all=True
        )[0]

        return jsonify({
            "message": "Customer added successfully", 
            "customer": {
                "customer_id": new_customer["customer_id"],
                "customer_name": new_customer["customer_name"],
                "phone": new_customer["phone"],
                "email": new_customer["email"],
                "address": new_customer["address"]
            }
        }), 201
    except Exception as e:
        print("Error adding customer:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/update-customer/<int:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    data = request.json

    customer_name = data.get("customer_name", "").strip() or None
    phone = data.get("phone", "").strip() or None
    email = data.get("email", "").strip() or None
    address = data.get("address", "").strip() or None

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not customer_name:
        return jsonify({"error": "Customer name is required"}), 400

    try:
        existing_customer = execute_query(
            """
            SELECT customer_id 
            FROM customers 
            WHERE customer_id = :customer_id 
            AND business_id = :business_id
            """,
            {
                "customer_id": customer_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        if not existing_customer:
            return jsonify({"error": "Customer not found"}), 404

        execute_update(
            """
            UPDATE customers
            SET customer_name = :customer_name,
                phone = :phone,
                email = :email,
                address = :address
            WHERE customer_id = :customer_id
            AND business_id = :business_id
            """,
            {
                "customer_name": customer_name,
                "phone": phone,
                "email": email,
                "address": address,
                "customer_id": customer_id,
                "business_id": business_id
            }
        )

        updated_customer = execute_query(
            """
            SELECT customer_id, customer_name, phone, email, address
            FROM customers
            WHERE customer_id = :customer_id
            AND business_id = :business_id
            """,
            {
                "customer_id": customer_id,
                "business_id": business_id
            },
            fetch_all=True
        )[0]

        return jsonify({
            "message": "Customer updated successfully",
            "customer": {
                "customer_id": updated_customer["customer_id"],
                "customer_name": updated_customer["customer_name"],
                "phone": updated_customer["phone"],
                "email": updated_customer["email"],
                "address": updated_customer["address"]
            }
        }), 200

    except Exception as e:
        print("Error updating customer:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/get-company-details", methods=["GET"])
def get_company_details():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        company_details = execute_query(
            "SELECT company, company_phone FROM users WHERE business_id = :business_id LIMIT 1",
            {"business_id": business_id},
            fetch_all=True
        )

        if not company_details:
            return jsonify({"error": "No company details found"}), 404

        return jsonify(company_details[0]), 200
    except Exception as e:
        print("❌ ERROR in get_company_details:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/get-orders", methods=["GET"])
def get_orders():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        # Get date range from query parameters
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        # Base query - added u.username to SELECT and LEFT JOIN users
        query = """
            SELECT 
                s.sale_id,
                s.order_number,
                s.customer_id,
                c.customer_name,
                s.total_price,
                s.payment_type,
                s.sale_date,
                s.status,
                s.vat,
                s.discount,
                s.user_id,
                u.username AS username,
                si.product_id,
                si.bundle_id,
                si.quantity,
                si.subtotal,
                si.buying_price,
                si.profit,

                p.product_name AS product_name,
                p.product_price AS product_price,

                pb.selling_price AS bundle_selling_price,
                pb.bundle_buying_price AS bundle_buying_price,

                pb.child_product_id,
                pb.quantity AS bundle_quantity,
                cp.product_name AS child_product_name

            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.customer_id
            LEFT JOIN users u ON s.user_id = u.user_id
            LEFT JOIN sales_items si ON s.sale_id = si.sale_id AND si.business_id = :business_id
            LEFT JOIN products p ON si.product_id = p.product_id AND p.business_id = :business_id
            LEFT JOIN product_bundles pb ON si.bundle_id = pb.bundle_id
            LEFT JOIN products cp ON pb.child_product_id = cp.product_id AND cp.business_id = :business_id
            WHERE s.business_id = :business_id
        """

        params = {"business_id": business_id}

        if start_date and end_date:
            query += " AND s.sale_date BETWEEN :start_date AND :end_date"
            params["start_date"] = f"{start_date} 00:00:00"
            params["end_date"] = f"{end_date} 23:59:59"

        query += " ORDER BY s.sale_date DESC"

        results = execute_query(query, params, fetch_all=True)
        
        # DEBUG: Print the first result to see what's coming from the query
        if results:
            print("FIRST RAW RESULT KEYS:", results[0].keys())
            print("FIRST RAW RESULT user_id:", results[0].get('user_id'))
            print("FIRST RAW RESULT username:", results[0].get('username'))

        grouped_orders = {}

        for order in results:
            sale_id = order["sale_id"]

            if sale_id not in grouped_orders:
                # DEBUG: Print what we're putting in the response for this sale
                if sale_id == 38:
                    print(f"SALE 38 - user_id from query: {order.get('user_id')}")
                    print(f"SALE 38 - username from query: {order.get('username')}")
                
                grouped_orders[sale_id] = {
                    "sale_id": sale_id,
                    "order_number": order["order_number"],
                    "customer_id": order["customer_id"],
                    "customer_name": order["customer_name"],
                    "total_price": float(order["total_price"]),
                    "payment_type": order["payment_type"],
                    "sale_date": order["sale_date"]
                        .astimezone(pytz.timezone("Africa/Nairobi"))
                        .isoformat(),
                    "vat": float(order["vat"] or 0),
                    "discount": float(order["discount"] or 0),
                    "status": order["status"],
                    "user_id": order["user_id"],
                    "username": order.get("username"),  # Use .get() to avoid KeyError
                    "items": [],
                    "profit": 0.0
                }

            quantity_sold = float(order["quantity"] or 0)
            is_bundle = order["bundle_id"] is not None

            selling_price = float(
                order["bundle_selling_price"]
                if is_bundle
                else order["product_price"] or 0
            )

            buying_price = float(order["buying_price"] or 0)
            item_profit = float(order["profit"] or 0)
            subtotal = float(order["subtotal"] or 0)

            if is_bundle:
                display_name = f"Bundle #{order['bundle_id']}"
                if order["child_product_name"]:
                    display_name = f"Bundle ({order['child_product_name']} + more)"
            else:
                display_name = order["product_name"] or "Unknown Product"

            grouped_orders[sale_id]["items"].append({
                "product_id": order["product_id"],
                "bundle_id": order["bundle_id"],
                "product_name": display_name,
                "product_price": selling_price,
                "buying_price": buying_price,
                "quantity": quantity_sold,
                "subtotal": subtotal,
                "is_bundle": is_bundle,
                "profit": round(item_profit, 2),
            })

        # Calculate total profit for each order
        for order in grouped_orders.values():
            total_profit = sum(item["profit"] for item in order["items"])
            order["profit"] = round(total_profit, 2)

        # DEBUG: Check what's actually in grouped_orders before sending
        if 38 in grouped_orders:
            print("GROUPED_ORDERS[38] keys:", grouped_orders[38].keys())
            print("GROUPED_ORDERS[38] username:", grouped_orders[38].get('username'))

        # DEBUG: Print what we're sending to the frontend for sale 38
        if 38 in grouped_orders:
            print("FINAL RESPONSE for sale 38:", grouped_orders[38].get('username'))

        response = jsonify({"orders": list(grouped_orders.values())})
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        return response

    except Exception as e:
        print(f"❌ Error in get_orders: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/update-order-status", methods=["POST"])
def update_order_status():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    data = request.get_json()
    sale_id = data.get("sale_id")
    new_status = data.get("status")

    if not sale_id or not new_status:
        return jsonify({"error": "Missing sale_id or status"}), 400

    try:
        with get_db() as db:
            # Lock sale row and verify it belongs to this business
            sale = db.execute(
                text("SELECT status FROM sales WHERE sale_id = :sale_id AND business_id = :business_id FOR UPDATE"),
                {"sale_id": sale_id, "business_id": business_id}
            ).fetchone()

            if not sale:
                return jsonify({"error": "Sale not found or access denied"}), 404

            current_status = sale[0]

            # Stock changes only when crossing "completed"
            entering_completed = current_status != "completed" and new_status == "completed"
            leaving_completed = current_status == "completed" and new_status != "completed"

            if entering_completed or leaving_completed:
                direction = -1 if entering_completed else 1

                items = db.execute(
                    text("""
                        SELECT product_id, bundle_id, quantity
                        FROM sales_items
                        WHERE sale_id = :sale_id AND business_id = :business_id
                        FOR UPDATE
                    """),
                    {"sale_id": sale_id, "business_id": business_id}
                ).fetchall()

                for item in items:
                    sale_qty = item[2]

                    # Bundle
                    if item[1]:
                        bundle_items = db.execute(
                            text("""
                                SELECT child_product_id, quantity
                                FROM product_bundles pb
                                JOIN products p ON pb.child_product_id = p.product_id
                                WHERE pb.bundle_id = :bundle_id AND p.business_id = :business_id
                                FOR UPDATE
                            """),
                            {"bundle_id": item[1], "business_id": business_id}
                        ).fetchall()

                        for b in bundle_items:
                            stock_change = direction * sale_qty * b[1]

                            db.execute(
                                text("""
                                    UPDATE products
                                    SET product_stock = product_stock + :stock_change
                                    WHERE product_id = :product_id AND business_id = :business_id
                                """),
                                {"stock_change": stock_change, "product_id": b[0], "business_id": business_id}
                            )

                    # Normal product
                    else:
                        stock_change = direction * sale_qty

                        db.execute(
                            text("""
                                UPDATE products
                                SET product_stock = product_stock + :stock_change
                                WHERE product_id = :product_id AND business_id = :business_id
                            """),
                            {"stock_change": stock_change, "product_id": item[0], "business_id": business_id}
                        )

            # Update sale status
            db.execute(
                text("UPDATE sales SET status = :status WHERE sale_id = :sale_id AND business_id = :business_id"),
                {"status": new_status, "sale_id": sale_id, "business_id": business_id}
            )

        return jsonify({"success": True})

    except Exception as e:
        print("❌ update_order_status error:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/material-inventory', methods=['GET'])
def get_material_inventory():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        query = """
            SELECT 
                m.material_id,
                m.material_name,
                m.unit,
                IFNULL(SUM(ms.quantity), 0) AS total_supplied,
                IFNULL((
                    SELECT SUM(pr.quantity * si.quantity)
                    FROM product_recipes pr
                    JOIN sales_items si ON pr.product_id = si.product_id AND si.business_id = :business_id
                    WHERE pr.material_id = m.material_id
                ), 0) AS total_used,
                IFNULL(SUM(ms.quantity), 0) - IFNULL((
                    SELECT SUM(pr.quantity * si.quantity)
                    FROM product_recipes pr
                    JOIN sales_items si ON pr.product_id = si.product_id AND si.business_id = :business_id
                    WHERE pr.material_id = m.material_id
                ), 0) AS current_stock,
                IFNULL(SUM(ms.quantity * ms.unit_price), 0) AS total_cost,
                CASE 
                    WHEN IFNULL(SUM(ms.quantity), 0) > 0 
                    THEN IFNULL(SUM(ms.quantity * ms.unit_price), 0) / IFNULL(SUM(ms.quantity), 0)
                    ELSE 0
                END AS avg_unit_cost
            FROM raw_materials m
            LEFT JOIN material_supplies ms ON m.material_id = ms.material_id AND ms.business_id = :business_id
            WHERE m.business_id = :business_id
            GROUP BY m.material_id, m.material_name, m.unit
            ORDER BY m.material_name
        """
        
        materials = execute_query(query, {"business_id": business_id}, fetch_all=True)

        # Convert decimal values to float
        for material in materials:
            for key in ['total_supplied', 'total_used', 'current_stock', 'total_cost', 'avg_unit_cost']:
                if material[key] is not None:
                    material[key] = float(material[key])
                else:
                    material[key] = 0.0

        return jsonify({
            "status": "success",
            "materials": materials,
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Error fetching material inventory: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch material inventory data",
            "error": str(e)
        }), 500

@app.route("/expenses", methods=["POST"])
def add_expense():
    data = request.json

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    expense_date = datetime.now().date()

    category = data.get("category")
    product_id = data.get("product_id")
    waste_quantity = Decimal(str(data.get("waste_quantity") or 0))

    try:
        with get_db() as db:
            if category == "Waste":
                if not product_id:
                    return jsonify({"error": "Product is required for waste expense"}), 400

                if waste_quantity <= 0:
                    return jsonify({"error": "Waste quantity must be greater than 0"}), 400

                product = db.execute(
                    text("""
                        SELECT product_stock
                        FROM products
                        WHERE product_id = :product_id
                        AND business_id = :business_id
                        FOR UPDATE
                    """),
                    {
                        "product_id": product_id,
                        "business_id": business_id
                    }
                ).fetchone()

                if not product:
                    return jsonify({"error": "Product not found"}), 404

                current_stock = Decimal(str(product[0] or 0))

                if waste_quantity > current_stock:
                    return jsonify({
                        "error": f"Cannot remove {float(waste_quantity)}. Only {float(current_stock)} available."
                    }), 400

                db.execute(
                    text("""
                        UPDATE products
                        SET product_stock = product_stock - :waste_quantity
                        WHERE product_id = :product_id
                        AND business_id = :business_id
                    """),
                    {
                        "waste_quantity": waste_quantity,
                        "product_id": product_id,
                        "business_id": business_id
                    }
                )

            db.execute(
                text("""
                    INSERT INTO expenses (
                        user_id, category, description, amount,
                        payment_method, expense_date, business_id,
                        product_id, waste_quantity
                    )
                    VALUES (
                        :user_id, :category, :description, :amount,
                        :payment_method, :expense_date, :business_id,
                        :product_id, :waste_quantity
                    )
                """),
                {
                    "user_id": data.get("user_id"),
                    "category": category,
                    "description": data.get("description"),
                    "amount": data.get("amount"),
                    "payment_method": data.get("payment_method"),
                    "expense_date": expense_date,
                    "business_id": business_id,
                    "product_id": product_id if category == "Waste" else None,
                    "waste_quantity": waste_quantity if category == "Waste" else 0
                }
            )

        return jsonify({
            "message": "Expense added successfully",
            "date": expense_date.isoformat()
        }), 201

    except Exception as e:
        print("Error adding expense:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/expenses", methods=["GET"])
def get_expenses():
    user_id = request.args.get("user_id")
    start = request.args.get("start")
    end = request.args.get("end")

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        query = """
            SELECT 
                e.*,
                p.product_name,
                (
                    SELECT SUM(amount)
                    FROM expenses
                    WHERE user_id = :user_id
                    AND business_id = :business_id
                ) AS total_expenses
            FROM expenses e
            LEFT JOIN products p 
                ON e.product_id = p.product_id
                AND p.business_id = e.business_id
            WHERE e.user_id = :user_id
            AND e.business_id = :business_id
        """

        params = {
            "user_id": user_id,
            "business_id": business_id
        }

        if start and end:
            query += " AND e.expense_date BETWEEN :start AND :end"
            params["start"] = start
            params["end"] = end

        query += " ORDER BY e.expense_date DESC, e.expense_id DESC"

        data = execute_query(query, params, fetch_all=True)
        return jsonify(data), 200

    except Exception as e:
        print("Error fetching expenses:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route("/expenses/<int:expense_id>", methods=["PUT"])
def update_expense(expense_id):
    data = request.json
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            # Fetch the existing expense
            old = db.execute(
                text("""
                    SELECT category, product_id, waste_quantity
                    FROM expenses
                    WHERE expense_id = :expense_id AND business_id = :business_id
                """),
                {"expense_id": expense_id, "business_id": business_id}
            ).fetchone()
            if not old:
                return jsonify({"error": "Expense not found"}), 404

            old_category, old_product_id, old_waste_qty = old
            old_waste_qty = Decimal(str(old_waste_qty or 0))

            new_category = data.get("category")
            new_product_id = data.get("product_id")
            new_waste_qty = Decimal(str(data.get("waste_quantity") or 0))

            # Handle stock adjustment for waste
            if old_category == "Waste":
                # Restore old waste quantity (add back to stock)
                if old_product_id and old_waste_qty > 0:
                    db.execute(
                        text("""
                            UPDATE products
                            SET product_stock = product_stock + :old_qty
                            WHERE product_id = :product_id AND business_id = :business_id
                        """),
                        {"old_qty": old_waste_qty, "product_id": old_product_id, "business_id": business_id}
                    )

            if new_category == "Waste":
                # Apply new waste deduction
                if not new_product_id or new_waste_qty <= 0:
                    return jsonify({"error": "Invalid waste data"}), 400

                # Check stock availability
                product = db.execute(
                    text("""
                        SELECT product_stock
                        FROM products
                        WHERE product_id = :product_id AND business_id = :business_id
                        FOR UPDATE
                    """),
                    {"product_id": new_product_id, "business_id": business_id}
                ).fetchone()
                if not product:
                    return jsonify({"error": "Product not found"}), 404
                current_stock = Decimal(str(product[0] or 0))
                if new_waste_qty > current_stock:
                    return jsonify({"error": f"Insufficient stock. Available: {float(current_stock)}"}), 400

                db.execute(
                    text("""
                        UPDATE products
                        SET product_stock = product_stock - :new_qty
                        WHERE product_id = :product_id AND business_id = :business_id
                    """),
                    {"new_qty": new_waste_qty, "product_id": new_product_id, "business_id": business_id}
                )

            # Update the expense record
            db.execute(
                text("""
                    UPDATE expenses
                    SET category = :category,
                        description = :description,
                        amount = :amount,
                        payment_method = :payment_method,
                        product_id = :product_id,
                        waste_quantity = :waste_quantity
                    WHERE expense_id = :expense_id AND business_id = :business_id
                """),
                {
                    "category": new_category,
                    "description": data.get("description"),
                    "amount": data.get("amount"),
                    "payment_method": data.get("payment_method"),
                    "product_id": new_product_id if new_category == "Waste" else None,
                    "waste_quantity": new_waste_qty if new_category == "Waste" else 0,
                    "expense_id": expense_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Expense updated successfully"})

    except Exception as e:
        print("Error updating expense:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            # Get the expense details before deleting
            expense = db.execute(
                text("""
                    SELECT category, product_id, waste_quantity
                    FROM expenses
                    WHERE expense_id = :expense_id AND business_id = :business_id
                """),
                {"expense_id": expense_id, "business_id": business_id}
            ).fetchone()
            if not expense:
                return jsonify({"error": "Expense not found"}), 404

            category, product_id, waste_qty = expense
            waste_qty = Decimal(str(waste_qty or 0))

            # If it was a waste expense, add the stock back
            if category == "Waste" and product_id and waste_qty > 0:
                db.execute(
                    text("""
                        UPDATE products
                        SET product_stock = product_stock + :waste_qty
                        WHERE product_id = :product_id AND business_id = :business_id
                    """),
                    {"waste_qty": waste_qty, "product_id": product_id, "business_id": business_id}
                )

            # Delete the expense
            db.execute(
                text("DELETE FROM expenses WHERE expense_id = :expense_id AND business_id = :business_id"),
                {"expense_id": expense_id, "business_id": business_id}
            )

        return jsonify({"message": "Expense deleted and stock restored"})

    except Exception as e:
        print("Error deleting expense:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/products/<int:product_id>/soft-delete", methods=["DELETE"])
def soft_delete_product(product_id):
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            product = db.execute(
                text("""
                    SELECT product_id
                    FROM products
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                    AND deleted_at IS NULL
                """),
                {
                    "product_id": product_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not product:
                return jsonify({"error": "Product not found or already deleted"}), 404

            db.execute(
                text("""
                    UPDATE products
                    SET deleted_at = NOW()
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "product_id": product_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Product soft-deleted successfully"}), 200

    except Exception as e:
        print("Soft delete product error:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/bundles/<int:bundle_id>/soft-delete", methods=["DELETE"])
def soft_delete_bundle(bundle_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:

            bundle = db.execute(
                text("""
                    SELECT bundle_id
                    FROM product_bundles
                    WHERE bundle_id = :bundle_id
                    AND business_id = :business_id
                    AND deleted_at IS NULL
                """),
                {
                    "bundle_id": bundle_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not bundle:
                return jsonify({
                    "error": "Bundle not found or already deleted"
                }), 404

            db.execute(
                text("""
                    UPDATE product_bundles
                    SET deleted_at = NOW()
                    WHERE bundle_id = :bundle_id
                    AND business_id = :business_id
                """),
                {
                    "bundle_id": bundle_id,
                    "business_id": business_id
                }
            )

        return jsonify({
            "message": "Bundle soft-deleted successfully"
        }), 200

    except Exception as e:
        print("Soft delete bundle error:", e)
        traceback.print_exc()

        return jsonify({
            "error": str(e)
        }), 500        

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint to monitor database connection pool"""
    try:
        # Test database connection
        with get_db() as db:
            db.execute(text("SELECT 1"))
        
        pool_status = get_pool_status()
        
        return jsonify({
            "status": "healthy",
            "database": "connected",
            "pool": pool_status,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route("/add-invoice", methods=["POST"])
def add_invoice():
    data = request.json

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    customer_id = data.get("customer_id")
    issue_date = data.get("issue_date")
    due_date = data.get("due_date")
    items = data.get("items", [])
    vat = float(data.get("vat", 0) or 0)
    discount = float(data.get("discount", 0) or 0)
    notes = data.get("notes", "")
    amount_paid = float(data.get("amount_paid", 0) or 0)

    if not customer_id:
        return jsonify({"error": "Customer is required"}), 400

    if not issue_date:
        return jsonify({"error": "Issue date is required"}), 400

    if not items:
        return jsonify({"error": "At least one invoice item is required"}), 400

    try:
        subtotal = sum(
            float(item.get("quantity", 1) or 1) * float(item.get("unit_price", 0) or 0)
            for item in items
        )

        total_amount = subtotal + vat - discount

        if amount_paid < 0:
            return jsonify({"error": "Amount paid cannot be negative"}), 400

        if amount_paid > total_amount:
            return jsonify({"error": "Amount paid cannot exceed invoice total"}), 400

        balance_due = total_amount - amount_paid

        if amount_paid <= 0:
            status = "unpaid"
        elif amount_paid < total_amount:
            status = "partial"
        else:
            status = "paid"

        invoice_count = execute_query(
            """
            SELECT COUNT(*) AS count 
            FROM invoices 
            WHERE business_id = :business_id
            """,
            {"business_id": business_id},
            fetch_all=True
        )[0]["count"]

        invoice_number = f"INV-{invoice_count + 1:04d}"

        invoice_id = execute_insert(
            """
            INSERT INTO invoices (
                invoice_number, customer_id, business_id, issue_date, due_date,
                subtotal, vat, discount, total_amount, amount_paid,
                balance_due, status, notes
            )
            VALUES (
                :invoice_number, :customer_id, :business_id, :issue_date, :due_date,
                :subtotal, :vat, :discount, :total_amount, :amount_paid,
                :balance_due, :status, :notes
            )
            """,
            {
                "invoice_number": invoice_number,
                "customer_id": customer_id,
                "business_id": business_id,
                "issue_date": issue_date,
                "due_date": due_date,
                "subtotal": subtotal,
                "vat": vat,
                "discount": discount,
                "total_amount": total_amount,
                "amount_paid": amount_paid,
                "balance_due": balance_due,
                "status": status,
                "notes": notes
            }
        )

        for item in items:
            quantity = float(item.get("quantity", 1) or 1)
            unit_price = float(item.get("unit_price", 0) or 0)
            item_subtotal = quantity * unit_price

            execute_insert(
                """
                INSERT INTO invoice_items (
                    invoice_id, item_name, quantity, unit_price, subtotal, business_id
                )
                VALUES (
                    :invoice_id, :item_name, :quantity, :unit_price, :subtotal, :business_id
                )
                """,
                {
                    "invoice_id": invoice_id,
                    "item_name": item.get("item_name"),
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "subtotal": item_subtotal,
                    "business_id": business_id
                }
            )

        return jsonify({
            "message": "Invoice created successfully",
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "total_amount": total_amount,
            "amount_paid": amount_paid,
            "balance_due": balance_due,
            "status": status
        }), 201

    except Exception as e:
        print("❌ Error adding invoice:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/get-invoices", methods=["GET"])
def get_invoices():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        company = execute_query(
            """
            SELECT company, company_phone
            FROM users
            WHERE business_id = :business_id
            LIMIT 1
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        invoices = execute_query(
            """
            SELECT 
                i.*,
                c.customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.customer_id
            WHERE i.business_id = :business_id
            ORDER BY i.created_at DESC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted = []

        for invoice in invoices:
            items = execute_query(
                """
                SELECT item_name, quantity, unit_price, subtotal
                FROM invoice_items
                WHERE invoice_id = :invoice_id
                AND business_id = :business_id
                """,
                {
                    "invoice_id": invoice["invoice_id"],
                    "business_id": business_id
                },
                fetch_all=True
            )

            formatted.append({
                "invoice_id": invoice["invoice_id"],
                "invoice_number": invoice["invoice_number"],
                "customer_id": invoice["customer_id"],
                "customer_name": invoice["customer_name"],
                "issue_date": str(invoice["issue_date"]),
                "due_date": str(invoice["due_date"]) if invoice["due_date"] else "",
                "subtotal": float(invoice["subtotal"] or 0),
                "vat": float(invoice["vat"] or 0),
                "discount": float(invoice["discount"] or 0),
                "total_amount": float(invoice["total_amount"] or 0),
                "amount_paid": float(invoice["amount_paid"] or 0),
                "balance_due": float(invoice["balance_due"] or 0),
                "status": invoice["status"],
                "notes": invoice["notes"] or "",
                "items": [
                    {
                        "item_name": item["item_name"],
                        "quantity": float(item["quantity"]),
                        "unit_price": float(item["unit_price"]),
                        "subtotal": float(item["subtotal"])
                    }
                    for item in items
                ]
            })

        return jsonify({
            "company": {
                "company": company[0]["company"] if company else "",
                "company_phone": company[0]["company_phone"] if company else "",
                "company_email": "",
                "company_address": ""
            },
            "invoices": formatted
        }), 200

    except Exception as e:
        print("❌ Error fetching invoices:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/update-invoice/<int:invoice_id>", methods=["PUT"])
def update_invoice(invoice_id):
    data = request.json

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    customer_id = data.get("customer_id")
    issue_date = data.get("issue_date")
    due_date = data.get("due_date")
    items = data.get("items", [])
    vat = float(data.get("vat", 0) or 0)
    discount = float(data.get("discount", 0) or 0)
    notes = data.get("notes", "")
    amount_paid = float(data.get("amount_paid", 0) or 0)

    try:
        subtotal = sum(
            float(item.get("quantity", 1) or 1) * float(item.get("unit_price", 0) or 0)
            for item in items
        )

        total_amount = subtotal + vat - discount

        if amount_paid < 0:
            return jsonify({"error": "Amount paid cannot be negative"}), 400

        if amount_paid > total_amount:
            return jsonify({"error": "Amount paid cannot exceed invoice total"}), 400

        balance_due = total_amount - amount_paid

        if amount_paid <= 0:
            status = "unpaid"
        elif amount_paid < total_amount:
            status = "partial"
        else:
            status = "paid"

        execute_update(
            """
            UPDATE invoices
            SET customer_id = :customer_id,
                issue_date = :issue_date,
                due_date = :due_date,
                subtotal = :subtotal,
                vat = :vat,
                discount = :discount,
                total_amount = :total_amount,
                amount_paid = :amount_paid,
                balance_due = :balance_due,
                status = :status,
                notes = :notes
            WHERE invoice_id = :invoice_id
            AND business_id = :business_id
            """,
            {
                "customer_id": customer_id,
                "issue_date": issue_date,
                "due_date": due_date,
                "subtotal": subtotal,
                "vat": vat,
                "discount": discount,
                "total_amount": total_amount,
                "amount_paid": amount_paid,
                "balance_due": balance_due,
                "status": status,
                "notes": notes,
                "invoice_id": invoice_id,
                "business_id": business_id
            }
        )

        execute_update(
            """
            DELETE FROM invoice_items
            WHERE invoice_id = :invoice_id
            AND business_id = :business_id
            """,
            {
                "invoice_id": invoice_id,
                "business_id": business_id
            }
        )

        for item in items:
            quantity = float(item.get("quantity", 1) or 1)
            unit_price = float(item.get("unit_price", 0) or 0)
            item_subtotal = quantity * unit_price

            execute_insert(
                """
                INSERT INTO invoice_items (
                    invoice_id, item_name, quantity, unit_price, subtotal, business_id
                )
                VALUES (
                    :invoice_id, :item_name, :quantity, :unit_price, :subtotal, :business_id
                )
                """,
                {
                    "invoice_id": invoice_id,
                    "item_name": item.get("item_name"),
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "subtotal": item_subtotal,
                    "business_id": business_id
                }
            )

        return jsonify({
            "message": "Invoice updated successfully",
            "total_amount": total_amount,
            "amount_paid": amount_paid,
            "balance_due": balance_due,
            "status": status
        }), 200

    except Exception as e:
        print("❌ Error updating invoice:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/update-invoice-status", methods=["POST"])
def update_invoice_status():
    data = request.json

    invoice_id = data.get("invoice_id")
    status = data.get("status")

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if status not in ["unpaid", "partial", "paid", "cancelled"]:
        return jsonify({"error": "Invalid status"}), 400

    try:
        invoice = execute_query(
            """
            SELECT total_amount, amount_paid
            FROM invoices
            WHERE invoice_id = :invoice_id
            AND business_id = :business_id
            LIMIT 1
            """,
            {
                "invoice_id": invoice_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        if not invoice:
            return jsonify({"error": "Invoice not found"}), 404

        total_amount = float(invoice[0]["total_amount"] or 0)
        amount_paid = float(invoice[0]["amount_paid"] or 0)

        if status == "paid":
            amount_paid = total_amount
        elif status == "unpaid":
            amount_paid = 0

        balance_due = total_amount - amount_paid

        execute_update(
            """
            UPDATE invoices
            SET status = :status,
                amount_paid = :amount_paid,
                balance_due = :balance_due
            WHERE invoice_id = :invoice_id
            AND business_id = :business_id
            """,
            {
                "status": status,
                "amount_paid": amount_paid,
                "balance_due": balance_due,
                "invoice_id": invoice_id,
                "business_id": business_id
            }
        )

        return jsonify({"message": "Invoice status updated"}), 200

    except Exception as e:
        print("❌ Error updating invoice status:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/mark-credit-paid", methods=["POST"])
def mark_credit_paid():
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        data = request.json
        sale_id = data.get("sale_id")
        payment_type = data.get("payment_type")

        if payment_type not in ["Mpesa", "Cash", "Bank"]:
            return jsonify({"error": "Invalid payment type"}), 400

        with get_db() as db:
            result = db.execute(
                text("""
                    UPDATE sales
                    SET payment_type = :payment_type
                    WHERE sale_id = :sale_id
                    AND business_id = :business_id
                    AND payment_type = 'Credit'
                """),
                {
                    "payment_type": payment_type,
                    "sale_id": sale_id,
                    "business_id": business_id
                }
            )

            if result.rowcount == 0:
                return jsonify({"error": "Credit order not found"}), 404

        return jsonify({"message": "Credit order marked as paid"}), 200

    except Exception as e:
        print("Error marking credit paid:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@app.route("/container-inventory", methods=["GET"])
def get_container_inventory():
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        with get_db() as db:
            result = db.execute(
                text("""
                    SELECT *
                    FROM container_inventory
                    WHERE business_id = :business_id
                    ORDER BY container_id DESC
                """),
                {"business_id": business_id}
            )

            containers = [dict(row._mapping) for row in result]

        return jsonify(containers), 200

    except Exception as e:
        print("Error fetching container inventory:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500



@app.route("/container-inventory", methods=["POST"])
def add_container_inventory():
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        data = request.json

        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO container_inventory
                    (
                        business_id,
                        container_name,
                        container_type,
                        size,
                        empty_quantity,
                        filled_quantity,
                        damaged_quantity,
                        notes
                    )
                    VALUES
                    (
                        :business_id,
                        :container_name,
                        :container_type,
                        :size,
                        :empty_quantity,
                        :filled_quantity,
                        :damaged_quantity,
                        :notes
                    )
                """),
                {
                    "business_id": business_id,
                    "container_name": data.get("container_name"),
                    "container_type": data.get("container_type"),
                    "size": data.get("size"),
                    "empty_quantity": int(data.get("empty_quantity", 0)),
                    "filled_quantity": int(data.get("filled_quantity", 0)),
                    "damaged_quantity": int(data.get("damaged_quantity", 0)),
                    "notes": data.get("notes"),
                }
            )

        return jsonify({"message": "Container added successfully"}), 201

    except Exception as e:
        print("Error adding container:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@app.route("/container-inventory/<int:container_id>", methods=["PUT"])
def update_container_inventory(container_id):
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        data = request.json

        with get_db() as db:
            result = db.execute(
                text("""
                    UPDATE container_inventory
                    SET
                        container_name = :container_name,
                        container_type = :container_type,
                        size = :size,
                        empty_quantity = :empty_quantity,
                        filled_quantity = :filled_quantity,
                        damaged_quantity = :damaged_quantity,
                        notes = :notes
                    WHERE container_id = :container_id
                    AND business_id = :business_id
                """),
                {
                    "container_id": container_id,
                    "business_id": business_id,
                    "container_name": data.get("container_name"),
                    "container_type": data.get("container_type"),
                    "size": data.get("size"),
                    "empty_quantity": int(data.get("empty_quantity", 0)),
                    "filled_quantity": int(data.get("filled_quantity", 0)),
                    "damaged_quantity": int(data.get("damaged_quantity", 0)),
                    "notes": data.get("notes"),
                }
            )

            if result.rowcount == 0:
                return jsonify({"error": "Container not found"}), 404

        return jsonify({"message": "Container updated successfully"}), 200

    except Exception as e:
        print("Error updating container:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route("/container-inventory/<int:container_id>", methods=["DELETE"])
def delete_container_inventory(container_id):
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        with get_db() as db:
            result = db.execute(
                text("""
                    DELETE FROM container_inventory
                    WHERE container_id = :container_id
                    AND business_id = :business_id
                """),
                {
                    "container_id": container_id,
                    "business_id": business_id
                }
            )

            if result.rowcount == 0:
                return jsonify({"error": "Container not found"}), 404

        return jsonify({"message": "Container deleted successfully"}), 200

    except Exception as e:
        print("Error deleting container:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@app.route("/container-inventory/<int:container_id>/action", methods=["POST"])
def container_inventory_action(container_id):
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        data = request.json
        action = data.get("action")
        quantity = int(data.get("quantity", 1))

        if quantity < 1:
            return jsonify({"error": "Quantity must be at least 1"}), 400

        with get_db() as db:
            result = db.execute(
                text("""
                    SELECT *
                    FROM container_inventory
                    WHERE container_id = :container_id
                    AND business_id = :business_id
                """),
                {
                    "container_id": container_id,
                    "business_id": business_id
                }
            )

            container = result.fetchone()

            if not container:
                return jsonify({"error": "Container not found"}), 404

            container = dict(container._mapping)

            empty_qty = int(container["empty_quantity"] or 0)
            filled_qty = int(container["filled_quantity"] or 0)
            damaged_qty = int(container["damaged_quantity"] or 0)

            if action == "add_empty":
                empty_qty += quantity

            elif action == "add_filled":
                filled_qty += quantity

            elif action == "refill":
                if empty_qty < quantity:
                    return jsonify({"error": "Not enough empty containers"}), 400
                empty_qty -= quantity
                filled_qty += quantity

            elif action == "sell_filled":
                if filled_qty < quantity:
                    return jsonify({"error": "Not enough filled containers"}), 400
                filled_qty -= quantity

            elif action == "exchange":
                if filled_qty < quantity:
                    return jsonify({"error": "Not enough filled containers"}), 400
                empty_qty += quantity
                filled_qty -= quantity

            elif action == "mark_damaged":
                if empty_qty >= quantity:
                    empty_qty -= quantity
                elif filled_qty >= quantity:
                    filled_qty -= quantity
                else:
                    return jsonify({"error": "Not enough containers to mark damaged"}), 400

                damaged_qty += quantity

            else:
                return jsonify({"error": "Invalid action"}), 400

            db.execute(
                text("""
                    UPDATE container_inventory
                    SET
                        empty_quantity = :empty_quantity,
                        filled_quantity = :filled_quantity,
                        damaged_quantity = :damaged_quantity
                    WHERE container_id = :container_id
                    AND business_id = :business_id
                """),
                {
                    "empty_quantity": empty_qty,
                    "filled_quantity": filled_qty,
                    "damaged_quantity": damaged_qty,
                    "container_id": container_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Action completed successfully"}), 200

    except Exception as e:
        print("Error performing container action:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)