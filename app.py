from flask import Flask, render_template, request, redirect, url_for, session, jsonify, make_response
import mysql.connector
from mysql.connector import Error
import smtplib
from email.message import EmailMessage
import hashlib
from itsdangerous import URLSafeTimedSerializer
from flask_cors import CORS
from datetime import datetime
import pytz
from decimal import Decimal
from mysql.connector import pooling
from datetime import datetime, timedelta
import random
from google.cloud import vision
from werkzeug.utils import secure_filename
import os
from zoneinfo import ZoneInfo
#from sync import sync_all_tables
from db import get_db_connection, get_db_connection


app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Change this to a secure key
CORS(app)

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Email Configuration
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_ADDRESS = "peakersdesign@gmail.com"
EMAIL_PASSWORD = "kcve sdei nljz aoix"  # Use the App Password

@app.route("/login", methods=["GET", "POST"])
def login():
    error_message = None  # Default: No error message

    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        conn = get_db_connection()
        if not conn:
            return render_template("login.html", error_message="❌ Database connection failed.")

        try:
            cursor = conn.cursor(dictionary=True)
            query = "SELECT * FROM users WHERE (username=%s OR user_email=%s)"
            cursor.execute(query, (username, username))
            user = cursor.fetchone()

            # ✅ Check credentials
            if user and user["user_password"] == hashlib.sha256(password.encode()).hexdigest():
                session["user"] = user["username"]
                return redirect(url_for("dashboard"))
            else:
                error_message = "Invalid credentials. Please try again."
        except Exception as e:
            print(f"❌ Error during login: {e}")
            error_message = "An error occurred during login."
        finally:
            cursor.close()
            conn.close()

    # 🔐 Prevent caching of login page
    response = make_response(render_template("login.html", error_message=error_message))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/check-session")
def check_session():
    if "user" not in session:
        return jsonify({"logged_in": False}), 401
    return jsonify({"logged_in": True}), 200



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
    BASE_URL = "http://zippie.peakerspointofsale.co.ke"  # <-- your public IP here

    if request.method == "POST":
        data = request.json
        email = data.get("email")

        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE user_email = %s", (email,))
            user = cursor.fetchone()

            if user:
                token = generate_token(email)
                # Use BASE_URL instead of url_for(_external=True)
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
        finally:
            cursor.close()
            conn.close()

    return render_template("forgot_password.html")


# Reset Password Page
@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    email = verify_token(token)
    print(f"Debug: Token={token}, Email={email}")  # Optional debug

    if not email:
        return jsonify({"error": "Invalid or expired token"}), 400

    if request.method == 'POST':
        if not request.is_json:
            return jsonify({"error": "Missing JSON in request"}), 400

        data = request.get_json()
        new_password = data.get("password")
        print(f"Debug: Received password={new_password}")  # Optional debug

        if not new_password:
            return jsonify({"error": "Password is required"}), 400

        hashed_password = hashlib.sha256(new_password.encode()).hexdigest()

        # ✅ Get a connection from the pool
        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET user_password = %s WHERE user_email = %s",
                (hashed_password, email.lower())
            )
            conn.commit()
            print("✅ Password updated successfully")  # Optional debug
            return jsonify({"message": "Password reset successful!"}), 200
        except Exception as e:
            conn.rollback()
            print(f"❌ Error updating password: {e}")
            return jsonify({"error": "Database update failed"}), 500
        finally:
            cursor.close()
            conn.close()

    # Render the reset password HTML page for GET requests
    return render_template("reset_password.html", token=token)


#Admin Dashboard
@app.route("/sales-data")
def sales_data():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        
        # Get current month dates
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
        cursor.execute(date_range_query)
        date_range = cursor.fetchone()
        
        # Generate all months in range
        all_months_query = """
            WITH RECURSIVE months AS (
                SELECT %s AS month_start
                UNION ALL
                SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
                FROM months
                WHERE month_start < %s
            )
            SELECT DATE_FORMAT(month_start, '%b') AS month_abbr,
                   DATE_FORMAT(month_start, '%Y-%m') AS month_key
            FROM months
            ORDER BY month_start
            LIMIT 6
        """
        cursor.execute(all_months_query, (date_range['start_date'], date_range['end_date']))
        all_months = cursor.fetchall()
        
        # Get sales data for chart
        sales_query = """
            SELECT 
                DATE_FORMAT(s.sale_date, '%b') AS month,
                DATE_FORMAT(s.sale_date, '%Y-%m') AS month_key,
                SUM(s.total_price) AS total_sales
            FROM 
                sales s
            WHERE 
                s.sale_date >= %s
                AND s.sale_date <= %s
                AND s.status = 'completed'
            GROUP BY 
                month_key, month
        """
        cursor.execute(sales_query, (date_range['start_date'], date_range['end_date']))
        sales_data = cursor.fetchall()
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
        
        # Get metrics data (now calculating both total and monthly sales)
        metrics_query = """
            SELECT 
                (SELECT COUNT(*) FROM products) AS products_count,
                (SELECT COUNT(*) FROM sales WHERE status = 'completed') AS orders_count,
                (SELECT COUNT(*) FROM customers) AS customers_count,
                (SELECT SUM(total_price) FROM sales WHERE status = 'completed') AS total_sales,
                (SELECT SUM(total_price) FROM sales 
                 WHERE status = 'completed'
                 AND sale_date BETWEEN %s AND %s) AS current_month_sales
        """
        cursor.execute(metrics_query, (first_day_of_month, last_day_str))
        metrics = cursor.fetchone()
        
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
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


@app.route("/add-customer", methods=["POST"])
def add_customer():
    data = request.json
    customer_name = data.get("customer_name")
    phone = data.get("phone", "").strip() or None
    email = data.get("email", "").strip() or None
    address = data.get("address", "").strip() or None

    if not customer_name:
        return jsonify({"error": "Customer name is required"}), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO customers (customer_name, phone, email, address) VALUES (%s, %s, %s, %s)",
            (customer_name, phone, email, address)
        )
        conn.commit()

        return jsonify({"message": "Customer registered successfully!"}), 201

    except mysql.connector.Error as e:
        print("❌ MySQL Error:", e)
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
       
@app.route("/update-customer/<int:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid or missing JSON data"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE customers
            SET customer_name = %s, phone = %s, email = %s, address = %s
            WHERE customer_id = %s
            """,
            (
                data.get("customer_name"),
                data.get("phone"),
                data.get("email"),
                data.get("address"),
                customer_id
            )
        )
        conn.commit()
        return jsonify({"message": "Customer updated successfully!"}), 200
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating customer: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

       

@app.route("/get-products", methods=["GET"])
def manage_products():
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        # 🔹 Get total product count
        cursor.execute("SELECT COUNT(*) AS total FROM products")
        total_products = cursor.fetchone()["total"]

        # 🔹 Fetch products with CALCULATED buying price
        cursor.execute(
            """
            SELECT 
                p.product_id, 
                p.product_number, 
                p.product_name, 
                p.product_price,

                -- ✅ BUYING PRICE = TOTAL PRICE / TOTAL STOCK
                COALESCE(
                    ROUND(
                        SUM(sp.price) / NULLIF(SUM(sp.stock_supplied), 0),
                        2
                    ),
                    0
                ) AS buying_price,

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

            LEFT JOIN supplier_products sp 
                ON p.product_id = sp.product_id

            GROUP BY p.product_id
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (per_page, offset),
        )

        products = cursor.fetchall()

        # 🔹 Format response
        formatted_products = []
        for row in products:
            formatted_products.append({
                "product_id": row["product_id"],
                "product_number": row["product_number"],
                "product_name": row["product_name"],
                "product_price": row["product_price"],
                "buying_price": float(row["buying_price"]),
                "product_stock": row["product_stock"],
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
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()



@app.route("/get-bundles", methods=["GET"])
def get_bundles():
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1️⃣ Get bundle stock, selling price, buying price, product count
        cursor.execute("""
            SELECT 
                pb.bundle_id,
                MIN(FLOOR(p.product_stock / pb.quantity)) AS bundle_stock,
                MAX(pb.selling_price) AS selling_price,
                SUM(p.buying_price * pb.quantity) AS buying_price,
                SUM(pb.quantity) AS products_count
            FROM product_bundles pb
            JOIN products p ON p.product_id = pb.child_product_id
            GROUP BY pb.bundle_id
        """)
        bundles = cursor.fetchall()

        result = []

        for bundle in bundles:
            bundle_id = bundle["bundle_id"]

            # 2️⃣ Get bundle items
            cursor.execute("""
                SELECT 
                    p.product_id,
                    p.product_name,
                    pb.quantity
                FROM product_bundles pb
                JOIN products p ON p.product_id = pb.child_product_id
                WHERE pb.bundle_id = %s
            """, (bundle_id,))
            items = cursor.fetchall()

            bundle_name = "Bundle of " + " + ".join(
                item["product_name"] for item in items
            )

            result.append({
                "bundle_id": bundle_id,
                "product_name": bundle_name,
                "product_price": bundle["selling_price"],
                "buying_price": bundle["buying_price"],   # ✅ calculated
                "product_stock": bundle["bundle_stock"],
                "products_count": bundle["products_count"],  # ✅ count
                "is_bundle": True,
                "items": items
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        

@app.route("/add-product", methods=["POST"])
def add_product():
    conn = None
    cursor = None
    try:
        data = request.json
        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        buying_price = data.get("buying_price", 0)  # Default to 0 if not provided
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")
        unit = data.get("unit")
        expiry_date = data.get("expiry_date")
        reorder_threshold = data.get("reorder_threshold", 5)
        ingredients = data.get("ingredients")  # Optional list of material_ids

        if not all([product_number, product_name, product_price, category_id_fk]):
            return jsonify({"error": "All fields except description are required"}), 400

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        product_stock = 0

        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert product
        query = """
            INSERT INTO products (
                product_number, product_name, product_price, buying_price, product_stock,
                product_description, created_at, category_id_fk,
                unit, expiry_date, reorder_threshold
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            product_number, product_name, product_price, buying_price, product_stock,
            product_description, created_at, category_id_fk,
            unit, expiry_date, reorder_threshold
        ))
        conn.commit()
        product_id = cursor.lastrowid

        # Insert optional ingredients
        if ingredients and isinstance(ingredients, list):
            for material_id in ingredients:
                cursor.execute(
                    "INSERT INTO product_recipes (product_id, material_id, quantity) VALUES (%s, %s, %s)",
                    (product_id, material_id, 0)  # Default quantity
                )
            conn.commit()

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
                "created_at": created_at
            }
        }), 201

    except Exception as e:
        print("Error adding product:", e)
        return jsonify({"error": "Internal server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.route("/add-bundle", methods=["POST"])
def add_bundle():
    conn = None
    cursor = None
    try:
        data = request.json

        bundle_items = data.get("bundle_items", [])
        selling_price = data.get("selling_price")

        if not bundle_items:
            return jsonify({"error": "Bundle must contain products"}), 400

        if selling_price is None:
            return jsonify({"error": "Selling price is required"}), 400

        child_product_ids = [item["product_id"] for item in bundle_items]

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 🔒 Block duplicate bundle products
        format_strings = ",".join(["%s"] * len(child_product_ids))
        cursor.execute(f"""
            SELECT 1
            FROM product_bundles
            WHERE child_product_id IN ({format_strings})
            LIMIT 1
        """, tuple(child_product_ids))

        if cursor.fetchone():
            return jsonify({
                "error": "The product bundle is already available"
            }), 409

        # Generate new bundle_id
        cursor.execute("SELECT IFNULL(MAX(bundle_id), 0) + 1 AS next_id FROM product_bundles")
        bundle_id = cursor.fetchone()["next_id"]

        for item in bundle_items:
            cursor.execute("""
                INSERT INTO product_bundles (
                    bundle_id,
                    parent_product_id,
                    child_product_id,
                    quantity,
                    selling_price
                )
                VALUES (%s, %s, %s, %s, %s)
            """, (
                bundle_id,
                bundle_id,
                item["product_id"],
                item["quantity"],
                selling_price
            ))

        conn.commit()

        return jsonify({
            "message": "Bundle created successfully",
            "bundle_id": bundle_id
        }), 201

    except Exception as e:
        print("Error adding bundle:", e)
        return jsonify({"error": "Internal server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/update-bundle/<int:bundle_id>", methods=["PUT"])
def update_bundle(bundle_id):
    conn = None
    cursor = None

    try:
        data = request.json
        bundle_items = data.get("bundle_items", [])
        selling_price = data.get("selling_price")

        if not bundle_items:
            return jsonify({"error": "Bundle must contain products"}), 400

        if selling_price is None:
            return jsonify({"error": "Selling price is required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 🔒 Ensure bundle exists
        cursor.execute(
            "SELECT 1 FROM product_bundles WHERE bundle_id = %s LIMIT 1",
            (bundle_id,)
        )
        if not cursor.fetchone():
            return jsonify({"error": "Bundle not found"}), 404

        # 🔥 Remove existing bundle items
        cursor.execute(
            "DELETE FROM product_bundles WHERE bundle_id = %s",
            (bundle_id,)
        )

        # ♻️ Re-insert updated bundle items
        for item in bundle_items:
            cursor.execute("""
                INSERT INTO product_bundles (
                    bundle_id,
                    parent_product_id,
                    child_product_id,
                    quantity,
                    selling_price
                )
                VALUES (%s, %s, %s, %s, %s)
            """, (
                bundle_id,
                bundle_id,
                item["product_id"],
                item["quantity"],
                selling_price
            ))

        conn.commit()

        return jsonify({
            "message": "Bundle updated successfully"
        }), 200

    except Exception as e:
        print("Error updating bundle:", e)
        return jsonify({"error": "Internal server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.route("/updating-product/<int:product_id>", methods=["PUT"])
def updating_product(product_id):
    conn = None
    cursor = None
    try:
        data = request.json
        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        buying_price = data.get("buying_price", 0)  # Default to 0 if not provided
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")
        unit = data.get("unit")
        expiry_date = data.get("expiry_date")
        reorder_threshold = data.get("reorder_threshold", 0)
        ingredients = data.get("ingredients")  # Optional list of material_ids

        if not all([product_number, product_name, product_price, category_id_fk]):
            return jsonify({"error": "Missing required fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ✅ Update product info
        update_query = """
            UPDATE products
            SET product_number=%s,
                product_name=%s,
                product_price=%s,
                buying_price=%s,
                product_description=%s,
                category_id_fk=%s,
                unit=%s,
                expiry_date=%s,
                reorder_threshold=%s
            WHERE product_id=%s
        """
        cursor.execute(update_query, (
            product_number, product_name, product_price, buying_price,
            product_description, category_id_fk,
            unit, expiry_date, reorder_threshold,
            product_id
        ))

        if ingredients is not None and isinstance(ingredients, list):
            # ✅ Fetch existing ingredients
            cursor.execute(
                "SELECT material_id, quantity FROM product_recipes WHERE product_id = %s",
                (product_id,)
            )
            existing_rows = cursor.fetchall()
            existing_map = {row["material_id"]: row["quantity"] for row in existing_rows}

            selected_set = set(ingredients)
            existing_set = set(existing_map.keys())

            # ✅ Delete removed ingredients
            to_delete = list(existing_set - selected_set)
            if to_delete:
                placeholders = ",".join(["%s"] * len(to_delete))
                query = f"DELETE FROM product_recipes WHERE product_id = %s AND material_id IN ({placeholders})"
                params = (product_id,) + tuple(to_delete)
                cursor.execute(query, params)

            # ✅ Add new ingredients
            to_add = selected_set - existing_set
            for mat_id in to_add:
                cursor.execute(
                    "INSERT INTO product_recipes (product_id, material_id, quantity) VALUES (%s, %s, %s)",
                    (product_id, mat_id, 0)
                )

            # ✅ Keep existing ones as is

        conn.commit()
        return jsonify({"message": "Product updated successfully"}), 200

    except Exception as e:
        print("Error updating product:", e)
        return jsonify({"error": "Internal server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.route("/get-product-ingredients/<int:product_id>", methods=["GET"])
def get_product_ingredients(product_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT m.material_id, m.material_name, m.unit
            FROM product_recipes pr
            JOIN raw_materials m ON pr.material_id = m.material_id
            WHERE pr.product_id = %s
        """, (product_id,))
        
        ingredients = cursor.fetchall()

        return jsonify({"ingredients": ingredients}), 200

    except Exception as e:
        print("Error fetching ingredients:", e)
        return jsonify({"error": "Internal server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.route("/add-material", methods=["POST"])
def add_material():
    data = request.json
    material_name = data.get("material_name")
    unit = data.get("unit")
    
    if not material_name or not unit:
        return jsonify({"error": "Material name and unit are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO raw_materials (material_name, unit) VALUES (%s, %s)",
            (material_name, unit)
        )
        conn.commit()
        return jsonify({"message": "Material added successfully"}), 201
    except Exception as e:
        print("❌ Error in /add-material:", e)
        return jsonify({"error": "Failed to add material"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/get-materials", methods=["GET"])
def get_materials():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM raw_materials")
        materials = cursor.fetchall()
        return jsonify({"materials": materials}), 200
    except Exception as e:
        print("❌ Error in /get-materials:", e)
        return jsonify({"error": "Failed to retrieve materials"}), 500
    finally:
        cursor.close()
        conn.close()



@app.route("/add-recipe", methods=["POST"])
def add_recipe():
    try:
        data = request.json
        product_id = data.get("product_id")
        new_materials = data.get("materials")

        if not product_id or not new_materials:
            return jsonify({"error": "Product ID and materials are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Get current product stock
        cursor.execute("SELECT product_stock FROM products WHERE product_id = %s", (product_id,))
        product_row = cursor.fetchone()
        if not product_row:
            return jsonify({"error": "Product not found"}), 404
        product_stock = product_row["product_stock"]

        # 2. Get existing recipe (if any)
        cursor.execute(
            "SELECT material_id, quantity FROM product_recipes WHERE product_id = %s",
            (product_id,)
        )
        existing_recipe = {row["material_id"]: row["quantity"] for row in cursor.fetchall()}

        # 3. Compare and calculate differences
        material_diffs = {}  # {material_id: diff_quantity}
        for item in new_materials:
            material_id = item.get("material_id")
            new_quantity_per_unit = item.get("quantity", 0)
            old_quantity_per_unit = existing_recipe.get(material_id, 0)

            diff = (new_quantity_per_unit - old_quantity_per_unit) * product_stock
            material_diffs[material_id] = diff

        # 4. Check if materials are sufficient for increase
        for material_id, diff_qty in material_diffs.items():
            if diff_qty > 0:
                # Only check for additions
                cursor.execute(
                    "SELECT quantity FROM material_supplies WHERE material_id = %s",
                    (material_id,)
                )
                material = cursor.fetchone()
                available_qty = material["quantity"] if material else 0

                if available_qty < diff_qty:
                    return jsonify({
                        "error": f"Insufficient stock for material ID {material_id}. Needed: {diff_qty}, Available: {available_qty}"
                    }), 400

        # 5. Revert material stock from old recipe
        for material_id, old_quantity_per_unit in existing_recipe.items():
            cursor.execute("""
                UPDATE material_supplies
                SET quantity = quantity + %s
                WHERE material_id = %s
            """, (old_quantity_per_unit * product_stock, material_id))

        # 6. Apply material stock changes for new recipe
        for item in new_materials:
            material_id = item["material_id"]
            quantity_per_unit = item["quantity"]
            used_total = quantity_per_unit * product_stock

            cursor.execute("""
                UPDATE material_supplies
                SET quantity = quantity - %s
                WHERE material_id = %s
            """, (used_total, material_id))

        # 7. Clear old recipe
        cursor.execute("DELETE FROM product_recipes WHERE product_id = %s", (product_id,))

        # 8. Insert updated recipe
        for item in new_materials:
            material_id = item["material_id"]
            quantity = item["quantity"]
            cursor.execute("""
                INSERT INTO product_recipes (product_id, material_id, quantity)
                VALUES (%s, %s, %s)
            """, (product_id, material_id, quantity))

        conn.commit()
        return jsonify({"message": "Recipe updated successfully"}), 201

    except Exception as e:
        print("❌ Error adding recipe:", str(e))
        return jsonify({"error": "Internal server error"}), 500

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass




@app.route("/getting-recipe/<int:product_id>", methods=["GET"])
def getting_recipe(product_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT rm.material_name, rm.unit, pr.quantity
            FROM product_recipes pr
            JOIN raw_materials rm ON pr.material_id = rm.material_id
            WHERE pr.product_id = %s
        """, (product_id,))
        recipe = cursor.fetchall()
        return jsonify({"recipe": recipe}), 200
    except Exception as e:
        print("❌ Error fetching recipe:", str(e))
        return jsonify({"error": "Failed to fetch recipe"}), 500
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

@app.route("/get-recipe/<int:product_id>", methods=["GET"])
def get_recipe(product_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT r.material_id, r.quantity, m.material_name, m.unit
        FROM product_recipes r
        JOIN raw_materials m ON r.material_id = m.material_id
        WHERE r.product_id = %s
    """
    cursor.execute(query, (product_id,))
    recipe = cursor.fetchall()
    
    cursor.close()
    conn.close()

    return jsonify({"recipe": recipe}), 200



@app.route("/update-material/<int:material_id>", methods=["PUT"])
def update_material(material_id):
    data = request.json

    if not data.get("material_name") or not data.get("unit"):
        return jsonify({"error": "Material name and unit are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE raw_materials
            SET material_name = %s, unit = %s
            WHERE material_id = %s
        """, (data["material_name"], data["unit"], material_id))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Material not found"}), 404

        return jsonify({"message": "Material updated"}), 200
    except Exception as e:
        print("❌ Error updating material:", str(e))
        return jsonify({"error": "Failed to update material"}), 500
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass


@app.route("/delete-material/<int:material_id>", methods=["DELETE"])
def delete_material(material_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM raw_materials WHERE material_id = %s", (material_id,))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Material not found"}), 404

        return jsonify({"message": "Material deleted"}), 200
    except Exception as e:
        print("❌ Error deleting material:", str(e))
        return jsonify({"error": "Failed to delete material"}), 500
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

@app.route("/add-material-supply", methods=["POST"])
def add_material_supply():
    try:
        data = request.json
        material_id = data.get("material_id")
        supplier_name = data.get("supplier_name")
        quantity = data.get("quantity")
        unit_price = data.get("unit_price")

        if not all([material_id, quantity, unit_price]):
            return jsonify({"error": "Missing required fields"}), 400

        total_cost = float(quantity) * float(unit_price)
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO material_supplies (material_id, supplier_name, quantity, unit_price, total_cost)
            VALUES (%s, %s, %s, %s, %s)
        """, (material_id, supplier_name, quantity, unit_price, total_cost))
        conn.commit()

        return jsonify({"message": "Material supply recorded successfully"}), 201

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass


@app.route("/pay-material-supply", methods=["POST"])
def pay_material_supply():
    try:
        data = request.json
        supply_id = data.get("supply_id")
        amount_paid = data.get("amount_paid")
        payment_type = data.get("payment_type")

        if not all([supply_id, amount_paid, payment_type]):
            return jsonify({"error": "Missing payment fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO material_payments (supply_id, amount_paid, payment_type)
            VALUES (%s, %s, %s)
        """, (supply_id, amount_paid, payment_type))
        conn.commit()

        return jsonify({"message": "Payment recorded successfully"}), 201

    except Exception as e:
        print("Payment error:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

@app.route('/get-material-payments/<int:supply_id>', methods=['GET'])
def get_material_payments(supply_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "DB connection failed"}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                amount_paid, payment_type, payment_date 
            FROM material_payments 
            WHERE supply_id = %s 
            ORDER BY payment_date DESC
        """
        cursor.execute(query, (supply_id,))
        payments = cursor.fetchall()
        return jsonify({"payments": payments})
    except Exception as e:
        print("❌ Failed to fetch payments:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/get-suppliers', methods=['GET'])
def get_material_suppliers():
    conn = get_db_connection()
    if not conn or not conn.is_connected():
        print("❌ DB connection is not active.")
        return jsonify({"error": "DB connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        if cursor is None:
            raise Exception("❌ Failed to create DB cursor")

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
            JOIN raw_materials m ON ms.material_id = m.material_id
            LEFT JOIN (
                SELECT supply_id, SUM(amount_paid) AS total_paid
                FROM material_payments
                GROUP BY supply_id
            ) mp ON ms.supply_id = mp.supply_id
            GROUP BY ms.supply_id
            ORDER BY ms.supplier_name ASC
        """

        cursor.execute(query)
        suppliers = cursor.fetchall()
        return jsonify({"suppliers": suppliers})
    except Exception as e:
        print("❌ Failed to fetch suppliers:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        try:
            if cursor:
                cursor.close()
            if conn and conn.is_connected():
                conn.close()
        except Exception as e:
            print("⚠️ Error closing DB resources:", e)



    
@app.route("/get-categories", methods=["GET"])
def get_categories():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT category_id, category_name FROM categories ORDER BY category_name ASC"
        )
        categories = cursor.fetchall()

        # ✅ Return with cache control headers
        response = make_response(jsonify({"categories": categories}), 200)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        return response
    except Exception as e:
        print("❌ Error fetching categories:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        cursor.close()
        conn.close()

    
@app.route("/add-category", methods=["POST"])
def add_category():
    try:
        data = request.get_json()
        category_name = data.get("category_name")

        if not category_name:
            return jsonify({"error": "Category name is required."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "INSERT INTO categories (category_name) VALUES (%s)",
                (category_name,)
            )
            conn.commit()
            return jsonify({"message": "Category added successfully"}), 201

        except mysql.connector.IntegrityError as e:
            if "Duplicate entry" in str(e):
                return jsonify({"error": "Category already exists."}), 400
            return jsonify({"error": "Database integrity error."}), 500

        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print("❌ Error in /add-category:", e)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/update-product/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # ✅ Update product details (excluding stock)
        cursor.execute(
            """
            UPDATE products
            SET product_number = %s, product_name = %s, 
                product_price = %s, product_description = %s, 
                category_id_fk = %s
            WHERE product_id = %s
            """,
            (
                data["product_number"],
                data["product_name"],
                data["product_price"],
                data["product_description"],
                data["category_id_fk"] if data["category_id_fk"] else None,
                product_id,
            ),
        )

        conn.commit()
        return jsonify({"message": "Product updated successfully!"}), 200

    except mysql.connector.Error as err:
        print("MySQL Error:", err)
        return jsonify({"error": f"MySQL Error: {str(err)}"}), 500
    except Exception as e:
        print("General Error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


# Get all suppliers
@app.route("/suppliers", methods=["GET"])
def get_suppliers():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM suppliers")
        suppliers = cursor.fetchall()
        return jsonify(suppliers), 200

    except mysql.connector.Error as err:
        print("MySQL Error:", err)
        return jsonify({"error": f"MySQL Error: {str(err)}"}), 500
    except Exception as e:
        print("General Error:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/check-supplier-exists/<supplier_name>", methods=["GET"])
def check_supplier_exists(supplier_name):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM suppliers WHERE supplier_name = %s", (supplier_name,))
        count = cursor.fetchone()[0]
        return jsonify({"exists": count > 0})
    except Exception as e:
        print("Error checking supplier existence:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



# Add supplier
@app.route("/add-supplier", methods=["POST"])
def add_supplier():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        data = request.json
        supplier_name = data.get("supplier_name")
        contact_person = data.get("contact_person", "")
        phone = data.get("phone_number", "")
        email = data.get("email", "")
        address = data.get("address", "")

        if not supplier_name:
            return jsonify({"error": "Supplier name is required"}), 400

        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO suppliers 
            (supplier_name, contact_person, phone_number, email, address) 
            VALUES (%s, %s, %s, %s, %s)
        """, (supplier_name, contact_person, phone, email, address))

        conn.commit()
        return jsonify({"message": "Supplier added successfully!"}), 201

    except mysql.connector.IntegrityError:
        return jsonify({"error": "Supplier name must be unique"}), 400
    except Exception as e:
        print("Error adding supplier:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()      

@app.route("/scan-receipt", methods=["POST"])
def scan_receipt():
    try:
        file = request.files.get("receipt")
        if not file:
            return jsonify({"error": "No receipt uploaded"}), 400

        filename = secure_filename(file.filename)
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)

        text = extract_text_from_receipt(path)
        print("OCR TEXT:\n", text)

        result = process_receipt_text(text)
        return jsonify(result)

    except Exception as e:
        print("SCAN RECEIPT ERROR:", e)
        return jsonify({"error": str(e)}), 500


def extract_text_from_receipt(image_path):
    client = vision.ImageAnnotatorClient()

    with open(image_path, "rb") as f:
        content = f.read()

    image = vision.Image(content=content)
    response = client.text_detection(image=image)

    if not response.text_annotations:
        return ""

    return response.text_annotations[0].description

def get_or_create_supplier(supplier_name):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT supplier_id FROM suppliers WHERE supplier_name=%s",
        (supplier_name,)
    )
    supplier = cursor.fetchone()

    if supplier:
        cursor.close()
        conn.close()
        return supplier[0]

    cursor.execute("""
        INSERT INTO suppliers (supplier_name)
        VALUES (%s)
    """, (supplier_name,))
    conn.commit()

    supplier_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return supplier_id

def process_receipt_text(text):
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    supplier_name = lines[0]   # usually top line
    supplier_id = get_or_create_supplier(supplier_name)

    items = []

    for line in lines:
        # Example: Sugar 2 @ 450
        if "@" in line:
            try:
                name_part, price_part = line.rsplit("@", 1)
                parts = name_part.split()

                qty = int(parts[-1])
                product_name = " ".join(parts[:-1])
                price = float(price_part.strip())

                product_id = get_or_create_product(product_name)
                update_stock(product_id, qty, supplier_id)

                items.append({
                    "product": product_name,
                    "qty": qty,
                    "price": price
                })
            except:
                continue

    return {
        "supplier": supplier_name,
        "items": items
    }

def get_or_create_product(name):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT product_id FROM products WHERE product_name=%s",
        (name,)
    )
    product = cursor.fetchone()

    if product:
        cursor.close()
        conn.close()
        return product[0]

    cursor.execute("""
        INSERT INTO products (product_name, stock)
        VALUES (%s, 0)
    """, (name,))
    conn.commit()

    pid = cursor.lastrowid
    cursor.close()
    conn.close()
    return pid

def update_stock(product_id, qty, supplier_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE products
        SET stock = stock + %s
        WHERE product_id = %s
    """, (qty, product_id))

    conn.commit()
    cursor.close()
    conn.close()


@app.route("/update-supplier/<int:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        data = request.json
        supplier_name = data.get("supplier_name")
        contact_person = data.get("contact_person", "")
        phone_number = data.get("phone_number", "")
        email = data.get("email", "")
        address = data.get("address", "")

        if not supplier_name or not supplier_id:
            return jsonify({"error": "Invalid supplier data"}), 400

        cursor = conn.cursor(dictionary=True)

        # ✅ Check if supplier exists
        cursor.execute("SELECT * FROM suppliers WHERE supplier_id = %s", (supplier_id,))
        existing_supplier = cursor.fetchone()
        if not existing_supplier:
            return jsonify({"error": "Supplier not found"}), 404

        # ✅ Check for duplicate name (case-insensitive)
        cursor.execute(
            "SELECT supplier_id FROM suppliers WHERE LOWER(supplier_name) = LOWER(%s) AND supplier_id != %s",
            (supplier_name, supplier_id),
        )
        if cursor.fetchone():
            return jsonify({"error": "Supplier name already exists"}), 400

        # ✅ Update supplier
        cursor.execute(
            """
            UPDATE suppliers 
            SET supplier_name = %s, contact_person = %s, phone_number = %s, email = %s, address = %s 
            WHERE supplier_id = %s
            """,
            (supplier_name, contact_person, phone_number, email, address, supplier_id)
        )

        conn.commit()
        return jsonify({"message": "Supplier updated successfully!"}), 200

    except Exception as e:
        print("Error updating supplier:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



# Fetch Supplier Products with Product ID Included
@app.route('/supplier-products/<int:supplier_id>', methods=['GET'])
def get_supplier_products(supplier_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT sp.supplier_product_id, p.product_id, p.product_name, sp.price, sp.stock_supplied, sp.supply_date
            FROM supplier_products sp
            JOIN products p ON sp.product_id = p.product_id
            WHERE sp.supplier_id = %s
        """
        cursor.execute(query, (supplier_id,))
        products = cursor.fetchall()

        for product in products:
            if product["supply_date"]:
                product["supply_date"] = product["supply_date"].strftime("%Y-%m-%d")

        response = make_response(jsonify(products))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    except mysql.connector.Error as err:
        print("Error fetching supplier products:", err)
        return jsonify({"error": "Database error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()  # ✅ Returns the connection to the pool


@app.route("/supplier-products/<int:supplier_id>/add", methods=["POST"])
def add_supplier_product(supplier_id):
    try:
        data = request.json
        print("Received Data:", data)

        # Validate required fields
        if not all(key in data for key in ["product_id", "stock_supplied", "price", "supply_date"]):
            return jsonify({"error": "Missing required fields"}), 400

        product_id = int(data["product_id"])
        stock_supplied = int(data["stock_supplied"])
        price = float(data["price"])
        supply_date = data["supply_date"]

        conn = get_db_connection()
        cursor = conn.cursor()
        conn.start_transaction()

        # ✅ 1. Check if materials are enough before inserting anything
        cursor.execute(
            "SELECT material_id, quantity FROM product_recipes WHERE product_id = %s",
            (product_id,)
        )
        recipes = cursor.fetchall()

        if recipes:
            for material_id, material_qty_per_unit in recipes:
                total_needed = material_qty_per_unit * stock_supplied
                remaining = total_needed

                cursor.execute(
                    """SELECT supply_id, quantity FROM material_supplies 
                    WHERE material_id = %s AND quantity > 0 
                    ORDER BY supply_date ASC FOR UPDATE""",
                    (material_id,)
                )
                supplies = cursor.fetchall()

                for supply_id, available_qty in supplies:
                    deduct = min(available_qty, remaining)
                    remaining -= deduct
                    if remaining <= 0:
                        break

                if remaining > 0:
                    conn.rollback()
                    cursor.execute("SELECT material_name FROM raw_materials WHERE material_id = %s", (material_id,))
                    material_name = cursor.fetchone()[0]
                    return jsonify({
                        "error": f"❌ Insufficient {material_name}. Short by {remaining} units"
                    }), 400

        # ✅ 2. Proceed to insert and update since materials are enough
        cursor.execute(
            """INSERT INTO supplier_products 
            (supplier_id, product_id, stock_supplied, price, supply_date)
            VALUES (%s, %s, %s, %s, %s)""",
            (supplier_id, product_id, stock_supplied, price, supply_date)
        )

        cursor.execute(
            """UPDATE products 
            SET product_stock = product_stock + %s
            WHERE product_id = %s""",
            (stock_supplied, product_id)
        )

        # ✅ 3. Deduct materials now
        for material_id, material_qty_per_unit in recipes:
            total_needed = material_qty_per_unit * stock_supplied
            remaining = total_needed

            cursor.execute(
                """SELECT supply_id, quantity FROM material_supplies 
                WHERE material_id = %s AND quantity > 0 
                ORDER BY supply_date ASC FOR UPDATE""",
                (material_id,)
            )
            supplies = cursor.fetchall()

            for supply_id, available_qty in supplies:
                if remaining <= 0:
                    break
                deduct = min(available_qty, remaining)
                cursor.execute(
                    "UPDATE material_supplies SET quantity = quantity - %s WHERE supply_id = %s",
                    (deduct, supply_id)
                )
                remaining -= deduct

        conn.commit()
        return jsonify({
            "message": "✅ Supply added and materials deducted successfully",
            "product_id": product_id,
            "stock_added": stock_supplied
        }), 201

    except ValueError as ve:
        if 'conn' in locals():
            conn.rollback()
        return jsonify({"error": f"Invalid data: {ve}"}), 400
    except Exception as e:
        print("Error:", e)
        if 'conn' in locals():
            conn.rollback()
        return jsonify({"error": "Internal Server Error"}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


# Endpoint to handle supplier payments
@app.route("/supplier-payments", methods=["POST"])
def add_supplier_payment():
    conn = None
    cursor = None
    try:
        data = request.json
        print("Received Data:", data)

        supplier_id = data.get("supplier_id")
        supplier_product_id = data.get("supplier_product_id")
        amount = Decimal(str(data.get("amount")))
        payment_method = data.get("payment_method")
        reference = data.get("reference")
        payment_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ✅ Fetch total paid so far
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM supplier_payments WHERE supplier_product_id = %s",
            (supplier_product_id,)
        )
        total_paid_result = cursor.fetchone()
        total_paid = Decimal(total_paid_result["total_paid"]) if total_paid_result else Decimal(0)

        # ✅ Fetch product price
        cursor.execute(
            "SELECT price FROM supplier_products WHERE supplier_product_id = %s",
            (supplier_product_id,)
        )
        product_result = cursor.fetchone()
        if not product_result:
            return jsonify({"error": "Supplier product not found."}), 404

        product_price = Decimal(product_result["price"])

        # ✅ Calculate remaining balance
        new_total_paid = total_paid + amount
        balance_remaining = product_price - new_total_paid

        # ✅ Insert new payment
        cursor.execute("""
            INSERT INTO supplier_payments (supplier_id, supplier_product_id, amount, payment_date, payment_method, reference)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (supplier_id, supplier_product_id, amount, payment_date, payment_method, reference))
        conn.commit()

        print(f"✅ Payment recorded. New balance: {balance_remaining}")

        return jsonify({
            "message": "Payment recorded successfully!",
            "balance_remaining": float(balance_remaining)
        }), 201

    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": "Failed to record payment.", "details": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/supplier-payments/<int:supplier_id>/<int:supplier_product_id>", methods=["GET"])
def get_supplier_payments(supplier_id, supplier_product_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # ✅ Fetch all payments for the given supplier_product_id
        cursor.execute(
            """
            SELECT payment_id, amount, payment_date, payment_method, reference
            FROM supplier_payments
            WHERE supplier_product_id = %s
            ORDER BY payment_date DESC
            """,
            (supplier_product_id,)
        )
        payments = cursor.fetchall()

        # ✅ Calculate total amount paid
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM supplier_payments WHERE supplier_product_id = %s",
            (supplier_product_id,)
        )
        total_paid_result = cursor.fetchone()
        total_paid = float(total_paid_result["total_paid"]) if total_paid_result else 0.0

        # ✅ Get product price
        cursor.execute(
            "SELECT price FROM supplier_products WHERE supplier_product_id = %s",
            (supplier_product_id,)
        )
        product_result = cursor.fetchone()
        product_price = float(product_result["price"]) if product_result else 0.0

        # ✅ Calculate balance
        balance_remaining = product_price - total_paid

        return jsonify({
            "payments": payments,
            "total_paid": total_paid,
            "balance_remaining": balance_remaining
        }), 200

    except Exception as e:
        print("Error fetching supplier payments:", str(e))
        return jsonify({
            "error": "Failed to fetch payment history.",
            "details": str(e)
        }), 500

    finally:
        cursor.close()
        conn.close()

    
@app.route('/api/v1/supplier/<int:supplier_id>', methods=['GET'])
def get_supplier_name(supplier_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT supplier_name FROM suppliers WHERE supplier_id = %s", (supplier_id,))
        supplier = cursor.fetchone()

        if supplier:
            response = make_response(jsonify(supplier))
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        else:
            return jsonify({"error": "Supplier not found"}), 404

    except mysql.connector.Error as err:
        print(f"Database Error: {err}")
        return jsonify({"error": "Database error"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


@app.route('/api/v1/update-supplier-product/<int:supplier_product_id>', methods=['PUT'])
def update_supplier_product(supplier_product_id):
    conn = None
    cursor = None
    recipes = []  # Initialize recipes as empty list
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        conn.start_transaction()

        data = request.json
        new_stock_supplied = int(data.get("stock_supplied"))
        new_price = data.get("price")
        new_supply_date = data.get("supply_date")

        # 1. Fetch existing record with FOR UPDATE lock
        cursor.execute("""
            SELECT stock_supplied, product_id 
            FROM supplier_products 
            WHERE supplier_product_id = %s FOR UPDATE
            """, (supplier_product_id,))
        existing_product = cursor.fetchone()

        if not existing_product:
            conn.rollback()
            return jsonify({"error": "Product not found"}), 404

        old_stock_supplied = int(existing_product["stock_supplied"])
        product_id = existing_product["product_id"]
        stock_difference = new_stock_supplied - old_stock_supplied

        # 2. Update supplier_products table
        cursor.execute("""
            UPDATE supplier_products 
            SET stock_supplied = %s, price = %s, supply_date = %s 
            WHERE supplier_product_id = %s
            """, (new_stock_supplied, new_price, new_supply_date, supplier_product_id))

        # 3. Update products table stock (always do this regardless of materials)
        cursor.execute("""
            UPDATE products 
            SET product_stock = product_stock + %s 
            WHERE product_id = %s
            """, (stock_difference, product_id))

        # 4. Check if product has recipes
        cursor.execute("""
            SELECT EXISTS(
                SELECT 1 FROM product_recipes 
                WHERE product_id = %s
            ) AS has_recipes
            """, (product_id,))
        has_recipes = cursor.fetchone()['has_recipes']

        # 5. Handle material adjustments only if product has recipes and stock changed
        if stock_difference != 0 and has_recipes:
            cursor.execute("""
                SELECT pr.material_id, pr.quantity, rm.material_name
                FROM product_recipes pr
                JOIN raw_materials rm ON pr.material_id = rm.material_id
                WHERE pr.product_id = %s
                """, (product_id,))
            recipes = cursor.fetchall()

            material_adjustment = abs(stock_difference)
            operation = "deduct" if stock_difference > 0 else "add"

            for recipe in recipes:
                material_id = recipe['material_id']
                material_name = recipe['material_name']
                total_adjustment = recipe['quantity'] * material_adjustment

                if operation == "deduct":
                    # FIFO deduction logic
                    cursor.execute("""
                        SELECT supply_id, quantity 
                        FROM material_supplies 
                        WHERE material_id = %s AND quantity > 0 
                        ORDER BY supply_date ASC FOR UPDATE
                        """, (material_id,))
                    supplies = cursor.fetchall()

                    remaining = total_adjustment
                    for supply in supplies:
                        if remaining <= 0:
                            break
                        deduct = min(supply['quantity'], remaining)
                        cursor.execute("""
                            UPDATE material_supplies 
                            SET quantity = quantity - %s 
                            WHERE supply_id = %s
                            """, (deduct, supply['supply_id']))
                        remaining -= deduct

                    if remaining > 0:
                        conn.rollback()
                        return jsonify({
                            "error": f"Insufficient {material_name} (short by {remaining} units)"
                        }), 400

                else:  # operation == "add"
                    # Add to most recent supply
                    cursor.execute("""
                        SELECT supply_id 
                        FROM material_supplies 
                        WHERE material_id = %s 
                        ORDER BY supply_date DESC LIMIT 1
                        """, (material_id,))
                    recent_supply = cursor.fetchone()
                    
                    if recent_supply:
                        cursor.execute("""
                            UPDATE material_supplies 
                            SET quantity = quantity + %s 
                            WHERE supply_id = %s
                            """, (total_adjustment, recent_supply['supply_id']))
                    else:
                        # Create new supply record
                        cursor.execute("""
                            INSERT INTO material_supplies 
                            (material_id, quantity, supply_date) 
                            VALUES (%s, %s, CURDATE())
                            """, (material_id, total_adjustment))

        conn.commit()
        return jsonify({
            "message": "Supplier product updated successfully",
            "stock_adjusted": stock_difference,
            "materials_updated": len(recipes) if stock_difference != 0 and has_recipes else 0,
            "has_recipes": has_recipes,
            "product_id": product_id
        })

    except ValueError as ve:
        if conn:
            conn.rollback()
        return jsonify({"error": f"Invalid data: {str(ve)}"}), 400
    except Exception as e:
        print(f"Error: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({"error": "Internal server error"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# Process Sale Endpoint
def generate_order_number(cursor):
    """
    Generates a unique order number in the format 'ORD' + 6-digit number (e.g., ORD000123).
    Ensures the number is unique in the sales table.
    """
    while True:
        number = str(random.randint(0, 999999)).zfill(6)  # Pads to 6 digits (e.g., '000123')
        order_number = "ORD" + number
        cursor.execute("SELECT 1 FROM sales WHERE order_number = %s", (order_number,))
        if not cursor.fetchone():
            return order_number


@app.route("/process-sale", methods=["POST"])
def process_sale():
    data = request.json
    customer_id = data.get("customer_id")  # Can be NULL
    payment_type = data.get("payment_type")
    cart_items = data.get("cart_items")  # [{ product_id, quantity, subtotal }]
    vat = float(data.get("vat", 0.00))
    discount = float(data.get("discount", 0.00))
    status = "completed"

    # Validate request
    if not cart_items or payment_type not in ["Mpesa", "Cash","Bank"]:
        return jsonify({"error": "Invalid request"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection not available"}), 500

    try:
        cursor = conn.cursor()
        conn.start_transaction()

        # Calculate totals
        total_amount = sum(float(item["subtotal"]) for item in cart_items)
        final_total = total_amount + vat - discount

        # Generate order number
        order_number = generate_order_number(cursor)

        # Insert sale
        cursor.execute("""
            INSERT INTO sales (customer_id, total_price, payment_type, vat, discount, status, order_number)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id if customer_id else None,
            final_total,
            payment_type,
            vat,
            discount,
            status,
            order_number,
        ))
        sale_id = cursor.lastrowid

        # Process cart items
        for item in cart_items:
            product_id = item["product_id"]
            quantity = int(item["quantity"])
            subtotal = float(item["subtotal"])

            # -------------------------------
            # Bundle products
            # -------------------------------
            if isinstance(product_id, str) and product_id.startswith("bundle-"):
                bundle_id = int(product_id.replace("bundle-", ""))

                # Lock child products
                cursor.execute("""
                    SELECT 
                        pb.child_product_id,
                        pb.quantity,
                        p.product_stock
                    FROM product_bundles pb
                    JOIN products p ON pb.child_product_id = p.product_id
                    WHERE pb.bundle_id = %s
                    FOR UPDATE
                """, (bundle_id,))
                bundle_items = cursor.fetchall()

                if not bundle_items:
                    conn.rollback()
                    return jsonify({"error": "Invalid bundle"}), 400

                # Check bundle stock
                max_bundles = min(
                    int(item_stock // child_qty)
                    for (_, child_qty, item_stock) in bundle_items
                )
                if max_bundles < quantity:
                    conn.rollback()
                    return jsonify({
                        "error": "Insufficient stock for bundle"
                    }), 400

                # Insert sale item for bundle
                cursor.execute("""
                    INSERT INTO sales_items (sale_id, product_id, bundle_id, quantity, subtotal)
                    VALUES (%s, %s, %s, %s, %s)
                """, (sale_id, None, bundle_id, quantity, subtotal))

                # Deduct child stock
                for child_id, child_qty, _ in bundle_items:
                    cursor.execute("""
                        UPDATE products
                        SET product_stock = product_stock - %s
                        WHERE product_id = %s
                    """, (child_qty * quantity, child_id))

            # -------------------------------
            # Normal products
            # -------------------------------
            else:
                cursor.execute("""
                    SELECT product_stock
                    FROM products
                    WHERE product_id = %s
                    FOR UPDATE
                """, (product_id,))
                product = cursor.fetchone()

                if not product or product[0] < quantity:
                    conn.rollback()
                    return jsonify({
                        "error": "INSUFFICIENT_STOCK",
                        "message": f"Only {product[0] if product else 0} item(s) left in stock",
                        "product_id": product_id,
                        "requested": quantity,
                        "available": product[0] if product else 0
                    }), 400

                # Insert sale item
                cursor.execute("""
                    INSERT INTO sales_items (sale_id, product_id, bundle_id, quantity, subtotal)
                    VALUES (%s, %s, %s, %s, %s)
                """, (sale_id, product_id, None, quantity, subtotal))

                # Deduct stock
                cursor.execute("""
                    UPDATE products
                    SET product_stock = product_stock - %s
                    WHERE product_id = %s
                """, (quantity, product_id))

        # Commit transaction
        conn.commit()

        return jsonify({
            "message": "Sale processed successfully",
            "order_number": order_number
        }), 201

    except Exception as e:
        conn.rollback()
        print("❌ ERROR in process_sale:", str(e))
        return jsonify({"error": "Internal server error"}), 500

    finally:
        cursor.close()
        conn.close()




@app.route("/get-sales-products", methods=["GET"])
def get_sales_products():
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection not available"}), 500

    cursor = None

    try:
        cursor = conn.cursor(dictionary=True)

        # 🔹 Fetch normal products
        cursor.execute("""
            SELECT 
                p.product_id,
                p.product_name,
                p.product_price,
                p.product_stock
            FROM products p
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
        """, (per_page, offset))

        products = cursor.fetchall()

        formatted_products = [
            {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "product_price": row["product_price"],
                "product_stock": row["product_stock"],
                "is_bundle": False
            }
            for row in products
        ]

        # 🔹 Fetch bundles (stock + price + quantity)
        cursor.execute("""
            SELECT
                pb.bundle_id,
                MAX(pb.selling_price) AS selling_price,
                MIN(pb.quantity) AS quantity,
                MIN(FLOOR(p.product_stock / pb.quantity)) AS bundle_stock
            FROM product_bundles pb
            JOIN products p ON p.product_id = pb.child_product_id
            GROUP BY pb.bundle_id
        """)

        bundles = cursor.fetchall()
        formatted_bundles = []

        for bundle in bundles:
            bundle_id = bundle["bundle_id"]

            # 🔹 Get ONE product name from products table (display name)
            cursor.execute("""
                SELECT p.product_name
                FROM product_bundles pb
                JOIN products p ON p.product_id = pb.child_product_id
                WHERE pb.bundle_id = %s
                ORDER BY pb.child_product_id
                LIMIT 1
            """, (bundle_id,))

            product = cursor.fetchone()
            if not product:
                continue

            formatted_bundles.append({
                "product_id": f"bundle-{bundle_id}",
                "product_name": product["product_name"],  # ✅ SAME NAME AS PRODUCT
                "product_price": bundle["selling_price"],
                "product_stock": int(bundle["bundle_stock"] or 0),
                "quantity": bundle["quantity"],  # ✅ ADDED COLUMN
                "is_bundle": True
            })

        # 🔹 Combine products + bundles
        combined_products = formatted_products + formatted_bundles

        return jsonify({
            "products": combined_products,
            "total_products": len(combined_products),
            "page": page
        }), 200

    except mysql.connector.Error as e:
        print("❌ ERROR in get_sales_products:", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        conn.close()


@app.route("/get-sales-customers", methods=["GET"])
def get_sales_customers():
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection not available"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) AS total FROM customers")
        total_customers = cursor.fetchone()
        total_customers = total_customers["total"] if total_customers else 0

        cursor.execute(
            """
            SELECT customer_id, customer_name, phone, email, address 
            FROM customers 
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
            """,
            (per_page, offset),
        )
        customers = cursor.fetchall()

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
        # Add headers to prevent caching
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response, 200

    except mysql.connector.Error as e:
        print("❌ ERROR in get_sales_customers:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/add-sales-customer", methods=["POST"])
def add_sales_customer():
    data = request.json
    customer_name = data.get("customer_name", "").strip() or None
    phone = data.get("phone", "").strip() or None
    email = data.get("email", "").strip() or None
    address = data.get("address", "").strip() or None

    if not customer_name:
        return jsonify({"error": "Customer name is required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection error"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            INSERT INTO customers (customer_name, phone, email, address, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            """,
            (customer_name, phone, email, address),
        )
        conn.commit()
        new_customer_id = cursor.lastrowid

        # Fetch the newly added customer details
        cursor.execute(
            "SELECT customer_id, customer_name, phone, email, address FROM customers WHERE customer_id = %s",
            (new_customer_id,),
        )
        new_customer = cursor.fetchone()

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
    except Error as e:
        conn.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/get-company-details", methods=["GET"])
def get_company_details():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection not available"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT company, company_phone FROM users LIMIT 1")  # Fetch the first user's company details
        company_details = cursor.fetchone()

        if not company_details:
            return jsonify({"error": "No company details found"}), 404

        return jsonify(company_details), 200
    except mysql.connector.Error as e:
        print("❌ ERROR in get_company_details:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# API Endpoint to Fetch Orders with Bundle Support
@app.route("/get-orders", methods=["GET"])
def get_orders():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        # Get date range from query parameters
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        # SQL query with CALCULATED buying price (same logic as /get-products)
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

                si.product_id,
                si.bundle_id,
                si.quantity,

                p.product_name AS product_name,
                p.product_price AS product_price,

                -- ✅ Buying price = SUM(price) / SUM(stock_supplied)
                COALESCE(
                    ROUND(
                        SUM(sp.price) / NULLIF(SUM(sp.stock_supplied), 0),
                        2
                    ),
                    0
                ) AS buying_price,

                pb.selling_price AS bundle_selling_price,
                pb.child_product_id,
                pb.quantity AS bundle_quantity,

                cp.product_name AS child_product_name,

                -- ✅ Child product buying price (same logic)
                COALESCE(
                    ROUND(
                        SUM(csp.price) / NULLIF(SUM(csp.stock_supplied), 0),
                        2
                    ),
                    0
                ) AS child_product_buying_price

            FROM sales s
            LEFT JOIN customers c 
                ON s.customer_id = c.customer_id

            LEFT JOIN sales_items si 
                ON s.sale_id = si.sale_id

            LEFT JOIN products p 
                ON si.product_id = p.product_id

            LEFT JOIN supplier_products sp 
                ON p.product_id = sp.product_id

            LEFT JOIN product_bundles pb 
                ON si.bundle_id = pb.bundle_id

            LEFT JOIN products cp 
                ON pb.child_product_id = cp.product_id

            LEFT JOIN supplier_products csp 
                ON cp.product_id = csp.product_id
        """

        cursor = conn.cursor(dictionary=True)

        # Apply date filter if provided
        if start_date and end_date:
            query += """
                WHERE s.sale_date BETWEEN %s AND %s
            """
            query += """
                GROUP BY 
                    s.sale_id,
                    si.sale_item_id,
                    p.product_id,
                    pb.bundle_id,
                    cp.product_id
            """
            cursor.execute(
                query,
                (f"{start_date} 00:00:00", f"{end_date} 23:59:59")
            )
        else:
            query += """
                GROUP BY 
                    s.sale_id,
                    si.sale_item_id,
                    p.product_id,
                    pb.bundle_id,
                    cp.product_id
                ORDER BY s.sale_date DESC
            """
            cursor.execute(query)

        results = cursor.fetchall()

        # Group orders by sale_id and calculate profit
        grouped_orders = {}
        for order in results:
            sale_id = order["sale_id"]

            if sale_id not in grouped_orders:
                grouped_orders[sale_id] = {
                    "sale_id": sale_id,
                    "order_number": order["order_number"],
                    "customer_id": order["customer_id"],
                    "customer_name": order["customer_name"],
                    "total_price": order["total_price"],
                    "payment_type": order["payment_type"],
                    "sale_date": order["sale_date"]
                        .astimezone(pytz.timezone("Africa/Nairobi"))
                        .isoformat(),
                    "vat": order["vat"],
                    "discount": order["discount"],
                    "status": order["status"],
                    "items": [],
                    "gross_profit": 0.0,
                    "profit": 0.0
                }

            quantity_sold = order["quantity"] or 0
            is_bundle = order["bundle_id"] is not None

            selling_price = float(
                order["bundle_selling_price"]
                if is_bundle
                else order["product_price"] or 0
            )

            buying_price = (
                float(order["buying_price"] or 0)
                if not is_bundle
                else None
            )

            subtotal = selling_price * quantity_sold

            # Profit calculation
            item_profit = 0.0
            if is_bundle:
                child_buying = float(order["child_product_buying_price"] or 0)
                bundle_qty = order["bundle_quantity"] or 0
                item_profit = (
                    selling_price - (child_buying * bundle_qty)
                ) * quantity_sold
            elif buying_price is not None:
                item_profit = (selling_price - buying_price) * quantity_sold

            grouped_orders[sale_id]["gross_profit"] += item_profit

            display_name = (
                order["child_product_name"]
                if is_bundle
                else order["product_name"]
            )
            if is_bundle:
                display_name += " (Bundle)"

            grouped_orders[sale_id]["items"].append({
                "product_id": order["product_id"],
                "bundle_id": order["bundle_id"],
                "product_name": display_name,
                "product_price": selling_price,
                "buying_price": buying_price,
                "quantity": quantity_sold,
                "subtotal": subtotal,
                "is_bundle": is_bundle,
                "profit": round(item_profit, 2)
            })

        # Finalize profit by subtracting discount
        for order in grouped_orders.values():
            discount = float(order["discount"] or 0)
            gross = order["gross_profit"]
            order["profit"] = round(gross - discount, 2)
            del order["gross_profit"]

        response = jsonify({"orders": list(grouped_orders.values())})
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    finally:
        if "cursor" in locals():
            cursor.close()
        if conn:
            conn.close()



@app.route("/update-order-status", methods=["POST"])
def update_order_status():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    data = request.get_json()
    sale_id = data.get("sale_id")
    new_status = data.get("status")

    if not sale_id or not new_status:
        return jsonify({"error": "Missing sale_id or status"}), 400

    try:
        cursor = conn.cursor(dictionary=True)
        conn.start_transaction()

        # 🔒 Lock sale row
        cursor.execute(
            "SELECT status FROM sales WHERE sale_id = %s FOR UPDATE",
            (sale_id,)
        )
        sale = cursor.fetchone()

        if not sale:
            conn.rollback()
            return jsonify({"error": "Sale not found"}), 404

        current_status = sale["status"]

        # 🧠 Stock changes only when crossing "completed"
        entering_completed = current_status != "completed" and new_status == "completed"
        leaving_completed  = current_status == "completed" and new_status != "completed"

        if entering_completed or leaving_completed:

            direction = -1 if entering_completed else 1  # deduct or restore

            cursor.execute("""
                SELECT product_id, bundle_id, quantity
                FROM sales_items
                WHERE sale_id = %s
                FOR UPDATE
            """, (sale_id,))
            items = cursor.fetchall()

            for item in items:
                sale_qty = item["quantity"]

                # 🧩 Bundle
                if item["bundle_id"]:
                    cursor.execute("""
                        SELECT child_product_id, quantity
                        FROM product_bundles
                        WHERE bundle_id = %s
                        FOR UPDATE
                    """, (item["bundle_id"],))
                    bundle_items = cursor.fetchall()

                    for b in bundle_items:
                        stock_change = direction * sale_qty * b["quantity"]

                        cursor.execute("""
                            UPDATE products
                            SET product_stock = product_stock + %s
                            WHERE product_id = %s
                        """, (stock_change, b["child_product_id"]))

                # 📦 Normal product
                else:
                    stock_change = direction * sale_qty

                    cursor.execute("""
                        UPDATE products
                        SET product_stock = product_stock + %s
                        WHERE product_id = %s
                    """, (stock_change, item["product_id"]))

        # ✅ Update sale status
        cursor.execute("""
            UPDATE sales
            SET status = %s
            WHERE sale_id = %s
        """, (new_status, sale_id))

        conn.commit()
        return jsonify({"success": True})

    except Exception as e:
        conn.rollback()
        print("❌ update_order_status error:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()




@app.route('/api/v1/material-inventory', methods=['GET'])
def get_material_inventory():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get comprehensive material inventory data
        query = """
            SELECT 
                m.material_id,
                m.material_name,
                m.unit,
                IFNULL(SUM(ms.quantity), 0) AS total_supplied,
                IFNULL((
                    SELECT SUM(pr.quantity * si.quantity)
                    FROM product_recipes pr
                    JOIN sales_items si ON pr.product_id = si.product_id
                    WHERE pr.material_id = m.material_id
                ), 0) AS total_used,
                IFNULL(SUM(ms.quantity), 0) - IFNULL((
                    SELECT SUM(pr.quantity * si.quantity)
                    FROM product_recipes pr
                    JOIN sales_items si ON pr.product_id = si.product_id
                    WHERE pr.material_id = m.material_id
                ), 0) AS current_stock,
                IFNULL(SUM(ms.quantity * ms.unit_price), 0) AS total_cost,
                CASE 
                    WHEN IFNULL(SUM(ms.quantity), 0) > 0 
                    THEN IFNULL(SUM(ms.quantity * ms.unit_price), 0) / IFNULL(SUM(ms.quantity), 0)
                    ELSE 0
                END AS avg_unit_cost
            FROM raw_materials m
            LEFT JOIN material_supplies ms ON m.material_id = ms.material_id
            GROUP BY m.material_id, m.material_name, m.unit
            ORDER BY m.material_name
        """
        cursor.execute(query)
        materials = cursor.fetchall()
        
        # Convert decimal values to float for JSON serialization
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
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


@app.route("/expenses", methods=["POST"])
def add_expense():
    conn = get_db_connection()
    data = request.json

    # Nairobi time
    nairobi_now = datetime.now(ZoneInfo("Africa/Nairobi"))
    expense_date = nairobi_now.date()  # YYYY-MM-DD

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO expenses (
            user_id, category, description, amount, payment_method, expense_date
        )
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        data["user_id"],
        data["category"],
        data.get("description"),
        data["amount"],
        data.get("payment_method"),
        expense_date
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({
        "message": "Expense added",
        "date": expense_date.isoformat(),
        "timezone": "Africa/Nairobi"
    }), 201

@app.route("/expenses", methods=["GET"])
def get_expenses():
    user_id = request.args.get("user_id")
    start = request.args.get("start")
    end = request.args.get("end")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT *, 
        (SELECT SUM(amount) FROM expenses WHERE user_id=%s) AS total_expenses
        FROM expenses
        WHERE user_id=%s
    """
    params = [user_id, user_id]

    if start and end:
        query += " AND expense_date BETWEEN %s AND %s"
        params.extend([start, end])

    cursor.execute(query, params)
    data = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(data)


# --- bottom of app.py ---
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)


