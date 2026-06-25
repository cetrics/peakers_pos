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
from dotenv import load_dotenv
import smtplib
import ssl
from email.message import EmailMessage
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pandas as pd
import traceback
import uuid
import requests
from io import BytesIO
from html import escape
from email.mime.application import MIMEApplication

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from db import get_db, execute_query, execute_insert, execute_update, get_pool_status
from flask import send_file
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from itsdangerous import URLSafeTimedSerializer, URLSafeSerializer
from reportlab.platypus import Flowable

app = Flask(__name__)

app.secret_key = 'your_secret_key'  # Change this to a secure key
CORS(app)

serializer = URLSafeSerializer(
    app.config["SECRET_KEY"],
    salt="invoice-link"
)

def generate_invoice_token(invoice_id, business_id):
    return serializer.dumps({
        "invoice_id": invoice_id,
        "business_id": business_id
    })

def verify_invoice_token(token):
    return serializer.loads(token)

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Email Configuration
load_dotenv()

EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 465))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

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

def send_email(to_email, subject, html_content):
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = EMAIL_USER
        msg["To"] = to_email

        msg.set_content("This email requires HTML support.")
        msg.add_alternative(html_content, subtype="html")

        context = ssl.create_default_context()

        with smtplib.SMTP_SSL(
            EMAIL_HOST,
            EMAIL_PORT,
            context=context
        ) as server:
            server.login(EMAIL_USER, EMAIL_PASSWORD)
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
    business_type = data.get("business_type", "retail").strip().lower()

    has_stk_api = 1 if data.get("has_stk_api") else 0
    stk_app_id = data.get("stk_app_id", "").strip()
    stk_api_key = data.get("stk_api_key", "").strip()
    stk_callback_url = data.get("stk_callback_url", "").strip()
    stk_error_callback_url = data.get("stk_error_callback_url", "").strip()

    if not business_name:
        return jsonify({"error": "Business name is required"}), 400

    if business_type not in ["retail", "restaurant"]:
        return jsonify({"error": "Invalid business type"}), 400

    if has_stk_api:
        if not stk_app_id or not stk_api_key:
            return jsonify({
                "error": "STK App ID and API Key are required when STK API is enabled"
            }), 400

    try:
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
                name,
                email,
                phone,
                business_type,
                subscription_plan,
                subscription_status,
                address,
                city,
                country,
                logo,
                has_stk_api,
                stk_app_id,
                stk_api_key,
                stk_callback_url,
                stk_error_callback_url,
                created_at,
                updated_at
            )
            VALUES (
                :name,
                :email,
                :phone,
                :business_type,
                :subscription_plan,
                :subscription_status,
                :address,
                :city,
                :country,
                :logo,
                :has_stk_api,
                :stk_app_id,
                :stk_api_key,
                :stk_callback_url,
                :stk_error_callback_url,
                NOW(),
                NOW()
            )
            """,
            {
                "name": business_name,
                "email": business_email,
                "phone": business_phone,
                "business_type": business_type,
                "subscription_plan": "basic",
                "subscription_status": "active",
                "address": address,
                "city": city,
                "country": country,
                "logo": "default-logo.png",
                "has_stk_api": has_stk_api,
                "stk_app_id": stk_app_id,
                "stk_api_key": stk_api_key,
                "stk_callback_url": stk_callback_url,
                "stk_error_callback_url": stk_error_callback_url,
            }
        )

        return jsonify({
            "message": "Business registered successfully",
            "business_id": business_id,
            "business_type": business_type,
            "has_stk_api": bool(has_stk_api)
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
                business_type,
                subscription_plan,
                subscription_status,
                address,
                city,
                country,

                has_stk_api,
                stk_app_id,
                stk_api_key,
                stk_callback_url,
                stk_error_callback_url

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
    business_type = data.get("business_type", "retail").strip().lower()
    subscription_plan = data.get("subscription_plan", "free").strip()
    subscription_status = data.get("subscription_status", "active").strip()

    has_stk_api = 1 if data.get("has_stk_api") else 0
    stk_app_id = data.get("stk_app_id", "").strip()
    stk_api_key = data.get("stk_api_key", "").strip()
    stk_callback_url = data.get("stk_callback_url", "").strip()
    stk_error_callback_url = data.get("stk_error_callback_url", "").strip()

    if not name:
        return jsonify({"error": "Business name is required"}), 400

    if business_type not in ["retail", "restaurant"]:
        return jsonify({"error": "Invalid business type"}), 400

    if has_stk_api and (not stk_app_id or not stk_api_key):
        return jsonify({
            "error": "STK App ID and API Key are required when STK API is enabled"
        }), 400

    try:
        existing_name = execute_query(
            """
            SELECT id
            FROM businesses
            WHERE LOWER(name) = LOWER(:name)
            AND id != :business_id
            LIMIT 1
            """,
            {"name": name, "business_id": business_id},
            fetch_all=True
        )

        if existing_name:
            return jsonify({"error": "A business with this name already exists"}), 409

        if email:
            existing_email = execute_query(
                """
                SELECT id
                FROM businesses
                WHERE LOWER(email) = LOWER(:email)
                AND id != :business_id
                LIMIT 1
                """,
                {"email": email, "business_id": business_id},
                fetch_all=True
            )

            if existing_email:
                return jsonify({"error": "Business email already exists"}), 409

        execute_update(
            """
            UPDATE businesses
            SET name = :name,
                email = :email,
                phone = :phone,
                business_type = :business_type,
                subscription_plan = :subscription_plan,
                subscription_status = :subscription_status,
                address = :address,
                city = :city,
                country = :country,
                has_stk_api = :has_stk_api,
                stk_app_id = :stk_app_id,
                stk_api_key = :stk_api_key,
                stk_callback_url = :stk_callback_url,
                stk_error_callback_url = :stk_error_callback_url,
                updated_at = NOW()
            WHERE id = :business_id
            """,
            {
                "name": name,
                "email": email,
                "phone": phone,
                "business_type": business_type,
                "subscription_plan": subscription_plan,
                "subscription_status": subscription_status,
                "address": address,
                "city": city,
                "country": country,
                "has_stk_api": has_stk_api,
                "stk_app_id": stk_app_id,
                "stk_api_key": stk_api_key,
                "stk_callback_url": stk_callback_url,
                "stk_error_callback_url": stk_error_callback_url,
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

        return jsonify({
            "message": "Business updated successfully",
            "business_type": business_type,
            "has_stk_api": bool(has_stk_api)
        }), 200

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



@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    try:
        with get_db() as conn:
            query = text("""
                SELECT 
                    u.user_id,
                    u.username,
                    u.user_password,
                    u.business_id,
                    u.role,
                    b.business_type
                FROM users u
                LEFT JOIN businesses b
                    ON u.business_id = b.id
                WHERE u.username = :username 
                OR u.user_email = :email
                LIMIT 1
            """)

            result = conn.execute(query, {
                "username": username,
                "email": username
            })

            user = result.mappings().fetchone()

            hashed_password = hashlib.sha256(password.encode()).hexdigest()

            if not user or user["user_password"] != hashed_password:
                return jsonify({
                    "success": False,
                    "error": "Invalid credentials. Please try again."
                }), 401

            session["user_id"] = user["user_id"]
            session["user"] = user["username"]
            session["username"] = user["username"]
            session["role"] = user["role"]

            if user["role"] == "super_admin":
                session.pop("business_id", None)
                session.pop("selected_business_id", None)
                session.pop("business_type", None)
                redirect_url = "/"
            else:
                session["business_id"] = user["business_id"]
                session["business_type"] = user["business_type"] or "retail"

                if session["business_type"] == "restaurant":
                    redirect_url = "/restaurant_dashboard"
                else:
                    redirect_url = "/"

            session.modified = True

            return jsonify({
                "success": True,
                "message": "Login successful",
                "redirect_url": redirect_url,
                "user_id": user["user_id"],
                "username": user["username"],
                "role": user["role"],
                "business_id": session.get("business_id"),
                "business_type": session.get("business_type", "retail")
            }), 200

    except Exception as e:
        print(f"❌ Error during login: {e}")
        return jsonify({
            "success": False,
            "error": "An error occurred during login."
        }), 500

@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    BASE_URL = "https://peakerspointofsale.co.ke"

    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    try:
        with get_db() as conn:
            query = text("SELECT * FROM users WHERE user_email = :email")
            result = conn.execute(query, {"email": email})
            user = result.mappings().fetchone()

            if not user:
                return jsonify({"error": "Email not found."}), 400

            token = generate_token(email)
            reset_link = f"{BASE_URL}/reset_password/{token}"

            email_message = f"""
            <p>Hello {user['username']},</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>This link will expire in 30 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            """

            if send_email(email, "Password Reset Request", email_message):
                return jsonify({
                    "message": "Password reset link sent to your email."
                }), 200

            return jsonify({"error": "Failed to send email."}), 500

    except Exception as e:
        print("❌ Error during forgot password:", e)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/reset-password/<token>", methods=["POST"])
def reset_password(token):
    email = verify_token(token)

    if not email:
        return jsonify({"error": "Invalid or expired token"}), 400

    data = request.get_json()
    new_password = data.get("password")

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

            return jsonify({
                "message": "Password reset successful!"
            }), 200

    except Exception as e:
        print(f"❌ Error updating password: {e}")
        return jsonify({
            "error": "Database update failed"
        }), 500

@app.route("/check-session")
def check_session():
    if "user" not in session:
        return jsonify({
            "logged_in": False
        }), 401

    business_id = session.get("business_id")

    has_stk_api = False

    if business_id:
        with get_db() as conn:
            result = conn.execute(text("""
                SELECT has_stk_api
                FROM businesses
                WHERE id = :business_id
            """), {
                "business_id": business_id
            })

            business = result.mappings().fetchone()

            if business:
                has_stk_api = bool(business["has_stk_api"])

    return jsonify({
        "logged_in": True,
        "user_id": session.get("user_id"),
        "username": session.get("username"),
        "role": session.get("role"),
        "business_id": business_id,
        "business_type": session.get("business_type", "retail"),
        "has_stk_api": has_stk_api
    }), 200


@app.route("/api/stk-push", methods=["POST"])
def stk_push():
    try:
        business_id = get_business_id()
        data = request.get_json()

        print("STK DATA RECEIVED:", data)
        print("BUSINESS ID:", business_id)

        phone = data.get("phoneNumber")
        amount = data.get("amount")

        if not phone:
            return jsonify({"error": "Phone number is required"}), 400

        if not amount:
            return jsonify({"error": "Amount is required"}), 400

        with get_db() as conn:
            business = conn.execute(text("""
                SELECT has_stk_api, stk_app_id, stk_api_key,
                       stk_callback_url, stk_error_callback_url
                FROM businesses
                WHERE id = :business_id
            """), {"business_id": business_id}).mappings().fetchone()

        print("BUSINESS STK CONFIG:", business)

        if not business:
            return jsonify({"error": "Business not found"}), 404

        if not business["has_stk_api"]:
            return jsonify({"error": "STK Push is not enabled for this business"}), 400

        payload = {
            "phoneNumber": phone,
            "amount": str(amount),
            "reference": str(uuid.uuid4())[:12],
            "countryCode": "KE",
            "telco": "SAFARICOM",
            "narration": "POS Payment",
            "callBackUrl": business["stk_callback_url"],
            "errorCallBackUrl": business["stk_error_callback_url"],
        }

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-app-id": business["stk_app_id"],
            "x-api-key": business["stk_api_key"],
        }

        print("STK PAYLOAD:", payload)
        print("STK HEADERS:", {
            "Accept": headers["Accept"],
            "Content-Type": headers["Content-Type"],
            "x-app-id": headers["x-app-id"],
            "x-api-key": "HIDDEN"
        })

        response = requests.post(
            "https://sandboxkonnectapi.creditbank.co.ke/safaricom-stkpush",
            json=payload,
            headers=headers,
            timeout=30
        )

        print("CREDIT BANK STATUS:", response.status_code)
        print("CREDIT BANK RESPONSE:", response.text)

        try:
            response_data = response.json()
        except Exception:
            response_data = {"raw_response": response.text}

        if response.status_code >= 500:
           return jsonify(response_data), 400    

        return jsonify(response_data), response.status_code

    except Exception as e:
        print("❌ STK PUSH ERROR:", e)
        return jsonify({"error": str(e)}), 500



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
                 AND business_id = :business_id) AS current_month_sales,
(SELECT monthly_target FROM businesses WHERE id = :business_id) AS monthly_target
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
                "monthly_target": float(metrics['monthly_target']) if metrics['monthly_target'] else 500000.0,
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
    per_page = 1000
    offset = (page - 1) * per_page

    include_deleted = (
        request.args.get("include_deleted", "false").lower() == "true"
    )

    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        count_where_clause = "WHERE business_id = :business_id"

        if not include_deleted:
            count_where_clause += " AND deleted_at IS NULL"

        products_where_clause = "WHERE p.business_id = :business_id"

        if not include_deleted:
            products_where_clause += " AND p.deleted_at IS NULL"

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
                p.reorder_threshold,
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
                p.reorder_threshold,
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
                "reorder_threshold": float(row["reorder_threshold"] or 0),
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
        data = request.json or {}

        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        buying_price = data.get("buying_price", 0)
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")
        unit = data.get("unit")
        expiry_date = data.get("expiry_date") or None
        reorder_threshold = data.get("reorder_threshold", 2)
        ingredients = data.get("ingredients")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if (
            product_number in [None, ""] or
            product_name in [None, ""] or
            product_price in [None, ""] or
            category_id_fk in [None, ""]
        ):
            return jsonify({"error": "All fields except description are required"}), 400

        product_price = Decimal(str(product_price or 0))
        buying_price = Decimal(str(buying_price or 0))

        if product_price < 0:
            return jsonify({"error": "Selling price cannot be negative"}), 400

        if buying_price < 0:
            return jsonify({"error": "Buying price cannot be negative"}), 400

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        product_stock = 0

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

        if ingredients and isinstance(ingredients, list):
            for material_id in ingredients:
                execute_insert(
                    """
                    INSERT INTO product_recipes (product_id, material_id, quantity)
                    VALUES (:product_id, :material_id, 0)
                    """,
                    {
                        "product_id": product_id,
                        "material_id": material_id
                    }
                )

        return jsonify({
            "message": "Product added successfully",
            "product": {
                "product_id": product_id,
                "product_number": product_number,
                "product_name": product_name,
                "product_price": float(product_price),
                "buying_price": float(buying_price),
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
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

def send_low_stock_email_if_needed(product_id, business_id):
    try:
        with get_db() as db:
            product = db.execute(text("""
                SELECT 
                    p.product_id,
                    p.product_name,
                    p.product_number,
                    p.product_stock,
                    p.reorder_threshold,
                    p.low_stock_notified,
                    b.name AS business_name,
                    b.email AS business_email,
                    b.phone AS business_phone
                FROM products p
                JOIN businesses b ON p.business_id = b.id
                WHERE p.product_id = :product_id
                AND p.business_id = :business_id
                AND p.deleted_at IS NULL
                LIMIT 1
            """), {
                "product_id": product_id,
                "business_id": business_id
            }).mappings().fetchone()

            if not product:
                return

            stock = float(product["product_stock"] or 0)
            threshold = float(product["reorder_threshold"] or 0)
            already_notified = int(product["low_stock_notified"] or 0)

            if threshold <= 0:
                return

            if already_notified == 1:
                return

            if stock > threshold:
                return

            if not product["business_email"]:
                print("Low stock email skipped: business has no email.")
                return

            email_host = os.getenv("EMAIL_HOST")
            email_port = int(os.getenv("EMAIL_PORT", 465))
            email_user = os.getenv("EMAIL_USER")
            email_password = os.getenv("EMAIL_PASSWORD")

            if not email_host or not email_user or not email_password:
                print("Low stock email skipped: email settings missing.")
                return

            subject = f"⚠ Low Stock Alert - {product['product_name']}"

            html_body = f"""
            <html>
              <body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:20px;color:#333;">
                <div style="max-width:650px;margin:auto;background:#ffffff;padding:25px;border-radius:12px;">
                  <h2 style="color:#dc2626;margin-top:0;">⚠ Low Stock Alert</h2>

                  <p>Hello <strong>{product['business_name']}</strong>,</p>

                  <p>
                    The following product has reached or gone below its reorder threshold.
                  </p>

                  <div style="background:#fff7ed;border:1px solid #fed7aa;padding:18px;border-radius:10px;margin:20px 0;">
                    <p><strong>Product:</strong> {product['product_name']}</p>
                    <p><strong>Product Number:</strong> {product['product_number'] or 'N/A'}</p>
                    <p><strong>Current Stock:</strong> 
                      <span style="color:#dc2626;font-weight:bold;">{stock}</span>
                    </p>
                    <p><strong>Reorder Threshold:</strong> {threshold}</p>
                  </div>

                  <p>
                    Please restock this item to avoid running out of stock.
                  </p>

                  <p style="margin-top:25px;">
                    Thank you,<br>
                    <strong>Peakers POS</strong>
                  </p>
                </div>
              </body>
            </html>
            """

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = email_user
            msg["To"] = product["business_email"]
            msg.attach(MIMEText(html_body, "html"))

            print("=" * 50)
            print("LOW STOCK EMAIL DEBUG")
            print("LOW STOCK EMAIL TO:", product["business_email"])
            print("LOW STOCK EMAIL FROM:", email_user)
            print("LOW STOCK SMTP:", email_host, email_port)
            print("PRODUCT:", product["product_name"])
            print("STOCK:", stock)
            print("THRESHOLD:", threshold)
            print("=" * 50)


            with smtplib.SMTP_SSL(email_host, email_port) as server:
                server.login(email_user, email_password)
                server.send_message(msg)

            db.execute(text("""
                UPDATE products
                SET low_stock_notified = 1
                WHERE product_id = :product_id
                AND business_id = :business_id
            """), {
                "product_id": product_id,
                "business_id": business_id
            })

            db.commit()

            print(f"Low stock email sent for product ID {product_id}")

    except Exception as e:
        print("Low stock email error:", e)
        traceback.print_exc()


def reset_low_stock_notification_if_restocked(product_id, business_id):
    try:
        with get_db() as db:
            db.execute(text("""
                UPDATE products
                SET low_stock_notified = 0
                WHERE product_id = :product_id
                AND business_id = :business_id
                AND product_stock > reorder_threshold
            """), {
                "product_id": product_id,
                "business_id": business_id
            })

            db.commit()

    except Exception as e:
        print("Reset low stock notification error:", e)

@app.route("/product-by-barcode/<barcode>", methods=["GET"])
def product_by_barcode(barcode):
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        product = execute_query(
            """
            SELECT *
            FROM products
            WHERE product_number = :barcode
            AND business_id = :business_id
            AND deleted_at IS NULL
            LIMIT 1
            """,
            {
                "barcode": barcode,
                "business_id": business_id,
            },
            fetch_all=True,
        )

        if not product:
            return jsonify({"error": "Product not found for this business"}), 404

        return jsonify(product[0]), 200

    except Exception as e:
        print("Barcode scan error:", e)
        traceback.print_exc()
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
        data = request.json or {}

        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        buying_price = data.get("buying_price", 0)
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")
        unit = data.get("unit")
        expiry_date = data.get("expiry_date") or None
        reorder_threshold = data.get("reorder_threshold", 2)
        ingredients = data.get("ingredients")

        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        if (
            product_number in [None, ""] or
            product_name in [None, ""] or
            product_price in [None, ""] or
            category_id_fk in [None, ""]
        ):
            return jsonify({"error": "Missing required fields"}), 400

        product_price = Decimal(str(product_price or 0))
        buying_price = Decimal(str(buying_price or 0))

        if product_price < 0:
            return jsonify({"error": "Selling price cannot be negative"}), 400

        if buying_price < 0:
            return jsonify({"error": "Buying price cannot be negative"}), 400

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
                buying_price = :buying_price,
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
            "buying_price": buying_price,
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
        traceback.print_exc()
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
            supplier_check = db.execute(text("""
                SELECT supplier_id
                FROM suppliers
                WHERE supplier_id = :supplier_id
                AND business_id = :business_id
            """), {
                "supplier_id": supplier_id,
                "business_id": business_id
            }).fetchone()

            if not supplier_check:
                return jsonify({"error": "Supplier not found or access denied"}), 404

            product_check = db.execute(text("""
                SELECT product_id
                FROM products
                WHERE product_id = :product_id
                AND business_id = :business_id
                FOR UPDATE
            """), {
                "product_id": product_id,
                "business_id": business_id
            }).fetchone()

            if not product_check:
                return jsonify({"error": "Product not found or access denied"}), 404

            recipes = db.execute(text("""
                SELECT material_id, quantity
                FROM product_recipes
                WHERE product_id = :product_id
            """), {
                "product_id": product_id
            }).fetchall()

            if recipes:
                for material_id, material_qty_per_unit in recipes:
                    material_qty_per_unit = Decimal(str(material_qty_per_unit or 0))
                    total_needed = material_qty_per_unit * stock_supplied
                    remaining = total_needed

                    supplies = db.execute(text("""
                        SELECT supply_id, quantity
                        FROM material_supplies
                        WHERE material_id = :material_id
                        AND quantity > 0
                        AND business_id = :business_id
                        ORDER BY supply_date ASC
                        FOR UPDATE
                    """), {
                        "material_id": material_id,
                        "business_id": business_id
                    }).fetchall()

                    for supply_id, available_qty in supplies:
                        available_qty = Decimal(str(available_qty or 0))
                        deduct = min(available_qty, remaining)
                        remaining -= deduct

                        if remaining <= 0:
                            break

                    if remaining > 0:
                        material = db.execute(text("""
                            SELECT material_name
                            FROM raw_materials
                            WHERE material_id = :material_id
                            AND business_id = :business_id
                        """), {
                            "material_id": material_id,
                            "business_id": business_id
                        }).fetchone()

                        material_name = material[0] if material else "material"

                        return jsonify({
                            "error": f"❌ Insufficient {material_name}. Short by {float(remaining)} units"
                        }), 400

            db.execute(text("""
                INSERT INTO supplier_products
                (supplier_id, product_id, stock_supplied, price, supply_date, business_id)
                VALUES (:supplier_id, :product_id, :stock_supplied, :price, :supply_date, :business_id)
            """), {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "stock_supplied": stock_supplied,
                "price": price,
                "supply_date": supply_date,
                "business_id": business_id
            })

            db.execute(text("""
                UPDATE products
                SET 
                    product_stock = product_stock + :stock_supplied,
                    low_stock_notified = CASE
                        WHEN (product_stock + :stock_supplied) > reorder_threshold THEN 0
                        ELSE low_stock_notified
                    END
                WHERE product_id = :product_id
                AND business_id = :business_id
            """), {
                "stock_supplied": stock_supplied,
                "product_id": product_id,
                "business_id": business_id
            })

            for material_id, material_qty_per_unit in recipes:
                material_qty_per_unit = Decimal(str(material_qty_per_unit or 0))
                total_needed = material_qty_per_unit * stock_supplied
                remaining = total_needed

                supplies = db.execute(text("""
                    SELECT supply_id, quantity
                    FROM material_supplies
                    WHERE material_id = :material_id
                    AND quantity > 0
                    AND business_id = :business_id
                    ORDER BY supply_date ASC
                    FOR UPDATE
                """), {
                    "material_id": material_id,
                    "business_id": business_id
                }).fetchall()

                for supply_id, available_qty in supplies:
                    if remaining <= 0:
                        break

                    available_qty = Decimal(str(available_qty or 0))
                    deduct = min(available_qty, remaining)

                    db.execute(text("""
                        UPDATE material_supplies
                        SET quantity = quantity - :deduct
                        WHERE supply_id = :supply_id
                    """), {
                        "deduct": deduct,
                        "supply_id": supply_id
                    })

                    remaining -= deduct

        return jsonify({
            "message": "✅ Supply added successfully. Buying price was not changed.",
            "product_id": product_id,
            "stock_added": float(stock_supplied),
            "price_per_unit": round(float(price_per_unit), 2)
        }), 201

    except Exception as e:
        print("Error:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal Server Error"}), 500


@app.route("/supplier-products/<int:supplier_id>/<int:supplier_product_id>", methods=["DELETE"])
def delete_supplier_product(supplier_id, supplier_product_id):
    try:
        business_id = get_business_id()
        if not business_id:
            return jsonify({"error": "Business ID not found"}), 401

        with get_db() as db:
            supply = db.execute(
                text("""
                    SELECT 
                        sp.supplier_product_id,
                        sp.product_id,
                        sp.stock_supplied,
                        p.product_stock,
                        p.product_name
                    FROM supplier_products sp
                    JOIN suppliers s ON sp.supplier_id = s.supplier_id
                    JOIN products p ON sp.product_id = p.product_id
                    WHERE sp.supplier_product_id = :supplier_product_id
                    AND sp.supplier_id = :supplier_id
                    AND sp.business_id = :business_id
                    AND s.business_id = :business_id
                    AND p.business_id = :business_id
                    FOR UPDATE
                """),
                {
                    "supplier_product_id": supplier_product_id,
                    "supplier_id": supplier_id,
                    "business_id": business_id
                }
            ).mappings().fetchone()

            if not supply:
                return jsonify({"error": "Supplier product not found or access denied"}), 404

            stock_supplied = Decimal(str(supply["stock_supplied"] or 0))
            current_stock = Decimal(str(supply["product_stock"] or 0))

            if current_stock < stock_supplied:
                return jsonify({
                    "error": (
                        f"Cannot delete this supply. "
                        f"{supply['product_name']} has only {float(current_stock)} in stock, "
                        f"but {float(stock_supplied)} needs to be deducted."
                    )
                }), 400

            db.execute(
                text("""
                    UPDATE products
                    SET product_stock = product_stock - :stock_supplied
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "stock_supplied": stock_supplied,
                    "product_id": supply["product_id"],
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    DELETE FROM supplier_products
                    WHERE supplier_product_id = :supplier_product_id
                    AND supplier_id = :supplier_id
                    AND business_id = :business_id
                """),
                {
                    "supplier_product_id": supplier_product_id,
                    "supplier_id": supplier_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Supplier product deleted and stock deducted successfully"}), 200

    except Exception as e:
        print("Error deleting supplier product:", e)
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
        amount = Decimal(str(data.get("amount") or 0))
        payment_method = data.get("payment_method")
        reference = data.get("reference")
        user_id = session.get("user_id")
        if not user_id:
           return jsonify({"error": "User session expired. Please login again."}), 401
        payment_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        expense_date = datetime.now().date()

        if not supplier_id:
            return jsonify({"error": "Supplier is required"}), 400

        if not supplier_product_id:
            return jsonify({"error": "Supplier product is required"}), 400

        if amount <= 0:
            return jsonify({"error": "Payment amount must be greater than 0"}), 400

        supplier_check = """
            SELECT supplier_id, supplier_name
            FROM suppliers
            WHERE supplier_id = :supplier_id
            AND business_id = :business_id
        """

        supplier_result = execute_query(
            supplier_check,
            {
                "supplier_id": supplier_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        if not supplier_result:
            return jsonify({"error": "Supplier not found or access denied"}), 404

        supplier_name = supplier_result[0]["supplier_name"]

        product_check = """
            SELECT 
                sp.price,
                sp.supplier_product_id,
                sp.stock_supplied,
                p.product_name
            FROM supplier_products sp
            JOIN suppliers s 
                ON sp.supplier_id = s.supplier_id
            JOIN products p 
                ON sp.product_id = p.product_id
            WHERE sp.supplier_product_id = :supplier_product_id
            AND sp.supplier_id = :supplier_id
            AND sp.business_id = :business_id
            AND s.business_id = :business_id
            AND p.business_id = :business_id
        """

        product_result = execute_query(
            product_check,
            {
                "supplier_product_id": supplier_product_id,
                "supplier_id": supplier_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        if not product_result:
            return jsonify({"error": "Supplier product not found or access denied."}), 404

        product_price = Decimal(str(product_result[0]["price"] or 0))
        product_name = product_result[0]["product_name"]

        paid_query = """
            SELECT COALESCE(SUM(amount), 0) AS total_paid
            FROM supplier_payments
            WHERE supplier_product_id = :supplier_product_id
            AND supplier_id = :supplier_id
            AND business_id = :business_id
        """

        paid_result = execute_query(
            paid_query,
            {
                "supplier_product_id": supplier_product_id,
                "supplier_id": supplier_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        total_paid = Decimal(str(paid_result[0]["total_paid"] or 0)) if paid_result else Decimal(0)
        balance_before_payment = product_price - total_paid

        if amount > balance_before_payment:
            return jsonify({
                "error": f"Payment exceeds balance. Balance is KES {float(balance_before_payment)}"
            }), 400

        execute_insert("""
            INSERT INTO supplier_payments (
                supplier_id,
                supplier_product_id,
                amount,
                payment_date,
                payment_method,
                reference,
                business_id
            )
            VALUES (
                :supplier_id,
                :supplier_product_id,
                :amount,
                :payment_date,
                :payment_method,
                :reference,
                :business_id
            )
        """, {
            "supplier_id": supplier_id,
            "supplier_product_id": supplier_product_id,
            "amount": amount,
            "payment_date": payment_date,
            "payment_method": payment_method,
            "reference": reference,
            "business_id": business_id
        })

        execute_insert("""
            INSERT INTO expenses (
                user_id,
                category,
                description,
                amount,
                payment_method,
                expense_date,
                business_id,
                product_id,
                waste_quantity
            )
            VALUES (
                :user_id,
                :category,
                :description,
                :amount,
                :payment_method,
                :expense_date,
                :business_id,
                :product_id,
                :waste_quantity
            )
        """, {
            "user_id": user_id,
            "category": "Supplier Payment",
            "description": f"Supplier payment to {supplier_name} for {product_name}",
            "amount": amount,
            "payment_method": payment_method,
            "expense_date": expense_date,
            "business_id": business_id,
            "product_id": None,
            "waste_quantity": 0
        })

        new_total_paid = total_paid + amount
        balance_remaining = product_price - new_total_paid

        return jsonify({
            "message": "Payment recorded successfully and added to expenses!",
            "balance_remaining": float(balance_remaining)
        }), 201

    except Exception as e:
        print("Error:", str(e))
        traceback.print_exc()
        return jsonify({
            "error": "Failed to record payment.",
            "details": str(e)
        }), 500

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

        with get_db() as db:
            existing = db.execute(
                text("""
                    SELECT 
                        sp.stock_supplied,
                        sp.product_id,
                        p.product_stock
                    FROM supplier_products sp
                    JOIN products p ON sp.product_id = p.product_id
                    WHERE sp.supplier_product_id = :supplier_product_id
                    AND sp.business_id = :business_id
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
            product_id = existing[1]
            current_stock = Decimal(str(existing[2] or 0))

            stock_difference = new_stock_supplied - old_stock_supplied
            new_total_stock = current_stock + stock_difference

            if new_total_stock < 0:
                return jsonify({
                    "error": "Cannot reduce stock below current available stock"
                }), 400

            db.execute(
                text("""
                    UPDATE supplier_products 
                    SET stock_supplied = :stock_supplied,
                        price = :price,
                        supply_date = :supply_date 
                    WHERE supplier_product_id = :supplier_product_id
                    AND business_id = :business_id
                """),
                {
                    "stock_supplied": new_stock_supplied,
                    "price": new_price,
                    "supply_date": new_supply_date,
                    "supplier_product_id": supplier_product_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE products 
                    SET 
                        product_stock = :new_total_stock,
                        low_stock_notified = CASE
                            WHEN :new_total_stock > reorder_threshold THEN 0
                            ELSE low_stock_notified
                        END
                    WHERE product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "new_total_stock": new_total_stock,
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
                    )
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

                for material_id, quantity, material_name in recipes:
                    quantity_per_product = Decimal(str(quantity or 0))
                    total_adjustment = quantity_per_product * material_adjustment

                    if stock_difference > 0:
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
                            {
                                "material_id": material_id,
                                "business_id": business_id
                            }
                        ).fetchall()

                        remaining = total_adjustment

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
                                {
                                    "deduct": deduct,
                                    "supply_id": supply_id
                                }
                            )

                            remaining -= deduct

                        if remaining > 0:
                            return jsonify({
                                "error": f"Insufficient {material_name} short by {float(remaining)} units"
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
            "message": "Supplier product updated successfully. Buying price was not changed.",
            "stock_adjusted": float(stock_difference),
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
    user_id = data.get("user_id")

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not cart_items or payment_type not in ["Mpesa", "Cash", "Bank", "Credit"]:
        return jsonify({"error": "Invalid request"}), 400

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    try:
        with get_db() as db:
            total_amount = sum(float(item["subtotal"]) for item in cart_items)
            final_total = total_amount + vat - discount
            order_number = generate_order_number()

            result = db.execute(
                text("""
                    INSERT INTO sales (
                        customer_id, total_price, payment_type, vat, discount,
                        status, order_number, business_id, user_id
                    )
                    VALUES (
                        :customer_id, :total_price, :payment_type, :vat, :discount,
                        :status, :order_number, :business_id, :user_id
                    )
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
                    "user_id": user_id,
                }
            )

            sale_id = result.lastrowid
            discount_ratio = discount / total_amount if total_amount > 0 else 0
            affected_product_ids = set()

            for item in cart_items:
                product_id = item["product_id"]
                quantity = float(item["quantity"])
                subtotal = float(item["subtotal"])
                item_discount = subtotal * discount_ratio

                if isinstance(product_id, str) and product_id.startswith("bundle-"):
                    bundle_id = int(product_id.replace("bundle-", ""))

                    bundle_result = db.execute(
                        text("""
                            SELECT pb.bundle_buying_price
                            FROM product_bundles pb
                            JOIN products p ON pb.child_product_id = p.product_id
                            WHERE pb.bundle_id = :bundle_id
                            AND p.business_id = :business_id
                            LIMIT 1
                        """),
                        {
                            "bundle_id": bundle_id,
                            "business_id": business_id
                        }
                    ).fetchone()

                    bundle_buying_price = float(bundle_result[0]) if bundle_result else 0

                    cost = quantity * bundle_buying_price
                    profit = subtotal - cost - item_discount

                    bundle_items = db.execute(
                        text("""
                            SELECT
                                pb.child_product_id,
                                pb.quantity,
                                p.product_stock
                            FROM product_bundles pb
                            JOIN products p
                                ON pb.child_product_id = p.product_id
                                AND p.business_id = :business_id
                            WHERE pb.bundle_id = :bundle_id
                            FOR UPDATE
                        """),
                        {
                            "business_id": business_id,
                            "bundle_id": bundle_id
                        }
                    ).fetchall()

                    if not bundle_items:
                        return jsonify({"error": "Invalid bundle"}), 400

                    max_bundles = min(
                        float(item_stock) / float(child_qty)
                        for (_, child_qty, item_stock) in bundle_items
                    )

                    if max_bundles < quantity:
                        return jsonify({"error": "Insufficient stock for bundle"}), 400

                    db.execute(
                        text("""
                            INSERT INTO sales_items (
                                sale_id, product_id, bundle_id, quantity,
                                subtotal, buying_price, profit, business_id
                            )
                            VALUES (
                                :sale_id, NULL, :bundle_id, :quantity,
                                :subtotal, :buying_price, :profit, :business_id
                            )
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

                    for child_id, child_qty, _ in bundle_items:
                        db.execute(
                            text("""
                                UPDATE products
                                SET product_stock = product_stock - :deduct_qty
                                WHERE product_id = :product_id
                                AND business_id = :business_id
                            """),
                            {
                                "deduct_qty": float(child_qty) * quantity,
                                "product_id": child_id,
                                "business_id": business_id
                            }
                        )
                        affected_product_ids.add(product_id)

                else:
                    product = db.execute(
                        text("""
                            SELECT product_stock, buying_price
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

                    if not product or float(product[0]) < quantity:
                        return jsonify({
                            "error": "INSUFFICIENT_STOCK",
                            "message": f"Only {product[0] if product else 0} item(s) left in stock",
                            "product_id": product_id,
                            "requested": quantity,
                            "available": product[0] if product else 0
                        }), 400

                    buying_price = float(product[1]) if product[1] else 0

                    cost = quantity * buying_price
                    profit = subtotal - cost - item_discount

                    db.execute(
                        text("""
                            INSERT INTO sales_items (
                                sale_id, product_id, bundle_id, quantity,
                                subtotal, buying_price, profit, business_id
                            )
                            VALUES (
                                :sale_id, :product_id, NULL, :quantity,
                                :subtotal, :buying_price, :profit, :business_id
                            )
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

                    db.execute(
                        text("""
                            UPDATE products
                            SET product_stock = product_stock - :quantity
                            WHERE product_id = :product_id
                            AND business_id = :business_id
                        """),
                        {
                            "quantity": quantity,
                            "product_id": product_id,
                            "business_id": business_id
                        }
                    )
                    affected_product_ids.add(product_id)
        for affected_product_id in affected_product_ids:
            send_low_stock_email_if_needed(affected_product_id, business_id)             

        return jsonify({
            "message": "Sale processed successfully",
            "order_number": order_number
        }), 201

    except Exception as e:
        print("❌ ERROR in process_sale:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"})
        
@app.route("/get-sales-products", methods=["GET"])
def get_sales_products():
    page = request.args.get("page", 1, type=int)
    per_page = 20000
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

            product_count = db.execute(
                text("""
                    SELECT COUNT(*) AS total_products
                    FROM supplier_products
                    WHERE supplier_id = :supplier_id
                    AND business_id = :business_id
                """),
                {
                    "supplier_id": supplier_id,
                    "business_id": business_id
                }
            ).scalar()

            if product_count > 0:
                return jsonify({
                    "error": (
                        f"This supplier cannot be deleted because they still have "
                        f"{product_count} supplied product(s). Delete all supplier products first."
                    )
                }), 400

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
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        customers_query = """
            SELECT
                customer_id,
                customer_name,
                phone,
                email,
                address
            FROM customers
            WHERE business_id = :business_id
            ORDER BY customer_name ASC
        """

        customers = execute_query(
            customers_query,
            {"business_id": business_id},
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

        response = jsonify({
            "customers": formatted_customers
        })

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
            """
            SELECT
                name,
                phone,
                email,
                address,
                city,
                country,
                logo
            FROM businesses
            WHERE id = :business_id
            LIMIT 1
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        if not company_details:
            return jsonify({"error": "No company details found"}), 404

        business = company_details[0]

        return jsonify({
            "company": business["name"] or "",
            "company_phone": business["phone"] or "",
            "company_email": business["email"] or "",
            "company_address": business["address"] or "",
            "company_city": business["city"] or "",
            "company_country": business["country"] or "",
            "company_logo": business["logo"] or "",
        }), 200

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
            sale = db.execute(
                text("""
                    SELECT status 
                    FROM sales 
                    WHERE sale_id = :sale_id 
                    AND business_id = :business_id 
                    FOR UPDATE
                """),
                {"sale_id": sale_id, "business_id": business_id}
            ).fetchone()

            if not sale:
                return jsonify({"error": "Sale not found or access denied"}), 404

            current_status = sale[0]

            entering_completed = current_status != "completed" and new_status == "completed"
            leaving_completed = current_status == "completed" and new_status != "completed"

            if entering_completed or leaving_completed:
                direction = -1 if entering_completed else 1

                items = db.execute(
                    text("""
                        SELECT product_id, bundle_id, quantity
                        FROM sales_items
                        WHERE sale_id = :sale_id 
                        AND business_id = :business_id
                        FOR UPDATE
                    """),
                    {"sale_id": sale_id, "business_id": business_id}
                ).fetchall()

                changed_product_ids = set()

                for item in items:
                    product_id = item[0]
                    bundle_id = item[1]
                    sale_qty = item[2]

                    if bundle_id:
                        bundle_items = db.execute(
                            text("""
                                SELECT pb.child_product_id, pb.quantity
                                FROM product_bundles pb
                                JOIN products p 
                                    ON pb.child_product_id = p.product_id
                                WHERE pb.bundle_id = :bundle_id 
                                AND p.business_id = :business_id
                                FOR UPDATE
                            """),
                            {
                                "bundle_id": bundle_id,
                                "business_id": business_id
                            }
                        ).fetchall()

                        for b in bundle_items:
                            child_product_id = b[0]
                            child_qty = b[1]
                            stock_change = direction * sale_qty * child_qty

                            db.execute(
                                text("""
                                    UPDATE products
                                    SET 
                                        product_stock = product_stock + :stock_change,
                                        low_stock_notified = CASE
                                            WHEN product_stock + :stock_change > reorder_threshold THEN 0
                                            ELSE low_stock_notified
                                        END
                                    WHERE product_id = :product_id 
                                    AND business_id = :business_id
                                """),
                                {
                                    "stock_change": stock_change,
                                    "product_id": child_product_id,
                                    "business_id": business_id
                                }
                            )

                            changed_product_ids.add(child_product_id)

                    else:
                        stock_change = direction * sale_qty

                        db.execute(
                            text("""
                                UPDATE products
                                SET 
                                    product_stock = product_stock + :stock_change,
                                    low_stock_notified = CASE
                                        WHEN product_stock + :stock_change > reorder_threshold THEN 0
                                        ELSE low_stock_notified
                                    END
                                WHERE product_id = :product_id 
                                AND business_id = :business_id
                            """),
                            {
                                "stock_change": stock_change,
                                "product_id": product_id,
                                "business_id": business_id
                            }
                        )

                        changed_product_ids.add(product_id)

                if entering_completed:
                    for product_id in changed_product_ids:
                        send_low_stock_email_if_needed(product_id, business_id)

            db.execute(
                text("""
                    UPDATE sales 
                    SET status = :status 
                    WHERE sale_id = :sale_id 
                    AND business_id = :business_id
                """),
                {
                    "status": new_status,
                    "sale_id": sale_id,
                    "business_id": business_id
                }
            )

            db.commit()

        return jsonify({"success": True}), 200

    except Exception as e:
        print("❌ update_order_status error:", e)
        traceback.print_exc()
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
    linked_invoices = data.get("linked_invoices", [])
    vat = float(data.get("vat", 0) or 0)
    discount = float(data.get("discount", 0) or 0)
    notes = data.get("notes", "")
    amount_paid = float(data.get("amount_paid", 0) or 0)
    user_id = data.get("user_id") or session.get("user_id")

    if not customer_id:
        return jsonify({"error": "Customer is required"}), 400

    if not issue_date:
        return jsonify({"error": "Issue date is required"}), 400

    if not items:
        return jsonify({"error": "At least one invoice item is required"}), 400

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    try:
        with get_db() as db:
            # 1. Validate stock first
            for item in items:
                product_id = item.get("product_id")
                quantity = float(item.get("quantity", 1) or 1)

                if not product_id:
                    return jsonify({"error": "Please select a product"}), 400

                product = db.execute(
                    text("""
                        SELECT product_name, product_stock, buying_price
                        FROM products
                        WHERE product_id = :product_id
                        AND business_id = :business_id
                        AND deleted_at IS NULL
                        FOR UPDATE
                    """),
                    {
                        "product_id": product_id,
                        "business_id": business_id
                    }
                ).fetchone()

                if not product:
                    return jsonify({"error": "Selected product not found"}), 404

                available_stock = float(product[1] or 0)

                if quantity > available_stock:
                    return jsonify({
                        "error": f"Only {available_stock} available for {product[0]}"
                    }), 400

            # 2. Calculate current invoice items subtotal
            subtotal = sum(
                float(item.get("quantity", 1) or 1) *
                float(item.get("unit_price", 0) or 0)
                for item in items
            )

            # 3. Get previous pending invoices total
            previous_balance_total = 0
            linked_invoice_rows = []

            if linked_invoices:
                clean_invoice_ids = []

                for invoice_id in linked_invoices:
                    try:
                        clean_invoice_ids.append(int(invoice_id))
                    except:
                        pass

                if clean_invoice_ids:
                    placeholders = ",".join([str(i) for i in clean_invoice_ids])

                    linked_invoice_rows = db.execute(
                        text(f"""
                            SELECT invoice_id, invoice_number, balance_due
                            FROM invoices
                            WHERE invoice_id IN ({placeholders})
                            AND customer_id = :customer_id
                            AND business_id = :business_id
                            AND balance_due > 0
                            AND status IN ('partial', 'unpaid')
                        """),
                        {
                            "customer_id": customer_id,
                            "business_id": business_id
                        }
                    ).mappings().all()

                    previous_balance_total = sum(
                        float(invoice["balance_due"] or 0)
                        for invoice in linked_invoice_rows
                    )

            # Invoice total includes previous balance
            total_amount = subtotal + previous_balance_total + vat - discount

            # Sale total should only be current products, NOT previous balance
            sale_total = subtotal + vat - discount

            if amount_paid < 0:
                return jsonify({"error": "Amount paid cannot be negative"}), 400

            if amount_paid > total_amount:
                return jsonify({"error": "Amount paid cannot exceed invoice total"}), 400

            balance_due = total_amount - amount_paid

            if amount_paid <= 0:
                invoice_status = "unpaid"
            elif amount_paid < total_amount:
                invoice_status = "partial"
            else:
                invoice_status = "paid"

            sale_payment_type = "Credit" if balance_due > 0 else "Cash"

            # 4. Generate invoice number
            invoice_count = db.execute(
                text("""
                    SELECT COUNT(*) AS count
                    FROM invoices
                    WHERE business_id = :business_id
                """),
                {"business_id": business_id}
            ).mappings().first()["count"]

            invoice_number = f"INV-{invoice_count + 1:04d}"

            # 5. Add linked invoice note
            if linked_invoice_rows:
                linked_note = "\n\nIncluded previous pending invoices:\n"
                linked_note += "\n".join([
                    f"- {invoice['invoice_number']} balance KES {float(invoice['balance_due'] or 0):,.2f}"
                    for invoice in linked_invoice_rows
                ])
                notes = f"{notes}{linked_note}"

            # 6. Create invoice
            invoice_result = db.execute(
                text("""
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
                """),
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
                    "status": invoice_status,
                    "notes": notes
                }
            )

            invoice_id = invoice_result.lastrowid

            # 7. Create sale
            order_number = generate_order_number()

            sale_result = db.execute(
                text("""
                   INSERT INTO sales (
            customer_id,
            total_price,
            payment_type,
            vat,
            discount,
            status,
            order_number,
            business_id,
            user_id,
            invoice_id
        )
        VALUES (
            :customer_id,
            :total_price,
            :payment_type,
            :vat,
            :discount,
            :status,
            :order_number,
            :business_id,
            :user_id,
            :invoice_id
        )
    """),
    {
        "customer_id": customer_id,
        "total_price": sale_total,
        "payment_type": sale_payment_type,
        "vat": vat,
        "discount": discount,
        "status": "completed",
        "order_number": order_number,
        "business_id": business_id,
        "user_id": user_id,
        "invoice_id": invoice_id,
                }
            )

            sale_id = sale_result.lastrowid

            discount_ratio = discount / subtotal if subtotal > 0 else 0

            # 8. Insert invoice items + sales_items + reduce stock
            for item in items:
                product_id = item.get("product_id")
                quantity = float(item.get("quantity", 1) or 1)
                unit_price = float(item.get("unit_price", 0) or 0)
                item_subtotal = quantity * unit_price
                item_discount = item_subtotal * discount_ratio

                product = db.execute(
                    text("""
                        SELECT buying_price
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

                buying_price = float(product[0] or 0) if product else 0
                cost = quantity * buying_price
                profit = item_subtotal - cost - item_discount

                db.execute(
                    text("""
                        INSERT INTO invoice_items (
                            invoice_id, item_name, quantity, unit_price, subtotal, business_id
                        )
                        VALUES (
                            :invoice_id, :item_name, :quantity, :unit_price, :subtotal, :business_id
                        )
                    """),
                    {
                        "invoice_id": invoice_id,
                        "item_name": item.get("item_name"),
                        "quantity": quantity,
                        "unit_price": unit_price,
                        "subtotal": item_subtotal,
                        "business_id": business_id
                    }
                )

                db.execute(
                    text("""
                        INSERT INTO sales_items (
                            sale_id, product_id, bundle_id, quantity,
                            subtotal, buying_price, profit, business_id
                        )
                        VALUES (
                            :sale_id, :product_id, NULL, :quantity,
                            :subtotal, :buying_price, :profit, :business_id
                        )
                    """),
                    {
                        "sale_id": sale_id,
                        "product_id": product_id,
                        "quantity": quantity,
                        "subtotal": item_subtotal,
                        "buying_price": buying_price,
                        "profit": profit,
                        "business_id": business_id
                    }
                )

                db.execute(
                    text("""
                        UPDATE products
                        SET product_stock = product_stock - :quantity
                        WHERE product_id = :product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "product_id": product_id,
                        "business_id": business_id
                    }
                )

            # 9. Add previous balance as invoice display item only
            for linked_invoice in linked_invoice_rows:
                db.execute(
                    text("""
                        INSERT INTO invoice_items (
                            invoice_id, item_name, quantity, unit_price, subtotal, business_id
                        )
                        VALUES (
                            :invoice_id, :item_name, :quantity, :unit_price, :subtotal, :business_id
                        )
                    """),
                    {
                        "invoice_id": invoice_id,
                        "item_name": f"Previous balance from {linked_invoice['invoice_number']}",
                        "quantity": 1,
                        "unit_price": float(linked_invoice["balance_due"] or 0),
                        "subtotal": float(linked_invoice["balance_due"] or 0),
                        "business_id": business_id
                    }
                )

        return jsonify({
            "message": "Invoice and sale created successfully",
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "sale_id": sale_id,
            "order_number": order_number,
            "subtotal": subtotal,
            "previous_balance_total": previous_balance_total,
            "total_amount": total_amount,
            "sale_total": sale_total,
            "amount_paid": amount_paid,
            "balance_due": balance_due,
            "status": invoice_status,
            "payment_type": sale_payment_type
        }), 201

    except Exception as e:
        print("❌ Error adding invoice:", e)
        traceback.print_exc()
        return jsonify({"error": f"Database error: {str(e)}"}), 500


class RoundedStatusBadge(Flowable):
    def __init__(self, text, bg_color, width=95, height=28):
        super().__init__()
        self.text = text
        self.bg_color = bg_color
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(self.bg_color)
        self.canv.roundRect(
            0,
            0,
            self.width,
            self.height,
            self.height / 2,
            fill=1,
            stroke=0
        )

        self.canv.setFillColor(colors.white)
        self.canv.setFont("Helvetica-Bold", 11)
        self.canv.drawCentredString(
            self.width / 2,
            9,
            self.text
        )

def generate_invoice_pdf_response(invoice_id, business_id):
    try:
        with get_db() as db:
            invoice = db.execute(
                text("""
                    SELECT
                        i.invoice_id,
                        i.invoice_number,
                        i.issue_date,
                        i.due_date,
                        i.subtotal,
                        i.vat,
                        i.discount,
                        i.total_amount,
                        i.amount_paid,
                        i.balance_due,
                        i.status,
                        i.notes,

                        c.customer_name AS customer_name,
                        c.email AS customer_email,
                        c.phone AS customer_phone,
                        c.address AS customer_address,

                        b.name AS company_name,
                        b.phone AS company_phone,
                        b.email AS company_email,
                        b.address AS company_address
                    FROM invoices i
                    LEFT JOIN customers c
                        ON i.customer_id = c.customer_id
                        AND i.business_id = c.business_id
                    LEFT JOIN businesses b
                        ON i.business_id = b.id
                    WHERE i.invoice_id = :invoice_id
                    AND i.business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).mappings().first()

            if not invoice:
                return jsonify({"error": "Invoice not found"}), 404

            items = db.execute(
                text("""
                    SELECT item_name, quantity, unit_price, subtotal
                    FROM invoice_items
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                    ORDER BY invoice_item_id ASC
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).mappings().all()

        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=22 * mm,
            leftMargin=22 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
        )

        styles = getSampleStyleSheet()

        navy = colors.HexColor("#0b1446")
        light_card = colors.HexColor("#f1f4f8")
        light_note = colors.HexColor("#f8fafc")
        balance_bg = colors.HexColor("#fff4e5")
        border = colors.HexColor("#e5e7eb")
        red = colors.HexColor("#dc2626")
        green = colors.HexColor("#16a34a")
        orange = colors.HexColor("#f59e0b")
        dark = colors.HexColor("#111827")

        status = str(invoice["status"] or "unpaid").lower()
        status_bg = {
            "paid": green,
            "partial": orange,
            "unpaid": red,
            "cancelled": dark,
        }.get(status, red)

        status_text = status.upper()

        normal_style = ParagraphStyle(
            "NormalStyle",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#333333"),
        )

        invoice_title_style = ParagraphStyle(
            "InvoiceTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=navy,
            alignment=2,
        )

        story = []

        company_info = f"""
        <font size="20" color="#0b1446"><b>{invoice['company_name'] or 'Company Name'}</b></font><br/><br/>
        {invoice['company_phone'] or ''}<br/>
        {invoice['company_email'] or ''}<br/>
        {invoice['company_address'] or ''}
        """

        invoice_header = f"""
        <font size="24"><b>INVOICE</b></font><br/>
        <font size="10"># {invoice['invoice_number']}</font>
        """

        header_table = Table(
            [[
                Paragraph(company_info, normal_style),
                Paragraph(invoice_header, invoice_title_style),
            ]],
            colWidths=[250, 250],
        )

        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))

        story.append(header_table)

        badge = RoundedStatusBadge(
            status_text,
            status_bg,
            width=95,
            height=28
        )

        badge_wrapper = Table(
            [["", badge]],
            colWidths=[405, 95]
        )

        badge_wrapper.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))

        story.append(badge_wrapper)
        story.append(Spacer(1, 14))

        divider = Table([[""]], colWidths=[500], rowHeights=[2])
        divider.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), navy),
        ]))

        story.append(divider)
        story.append(Spacer(1, 16))

        bill_to = f"""
        <font size="11" color="#0b1446"><b>Bill To</b></font><br/><br/>
        <b>{invoice['customer_name'] or 'Customer'}</b><br/>
        {invoice['customer_phone'] or ''}<br/>
        {invoice['customer_email'] or ''}<br/>
        {invoice['customer_address'] or ''}
        """

        invoice_details = f"""
        <font size="11" color="#0b1446"><b>Invoice Details</b></font><br/><br/>
        <b>Invoice Date:</b> {invoice['issue_date']}<br/>
        <b>Due Date:</b> {invoice['due_date'] or 'N/A'}<br/>
        <b>Status:</b> {status_text}
        """

        bill_card = Table(
            [[Paragraph(bill_to, normal_style)]],
            colWidths=[230],
            rowHeights=[92],
        )

        bill_card.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), light_card),
            ("BOX", (0, 0), (-1, -1), 0.5, light_card),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]))

        details_card = Table(
            [[Paragraph(invoice_details, normal_style)]],
            colWidths=[230],
            rowHeights=[92],
        )

        details_card.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), light_card),
            ("BOX", (0, 0), (-1, -1), 0.5, light_card),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]))

        cards_table = Table(
            [[bill_card, "", details_card]],
            colWidths=[230, 30, 230],
            hAlign="CENTER",
        )

        cards_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))

        story.append(cards_table)
        story.append(Spacer(1, 18))

        item_data = [["Item", "Qty", "Rate", "Amount"]]

        for item in items:
            item_data.append([
                item["item_name"] or "",
                f"{float(item['quantity'] or 0):,.2f}",
                f"KES {float(item['unit_price'] or 0):,.2f}",
                f"KES {float(item['subtotal'] or 0):,.2f}",
            ])

        items_table = Table(
            item_data,
            colWidths=[210, 70, 100, 120],
        )

        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8.8),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 9),
            ("TOPPADDING", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8.2),
            ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#111111")),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#dddddd")),
            ("TOPPADDING", (0, 1), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
        ]))

        story.append(items_table)
        story.append(Spacer(1, 18))

        totals_data = [
            ["Subtotal", f"KES {float(invoice['subtotal'] or 0):,.2f}"],
            ["VAT", f"KES {float(invoice['vat'] or 0):,.2f}"],
            ["Discount", f"KES {float(invoice['discount'] or 0):,.2f}"],
            ["Total", f"KES {float(invoice['total_amount'] or 0):,.2f}"],
            ["Amount Paid", f"KES {float(invoice['amount_paid'] or 0):,.2f}"],
            ["Balance Due", f"KES {float(invoice['balance_due'] or 0):,.2f}"],
        ]

        totals_table = Table(
            totals_data,
            colWidths=[140, 140],
            hAlign="RIGHT",
        )

        totals_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 3), (-1, 3), navy),
            ("FONTSIZE", (0, 0), (-1, -1), 8.8),
            ("FONTSIZE", (0, 3), (-1, 3), 10.5),
            ("FONTSIZE", (0, 5), (-1, 5), 9.5),
            ("LINEBELOW", (0, 0), (-1, 4), 0.5, border),
            ("BACKGROUND", (0, 5), (-1, 5), balance_bg),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))

        story.append(totals_table)
        story.append(Spacer(1, 24))

        notes_text = invoice["notes"] or "N/A"

        notes_table = Table(
            [[
                Paragraph(
                    f"<font color='#0b1446'><b>Notes:</b></font><br/><br/>{notes_text}",
                    normal_style
                )
            ]],
            colWidths=[500],
        )

        notes_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), light_note),
            ("BOX", (0, 0), (-1, -1), 0.5, light_note),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]))

        story.append(notes_table)

        doc.build(story)

        buffer.seek(0)

        return send_file(
            buffer,
            mimetype="application/pdf",
            as_attachment=False,
            download_name=f"{invoice['invoice_number']}.pdf"
        )

    except Exception as e:
        print("❌ Error generating invoice PDF:", e)
        traceback.print_exc()
        return jsonify({"error": "Error generating invoice PDF"}), 500

@app.route("/invoice-pdf/<int:invoice_id>", methods=["GET"])
def invoice_pdf(invoice_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    return generate_invoice_pdf_response(invoice_id, business_id)

@app.route("/public-invoice/<token>")
def public_invoice(token):
    try:
        data = verify_invoice_token(token)

        invoice_id = data["invoice_id"]
        business_id = data["business_id"]

        return generate_invoice_pdf_response(invoice_id, business_id)

    except Exception as e:
        print("❌ Invalid public invoice link:", e)
        return jsonify({
            "error": "Invalid invoice link"
        }), 403


def get_invoice_status_style(status):
    status = str(status or "unpaid").lower()

    styles = {
        "paid": {"bg": "#16a34a", "text": "PAID"},
        "partial": {"bg": "#f59e0b", "text": "PARTIAL"},
        "unpaid": {"bg": "#dc2626", "text": "UNPAID"},
        "cancelled": {"bg": "#111827", "text": "CANCELLED"},
    }

    return styles.get(status, {"bg": "#6b7280", "text": status.upper()})


def get_invoice_email_data(invoice_id, business_id):
    with get_db() as conn:
        invoice = conn.execute(text("""
            SELECT 
                i.*,
                c.customer_name AS customer_name,
                c.email AS customer_email,
                c.phone AS customer_phone,
                c.address AS customer_address,
                b.name AS company_name,
                b.email AS company_email,
                b.phone AS company_phone,
                b.address AS company_address,
                b.city AS company_city,
                b.country AS company_country
            FROM invoices i
            LEFT JOIN customers c 
                ON i.customer_id = c.customer_id
                AND i.business_id = c.business_id
            LEFT JOIN businesses b 
                ON i.business_id = b.id
            WHERE i.invoice_id = :invoice_id
            AND i.business_id = :business_id
            LIMIT 1
        """), {
            "invoice_id": invoice_id,
            "business_id": business_id
        }).mappings().fetchone()

        if not invoice:
            return None, []

        items = conn.execute(text("""
            SELECT item_name, quantity, unit_price, subtotal
            FROM invoice_items
            WHERE invoice_id = :invoice_id
            AND business_id = :business_id
        """), {
            "invoice_id": invoice_id,
            "business_id": business_id
        }).mappings().fetchall()

    return invoice, items


def build_invoice_html(invoice, items):
    status_style = get_invoice_status_style(invoice["status"])

    item_rows = ""
    for item in items:
        item_rows += f"""
            <tr>
                <td style="padding:10px;border-bottom:1px solid #ddd;">{escape(str(item['item_name'] or ''))}</td>
                <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;">{float(item['quantity'] or 0):,.2f}</td>
                <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;">KES {float(item['unit_price'] or 0):,.2f}</td>
                <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;">KES {float(item['subtotal'] or 0):,.2f}</td>
            </tr>
        """

    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;color:#333;background:#f6f7f9;padding:20px;">
        <div style="max-width:800px;margin:auto;background:white;padding:30px;border-radius:12px;">
            <h1 style="color:#0b1446;margin-bottom:5px;">Invoice</h1>
            <h3 style="margin-top:0;color:#555;">#{invoice['invoice_number']}</h3>

            <div style="display:inline-block;background:{status_style['bg']};color:white;font-weight:900;
                        padding:12px 22px;border-radius:999px;font-size:20px;letter-spacing:1px;">
                {status_style['text']}
            </div>

            <p>Hello <strong>{escape(str(invoice['customer_name'] or 'Customer'))}</strong>,</p>
            <p>Please find your invoice details below. A PDF copy is also attached.</p>

            <div style="background:#f1f4f8;padding:15px;border-radius:8px;margin:20px 0;">
                <h3 style="margin-top:0;">{escape(str(invoice['company_name'] or 'Company'))}</h3>
                <p style="margin:0;line-height:1.6;">
                    {escape(str(invoice['company_phone'] or ''))}<br>
                    {escape(str(invoice['company_email'] or ''))}<br>
                    {escape(str(invoice['company_address'] or ''))}<br>
                    {escape(str(invoice['company_city'] or ''))}, {escape(str(invoice['company_country'] or ''))}
                </p>
            </div>

            <p style="line-height:1.8;">
                <strong>Invoice Date:</strong> {invoice['issue_date']}<br>
                <strong>Due Date:</strong> {invoice['due_date'] or 'N/A'}<br>
                <strong>Status:</strong> {status_style['text']}
            </p>

            <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;">
                <thead>
                    <tr style="background:#0b1446;color:white;">
                        <th style="padding:12px;text-align:left;">Item</th>
                        <th style="padding:12px;text-align:right;">Qty</th>
                        <th style="padding:12px;text-align:right;">Rate</th>
                        <th style="padding:12px;text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>{item_rows}</tbody>
            </table>

            <div style="margin-top:25px;max-width:350px;margin-left:auto;">
                <p><strong>Subtotal:</strong> KES {float(invoice['subtotal'] or 0):,.2f}</p>
                <p><strong>VAT:</strong> KES {float(invoice['vat'] or 0):,.2f}</p>
                <p><strong>Discount:</strong> KES {float(invoice['discount'] or 0):,.2f}</p>
                <h3>Total: KES {float(invoice['total_amount'] or 0):,.2f}</h3>
                <p><strong>Amount Paid:</strong> KES {float(invoice['amount_paid'] or 0):,.2f}</p>
                <h3 style="background:#fff4e5;padding:12px;border-radius:8px;">
                    Balance Due: KES {float(invoice['balance_due'] or 0):,.2f}
                </h3>
            </div>

            <div style="margin-top:30px;">
                <strong>Notes:</strong>
                <p>{escape(str(invoice['notes'] or 'N/A'))}</p>
            </div>

            <p>Thank you.</p>
        </div>
    </body>
    </html>
    """


def build_invoice_pdf(invoice, items):
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    navy = colors.HexColor("#0b1446")
    light_card = colors.HexColor("#f1f4f8")
    light_note = colors.HexColor("#f8fafc")
    balance_bg = colors.HexColor("#fff4e5")
    border = colors.HexColor("#e5e7eb")

    status = str(invoice["status"] or "").lower()

    if status == "paid":
        status_bg = colors.HexColor("#16a34a")
        status_text = "PAID"
    elif status in ["partial", "partially paid"]:
        status_bg = colors.HexColor("#f59e0b")
        status_text = "PARTIAL"
    elif status == "cancelled":
        status_bg = colors.HexColor("#6b7280")
        status_text = "CANCELLED"
    else:
        status_bg = colors.HexColor("#dc2626")
        status_text = "UNPAID"

    normal_style = ParagraphStyle(
        "NormalStyle",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#333333"),
    )

    badge_style = ParagraphStyle(
        "BadgeStyle",
        parent=styles["Normal"],
        alignment=1,
        textColor=colors.white,
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        borderPadding=(7, 18, 7, 18),
        backColor=status_bg,
    )

    story = []

    company_info = f"""
    <font size="15" color="#0b1446"><b>{invoice['company_name'] or 'Company Name'}</b></font><br/><br/>
    {invoice['company_phone'] or ''}<br/>
    {invoice['company_email'] or ''}<br/>
    {invoice['company_address'] or ''}
    """

    invoice_header = f"""
    <para alignment="right">
        <font size="18" color="#0b1446"><b>INVOICE</b></font><br/>
        <font size="10"># {invoice['invoice_number']}</font>
    </para>
    """

    header_table = Table(
        [[
            Paragraph(company_info, normal_style),
            Paragraph(invoice_header, normal_style),
        ]],
        colWidths=[220, 280],
    )

    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    story.append(header_table)

    badge = Paragraph(
        f"<font color='white'><b>{status_text}</b></font>",
        badge_style,
    )

    badge_container = Table(
        [["", badge]],
        colWidths=[390, 110],
        rowHeights=[34],
    )

    badge_container.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
    ]))

    story.append(badge_container)
    story.append(Spacer(1, 14))

    divider = Table([[""]], colWidths=[500], rowHeights=[2])
    divider.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), navy),
    ]))

    story.append(divider)
    story.append(Spacer(1, 16))

    bill_to = f"""
    <font size="11" color="#0b1446"><b>Bill To</b></font><br/><br/>
    <b>{invoice['customer_name'] or 'Customer'}</b><br/>
    {invoice['customer_phone'] or ''}<br/>
    {invoice['customer_email'] or ''}<br/>
    {invoice['customer_address'] or ''}
    """

    invoice_details = f"""
    <font size="11" color="#0b1446"><b>Invoice Details</b></font><br/><br/>
    <b>Invoice Date:</b> {invoice['issue_date']}<br/>
    <b>Due Date:</b> {invoice['due_date'] or 'N/A'}<br/>
    <b>Status:</b> {status_text}
    """

    bill_card = Table(
        [[Paragraph(bill_to, normal_style)]],
        colWidths=[230],
        rowHeights=[92],
    )

    bill_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), light_card),
        ("BOX", (0, 0), (-1, -1), 0.5, light_card),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))

    details_card = Table(
        [[Paragraph(invoice_details, normal_style)]],
        colWidths=[230],
        rowHeights=[92],
    )

    details_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), light_card),
        ("BOX", (0, 0), (-1, -1), 0.5, light_card),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))

    cards_table = Table(
        [[bill_card, "", details_card]],
        colWidths=[230, 30, 230],
        hAlign="CENTER",
    )

    cards_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    story.append(cards_table)
    story.append(Spacer(1, 18))

    data = [["Item", "Qty", "Rate", "Amount"]]

    for item in items:
        data.append([
            str(item["item_name"] or ""),
            f"{float(item['quantity'] or 0):,.2f}",
            f"KES {float(item['unit_price'] or 0):,.2f}",
            f"KES {float(item['subtotal'] or 0):,.2f}",
        ])

    table = Table(data, colWidths=[210, 70, 100, 120])

    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.8),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8.2),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
    ]))

    story.append(table)
    story.append(Spacer(1, 18))

    totals = [
        ["Subtotal", f"KES {float(invoice['subtotal'] or 0):,.2f}"],
        ["VAT", f"KES {float(invoice['vat'] or 0):,.2f}"],
        ["Discount", f"KES {float(invoice['discount'] or 0):,.2f}"],
        ["Total", f"KES {float(invoice['total_amount'] or 0):,.2f}"],
        ["Amount Paid", f"KES {float(invoice['amount_paid'] or 0):,.2f}"],
        ["Balance Due", f"KES {float(invoice['balance_due'] or 0):,.2f}"],
    ]

    totals_table = Table(totals, colWidths=[140, 140], hAlign="RIGHT")

    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
        ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 3), (-1, 3), navy),
        ("FONTSIZE", (0, 0), (-1, -1), 8.8),
        ("FONTSIZE", (0, 3), (-1, 3), 10.5),
        ("FONTSIZE", (0, 5), (-1, 5), 9.5),
        ("LINEBELOW", (0, 0), (-1, 4), 0.5, border),
        ("BACKGROUND", (0, 5), (-1, 5), balance_bg),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))

    story.append(totals_table)
    story.append(Spacer(1, 24))

    notes_text = invoice["notes"] or "N/A"

    notes_table = Table(
        [[Paragraph(
            f"<font color='#0b1446'><b>Notes:</b></font><br/><br/>{notes_text}",
            normal_style
        )]],
        colWidths=[500],
    )

    notes_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), light_note),
        ("BOX", (0, 0), (-1, -1), 0.5, light_note),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))

    story.append(notes_table)

    doc.build(story)
    buffer.seek(0)

    return buffer.read()


@app.route("/invoice-email-preview/<int:invoice_id>", methods=["GET"])
def invoice_email_preview(invoice_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    invoice, items = get_invoice_email_data(invoice_id, business_id)

    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    if not invoice.get("customer_email"):
        return jsonify({"error": "Customer does not have an email address"}), 400

    html_body = build_invoice_html(invoice, items)

    return jsonify({
        "to": invoice["customer_email"],
        "customer_name": invoice["customer_name"],
        "invoice_number": invoice["invoice_number"],
        "status": invoice["status"],
        "html": html_body
    }), 200


@app.route("/send-invoice-email/<int:invoice_id>", methods=["POST"])
def send_invoice_email(invoice_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        invoice, items = get_invoice_email_data(invoice_id, business_id)

        if not invoice:
            return jsonify({"error": "Invoice not found"}), 404

        if not invoice.get("customer_email"):
            return jsonify({"error": "Customer does not have an email address"}), 400

        email_host = os.getenv("EMAIL_HOST")
        email_port = int(os.getenv("EMAIL_PORT", 465))
        email_user = os.getenv("EMAIL_USER")
        email_password = os.getenv("EMAIL_PASSWORD")

        if not email_host or not email_user or not email_password:
            return jsonify({"error": "Email settings are missing in .env"}), 500

        html_body = build_invoice_html(invoice, items)
        pdf_bytes = build_invoice_pdf(invoice, items)

        msg = MIMEMultipart("mixed")
        msg["Subject"] = f"Invoice {invoice['invoice_number']}"
        msg["From"] = f"{invoice['company_name']} <{email_user}>"
        msg["To"] = invoice["customer_email"]

        msg["Reply-To"] = invoice.get("company_email") or email_user

        msg_alt = MIMEMultipart("alternative")
        msg_alt.attach(MIMEText(html_body, "html"))
        msg.attach(msg_alt)

        pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        pdf_attachment.add_header(
            "Content-Disposition",
            "attachment",
            filename=f"{invoice['invoice_number']}.pdf"
        )
        msg.attach(pdf_attachment)

        with smtplib.SMTP_SSL(email_host, email_port) as server:
            server.login(email_user, email_password)
            server.send_message(msg)

        return jsonify({"message": "Invoice sent successfully"}), 200

    except Exception as e:
        print("Error sending invoice email:", e)
        return jsonify({"error": f"Failed to send invoice email: {str(e)}"}), 500

@app.route("/delete-invoice/<int:invoice_id>", methods=["DELETE"])
def delete_invoice(invoice_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            invoice = db.execute(
                text("""
                    SELECT invoice_id
                    FROM invoices
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not invoice:
                return jsonify({"error": "Invoice not found"}), 404

            sale = db.execute(
                text("""
                    SELECT sale_id
                    FROM sales
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).fetchone()

            if sale:
                sale_id = sale[0]

                sale_items = db.execute(
                    text("""
                        SELECT product_id, quantity
                        FROM sales_items
                        WHERE sale_id = :sale_id
                        AND business_id = :business_id
                        AND product_id IS NOT NULL
                    """),
                    {
                        "sale_id": sale_id,
                        "business_id": business_id
                    }
                ).mappings().all()

                for item in sale_items:
                    db.execute(
                        text("""
                            UPDATE products
                            SET product_stock = product_stock + :quantity
                            WHERE product_id = :product_id
                            AND business_id = :business_id
                        """),
                        {
                            "quantity": item["quantity"],
                            "product_id": item["product_id"],
                            "business_id": business_id
                        }
                    )

                db.execute(
                    text("""
                        DELETE FROM sales_items
                        WHERE sale_id = :sale_id
                        AND business_id = :business_id
                    """),
                    {
                        "sale_id": sale_id,
                        "business_id": business_id
                    }
                )

                db.execute(
                    text("""
                        DELETE FROM sales
                        WHERE sale_id = :sale_id
                        AND business_id = :business_id
                    """),
                    {
                        "sale_id": sale_id,
                        "business_id": business_id
                    }
                )

            db.execute(
                text("""
                    DELETE FROM invoice_items
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    DELETE FROM invoices
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            )

            db.commit()

        return jsonify({"message": "Invoice deleted and stock restored successfully"}), 200

    except Exception as e:
        print("❌ Error deleting invoice:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/get-invoice-products", methods=["GET"])
def get_invoice_products():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        products_query = """
            SELECT
                product_id,
                product_name,
                product_price,
                product_stock,
                unit
            FROM products
            WHERE business_id = :business_id
            AND deleted_at IS NULL
            ORDER BY product_name ASC
        """

        products = execute_query(
            products_query,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted_products = [
            {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "product_price": float(row["product_price"] or 0),
                "product_stock": float(row["product_stock"] or 0),
                "unit": row["unit"]
            }
            for row in products
        ]

        return jsonify({
            "products": formatted_products,
            "total_products": len(formatted_products)
        }), 200

    except Exception as e:
        print("❌ ERROR in get_invoice_products:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/get-invoices", methods=["GET"])
def get_invoices():
    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        company = execute_query(
            """
            SELECT name, email, phone, address, city, country, logo
            FROM businesses
            WHERE id = :business_id
            LIMIT 1
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        invoices = execute_query(
            """
            SELECT 
                i.*,
                c.customer_name,
                c.phone AS customer_phone,
                c.email AS customer_email,
                c.address AS customer_address
            FROM invoices i
            LEFT JOIN customers c 
                ON i.customer_id = c.customer_id
                AND c.business_id = :business_id
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
                SELECT 
                    item_name,
                    quantity,
                    unit_price,
                    subtotal,
                    product_id
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
                "public_token": generate_invoice_token(
                    invoice["invoice_id"],
                    business_id
                    ),
                "invoice_number": invoice["invoice_number"],
                "customer_id": invoice["customer_id"],
                "customer_name": invoice["customer_name"],
                "customer_phone": invoice["customer_phone"] or "",
                "customer_email": invoice["customer_email"] or "",
                "customer_address": invoice["customer_address"] or "",
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
                "created_at": str(invoice["created_at"]) if invoice.get("created_at") else "",
                "updated_at": str(invoice["updated_at"]) if invoice.get("updated_at") else "",
                "items": [
                    {
                        "product_id": item.get("product_id"),
                        "item_name": item["item_name"],
                        "quantity": float(item["quantity"] or 0),
                        "unit_price": float(item["unit_price"] or 0),
                        "subtotal": float(item["subtotal"] or 0)
                    }
                    for item in items
                ]
            })

        business = company[0] if company else {}

        return jsonify({
            "company": {
                "company": business.get("name", ""),
                "company_phone": business.get("phone", ""),
                "company_email": business.get("email", ""),
                "company_address": business.get("address", ""),
                "company_city": business.get("city", ""),
                "company_country": business.get("country", ""),
                "company_logo": business.get("logo", "")
            },
            "invoices": formatted
        }), 200

    except Exception as e:
        print("❌ Error fetching invoices:", e)
        traceback.print_exc()
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

    items = [
        item for item in items
        if item.get("product_id") and item.get("item_name")
    ]

    previous_balances = data.get("previous_balances", [])
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
        with get_db() as db:
            existing_invoice = db.execute(
                text("""
                    SELECT invoice_id
                    FROM invoices
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                    LIMIT 1
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not existing_invoice:
                return jsonify({"error": "Invoice not found"}), 404

            linked_sale = db.execute(
                text("""
                    SELECT sale_id
                    FROM sales
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                    LIMIT 1
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).fetchone()

            sale_id = linked_sale[0] if linked_sale else None

            old_items = db.execute(
                text("""
                    SELECT product_id, item_name, quantity
                    FROM invoice_items
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            ).fetchall()

            for old_item in old_items:
                old_product_id = old_item[0]
                old_item_name = old_item[1]
                old_quantity = float(old_item[2] or 0)

                restore_product_id = old_product_id

                if not restore_product_id:
                    matching_new_item = next(
                        (
                            item for item in items
                            if str(item.get("item_name", "")).lower()
                            == str(old_item_name or "").lower()
                        ),
                        None
                    )

                    if matching_new_item:
                        restore_product_id = matching_new_item.get("product_id")

                if restore_product_id:
                    db.execute(
                        text("""
                            UPDATE products
                            SET product_stock = product_stock + :quantity
                            WHERE product_id = :product_id
                            AND business_id = :business_id
                        """),
                        {
                            "quantity": old_quantity,
                            "product_id": restore_product_id,
                            "business_id": business_id
                        }
                    )

            for item in items:
                product_id = item.get("product_id")
                quantity = float(item.get("quantity", 1) or 1)

                if not product_id:
                    return jsonify({"error": "Please select a product"}), 400

                product = db.execute(
                    text("""
                        SELECT product_name, product_stock
                        FROM products
                        WHERE product_id = :product_id
                        AND business_id = :business_id
                        AND deleted_at IS NULL
                        AND (is_deleted = 0 OR is_deleted IS NULL)
                        FOR UPDATE
                    """),
                    {
                        "product_id": product_id,
                        "business_id": business_id
                    }
                ).fetchone()

                if not product:
                    return jsonify({"error": "Selected product not found"}), 404

                available_stock = float(product[1] or 0)

                if quantity > available_stock:
                    return jsonify({
                        "error": f"Only {available_stock} available for {product[0]}"
                    }), 400

            subtotal = sum(
                float(item.get("quantity", 1) or 1) *
                float(item.get("unit_price", 0) or 0)
                for item in items
            )

            previous_balance_total = sum(
                float(balance.get("balance_due", 0) or 0)
                for balance in previous_balances
            )

            total_amount = subtotal + previous_balance_total + vat - discount
            sale_total = subtotal + vat - discount

            if amount_paid < 0:
                return jsonify({"error": "Amount paid cannot be negative"}), 400

            if amount_paid > total_amount:
                return jsonify({"error": "Amount paid cannot exceed invoice total"}), 400

            balance_due = total_amount - amount_paid

            if amount_paid <= 0:
                invoice_status = "unpaid"
            elif amount_paid < total_amount:
                invoice_status = "partial"
            else:
                invoice_status = "paid"

            sale_payment_type = "Cash" if balance_due <= 0 else "Credit"

            db.execute(
                text("""
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
                """),
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
                    "status": invoice_status,
                    "notes": notes,
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            )

            if sale_id:
                db.execute(
                    text("""
                        UPDATE sales
                        SET customer_id = :customer_id,
                            total_price = :total_price,
                            payment_type = :payment_type,
                            vat = :vat,
                            discount = :discount,
                            status = 'completed'
                        WHERE sale_id = :sale_id
                        AND business_id = :business_id
                    """),
                    {
                        "customer_id": customer_id,
                        "total_price": sale_total,
                        "payment_type": sale_payment_type,
                        "vat": vat,
                        "discount": discount,
                        "sale_id": sale_id,
                        "business_id": business_id
                    }
                )

                db.execute(
                    text("""
                        DELETE FROM sales_items
                        WHERE sale_id = :sale_id
                        AND business_id = :business_id
                    """),
                    {
                        "sale_id": sale_id,
                        "business_id": business_id
                    }
                )

            db.execute(
                text("""
                    DELETE FROM invoice_items
                    WHERE invoice_id = :invoice_id
                    AND business_id = :business_id
                """),
                {
                    "invoice_id": invoice_id,
                    "business_id": business_id
                }
            )

            discount_ratio = discount / subtotal if subtotal > 0 else 0

            for item in items:
                product_id = item.get("product_id")
                quantity = float(item.get("quantity", 1) or 1)
                unit_price = float(item.get("unit_price", 0) or 0)
                item_subtotal = quantity * unit_price
                item_discount = item_subtotal * discount_ratio

                product = db.execute(
                    text("""
                        SELECT buying_price
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

                buying_price = float(product[0] or 0) if product else 0
                profit = item_subtotal - (quantity * buying_price) - item_discount

                db.execute(
                    text("""
                        INSERT INTO invoice_items (
                            invoice_id, product_id, item_name, quantity,
                            unit_price, subtotal, business_id
                        )
                        VALUES (
                            :invoice_id, :product_id, :item_name, :quantity,
                            :unit_price, :subtotal, :business_id
                        )
                    """),
                    {
                        "invoice_id": invoice_id,
                        "product_id": product_id,
                        "item_name": item.get("item_name"),
                        "quantity": quantity,
                        "unit_price": unit_price,
                        "subtotal": item_subtotal,
                        "business_id": business_id
                    }
                )

                if sale_id:
                    db.execute(
                        text("""
                            INSERT INTO sales_items (
                                sale_id, product_id, bundle_id, quantity,
                                subtotal, buying_price, profit, business_id
                            )
                            VALUES (
                                :sale_id, :product_id, NULL, :quantity,
                                :subtotal, :buying_price, :profit, :business_id
                            )
                        """),
                        {
                            "sale_id": sale_id,
                            "product_id": product_id,
                            "quantity": quantity,
                            "subtotal": item_subtotal,
                            "buying_price": buying_price,
                            "profit": profit,
                            "business_id": business_id
                        }
                    )

                db.execute(
                    text("""
                        UPDATE products
                        SET product_stock = product_stock - :quantity
                        WHERE product_id = :product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "product_id": product_id,
                        "business_id": business_id
                    }
                )

            for balance in previous_balances:
                invoice_number = balance.get("invoice_number", "Invoice")
                balance_due_value = float(balance.get("balance_due", 0) or 0)

                db.execute(
                    text("""
                        INSERT INTO invoice_items (
                            invoice_id, product_id, item_name, quantity,
                            unit_price, subtotal, business_id
                        )
                        VALUES (
                            :invoice_id, NULL, :item_name, 1,
                            :unit_price, :subtotal, :business_id
                        )
                    """),
                    {
                        "invoice_id": invoice_id,
                        "item_name": f"Previous balance from {invoice_number}",
                        "unit_price": balance_due_value,
                        "subtotal": balance_due_value,
                        "business_id": business_id
                    }
                )

        return jsonify({
            "message": "Invoice and linked sale updated successfully",
            "invoice_id": invoice_id,
            "sale_id": sale_id,
            "subtotal": subtotal,
            "previous_balance_total": previous_balance_total,
            "total_amount": total_amount,
            "sale_total": sale_total,
            "amount_paid": amount_paid,
            "balance_due": balance_due,
            "status": invoice_status,
            "payment_type": sale_payment_type
        }), 200

    except Exception as e:
        print("❌ Error updating invoice:", e)
        traceback.print_exc()
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
        elif status in ["unpaid", "cancelled"]:
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

        sale_payment_type = "Cash" if status == "paid" else "Credit"

        execute_update(
            """
            UPDATE sales
            SET payment_type = :payment_type
            WHERE invoice_id = :invoice_id
            AND business_id = :business_id
            """,
            {
                "payment_type": sale_payment_type,
                "invoice_id": invoice_id,
                "business_id": business_id
            }
        )

        return jsonify({
            "message": "Invoice status updated",
            "amount_paid": amount_paid,
            "balance_due": balance_due,
            "status": status,
            "payment_type": sale_payment_type
        }), 200

    except Exception as e:
        print("❌ Error updating invoice status:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/customer-pending-invoices/<int:customer_id>", methods=["GET"])
def customer_pending_invoices(customer_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        invoices = execute_query(
            """
            SELECT
                invoice_id,
                invoice_number,
                balance_due
            FROM invoices
            WHERE customer_id = :customer_id
            AND business_id = :business_id
            AND balance_due > 0
            AND status IN ('partial', 'unpaid')
            ORDER BY created_at DESC
            """,
            {
                "customer_id": customer_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        return jsonify({
            "invoices": invoices
        }), 200

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500


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



# ==============================
# RESTAURANT TABLES
# ==============================

@app.route("/restaurant-tables", methods=["GET"])
def get_restaurant_tables():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        tables = execute_query(
            """
            SELECT
                table_id,
                table_name,
                capacity,
                status,
                current_order_id
            FROM restaurant_tables
            WHERE business_id = :business_id
            ORDER BY table_name ASC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted_tables = [
            {
                "table_id": row["table_id"],
                "table_name": row["table_name"],
                "capacity": row["capacity"],
                "status": row["status"],
                "current_order_id": row["current_order_id"],
            }
            for row in tables
        ]

        return jsonify({"tables": formatted_tables}), 200

    except Exception as e:
        print("❌ ERROR in get_restaurant_tables:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ==============================
# RESTAURANT TABLES CRUD
# ==============================

@app.route("/restaurant-tables", methods=["POST"])
def add_restaurant_table():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    table_name = data.get("table_name")
    capacity = data.get("capacity", 4)

    if not table_name:
        return jsonify({"error": "Table name is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO restaurant_tables
                    (business_id, table_name, capacity, status)
                    VALUES (:business_id, :table_name, :capacity, 'Available')
                """),
                {
                    "business_id": business_id,
                    "table_name": table_name,
                    "capacity": capacity,
                }
            )

        return jsonify({"message": "Table added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant table:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-tables/<int:table_id>", methods=["PUT"])
def update_restaurant_table(table_id):
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    UPDATE restaurant_tables
                    SET table_name = :table_name,
                        capacity = :capacity,
                        status = :status
                    WHERE table_id = :table_id
                    AND business_id = :business_id
                """),
                {
                    "table_name": data.get("table_name"),
                    "capacity": data.get("capacity", 4),
                    "status": data.get("status", "Available"),
                    "table_id": table_id,
                    "business_id": business_id,
                }
            )

        return jsonify({"message": "Table updated successfully"}), 200

    except Exception as e:
        print("❌ ERROR updating restaurant table:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-tables/<int:table_id>", methods=["DELETE"])
def delete_restaurant_table(table_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    DELETE FROM restaurant_tables
                    WHERE table_id = :table_id
                    AND business_id = :business_id
                """),
                {
                    "table_id": table_id,
                    "business_id": business_id,
                }
            )

        return jsonify({"message": "Table deleted successfully"}), 200

    except Exception as e:
        print("❌ ERROR deleting restaurant table:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ==============================
# RESTAURANT ADD-ONS CRUD
# ==============================

@app.route("/restaurant-addons", methods=["POST"])
def add_restaurant_addon():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    addon_name = data.get("addon_name")
    addon_price = float(data.get("addon_price", 0))
    status = data.get("status", "Active")

    if not addon_name:
        return jsonify({"error": "Add-on name is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO restaurant_addons
                    (business_id, addon_name, addon_price, status)
                    VALUES (:business_id, :addon_name, :addon_price, :status)
                """),
                {
                    "business_id": business_id,
                    "addon_name": addon_name,
                    "addon_price": addon_price,
                    "status": status,
                }
            )

        return jsonify({"message": "Add-on added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant add-on:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-addons/<int:addon_id>", methods=["PUT"])
def update_restaurant_addon(addon_id):
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    UPDATE restaurant_addons
                    SET addon_name = :addon_name,
                        addon_price = :addon_price,
                        status = :status
                    WHERE addon_id = :addon_id
                    AND business_id = :business_id
                """),
                {
                    "addon_name": data.get("addon_name"),
                    "addon_price": float(data.get("addon_price", 0)),
                    "status": data.get("status", "Active"),
                    "addon_id": addon_id,
                    "business_id": business_id,
                }
            )

        return jsonify({"message": "Add-on updated successfully"}), 200

    except Exception as e:
        print("❌ ERROR updating restaurant add-on:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-addons/<int:addon_id>", methods=["DELETE"])
def delete_restaurant_addon(addon_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    DELETE FROM restaurant_addons
                    WHERE addon_id = :addon_id
                    AND business_id = :business_id
                """),
                {
                    "addon_id": addon_id,
                    "business_id": business_id,
                }
            )

        return jsonify({"message": "Add-on deleted successfully"}), 200

    except Exception as e:
        print("❌ ERROR deleting restaurant add-on:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500        


# ==============================
# HELPER: CREATE RESTAURANT ORDER
# ==============================

def create_restaurant_order(data, order_status, kitchen_status):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    customer_id = data.get("customer_id")
    user_id = data.get("user_id")
    cart_items = data.get("cart_items", [])
    order_type = data.get("order_type", "Dine In")
    table_name = data.get("table_name")
    waiter_name = data.get("waiter_name")
    payment_type = data.get("payment_type")
    vat = float(data.get("vat", 0))
    discount = float(data.get("discount", 0))

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    if not cart_items:
        return jsonify({"error": "Cart is empty"}), 400

    if order_type == "Dine In" and not table_name:
        return jsonify({"error": "Please select a table"}), 400

    try:
        with get_db() as db:
            table_id = None

            if table_name:
                table = db.execute(
                    text("""
                        SELECT table_id, status
                        FROM restaurant_tables
                        WHERE business_id = :business_id
                        AND table_name = :table_name
                        LIMIT 1
                    """),
                    {
                        "business_id": business_id,
                        "table_name": table_name
                    }
                ).fetchone()

                if table:
                    table_id = table[0]

            subtotal_amount = sum(float(item["subtotal"]) for item in cart_items)
            total_price = subtotal_amount + vat - discount
            order_number = generate_order_number()

            if order_status == "completed":
                for item in cart_items:
                    product_id = item["product_id"]
                    quantity = float(item["quantity"])
                    addons = item.get("addons", [])

                    product = db.execute(
                        text("""
                            SELECT product_stock
                            FROM restaurant_products
                            WHERE restaurant_product_id = :product_id
                            AND business_id = :business_id
                            FOR UPDATE
                        """),
                        {
                            "product_id": product_id,
                            "business_id": business_id
                        }
                    ).fetchone()

                    if not product:
                        return jsonify({
                            "error": "Restaurant product not found",
                            "product_id": product_id
                        }), 400

                    product_stock = float(product[0] or 0)

                    if product_stock < quantity:
                        return jsonify({
                            "error": "INSUFFICIENT_STOCK",
                            "message": f"Only {product_stock} item(s) left in stock",
                            "product_id": product_id
                        }), 400

                    product_recipe = db.execute(
                        text("""
                            SELECT
                                rpr.raw_material_id,
                                rpr.quantity_required,
                                rm.material_name,
                                rm.stock_quantity
                            FROM restaurant_product_recipes rpr
                            JOIN restaurant_materials rm
                                ON rpr.raw_material_id = rm.raw_material_id
                                AND rpr.business_id = rm.business_id
                            WHERE rpr.restaurant_product_id = :product_id
                            AND rpr.business_id = :business_id
                            FOR UPDATE
                        """),
                        {
                            "product_id": product_id,
                            "business_id": business_id
                        }
                    ).fetchall()

                    for raw_material_id, quantity_required, material_name, stock_quantity in product_recipe:
                        required_qty = float(quantity_required) * quantity
                        available_material = float(stock_quantity or 0)

                        if available_material < required_qty:
                            return jsonify({
                                "error": "INSUFFICIENT_MATERIAL",
                                "message": f"Insufficient {material_name}. Required {required_qty}, available {available_material}",
                                "material_name": material_name
                            }), 400

                    for addon in addons:
                        addon_id = addon.get("addon_id")
                        addon_quantity = float(addon.get("quantity", 1))

                        addon_recipe = db.execute(
                            text("""
                                SELECT
                                    rar.raw_material_id,
                                    rar.quantity_required,
                                    rm.material_name,
                                    rm.stock_quantity
                                FROM restaurant_addon_recipes rar
                                JOIN restaurant_materials rm
                                    ON rar.raw_material_id = rm.raw_material_id
                                    AND rar.business_id = rm.business_id
                                WHERE rar.addon_id = :addon_id
                                AND rar.business_id = :business_id
                                FOR UPDATE
                            """),
                            {
                                "addon_id": addon_id,
                                "business_id": business_id
                            }
                        ).fetchall()

                        for raw_material_id, quantity_required, material_name, stock_quantity in addon_recipe:
                            required_qty = float(quantity_required) * addon_quantity
                            available_material = float(stock_quantity or 0)

                            if available_material < required_qty:
                                return jsonify({
                                    "error": "INSUFFICIENT_MATERIAL",
                                    "message": f"Insufficient {material_name} for add-on. Required {required_qty}, available {available_material}",
                                    "material_name": material_name
                                }), 400

            result = db.execute(
                text("""
                    INSERT INTO restaurant_orders (
                        business_id,
                        customer_id,
                        user_id,
                        order_number,
                        order_type,
                        table_id,
                        table_name,
                        waiter_name,
                        subtotal,
                        vat,
                        discount,
                        total_price,
                        payment_type,
                        order_status,
                        kitchen_status
                    )
                    VALUES (
                        :business_id,
                        :customer_id,
                        :user_id,
                        :order_number,
                        :order_type,
                        :table_id,
                        :table_name,
                        :waiter_name,
                        :subtotal,
                        :vat,
                        :discount,
                        :total_price,
                        :payment_type,
                        :order_status,
                        :kitchen_status
                    )
                """),
                {
                    "business_id": business_id,
                    "customer_id": customer_id if customer_id else None,
                    "user_id": user_id,
                    "order_number": order_number,
                    "order_type": order_type,
                    "table_id": table_id,
                    "table_name": table_name,
                    "waiter_name": waiter_name,
                    "subtotal": subtotal_amount,
                    "vat": vat,
                    "discount": discount,
                    "total_price": total_price,
                    "payment_type": payment_type if order_status == "completed" else None,
                    "order_status": order_status,
                    "kitchen_status": kitchen_status,
                }
            )

            restaurant_order_id = result.lastrowid

            for item in cart_items:
                product_id = item["product_id"]
                addons = item.get("addons", [])
                quantity = float(item["quantity"])
                item_subtotal = float(item["subtotal"])

                product = db.execute(
                    text("""
                        SELECT
                            product_name,
                            product_price,
                            product_stock,
                            buying_price
                        FROM restaurant_products
                        WHERE restaurant_product_id = :product_id
                        AND business_id = :business_id
                        FOR UPDATE
                    """),
                    {
                        "product_id": product_id,
                        "business_id": business_id
                    }
                ).fetchone()

                if not product:
                    return jsonify({"error": "Restaurant product not found"}), 400

                product_name = product[0]
                product_price = float(product[1] or 0)
                product_stock = float(product[2] or 0)
                buying_price = float(product[3] or 0)

                profit = (product_price - buying_price) * quantity

                item_result = db.execute(
                    text("""
                        INSERT INTO restaurant_order_items (
                            restaurant_order_id,
                            business_id,
                            product_id,
                            product_name,
                            quantity,
                            unit_price,
                            subtotal,
                            buying_price,
                            profit,
                            item_status
                        )
                        VALUES (
                            :restaurant_order_id,
                            :business_id,
                            :product_id,
                            :product_name,
                            :quantity,
                            :unit_price,
                            :subtotal,
                            :buying_price,
                            :profit,
                            :item_status
                        )
                    """),
                    {
                        "restaurant_order_id": restaurant_order_id,
                        "business_id": business_id,
                        "product_id": product_id,
                        "product_name": product_name,
                        "quantity": quantity,
                        "unit_price": product_price,
                        "subtotal": item_subtotal,
                        "buying_price": buying_price,
                        "profit": profit,
                        "item_status": kitchen_status if kitchen_status != "not_sent" else "pending",
                    }
                )

                restaurant_order_item_id = item_result.lastrowid

                for addon in addons:
                    addon_id = addon.get("addon_id")
                    addon_name = addon.get("addon_name")
                    addon_price = float(addon.get("addon_price", 0))
                    addon_quantity = float(addon.get("quantity", 1))
                    addon_subtotal = addon_price * addon_quantity

                    db.execute(
                        text("""
                            INSERT INTO restaurant_order_item_addons (
                                restaurant_order_item_id,
                                restaurant_order_id,
                                business_id,
                                addon_id,
                                addon_name,
                                addon_price,
                                quantity,
                                subtotal
                            )
                            VALUES (
                                :restaurant_order_item_id,
                                :restaurant_order_id,
                                :business_id,
                                :addon_id,
                                :addon_name,
                                :addon_price,
                                :quantity,
                                :subtotal
                            )
                        """),
                        {
                            "restaurant_order_item_id": restaurant_order_item_id,
                            "restaurant_order_id": restaurant_order_id,
                            "business_id": business_id,
                            "addon_id": addon_id,
                            "addon_name": addon_name,
                            "addon_price": addon_price,
                            "quantity": addon_quantity,
                            "subtotal": addon_subtotal,
                        }
                    )

                if order_status == "completed":
                    product_recipe = db.execute(
                        text("""
                            SELECT
                                raw_material_id,
                                quantity_required
                            FROM restaurant_product_recipes
                            WHERE restaurant_product_id = :product_id
                            AND business_id = :business_id
                        """),
                        {
                            "product_id": product_id,
                            "business_id": business_id
                        }
                    ).fetchall()

                    for raw_material_id, quantity_required in product_recipe:
                        required_qty = float(quantity_required) * quantity

                        db.execute(
                            text("""
                                UPDATE restaurant_materials
                                SET stock_quantity = stock_quantity - :required_qty
                                WHERE raw_material_id = :raw_material_id
                                AND business_id = :business_id
                            """),
                            {
                                "required_qty": required_qty,
                                "raw_material_id": raw_material_id,
                                "business_id": business_id
                            }
                        )

                    for addon in addons:
                        addon_id = addon.get("addon_id")
                        addon_quantity = float(addon.get("quantity", 1))

                        addon_recipe = db.execute(
                            text("""
                                SELECT
                                    raw_material_id,
                                    quantity_required
                                FROM restaurant_addon_recipes
                                WHERE addon_id = :addon_id
                                AND business_id = :business_id
                            """),
                            {
                                "addon_id": addon_id,
                                "business_id": business_id
                            }
                        ).fetchall()

                        for raw_material_id, quantity_required in addon_recipe:
                            required_qty = float(quantity_required) * addon_quantity

                            db.execute(
                                text("""
                                    UPDATE restaurant_materials
                                    SET stock_quantity = stock_quantity - :required_qty
                                    WHERE raw_material_id = :raw_material_id
                                    AND business_id = :business_id
                                """),
                                {
                                    "required_qty": required_qty,
                                    "raw_material_id": raw_material_id,
                                    "business_id": business_id
                                }
                            )

                    db.execute(
                        text("""
                            UPDATE restaurant_products
                            SET product_stock = product_stock - :quantity
                            WHERE restaurant_product_id = :product_id
                            AND business_id = :business_id
                        """),
                        {
                            "quantity": quantity,
                            "product_id": product_id,
                            "business_id": business_id
                        }
                    )

            if table_id:
                if order_status in ["pending", "held"]:
                    db.execute(
                        text("""
                            UPDATE restaurant_tables
                            SET status = 'Occupied',
                                current_order_id = :restaurant_order_id
                            WHERE table_id = :table_id
                            AND business_id = :business_id
                        """),
                        {
                            "restaurant_order_id": restaurant_order_id,
                            "table_id": table_id,
                            "business_id": business_id
                        }
                    )

                if order_status == "completed":
                    db.execute(
                        text("""
                            UPDATE restaurant_tables
                            SET status = 'Available',
                                current_order_id = NULL
                            WHERE table_id = :table_id
                            AND business_id = :business_id
                        """),
                        {
                            "table_id": table_id,
                            "business_id": business_id
                        }
                    )

            db.commit()

        return jsonify({
            "message": "Restaurant order saved successfully",
            "restaurant_order_id": restaurant_order_id,
            "order_number": order_number,
            "order_status": order_status,
            "kitchen_status": kitchen_status
        }), 201

    except Exception as e:
        print("❌ ERROR in create_restaurant_order:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ==============================
# SEND TO KITCHEN
# ==============================

@app.route("/restaurant/send-to-kitchen", methods=["POST"])
def restaurant_send_to_kitchen():
    data = request.json

    return create_restaurant_order(
        data=data,
        order_status="pending",
        kitchen_status="pending"
    )


# ==============================
# HOLD ORDER
# ==============================

@app.route("/restaurant/hold-order", methods=["POST"])
def restaurant_hold_order():
    data = request.json

    return create_restaurant_order(
        data=data,
        order_status="held",
        kitchen_status="not_sent"
    )


# ==============================
# CHECKOUT DIRECTLY
# ==============================

@app.route("/restaurant/checkout", methods=["POST"])
def restaurant_checkout():
    data = request.json
    payment_type = data.get("payment_type")

    if payment_type not in ["Mpesa", "Cash", "Bank", "Credit"]:
        return jsonify({"error": "Invalid payment type"}), 400

    return create_restaurant_order(
        data=data,
        order_status="completed",
        kitchen_status="served"
    )


# ==============================
# GET KITCHEN ORDERS
# ==============================

@app.route("/restaurant/kitchen-orders", methods=["GET"])
def get_kitchen_orders():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        orders = execute_query(
            """
            SELECT
                restaurant_order_id,
                order_number,
                order_type,
                table_name,
                waiter_name,
                total_price,
                order_status,
                kitchen_status,
                created_at
            FROM restaurant_orders
            WHERE business_id = :business_id
            AND kitchen_status IN ('pending', 'preparing', 'ready')
            ORDER BY created_at ASC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted_orders = []

        for order in orders:
            items = execute_query(
                """
                SELECT
                    restaurant_order_item_id,
                    product_id,
                    product_name,
                    quantity,
                    unit_price,
                    subtotal,
                    item_status
                FROM restaurant_order_items
                WHERE restaurant_order_id = :restaurant_order_id
                AND business_id = :business_id
                ORDER BY restaurant_order_item_id ASC
                """,
                {
                    "restaurant_order_id": order["restaurant_order_id"],
                    "business_id": business_id
                },
                fetch_all=True
            )

            formatted_items = []

            for item in items:
                addons = execute_query(
                    """
                    SELECT
                        order_item_addon_id,
                        addon_id,
                        addon_name,
                        addon_price,
                        quantity,
                        subtotal
                    FROM restaurant_order_item_addons
                    WHERE restaurant_order_item_id = :restaurant_order_item_id
                    AND restaurant_order_id = :restaurant_order_id
                    AND business_id = :business_id
                    ORDER BY order_item_addon_id ASC
                    """,
                    {
                        "restaurant_order_item_id": item["restaurant_order_item_id"],
                        "restaurant_order_id": order["restaurant_order_id"],
                        "business_id": business_id,
                    },
                    fetch_all=True
                )

                formatted_items.append({
                    "restaurant_order_item_id": item["restaurant_order_item_id"],
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "quantity": float(item["quantity"] or 0),
                    "unit_price": float(item["unit_price"] or 0),
                    "subtotal": float(item["subtotal"] or 0),
                    "item_status": item["item_status"],
                    "addons": [
                        {
                            "order_item_addon_id": addon["order_item_addon_id"],
                            "addon_id": addon["addon_id"],
                            "addon_name": addon["addon_name"],
                            "addon_price": float(addon["addon_price"] or 0),
                            "quantity": float(addon["quantity"] or 0),
                            "subtotal": float(addon["subtotal"] or 0),
                        }
                        for addon in addons
                    ]
                })

            formatted_orders.append({
                "restaurant_order_id": order["restaurant_order_id"],
                "order_number": order["order_number"],
                "order_type": order["order_type"],
                "table_name": order["table_name"],
                "waiter_name": order["waiter_name"],
                "total_price": float(order["total_price"] or 0),
                "order_status": order["order_status"],
                "kitchen_status": order["kitchen_status"],
                "created_at": str(order["created_at"]),
                "items": formatted_items
            })

        return jsonify({"orders": formatted_orders}), 200

    except Exception as e:
        print("❌ ERROR in get_kitchen_orders:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant/orders/<int:order_id>/reopen", methods=["PUT"])
def reopen_restaurant_order(order_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:

            order = db.execute(
                text("""
                    SELECT
                        restaurant_order_id,
                        table_id,
                        order_status
                    FROM restaurant_orders
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                    LIMIT 1
                    FOR UPDATE
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not order:
                return jsonify({"error": "Order not found"}), 404

            table_id = order[1]
            order_status = order[2]

            if order_status != "completed":
                return jsonify({
                    "error": "Only completed orders can be reopened"
                }), 400

            items = db.execute(
                text("""
                    SELECT
                        restaurant_order_item_id,
                        product_id,
                        quantity
                    FROM restaurant_order_items
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchall()

            for item in items:

                restaurant_order_item_id = item[0]
                restaurant_product_id = item[1]
                quantity = float(item[2])

                # Restore restaurant product stock
                db.execute(
                    text("""
                        UPDATE restaurant_products
                        SET product_stock = product_stock + :quantity
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id
                    }
                )

                # Restore product recipe materials
                product_recipe = db.execute(
                    text("""
                        SELECT
                            raw_material_id,
                            quantity_required
                        FROM restaurant_product_recipes
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                    """),
                    {
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id
                    }
                ).fetchall()

                for recipe_item in product_recipe:

                    raw_material_id = recipe_item[0]
                    quantity_required = float(recipe_item[1])

                    restore_qty = quantity_required * quantity

                    db.execute(
                        text("""
                            UPDATE restaurant_materials
                            SET stock_quantity = stock_quantity + :restore_qty
                            WHERE raw_material_id = :raw_material_id
                            AND business_id = :business_id
                        """),
                        {
                            "restore_qty": restore_qty,
                            "raw_material_id": raw_material_id,
                            "business_id": business_id
                        }
                    )

                # Restore add-on materials
                addons = db.execute(
                    text("""
                        SELECT
                            addon_id,
                            quantity
                        FROM restaurant_order_item_addons
                        WHERE restaurant_order_item_id = :restaurant_order_item_id
                        AND restaurant_order_id = :restaurant_order_id
                        AND business_id = :business_id
                    """),
                    {
                        "restaurant_order_item_id": restaurant_order_item_id,
                        "restaurant_order_id": order_id,
                        "business_id": business_id
                    }
                ).fetchall()

                for addon in addons:

                    addon_id = addon[0]
                    addon_quantity = float(addon[1] or 1)

                    addon_recipe = db.execute(
                        text("""
                            SELECT
                                raw_material_id,
                                quantity_required
                            FROM restaurant_addon_recipes
                            WHERE addon_id = :addon_id
                            AND business_id = :business_id
                        """),
                        {
                            "addon_id": addon_id,
                            "business_id": business_id
                        }
                    ).fetchall()

                    for addon_recipe_item in addon_recipe:

                        raw_material_id = addon_recipe_item[0]
                        quantity_required = float(addon_recipe_item[1])

                        restore_qty = quantity_required * addon_quantity

                        db.execute(
                            text("""
                                UPDATE restaurant_materials
                                SET stock_quantity = stock_quantity + :restore_qty
                                WHERE raw_material_id = :raw_material_id
                                AND business_id = :business_id
                            """),
                            {
                                "restore_qty": restore_qty,
                                "raw_material_id": raw_material_id,
                                "business_id": business_id
                            }
                        )

            db.execute(
                text("""
                    UPDATE restaurant_orders
                    SET
                        order_status = 'pending',
                        kitchen_status = 'pending',
                        payment_type = NULL
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE restaurant_order_items
                    SET item_status = 'pending'
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            if table_id:
                db.execute(
                    text("""
                        UPDATE restaurant_tables
                        SET
                            status = 'Occupied',
                            current_order_id = :order_id
                        WHERE table_id = :table_id
                        AND business_id = :business_id
                    """),
                    {
                        "order_id": order_id,
                        "table_id": table_id,
                        "business_id": business_id
                    }
                )

        return jsonify({
            "message": "Order reopened successfully. Product stock and material stock restored.",
            "restaurant_order_id": order_id
        }), 200

    except Exception as e:
        print("❌ ERROR in reopen_restaurant_order:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ==============================
# UPDATE KITCHEN STATUS
# ==============================

@app.route("/restaurant/update-kitchen-status/<int:restaurant_order_id>", methods=["PUT"])
def update_kitchen_status(restaurant_order_id):
    data = request.json
    kitchen_status = data.get("kitchen_status")

    allowed_statuses = ["pending", "preparing", "ready", "served"]

    if kitchen_status not in allowed_statuses:
        return jsonify({"error": "Invalid kitchen status"}), 400

    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    UPDATE restaurant_orders
                    SET kitchen_status = :kitchen_status
                    WHERE restaurant_order_id = :restaurant_order_id
                    AND business_id = :business_id
                """),
                {
                    "kitchen_status": kitchen_status,
                    "restaurant_order_id": restaurant_order_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE restaurant_order_items
                    SET item_status = :kitchen_status
                    WHERE restaurant_order_id = :restaurant_order_id
                    AND business_id = :business_id
                """),
                {
                    "kitchen_status": kitchen_status,
                    "restaurant_order_id": restaurant_order_id,
                    "business_id": business_id
                }
            )

        return jsonify({"message": "Kitchen status updated"}), 200

    except Exception as e:
        print("❌ ERROR in update_kitchen_status:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ==============================
# GET HELD ORDERS
# ==============================

@app.route("/restaurant/held-orders", methods=["GET"])
def get_held_restaurant_orders():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        orders = execute_query(
            """
            SELECT
                restaurant_order_id,
                order_number,
                order_type,
                table_name,
                waiter_name,
                subtotal,
                vat,
                discount,
                total_price,
                order_status,
                kitchen_status,
                created_at
            FROM restaurant_orders
            WHERE business_id = :business_id
            AND order_status = 'held'
            ORDER BY created_at DESC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted_orders = [
            {
                "restaurant_order_id": row["restaurant_order_id"],
                "order_number": row["order_number"],
                "order_type": row["order_type"],
                "table_name": row["table_name"],
                "waiter_name": row["waiter_name"],
                "subtotal": float(row["subtotal"] or 0),
                "vat": float(row["vat"] or 0),
                "discount": float(row["discount"] or 0),
                "total_price": float(row["total_price"] or 0),
                "order_status": row["order_status"],
                "kitchen_status": row["kitchen_status"],
                "created_at": str(row["created_at"]),
            }
            for row in orders
        ]

        return jsonify({"orders": formatted_orders}), 200

    except Exception as e:
        print("❌ ERROR in get_held_restaurant_orders:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant/orders/<int:order_id>/kitchen-status", methods=["PUT"])
def update_restaurant_kitchen_status(order_id):
    data = request.json
    kitchen_status = data.get("kitchen_status")

    allowed_statuses = ["pending", "preparing", "ready", "served"]

    if kitchen_status not in allowed_statuses:
        return jsonify({"error": "Invalid kitchen status"}), 400

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            order = db.execute(
                text("""
                    SELECT restaurant_order_id
                    FROM restaurant_orders
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                    LIMIT 1
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not order:
                return jsonify({"error": "Order not found"}), 404

            db.execute(
                text("""
                    UPDATE restaurant_orders
                    SET kitchen_status = :kitchen_status
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "kitchen_status": kitchen_status,
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE restaurant_order_items
                    SET item_status = :kitchen_status
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "kitchen_status": kitchen_status,
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

        return jsonify({
            "message": "Kitchen status updated successfully",
            "kitchen_status": kitchen_status
        }), 200

    except Exception as e:
        print("❌ ERROR in update_restaurant_kitchen_status:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant/orders", methods=["GET"])
def get_restaurant_orders():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        payment_type = request.args.get("payment_type", "all")
        status = request.args.get("status", "all")
        view = request.args.get("view", "all")  # all or active

        query = """
            SELECT
                ro.restaurant_order_id,
                ro.order_number,
                ro.order_type,
                ro.table_name,
                ro.waiter_name,
                ro.subtotal,
                ro.vat,
                ro.discount,
                ro.total_price,
                ro.payment_type,
                ro.order_status,
                ro.kitchen_status,
                ro.created_at,
                COALESCE(SUM(roi.profit), 0) AS profit
            FROM restaurant_orders ro
            LEFT JOIN restaurant_order_items roi
                ON ro.restaurant_order_id = roi.restaurant_order_id
                AND ro.business_id = roi.business_id
            WHERE ro.business_id = :business_id
        """

        params = {
            "business_id": business_id
        }

        if view == "active":
            query += " AND ro.order_status IN ('pending', 'held')"

        if start_date and end_date:
            query += " AND DATE(ro.created_at) BETWEEN :start_date AND :end_date"
            params["start_date"] = start_date
            params["end_date"] = end_date

        if payment_type != "all":
            if payment_type == "unpaid":
                query += " AND (ro.payment_type IS NULL OR ro.payment_type = '')"
            else:
                query += " AND ro.payment_type = :payment_type"
                params["payment_type"] = payment_type

        if status != "all":
            query += " AND ro.order_status = :status"
            params["status"] = status

        query += """
            GROUP BY
                ro.restaurant_order_id,
                ro.order_number,
                ro.order_type,
                ro.table_name,
                ro.waiter_name,
                ro.subtotal,
                ro.vat,
                ro.discount,
                ro.total_price,
                ro.payment_type,
                ro.order_status,
                ro.kitchen_status,
                ro.created_at
            ORDER BY ro.created_at DESC
        """

        orders = execute_query(query, params, fetch_all=True)

        formatted_orders = []

        for order in orders:
            is_paid_completed = (
                order["order_status"] == "completed"
                and order["payment_type"] is not None
                and str(order["payment_type"]).strip() != ""
            )

            items = execute_query(
                """
                SELECT
                    restaurant_order_item_id,
                    product_id,
                    product_name,
                    quantity,
                    unit_price,
                    subtotal,
                    buying_price,
                    profit,
                    item_status
                FROM restaurant_order_items
                WHERE restaurant_order_id = :order_id
                AND business_id = :business_id
                ORDER BY restaurant_order_item_id ASC
                """,
                {
                    "order_id": order["restaurant_order_id"],
                    "business_id": business_id
                },
                fetch_all=True
            )

            formatted_items = []

            for item in items:
                addons = execute_query(
                    """
                    SELECT
                        order_item_addon_id,
                        addon_id,
                        addon_name,
                        addon_price,
                        quantity,
                        subtotal
                    FROM restaurant_order_item_addons
                    WHERE restaurant_order_item_id = :restaurant_order_item_id
                    AND restaurant_order_id = :restaurant_order_id
                    AND business_id = :business_id
                    ORDER BY order_item_addon_id ASC
                    """,
                    {
                        "restaurant_order_item_id": item["restaurant_order_item_id"],
                        "restaurant_order_id": order["restaurant_order_id"],
                        "business_id": business_id,
                    },
                    fetch_all=True
                )

                formatted_items.append({
                    "restaurant_order_item_id": item["restaurant_order_item_id"],
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "quantity": float(item["quantity"] or 0),
                    "unit_price": float(item["unit_price"] or 0),
                    "subtotal": float(item["subtotal"] or 0),
                    "buying_price": float(item["buying_price"] or 0),
                    "profit": float(item["profit"] or 0) if is_paid_completed else 0,
                    "item_status": item["item_status"],
                    "addons": [
                        {
                            "order_item_addon_id": addon["order_item_addon_id"],
                            "addon_id": addon["addon_id"],
                            "addon_name": addon["addon_name"],
                            "addon_price": float(addon["addon_price"] or 0),
                            "quantity": float(addon["quantity"] or 0),
                            "subtotal": float(addon["subtotal"] or 0),
                        }
                        for addon in addons
                    ]
                })

            formatted_orders.append({
                "restaurant_order_id": order["restaurant_order_id"],
                "order_number": order["order_number"],
                "order_type": order["order_type"],
                "table_name": order["table_name"],
                "waiter_name": order["waiter_name"],
                "subtotal": float(order["subtotal"] or 0),
                "vat": float(order["vat"] or 0),
                "discount": float(order["discount"] or 0),
                "total_price": float(order["total_price"] or 0),
                "payment_type": order["payment_type"],
                "order_status": order["order_status"],
                "kitchen_status": order["kitchen_status"],
                "profit": float(order["profit"] or 0) if is_paid_completed else 0,
                "created_at": str(order["created_at"]),
                "items": formatted_items
            })

        return jsonify({
            "orders": formatted_orders
        }), 200

    except Exception as e:
        print("❌ ERROR in get_restaurant_orders:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/restaurant/orders/<int:order_id>/checkout", methods=["PUT"])
def checkout_existing_restaurant_order(order_id):
    data = request.json
    payment_type = data.get("payment_type")

    if payment_type not in ["Mpesa", "Cash", "Bank", "Credit"]:
        return jsonify({"error": "Invalid payment type"}), 400

    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            order = db.execute(
                text("""
                    SELECT
                        restaurant_order_id,
                        table_id,
                        order_status
                    FROM restaurant_orders
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                    LIMIT 1
                    FOR UPDATE
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not order:
                return jsonify({"error": "Order not found"}), 404

            table_id = order[1]
            order_status = order[2]

            if order_status == "completed":
                return jsonify({"error": "Order already completed"}), 400

            items = db.execute(
                text("""
                    SELECT
                        restaurant_order_item_id,
                        product_id,
                        quantity
                    FROM restaurant_order_items
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchall()

            for item in items:
                restaurant_order_item_id = item[0]
                restaurant_product_id = item[1]
                quantity = float(item[2])

                product = db.execute(
                    text("""
                        SELECT product_stock
                        FROM restaurant_products
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                        FOR UPDATE
                    """),
                    {
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id
                    }
                ).fetchone()

                if not product:
                    return jsonify({
                        "error": "Product not found",
                        "restaurant_product_id": restaurant_product_id
                    }), 400

                available_stock = float(product[0] or 0)

                if available_stock < quantity:
                    return jsonify({
                        "error": "INSUFFICIENT_STOCK",
                        "message": f"Only {available_stock} item(s) left in stock",
                        "restaurant_product_id": restaurant_product_id
                    }), 400

                product_recipe = db.execute(
                    text("""
                        SELECT
                            rpr.raw_material_id,
                            rpr.quantity_required,
                            rm.material_name,
                            rm.stock_quantity
                        FROM restaurant_product_recipes rpr
                        JOIN restaurant_materials rm
                            ON rpr.raw_material_id = rm.raw_material_id
                            AND rpr.business_id = rm.business_id
                        WHERE rpr.restaurant_product_id = :restaurant_product_id
                        AND rpr.business_id = :business_id
                    """),
                    {
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id
                    }
                ).fetchall()

                for raw_material_id, quantity_required, material_name, stock_quantity in product_recipe:
                    required_qty = float(quantity_required) * quantity
                    available_material = float(stock_quantity or 0)

                    if available_material < required_qty:
                        return jsonify({
                            "error": "INSUFFICIENT_MATERIAL",
                            "message": f"Insufficient {material_name}. Required {required_qty}, available {available_material}",
                            "material_name": material_name
                        }), 400

                addons = db.execute(
                    text("""
                        SELECT
                            addon_id,
                            quantity
                        FROM restaurant_order_item_addons
                        WHERE restaurant_order_item_id = :restaurant_order_item_id
                        AND restaurant_order_id = :restaurant_order_id
                        AND business_id = :business_id
                    """),
                    {
                        "restaurant_order_item_id": restaurant_order_item_id,
                        "restaurant_order_id": order_id,
                        "business_id": business_id
                    }
                ).fetchall()

                addon_recipe_checks = []

                for addon_id, addon_quantity in addons:
                    addon_quantity = float(addon_quantity or 1)

                    addon_recipe = db.execute(
                        text("""
                            SELECT
                                rar.raw_material_id,
                                rar.quantity_required,
                                rm.material_name,
                                rm.stock_quantity
                            FROM restaurant_addon_recipes rar
                            JOIN restaurant_materials rm
                                ON rar.raw_material_id = rm.raw_material_id
                                AND rar.business_id = rm.business_id
                            WHERE rar.addon_id = :addon_id
                            AND rar.business_id = :business_id
                        """),
                        {
                            "addon_id": addon_id,
                            "business_id": business_id
                        }
                    ).fetchall()

                    for raw_material_id, quantity_required, material_name, stock_quantity in addon_recipe:
                        required_qty = float(quantity_required) * addon_quantity
                        available_material = float(stock_quantity or 0)

                        if available_material < required_qty:
                            return jsonify({
                                "error": "INSUFFICIENT_MATERIAL",
                                "message": f"Insufficient {material_name} for add-on. Required {required_qty}, available {available_material}",
                                "material_name": material_name
                            }), 400

                        addon_recipe_checks.append({
                            "raw_material_id": raw_material_id,
                            "required_qty": required_qty
                        })

                for raw_material_id, quantity_required, material_name, stock_quantity in product_recipe:
                    required_qty = float(quantity_required) * quantity

                    db.execute(
                        text("""
                            UPDATE restaurant_materials
                            SET stock_quantity = stock_quantity - :required_qty
                            WHERE raw_material_id = :raw_material_id
                            AND business_id = :business_id
                        """),
                        {
                            "required_qty": required_qty,
                            "raw_material_id": raw_material_id,
                            "business_id": business_id
                        }
                    )

                for addon_item in addon_recipe_checks:
                    db.execute(
                        text("""
                            UPDATE restaurant_materials
                            SET stock_quantity = stock_quantity - :required_qty
                            WHERE raw_material_id = :raw_material_id
                            AND business_id = :business_id
                        """),
                        {
                            "required_qty": addon_item["required_qty"],
                            "raw_material_id": addon_item["raw_material_id"],
                            "business_id": business_id
                        }
                    )

                db.execute(
                    text("""
                        UPDATE restaurant_products
                        SET product_stock = product_stock - :quantity
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id
                    }
                )

            db.execute(
                text("""
                    UPDATE restaurant_orders
                    SET order_status = 'completed',
                        kitchen_status = 'served',
                        payment_type = :payment_type
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "payment_type": payment_type,
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE restaurant_order_items
                    SET item_status = 'served'
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            if table_id:
                db.execute(
                    text("""
                        UPDATE restaurant_tables
                        SET status = 'Available',
                            current_order_id = NULL
                        WHERE table_id = :table_id
                        AND business_id = :business_id
                    """),
                    {
                        "table_id": table_id,
                        "business_id": business_id
                    }
                )

        return jsonify({
            "message": "Restaurant order checked out successfully",
            "restaurant_order_id": order_id
        }), 200

    except Exception as e:
        print("❌ ERROR in checkout_existing_restaurant_order:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/restaurant/orders/<int:order_id>/cancel", methods=["PUT"])
def cancel_restaurant_order(order_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            order = db.execute(
                text("""
                    SELECT table_id, order_status
                    FROM restaurant_orders
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                    LIMIT 1
                    FOR UPDATE
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not order:
                return jsonify({"error": "Order not found"}), 404

            if order[1] == "completed":
                return jsonify({"error": "Completed order cannot be cancelled here"}), 400

            db.execute(
                text("""
                    UPDATE restaurant_orders
                    SET order_status = 'cancelled',
                        kitchen_status = 'not_sent'
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            db.execute(
                text("""
                    UPDATE restaurant_order_items
                    SET item_status = 'cancelled'
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            table_id = order[0]

            if table_id:
                db.execute(
                    text("""
                        UPDATE restaurant_tables
                        SET status = 'Available',
                            current_order_id = NULL
                        WHERE table_id = :table_id
                        AND business_id = :business_id
                    """),
                    {
                        "table_id": table_id,
                        "business_id": business_id
                    }
                )

        return jsonify({
            "message": "Restaurant order cancelled successfully"
        }), 200

    except Exception as e:
        print("❌ ERROR in cancel_restaurant_order:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500   

@app.route("/restaurant/orders/<int:order_id>/status", methods=["PUT"])
def update_restaurant_order_status(order_id):
    data = request.json
    new_status = data.get("order_status")

    allowed_statuses = ["pending", "held", "completed", "cancelled"]

    if new_status not in allowed_statuses:
        return jsonify({"error": "Invalid order status"}), 400

    business_id = get_business_id()
    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            order = db.execute(
                text("""
                    SELECT table_id, order_status
                    FROM restaurant_orders
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                    LIMIT 1
                    FOR UPDATE
                """),
                {
                    "order_id": order_id,
                    "business_id": business_id
                }
            ).fetchone()

            if not order:
                return jsonify({"error": "Order not found"}), 404

            table_id = order[0]

            db.execute(
                text("""
                    UPDATE restaurant_orders
                    SET order_status = :new_status
                    WHERE restaurant_order_id = :order_id
                    AND business_id = :business_id
                """),
                {
                    "new_status": new_status,
                    "order_id": order_id,
                    "business_id": business_id
                }
            )

            if new_status == "cancelled":
                db.execute(
                    text("""
                        UPDATE restaurant_order_items
                        SET item_status = 'cancelled'
                        WHERE restaurant_order_id = :order_id
                        AND business_id = :business_id
                    """),
                    {
                        "order_id": order_id,
                        "business_id": business_id
                    }
                )

                if table_id:
                    db.execute(
                        text("""
                            UPDATE restaurant_tables
                            SET status = 'Available',
                                current_order_id = NULL
                            WHERE table_id = :table_id
                            AND business_id = :business_id
                        """),
                        {
                            "table_id": table_id,
                            "business_id": business_id
                        }
                    )

        return jsonify({"message": "Restaurant order status updated"}), 200

    except Exception as e:
        print("❌ ERROR in update_restaurant_order_status:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500 


@app.route("/restaurant-addons", methods=["GET"])
def get_restaurant_addons():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        addons = execute_query(
            """
            SELECT
                addon_id,
                addon_name,
                addon_price,
                status
            FROM restaurant_addons
            WHERE business_id = :business_id
            AND status = 'Active'
            ORDER BY addon_name ASC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        formatted_addons = [
            {
                "addon_id": row["addon_id"],
                "addon_name": row["addon_name"],
                "addon_price": float(row["addon_price"] or 0),
                "status": row["status"],
            }
            for row in addons
        ]

        return jsonify({"addons": formatted_addons}), 200

    except Exception as e:
        print("❌ ERROR in get_restaurant_addons:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



# ==============================
# RESTAURANT PRODUCTS
# ==============================

# ==============================
# RESTAURANT CATEGORIES
# ==============================

@app.route("/restaurant-categories", methods=["GET"])
def get_restaurant_categories():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        categories = execute_query(
            """
            SELECT category_id, category_name, status
            FROM restaurant_categories
            WHERE business_id = :business_id
            ORDER BY category_name ASC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        return jsonify({
            "categories": [
                {
                    "category_id": row["category_id"],
                    "category_name": row["category_name"],
                    "status": row["status"],
                }
                for row in categories
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting restaurant categories:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-categories", methods=["POST"])
def add_restaurant_category():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    category_name = data.get("category_name")
    status = data.get("status", "Active")

    if not category_name:
        return jsonify({"error": "Category name is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO restaurant_categories
                    (business_id, category_name, status)
                    VALUES (:business_id, :category_name, :status)
                """),
                {
                    "business_id": business_id,
                    "category_name": category_name,
                    "status": status,
                }
            )

        return jsonify({"message": "Restaurant category added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant category:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-categories/<int:category_id>", methods=["PUT"])
def update_restaurant_category(category_id):
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    UPDATE restaurant_categories
                    SET category_name = :category_name,
                        status = :status
                    WHERE category_id = :category_id
                    AND business_id = :business_id
                """),
                {
                    "category_id": category_id,
                    "business_id": business_id,
                    "category_name": data.get("category_name"),
                    "status": data.get("status", "Active"),
                }
            )

        return jsonify({"message": "Restaurant category updated successfully"}), 200

    except Exception as e:
        print("❌ ERROR updating restaurant category:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ==============================
# RESTAURANT MATERIALS
# ==============================

@app.route("/restaurant-materials", methods=["GET"])
def get_restaurant_materials():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        materials = execute_query(
            """
            SELECT
                raw_material_id,
                material_name,
                stock_quantity,
                unit,
                reorder_level,
                status
            FROM restaurant_materials
            WHERE business_id = :business_id
            ORDER BY material_name ASC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        return jsonify({
            "materials": [
                {
                    "raw_material_id": row["raw_material_id"],
                    "material_name": row["material_name"],
                    "stock_quantity": float(row["stock_quantity"] or 0),
                    "unit": row["unit"],
                    "reorder_level": float(row["reorder_level"] or 0),
                    "status": row["status"],
                }
                for row in materials
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting restaurant materials:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-materials", methods=["POST"])
def add_restaurant_material():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    material_name = data.get("material_name")

    if not material_name:
        return jsonify({"error": "Material name is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO restaurant_materials
                    (
                        business_id,
                        material_name,
                        unit,
                        reorder_level,
                        status
                    )
                    VALUES
                    (
                        :business_id,
                        :material_name,
                        :unit,
                        :reorder_level,
                        :status
                    )
                """),
                {
                    "business_id": business_id,
                    "material_name": material_name,
                    "unit": data.get("unit"),
                    "reorder_level": float(data.get("reorder_level", 5)),
                    "status": data.get("status", "Active"),
                }
            )

        return jsonify({"message": "Restaurant material added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant material:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-materials/<int:material_id>", methods=["PUT"])
def update_restaurant_material(material_id):
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    UPDATE restaurant_materials
                    SET material_name = :material_name,
                        unit = :unit,
                        reorder_level = :reorder_level,
                        status = :status
                    WHERE raw_material_id = :material_id
                    AND business_id = :business_id
                """),
                {
                    "material_id": material_id,
                    "business_id": business_id,
                    "material_name": data.get("material_name"),
                    "unit": data.get("unit"),
                    "reorder_level": float(data.get("reorder_level", 5)),
                    "status": data.get("status", "Active"),
                }
            )

        return jsonify({"message": "Restaurant material updated successfully"}), 200

    except Exception as e:
        print("❌ ERROR updating restaurant material:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ==============================
# RESTAURANT PRODUCTS
# ==============================

@app.route("/restaurant-products", methods=["GET"])
def get_restaurant_products():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        products = execute_query(
            """
            SELECT
                rp.restaurant_product_id,
                rp.category_id,
                rp.product_name,
                rp.product_price,
                rp.buying_price,
                rp.product_stock,
                rp.unit,
                rp.description,
                rp.status,
                rc.category_name
            FROM restaurant_products rp
            LEFT JOIN restaurant_categories rc
                ON rp.category_id = rc.category_id
                AND rp.business_id = rc.business_id
            WHERE rp.business_id = :business_id
            ORDER BY rp.created_at DESC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        return jsonify({
            "products": [
                {
                    "product_id": row["restaurant_product_id"],
                    "restaurant_product_id": row["restaurant_product_id"],
                    "category_id": row["category_id"],
                    "category_name": row["category_name"],
                    "product_name": row["product_name"],
                    "product_price": float(row["product_price"] or 0),
                    "buying_price": float(row["buying_price"] or 0),
                    "profit": float(row["product_price"] or 0) - float(row["buying_price"] or 0),
                    "product_stock": float(row["product_stock"] or 0),
                    "unit": row["unit"],
                    "description": row["description"],
                    "status": row["status"],
                    "is_restaurant_product": True,
                }
                for row in products
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting restaurant products:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-products", methods=["POST"])
def add_restaurant_product():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    product_name = data.get("product_name")

    if not product_name:
        return jsonify({"error": "Product name is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO restaurant_products
                    (
                        business_id,
                        category_id,
                        product_name,
                        product_price,
                        buying_price,
                        product_stock,
                        unit,
                        description,
                        status
                    )
                    VALUES
                    (
                        :business_id,
                        :category_id,
                        :product_name,
                        :product_price,
                        :buying_price,
                        0,
                        :unit,
                        :description,
                        :status
                    )
                """),
                {
                    "business_id": business_id,
                    "category_id": data.get("category_id") or None,
                    "product_name": product_name,
                    "product_price": float(data.get("product_price", 0) or 0),
                    "buying_price": float(data.get("buying_price", 0) or 0),
                    "unit": data.get("unit"),
                    "description": data.get("description"),
                    "status": data.get("status", "Active"),
                }
            )

        return jsonify({"message": "Restaurant product added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant product:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-products/<int:product_id>", methods=["PUT"])
def update_restaurant_product(product_id):
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    UPDATE restaurant_products
                    SET category_id = :category_id,
                        product_name = :product_name,
                        product_price = :product_price,
                        buying_price = :buying_price,
                        unit = :unit,
                        description = :description,
                        status = :status
                    WHERE restaurant_product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "product_id": product_id,
                    "business_id": business_id,
                    "category_id": data.get("category_id") or None,
                    "product_name": data.get("product_name"),
                    "product_price": float(data.get("product_price", 0) or 0),
                    "buying_price": float(data.get("buying_price", 0) or 0),
                    "unit": data.get("unit"),
                    "description": data.get("description"),
                    "status": data.get("status", "Active"),
                }
            )

        return jsonify({"message": "Restaurant product updated successfully"}), 200

    except Exception as e:
        print("❌ ERROR updating restaurant product:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/restaurant-products/<int:product_id>", methods=["DELETE"])
def delete_restaurant_product(product_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        with get_db() as db:
            db.execute(
                text("""
                    DELETE FROM restaurant_products
                    WHERE restaurant_product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "product_id": product_id,
                    "business_id": business_id,
                }
            )

        return jsonify({"message": "Restaurant product deleted successfully"}), 200

    except Exception as e:
        print("❌ ERROR deleting restaurant product:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ==============================
# RESTAURANT PRODUCT RECIPE
# ==============================

@app.route("/restaurant-products/<int:product_id>/recipe", methods=["GET"])
def get_restaurant_product_recipe(product_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        recipe = execute_query(
            """
            SELECT
                rpr.recipe_id,
                rpr.raw_material_id,
                rm.material_name,
                rm.unit,
                rpr.quantity_required
            FROM restaurant_product_recipes rpr
            JOIN restaurant_materials rm
                ON rpr.raw_material_id = rm.raw_material_id
                AND rpr.business_id = rm.business_id
            WHERE rpr.restaurant_product_id = :product_id
            AND rpr.business_id = :business_id
            ORDER BY rm.material_name ASC
            """,
            {
                "product_id": product_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        return jsonify({
            "recipe": [
                {
                    "recipe_id": row["recipe_id"],
                    "raw_material_id": row["raw_material_id"],
                    "material_name": row["material_name"],
                    "unit": row["unit"],
                    "quantity_required": float(row["quantity_required"] or 0),
                }
                for row in recipe
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting restaurant recipe:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-products/<int:product_id>/recipe", methods=["POST"])
def save_restaurant_product_recipe(product_id):
    data = request.json
    recipe = data.get("recipe", [])

    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not recipe:
        return jsonify({"error": "Recipe is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    DELETE FROM restaurant_product_recipes
                    WHERE restaurant_product_id = :product_id
                    AND business_id = :business_id
                """),
                {
                    "product_id": product_id,
                    "business_id": business_id
                }
            )

            for item in recipe:
                db.execute(
                    text("""
                        INSERT INTO restaurant_product_recipes
                        (
                            business_id,
                            restaurant_product_id,
                            raw_material_id,
                            quantity_required
                        )
                        VALUES
                        (
                            :business_id,
                            :restaurant_product_id,
                            :raw_material_id,
                            :quantity_required
                        )
                    """),
                    {
                        "business_id": business_id,
                        "restaurant_product_id": product_id,
                        "raw_material_id": item.get("raw_material_id"),
                        "quantity_required": float(item.get("quantity_required", 0)),
                    }
                )

        return jsonify({"message": "Restaurant recipe saved successfully"}), 200

    except Exception as e:
        print("❌ ERROR saving restaurant recipe:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
# ==============================
# RESTAURANT SUPPLIERS
# ==============================

@app.route("/restaurant-suppliers", methods=["GET"])
def get_restaurant_suppliers():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        suppliers = execute_query(
            """
            SELECT supplier_id, supplier_name, phone, email, address, created_at
            FROM restaurant_suppliers
            WHERE business_id = :business_id
            ORDER BY supplier_name ASC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        return jsonify({
            "suppliers": [
                {
                    "supplier_id": row["supplier_id"],
                    "supplier_name": row["supplier_name"],
                    "phone": row["phone"],
                    "email": row["email"],
                    "address": row["address"],
                    "created_at": str(row["created_at"]),
                }
                for row in suppliers
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting restaurant suppliers:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-suppliers", methods=["POST"])
def add_restaurant_supplier():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not data.get("supplier_name"):
        return jsonify({"error": "Supplier name is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    INSERT INTO restaurant_suppliers
                    (business_id, supplier_name, phone, email, address)
                    VALUES (:business_id, :supplier_name, :phone, :email, :address)
                """),
                {
                    "business_id": business_id,
                    "supplier_name": data.get("supplier_name"),
                    "phone": data.get("phone"),
                    "email": data.get("email"),
                    "address": data.get("address"),
                }
            )

        return jsonify({"message": "Supplier added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant supplier:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ==============================
# RESTAURANT STOCK SUPPLY
# ==============================

@app.route("/restaurant-stock-supply", methods=["POST"])
def add_restaurant_stock_supply():
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    item_type = data.get("item_type")
    quantity = float(data.get("quantity", 0))
    total_cost = float(data.get("buying_price", 0))
    buying_price = total_cost / quantity if quantity > 0 else 0

    if item_type not in ["product", "material"]:
        return jsonify({"error": "Invalid item type"}), 400

    if quantity <= 0:
        return jsonify({"error": "Quantity must be greater than 0"}), 400

    try:
        with get_db() as db:
            supplier_id = data.get("supplier_id") or None
            restaurant_product_id = data.get("restaurant_product_id") or None
            raw_material_id = data.get("raw_material_id") or None

            if item_type == "product":
                if not restaurant_product_id:
                    return jsonify({"error": "Select a restaurant product"}), 400

                db.execute(
                    text("""
                        UPDATE restaurant_products
                        SET product_stock = product_stock + :quantity
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id,
                    }
                )

            if item_type == "material":
                if not raw_material_id:
                    return jsonify({"error": "Select a raw material"}), 400

                db.execute(
                    text("""
                        UPDATE restaurant_materials
                        SET stock_quantity = stock_quantity + :quantity
                        WHERE raw_material_id = :raw_material_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "raw_material_id": raw_material_id,
                        "business_id": business_id,
                    }
                )

            db.execute(
                text("""
                    INSERT INTO restaurant_supplier_stock
                    (
                        business_id,
                        supplier_id,
                        item_type,
                        restaurant_product_id,
                        raw_material_id,
                        quantity,
                        buying_price,
                        total_cost,
                        notes
                    )
                    VALUES
                    (
                        :business_id,
                        :supplier_id,
                        :item_type,
                        :restaurant_product_id,
                        :raw_material_id,
                        :quantity,
                        :buying_price,
                        :total_cost,
                        :notes
                    )
                """),
                {
                    "business_id": business_id,
                    "supplier_id": supplier_id,
                    "item_type": item_type,
                    "restaurant_product_id": restaurant_product_id if item_type == "product" else None,
                    "raw_material_id": raw_material_id if item_type == "material" else None,
                    "quantity": quantity,
                    "buying_price": buying_price,
                    "total_cost": total_cost,
                    "notes": data.get("notes"),
                }
            )

        return jsonify({"message": "Stock added successfully"}), 201

    except Exception as e:
        print("❌ ERROR adding restaurant stock:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-stock-supply", methods=["GET"])
def get_restaurant_stock_supply():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        supplies = execute_query(
            """
            SELECT
                rss.stock_id,
                rss.business_id,
                rss.supplier_id,
                rss.item_type,
                rss.restaurant_product_id,
                rss.raw_material_id,
                rss.quantity,
                rss.buying_price,
                rss.total_cost,
                rss.notes,
                rss.created_at,
                rs.supplier_name,
                rp.product_name,
                rm.material_name
            FROM restaurant_supplier_stock rss
            LEFT JOIN restaurant_suppliers rs
                ON rss.supplier_id = rs.supplier_id
                AND rss.business_id = rs.business_id
            LEFT JOIN restaurant_products rp
                ON rss.restaurant_product_id = rp.restaurant_product_id
                AND rss.business_id = rp.business_id
            LEFT JOIN restaurant_materials rm
                ON rss.raw_material_id = rm.raw_material_id
                AND rss.business_id = rm.business_id
            WHERE rss.business_id = :business_id
            ORDER BY rss.created_at DESC
            """,
            {"business_id": business_id},
            fetch_all=True
        )

        return jsonify({
            "supplies": [
                {
                    "stock_id": row["stock_id"],
                    "business_id": row["business_id"],
                    "supplier_id": row["supplier_id"],
                    "item_type": row["item_type"],
                    "restaurant_product_id": row["restaurant_product_id"],
                    "raw_material_id": row["raw_material_id"],
                    "item_name": row["product_name"] if row["item_type"] == "product" else row["material_name"],
                    "supplier_name": row["supplier_name"] or "N/A",
                    "quantity": float(row["quantity"] or 0),
                    "buying_price": float(row["buying_price"] or 0),
                    "total_cost": float(row["total_cost"] or 0),
                    "notes": row["notes"],
                    "created_at": str(row["created_at"]),
                }
                for row in supplies
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting restaurant stock history:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/restaurant-stock-supply/<int:stock_id>", methods=["PUT"])
def update_restaurant_stock_supply(stock_id):
    data = request.json
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    item_type = data.get("item_type")
    quantity = float(data.get("quantity", 0))
    total_cost = float(data.get("buying_price", 0))
    buying_price = total_cost / quantity if quantity > 0 else 0

    if item_type not in ["product", "material"]:
        return jsonify({"error": "Invalid item type"}), 400

    if quantity <= 0:
        return jsonify({"error": "Quantity must be greater than 0"}), 400

    try:
        with get_db() as db:
            old = db.execute(
                text("""
                    SELECT *
                    FROM restaurant_supplier_stock
                    WHERE stock_id = :stock_id
                    AND business_id = :business_id
                """),
                {
                    "stock_id": stock_id,
                    "business_id": business_id,
                }
            ).mappings().fetchone()

            if not old:
                return jsonify({"error": "Stock record not found"}), 404

            # Reverse old stock
            if old["item_type"] == "product" and old["restaurant_product_id"]:
                db.execute(
                    text("""
                        UPDATE restaurant_products
                        SET product_stock = product_stock - :quantity
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": float(old["quantity"] or 0),
                        "restaurant_product_id": old["restaurant_product_id"],
                        "business_id": business_id,
                    }
                )

            if old["item_type"] == "material" and old["raw_material_id"]:
                db.execute(
                    text("""
                        UPDATE restaurant_materials
                        SET stock_quantity = stock_quantity - :quantity
                        WHERE raw_material_id = :raw_material_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": float(old["quantity"] or 0),
                        "raw_material_id": old["raw_material_id"],
                        "business_id": business_id,
                    }
                )

            supplier_id = data.get("supplier_id") or None
            restaurant_product_id = data.get("restaurant_product_id") or None
            raw_material_id = data.get("raw_material_id") or None

            # Apply new stock
            if item_type == "product":
                if not restaurant_product_id:
                    return jsonify({"error": "Select a restaurant product"}), 400

                db.execute(
                    text("""
                        UPDATE restaurant_products
                        SET product_stock = product_stock + :quantity
                        WHERE restaurant_product_id = :restaurant_product_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "restaurant_product_id": restaurant_product_id,
                        "business_id": business_id,
                    }
                )

            if item_type == "material":
                if not raw_material_id:
                    return jsonify({"error": "Select a raw material"}), 400

                db.execute(
                    text("""
                        UPDATE restaurant_materials
                        SET stock_quantity = stock_quantity + :quantity
                        WHERE raw_material_id = :raw_material_id
                        AND business_id = :business_id
                    """),
                    {
                        "quantity": quantity,
                        "raw_material_id": raw_material_id,
                        "business_id": business_id,
                    }
                )

            db.execute(
                text("""
                    UPDATE restaurant_supplier_stock
                    SET
                        supplier_id = :supplier_id,
                        item_type = :item_type,
                        restaurant_product_id = :restaurant_product_id,
                        raw_material_id = :raw_material_id,
                        quantity = :quantity,
                        buying_price = :buying_price,
                        total_cost = :total_cost,
                        notes = :notes
                    WHERE stock_id = :stock_id
                    AND business_id = :business_id
                """),
                {
                    "supplier_id": supplier_id,
                    "item_type": item_type,
                    "restaurant_product_id": restaurant_product_id if item_type == "product" else None,
                    "raw_material_id": raw_material_id if item_type == "material" else None,
                    "quantity": quantity,
                    "buying_price": buying_price,
                    "total_cost": total_cost,
                    "notes": data.get("notes"),
                    "stock_id": stock_id,
                    "business_id": business_id,
                }
            )

        return jsonify({"message": "Stock updated successfully"}), 200

    except Exception as e:
        print("❌ ERROR updating restaurant stock:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def deduct_restaurant_addon_recipe_materials(db, addon_id, quantity, business_id):
    recipe_items = db.execute(
        text("""
            SELECT
                rar.raw_material_id,
                rar.quantity_required,
                rm.material_name,
                rm.stock_quantity
            FROM restaurant_addon_recipes rar
            JOIN restaurant_materials rm
                ON rar.raw_material_id = rm.raw_material_id
                AND rar.business_id = rm.business_id
            WHERE rar.addon_id = :addon_id
            AND rar.business_id = :business_id
        """),
        {
            "addon_id": addon_id,
            "business_id": business_id
        }
    ).fetchall()

    if not recipe_items:
        return

    for raw_material_id, quantity_required, material_name, stock_quantity in recipe_items:
        required_qty = float(quantity_required) * float(quantity)
        available_qty = float(stock_quantity or 0)

        if available_qty < required_qty:
            raise Exception(
                f"Insufficient material stock for add-on {material_name}. "
                f"Required {required_qty}, available {available_qty}"
            )

    for raw_material_id, quantity_required, material_name, stock_quantity in recipe_items:
        required_qty = float(quantity_required) * float(quantity)

        db.execute(
            text("""
                UPDATE restaurant_materials
                SET stock_quantity = stock_quantity - :required_qty
                WHERE raw_material_id = :raw_material_id
                AND business_id = :business_id
            """),
            {
                "required_qty": required_qty,
                "raw_material_id": raw_material_id,
                "business_id": business_id
            }
        )


def restore_restaurant_addon_recipe_materials(db, addon_id, quantity, business_id):
    recipe_items = db.execute(
        text("""
            SELECT
                raw_material_id,
                quantity_required
            FROM restaurant_addon_recipes
            WHERE addon_id = :addon_id
            AND business_id = :business_id
        """),
        {
            "addon_id": addon_id,
            "business_id": business_id
        }
    ).fetchall()

    for raw_material_id, quantity_required in recipe_items:
        restore_qty = float(quantity_required) * float(quantity)

        db.execute(
            text("""
                UPDATE restaurant_materials
                SET stock_quantity = stock_quantity + :restore_qty
                WHERE raw_material_id = :raw_material_id
                AND business_id = :business_id
            """),
            {
                "restore_qty": restore_qty,
                "raw_material_id": raw_material_id,
                "business_id": business_id
            }
        )



@app.route("/restaurant-addons/<int:addon_id>/recipe", methods=["GET"])
def get_restaurant_addon_recipe(addon_id):
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        recipe = execute_query(
            """
            SELECT
                rar.recipe_id,
                rar.raw_material_id,
                rm.material_name,
                rm.unit,
                rar.quantity_required
            FROM restaurant_addon_recipes rar
            JOIN restaurant_materials rm
                ON rar.raw_material_id = rm.raw_material_id
                AND rar.business_id = rm.business_id
            WHERE rar.addon_id = :addon_id
            AND rar.business_id = :business_id
            ORDER BY rm.material_name ASC
            """,
            {
                "addon_id": addon_id,
                "business_id": business_id
            },
            fetch_all=True
        )

        return jsonify({
            "recipe": [
                {
                    "recipe_id": row["recipe_id"],
                    "raw_material_id": row["raw_material_id"],
                    "material_name": row["material_name"],
                    "unit": row["unit"],
                    "quantity_required": float(row["quantity_required"] or 0),
                }
                for row in recipe
            ]
        }), 200

    except Exception as e:
        print("❌ ERROR getting addon recipe:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-addons/<int:addon_id>/recipe", methods=["POST"])
def save_restaurant_addon_recipe(addon_id):
    data = request.json
    recipe = data.get("recipe", [])

    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    if not recipe:
        return jsonify({"error": "Recipe is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                text("""
                    DELETE FROM restaurant_addon_recipes
                    WHERE addon_id = :addon_id
                    AND business_id = :business_id
                """),
                {
                    "addon_id": addon_id,
                    "business_id": business_id
                }
            )

            for item in recipe:
                db.execute(
                    text("""
                        INSERT INTO restaurant_addon_recipes
                        (
                            business_id,
                            addon_id,
                            raw_material_id,
                            quantity_required
                        )
                        VALUES
                        (
                            :business_id,
                            :addon_id,
                            :raw_material_id,
                            :quantity_required
                        )
                    """),
                    {
                        "business_id": business_id,
                        "addon_id": addon_id,
                        "raw_material_id": item.get("raw_material_id"),
                        "quantity_required": float(item.get("quantity_required", 0)),
                    }
                )

        return jsonify({"message": "Add-on recipe saved successfully"}), 200

    except Exception as e:
        print("❌ ERROR saving addon recipe:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/restaurant-dashboard-data", methods=["GET"])
def restaurant_dashboard_data():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    try:
        metrics_rows = execute_query("""
            SELECT
                COALESCE(SUM(total_price), 0) AS total_sales,
                COALESCE(SUM(
                    CASE
                        WHEN MONTH(created_at) = MONTH(CURRENT_DATE())
                        AND YEAR(created_at) = YEAR(CURRENT_DATE())
                        THEN total_price
                        ELSE 0
                    END
                ), 0) AS current_month_sales,
                COUNT(*) AS orders_count
            FROM restaurant_orders
            WHERE business_id = :business_id
            AND order_status = 'completed'
        """, {"business_id": business_id}, fetch_all=True)

        metrics = metrics_rows[0] if metrics_rows else {}

        products_rows = execute_query("""
            SELECT COUNT(*) AS count
            FROM restaurant_products
            WHERE business_id = :business_id
        """, {"business_id": business_id}, fetch_all=True)

        products_count = products_rows[0] if products_rows else {}

        materials_rows = execute_query("""
            SELECT COUNT(*) AS count
            FROM restaurant_materials
            WHERE business_id = :business_id
        """, {"business_id": business_id}, fetch_all=True)

        materials_count = materials_rows[0] if materials_rows else {}

        recent_orders = execute_query("""
            SELECT
                restaurant_order_id,
                order_number,
                order_type,
                table_name,
                waiter_name,
                subtotal,
                vat,
                discount,
                total_price,
                payment_type,
                order_status,
                kitchen_status,
                created_at
            FROM restaurant_orders
            WHERE business_id = :business_id
            ORDER BY created_at DESC
            LIMIT 5
        """, {"business_id": business_id}, fetch_all=True)

        top_products = execute_query("""
            SELECT
                product_name,
                SUM(quantity) AS quantity_sold,
                SUM(subtotal) AS total_sales
            FROM restaurant_order_items
            WHERE business_id = :business_id
            GROUP BY product_id, product_name
            ORDER BY quantity_sold DESC
            LIMIT 5
        """, {"business_id": business_id}, fetch_all=True)

        chart_rows = execute_query("""
            SELECT
                DATE(created_at) AS sale_date,
                COALESCE(SUM(total_price), 0) AS total_sales
            FROM restaurant_orders
            WHERE business_id = :business_id
            AND order_status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY sale_date ASC
            LIMIT 7
        """, {"business_id": business_id}, fetch_all=True)

        profit_rows = execute_query("""
            SELECT
                COALESCE(SUM(roi.profit), 0) AS total_profit
            FROM restaurant_order_items roi
            JOIN restaurant_orders ro
                ON roi.restaurant_order_id = ro.restaurant_order_id
                AND roi.business_id = ro.business_id
            WHERE ro.business_id = :business_id
            AND ro.order_status = 'completed'
            AND ro.payment_type IS NOT NULL
            AND ro.payment_type != ''
        """, {"business_id": business_id}, fetch_all=True)

        profit_data = profit_rows[0] if profit_rows else {}

        return jsonify({
            "metrics": {
                "total_sales": float(metrics.get("total_sales") or 0),
                "current_month_sales": float(metrics.get("current_month_sales") or 0),
                "monthly_target": 125000,
                "orders_count": int(metrics.get("orders_count") or 0),
                "menu_products_count": int(products_count.get("count") or 0),
                "materials_count": int(materials_count.get("count") or 0),
                "customers_count": 0,
                "total_profit": float(profit_data.get("total_profit") or 0),
            },

            "recent_orders": [
                {
                    "restaurant_order_id": row["restaurant_order_id"],
                    "order_number": row["order_number"],
                    "order_type": row["order_type"],
                    "table_name": row["table_name"],
                    "waiter_name": row["waiter_name"],
                    "subtotal": float(row["subtotal"] or 0),
                    "vat": float(row["vat"] or 0),
                    "discount": float(row["discount"] or 0),
                    "total_price": float(row["total_price"] or 0),
                    "payment_type": row["payment_type"],
                    "order_status": row["order_status"],
                    "kitchen_status": row["kitchen_status"],
                    "created_at": str(row["created_at"]),
                }
                for row in recent_orders
            ],

            "top_products": [
                {
                    "product_name": row["product_name"],
                    "quantity_sold": float(row["quantity_sold"] or 0),
                    "total_sales": float(row["total_sales"] or 0),
                }
                for row in top_products
            ],

            "labels": [str(row["sale_date"]) for row in chart_rows],
            "sales": [float(row["total_sales"] or 0) for row in chart_rows],
        }), 200

    except Exception as e:
        print("❌ ERROR loading restaurant dashboard:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def normalize_product_name(name):
    return " ".join(str(name or "").lower().strip().split())


def safe_float(value, default=0):
    try:
        if value is None or str(value).strip() == "" or str(value).lower() == "nan":
            return default
        cleaned = str(value).replace("Ksh", "").replace(",", "").strip()
        return float(cleaned)
    except Exception:
        return default


def get_excel_value(row, possible_columns, default=""):
    for col in possible_columns:
        if col in row and pd.notna(row[col]):
            return row[col]
    return default


@app.route("/products/import-excel", methods=["POST"])
def import_products_excel():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    file = request.files.get("file")
    update_stock = request.form.get("update_stock", "no").lower() == "yes"
    default_category = request.form.get("category_name", "Imported Products")

    if not file:
        return jsonify({"error": "Excel file is required"}), 400

    try:
        df = pd.read_excel(file)
        df.columns = [str(col).strip() for col in df.columns]

        def has_any_column(df, possible_columns):
            return any(col in df.columns for col in possible_columns)

        missing = []

        if not has_any_column(
            df,
            ["Product Name", "product_name", "Book Title", "BOOK TITLE", "Title", "TITLE", "Item Name"],
        ):
            missing.append("Product Name / Book Title")

        if not has_any_column(
            df,
            ["Selling Price", "SELLING PRICE", "selling_price", "Price", "price"],
        ):
            missing.append("Selling Price")

        if not has_any_column(
            df,
            ["Stock", "stock", "QTY IN STOCK", "Qty In Stock", "Quantity", "quantity"],
        ):
            missing.append("Stock / Qty In Stock")

        if missing:
            return jsonify({
                "error": "Excel file columns do not match the expected format.",
                "missing_columns": missing,
                "expected_columns": [
                    "Book Title or Product Name",
                    "Author",
                    "Publisher",
                    "Qty In Stock or Stock",
                    "Buying Price",
                    "Selling Price",
                    "Category",
                    "Unit",
                ],
            }), 400

        imported = 0
        updated = 0
        skipped = 0
        duplicates_found = 0
        errors = []

        with get_db() as db:
            existing_categories = db.execute(
                text("""
                    SELECT category_id, category_name
                    FROM categories
                    WHERE business_id = :business_id
                """),
                {"business_id": business_id},
            ).mappings().fetchall()

            category_map = {
                normalize_product_name(cat["category_name"]): cat["category_id"]
                for cat in existing_categories
            }

            def get_or_create_category(category_name):
                normalized_category = normalize_product_name(category_name)

                if normalized_category in category_map:
                    return category_map[normalized_category]

                result = db.execute(
                    text("""
                        INSERT INTO categories (business_id, category_name)
                        VALUES (:business_id, :category_name)
                    """),
                    {
                        "business_id": business_id,
                        "category_name": category_name,
                    },
                )

                category_id = result.lastrowid
                category_map[normalized_category] = category_id
                return category_id

            existing_products = db.execute(
                text("""
                    SELECT product_id, product_name, product_stock
                    FROM products
                    WHERE business_id = :business_id
                    AND deleted_at IS NULL
                """),
                {"business_id": business_id},
            ).mappings().fetchall()

            product_map = {
                normalize_product_name(product["product_name"]): product
                for product in existing_products
            }

            for index, row in df.iterrows():
                try:
                    row_data = row.to_dict()

                    product_name = get_excel_value(
                        row_data,
                        ["Product Name", "product_name", "Book Title", "BOOK TITLE", "Title", "TITLE", "Item Name"],
                    )

                    if not product_name or str(product_name).lower() == "nan":
                        skipped += 1
                        continue

                    product_name = str(product_name).strip()
                    normalized_name = normalize_product_name(product_name)

                    author = get_excel_value(row_data, ["Author", "AUTHOR"], "")
                    publisher = get_excel_value(row_data, ["Publisher", "PUBLISHER"], "")

                    category_name = get_excel_value(
                        row_data,
                        ["Category", "CATEGORY", "category_name"],
                        default_category,
                    )

                    quantity = safe_float(
                        get_excel_value(
                            row_data,
                            ["Stock", "stock", "QTY IN STOCK", "Qty In Stock", "Quantity", "quantity"],
                            0,
                        )
                    )

                    buying_price = safe_float(
                        get_excel_value(
                            row_data,
                            ["Buying Price", "BUYING PRICE", "buying_price", "Cost Price"],
                            0,
                        )
                    )

                    selling_price = safe_float(
                        get_excel_value(
                            row_data,
                            ["Selling Price", "SELLING PRICE", "selling_price", "Price", "price"],
                            0,
                        )
                    )

                    unit = str(
                        get_excel_value(row_data, ["Unit", "unit"], "pcs")
                    ).strip() or "pcs"

                    description_parts = []

                    if author:
                        description_parts.append(f"Author: {author}")

                    if publisher:
                        description_parts.append(f"Publisher: {publisher}")

                    ignored_columns = [
                        "Product Name", "product_name", "Book Title", "BOOK TITLE",
                        "Title", "TITLE", "Item Name", "Author", "AUTHOR",
                        "Publisher", "PUBLISHER", "Stock", "stock",
                        "QTY IN STOCK", "Qty In Stock", "Quantity", "quantity",
                        "Buying Price", "BUYING PRICE", "buying_price", "Cost Price",
                        "Selling Price", "SELLING PRICE", "selling_price",
                        "Price", "price", "Category", "CATEGORY",
                        "category_name", "Unit", "unit",
                    ]

                    for key, value in row_data.items():
                        if pd.notna(value) and key not in ignored_columns:
                            description_parts.append(f"{key}: {value}")

                    product_description = "\n".join(description_parts)
                    category_id = get_or_create_category(str(category_name).strip())

                    if normalized_name in product_map:
                        duplicates_found += 1
                        existing_product = product_map[normalized_name]

                        if update_stock:
                            db.execute(
                                text("""
                                    UPDATE products
                                    SET
                                        product_stock = product_stock + :quantity,
                                        product_price = :selling_price,
                                        buying_price = :buying_price,
                                        product_description = :product_description,
                                        category_id_fk = :category_id_fk,
                                        unit = :unit
                                    WHERE product_id = :product_id
                                    AND business_id = :business_id
                                """),
                                {
                                    "quantity": quantity,
                                    "selling_price": selling_price,
                                    "buying_price": buying_price,
                                    "product_description": product_description,
                                    "category_id_fk": category_id,
                                    "unit": unit,
                                    "product_id": existing_product["product_id"],
                                    "business_id": business_id,
                                },
                            )
                        else:
                            db.execute(
                                text("""
                                    UPDATE products
                                    SET
                                        product_price = :selling_price,
                                        buying_price = :buying_price,
                                        product_description = :product_description,
                                        category_id_fk = :category_id_fk,
                                        unit = :unit
                                    WHERE product_id = :product_id
                                    AND business_id = :business_id
                                """),
                                {
                                    "selling_price": selling_price,
                                    "buying_price": buying_price,
                                    "product_description": product_description,
                                    "category_id_fk": category_id,
                                    "unit": unit,
                                    "product_id": existing_product["product_id"],
                                    "business_id": business_id,
                                },
                            )

                        updated += 1

                    else:
                        db.execute(
                            text("""
                                INSERT INTO products
                                (
                                    business_id,
                                    product_number,
                                    product_name,
                                    product_price,
                                    buying_price,
                                    product_stock,
                                    product_description,
                                    category_id_fk,
                                    unit
                                )
                                VALUES
                                (
                                    :business_id,
                                    :product_number,
                                    :product_name,
                                    :product_price,
                                    :buying_price,
                                    :product_stock,
                                    :product_description,
                                    :category_id_fk,
                                    :unit
                                )
                            """),
                            {
                                "business_id": business_id,
                                "product_number": "1000",
                                "product_name": product_name,
                                "product_price": selling_price,
                                "buying_price": buying_price,
                                "product_stock": quantity,
                                "product_description": product_description,
                                "category_id_fk": category_id,
                                "unit": unit,
                            },
                        )

                        imported += 1
                        product_map[normalized_name] = {
                            "product_id": None,
                            "product_name": product_name,
                            "product_stock": quantity,
                        }

                except Exception as row_error:
                    errors.append({
                        "row": int(index) + 2,
                        "error": str(row_error),
                    })

        return jsonify({
            "message": "Excel import completed",
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "duplicates_found": duplicates_found,
            "errors": errors,
            "update_stock": update_stock,
        }), 200

    except Exception as e:
        print("❌ ERROR importing products Excel:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/products/preview-import-excel", methods=["POST"])
def preview_products_excel():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business ID not found"}), 401

    file = request.files.get("file")
    default_category = request.form.get(
        "category_name",
        "Imported Products"
    )

    if not file:
        return jsonify({"error": "Excel file is required"}), 400

    try:
        df = pd.read_excel(file)
        df.columns = [str(col).strip() for col in df.columns]

        # Validate Excel columns
        def has_any_column(df, possible_columns):
            return any(
                col in df.columns
                for col in possible_columns
            )

        missing = []

        if not has_any_column(
            df,
            [
                "Product Name",
                "product_name",
                "Book Title",
                "BOOK TITLE",
                "Title",
                "TITLE",
                "Item Name"
            ]
        ):
            missing.append("Product Name / Book Title")

        if not has_any_column(
            df,
            [
                "Selling Price",
                "SELLING PRICE",
                "selling_price",
                "Price",
                "price"
            ]
        ):
            missing.append("Selling Price")

        if not has_any_column(
            df,
            [
                "Stock",
                "stock",
                "QTY IN STOCK",
                "Qty In Stock",
                "Quantity",
                "quantity"
            ]
        ):
            missing.append("Stock / Qty In Stock")

        if missing:
            return jsonify({
                "error": "Excel file columns do not match the expected format.",
                "missing_columns": missing,
                "expected_columns": [
                    "Book Title or Product Name",
                    "Author",
                    "Publisher",
                    "Qty In Stock or Stock",
                    "Buying Price",
                    "Selling Price",
                    "Category",
                    "Unit"
                ]
            }), 400

        with get_db() as db:
            existing_products = db.execute(
                text("""
                    SELECT product_name
                    FROM products
                    WHERE business_id = :business_id
                    AND deleted_at IS NULL
                """),
                {"business_id": business_id}
            ).mappings().fetchall()

            existing_names = {
                normalize_product_name(product["product_name"])
                for product in existing_products
            }

        preview_products = []

        for _, row in df.iterrows():
            row_data = row.to_dict()

            product_name = get_excel_value(
                row_data,
                [
                    "Product Name",
                    "product_name",
                    "Book Title",
                    "BOOK TITLE",
                    "Title",
                    "TITLE",
                    "Item Name",
                ],
            )

            if not product_name or str(product_name).lower() == "nan":
                continue

            product_name = str(product_name).strip()
            normalized_name = normalize_product_name(product_name)

            author = get_excel_value(
                row_data,
                ["Author", "AUTHOR"],
                ""
            )

            publisher = get_excel_value(
                row_data,
                ["Publisher", "PUBLISHER"],
                ""
            )

            category_name = get_excel_value(
                row_data,
                [
                    "Category",
                    "CATEGORY",
                    "category_name",
                ],
                default_category,
            )

            quantity = safe_float(
                get_excel_value(
                    row_data,
                    [
                        "Stock",
                        "stock",
                        "QTY IN STOCK",
                        "Qty In Stock",
                        "Quantity",
                        "quantity",
                    ],
                    0,
                )
            )

            buying_price = safe_float(
                get_excel_value(
                    row_data,
                    [
                        "Buying Price",
                        "BUYING PRICE",
                        "buying_price",
                        "Cost Price",
                    ],
                    0,
                )
            )

            selling_price = safe_float(
                get_excel_value(
                    row_data,
                    [
                        "Selling Price",
                        "SELLING PRICE",
                        "selling_price",
                        "Price",
                        "price",
                    ],
                    0,
                )
            )

            description_parts = []

            if author:
                description_parts.append(
                    f"Author: {author}"
                )

            if publisher:
                description_parts.append(
                    f"Publisher: {publisher}"
                )

            preview_products.append({
                "product_name": product_name,
                "category_name": str(category_name).strip(),
                "quantity": quantity,
                "buying_price": buying_price,
                "selling_price": selling_price,
                "product_description": "\n".join(description_parts),
                "exists": normalized_name in existing_names,
            })

        return jsonify({
            "products": preview_products,
            "total": len(preview_products),
            "existing": sum(
                1 for p in preview_products
                if p["exists"]
            ),
            "new": sum(
                1 for p in preview_products
                if not p["exists"]
            ),
        }), 200

    except Exception as e:
        print(
            "❌ ERROR previewing products Excel:",
            str(e)
        )
        traceback.print_exc()

        return jsonify({
            "error": str(e)
        }), 500



@app.route("/update-sales-target", methods=["PUT"])
def update_sales_target():
    business_id = get_business_id()

    if not business_id:
        return jsonify({"error": "Business not found"}), 401

    data = request.get_json()
    monthly_target = data.get("monthly_target")

    if not monthly_target:
        return jsonify({"error": "Monthly target required"}), 400

    try:
        with get_db() as conn:
            conn.execute(
                text("""
                    UPDATE businesses
                    SET monthly_target = :monthly_target
                    WHERE id = :business_id
                """),
                {
                    "monthly_target": monthly_target,
                    "business_id": business_id,
                },
            )
            conn.commit()

        return jsonify({"success": True})

    except Exception as e:
        print("Error in /update-sales-target:", str(e))
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)