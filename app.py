from flask import Flask, render_template, request, redirect, url_for, session, jsonify, make_response
import mysql.connector
from mysql.connector import Error
import smtplib
from email.message import EmailMessage
import hashlib
from itsdangerous import URLSafeTimedSerializer
from flask_cors import CORS
from datetime import datetime
from decimal import Decimal
from mysql.connector import pooling
from datetime import datetime, timedelta



app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Change this to a secure key
CORS(app)

# ✅ MySQL Configuration
mysql_settings = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "peakers_pos_system",
}

try:
    # ✅ Create a connection pool
    pool = pooling.MySQLConnectionPool(
        pool_name="mypool",
        pool_size=5,  # Adjust size (min: 1, max: 32)
        **mysql_settings
    )
    print("✅ Connection pool created successfully")
except mysql.connector.Error as err:
    print(f"❌ Failed to create connection pool: {err}")
    pool = None  # Set pool to None if creation fails

def get_db_connection():
    global pool
    if pool is None:
        print("❌ Connection pool is not available")
        return None
    try:
        conn = pool.get_connection()
        if conn is None:
            print("❌ Failed to get a valid connection from pool (None returned)")
            return None
        if conn.is_connected():
            print("✅ Successfully acquired connection from pool")
            return conn
        else:
            print("❌ Connection acquired, but not connected")
            conn.close()
            return None
    except mysql.connector.errors.PoolError as pool_err:
        print(f"❌ Connection pool exhausted: {pool_err}")
        return None
    except mysql.connector.Error as err:
        print(f"❌ Database connection failed: {err}")
        return None





# MySQL Configuration
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="peakers_pos_system"
)
cursor = db.cursor(dictionary=True)

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

        query = "SELECT * FROM users WHERE (username=%s OR user_email=%s)"
        cursor.execute(query, (username, username))
        user = cursor.fetchone()

        if user and user["user_password"] == hashlib.sha256(password.encode()).hexdigest():
            session["user"] = user["username"]
            return redirect(url_for("dashboard"))
        else:
            error_message = "Invalid credentials. Please try again."

    return render_template("login.html", error_message=error_message)

# Function to send email
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
        return f"Error: {e}"

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

# Forgot Password Route
@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == "POST":
        data = request.json
        email = data.get("email")

        cursor.execute("SELECT * FROM users WHERE user_email = %s", (email,))
        user = cursor.fetchone()

        if user:
            token = generate_token(email)
            reset_link = url_for('reset_password', token=token, _external=True)

            email_message = f"""
            <p>Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>This link will expire in 30 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            """

            send_email(email, "Password Reset Request", email_message)
            return jsonify({"message": "Password reset link sent to your email."}), 200
        else:
            return jsonify({"error": "Email not found."}), 400

    return render_template("forgot_password.html")

# Reset Password Page
@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    email = verify_token(token)
    print(f"Debug: Token={token}, Email={email}")  # Debug output

    if not email:
        return jsonify({"error": "Invalid or expired token"}), 400

    if request.method == 'POST':
        if not request.is_json:
            return jsonify({"error": "Missing JSON in request"}), 400

        data = request.get_json()
        new_password = data.get("password")
        print(f"Debug: Received password={new_password}")  # Debug output

        if not new_password:
            return jsonify({"error": "Password is required"}), 400

        # Improved hashing
        hashed_password = hashlib.sha256(new_password.encode()).hexdigest()
        
        try:
            cursor.execute(
                "UPDATE users SET user_password = %s WHERE user_email = %s",
                (hashed_password, email.lower())  # Case-insensitive
            )
            db.commit()
            print("Debug: Password updated successfully")  # Debug output
            return jsonify({"message": "Password reset successful!"}), 200
        except Exception as e:
            db.rollback()
            print(f"Error: {str(e)}")  # Debug output
            return jsonify({"error": "Database update failed"}), 500

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
                "monthly_target": 125000.0,
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
    phone = data.get("phone").strip() or None  # Convert empty string to None
    email = data.get("email").strip() or None  # Convert empty string to None
    address = data.get("address").strip() or None  # Convert empty string to None

    if not customer_name:
        return jsonify({"error": "Customer name is required"}), 400

    try:
        # Insert new customer without checking for duplicates
        cursor.execute(
            "INSERT INTO customers (customer_name, phone, email, address) VALUES (%s, %s, %s, %s)",
            (customer_name, phone, email, address),
        )
        db.commit()

        return jsonify({"message": "Customer registered successfully!"}), 201

    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

       
@app.route("/update-customer/<int:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    data = request.get_json()
    try:
        cursor.execute(
            """
            UPDATE customers
            SET customer_name = %s, phone = %s, email = %s, address = %s
            WHERE customer_id = %s
            """,
            (data["customer_name"], data.get("phone"), data.get("email"), data.get("address"), customer_id)
        )
        db.commit()
        return jsonify({"message": "Customer updated successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
       
@app.route("/search-customer", methods=["GET"])
def search_customer():
    search_query = request.args.get("q", "").strip()  # Get the search query
    if not search_query:
        return jsonify({"customers": []})  # Return empty list if no query

    try:
        cursor.execute(
            """
            SELECT customer_id, customer_name, phone, email, address 
            FROM customers 
            WHERE customer_name LIKE %s OR phone LIKE %s OR email LIKE %s
            ORDER BY created_at DESC
            """,
            (f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"),
        )
        customers = cursor.fetchall()

        formatted_customers = [
            {
                "id": row["customer_id"],
                "name": row["customer_name"],
                "phone": row["phone"] or "N/A",
                "email": row["email"] or "N/A",
                "address": row["address"] or "N/A",
            }
            for row in customers
        ]

        return jsonify({"customers": formatted_customers}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get-products", methods=["GET", "POST"])
def manage_products():
    if request.method == "GET":
        page = request.args.get("page", 1, type=int)
        per_page = 20
        offset = (page - 1) * per_page

        try:
            cursor = db.cursor(dictionary=True)

            # Get total product count
            cursor.execute("SELECT COUNT(*) AS total FROM products")
            total_products = cursor.fetchone()["total"]

            # Fetch products with category ID and name
            cursor.execute(
                """
                SELECT p.product_id, p.product_number, p.product_name, 
                       p.product_price, p.product_stock, p.product_description, 
                       p.created_at, p.category_id_fk, c.category_name 
                FROM products p
                LEFT JOIN categories c ON p.category_id_fk = c.category_id
                ORDER BY p.created_at DESC 
                LIMIT %s OFFSET %s
                """,
                (per_page, offset),
            )
            products = cursor.fetchall()

            cursor.close()

            formatted_products = [
                {
                    "product_id": row["product_id"],
                    "product_number": row["product_number"],
                    "product_name": row["product_name"],
                    "product_price": row["product_price"],
                    "product_stock": row["product_stock"],
                    "product_description": row["product_description"],
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row["created_at"] else None,
                    "category_id_fk": row["category_id_fk"],  # ✅ Include category ID
                    "category_name": row["category_name"]
                }
                for row in products
            ]

            return jsonify({"products": formatted_products, "total_products": total_products, "page": page}), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500
        
    
@app.route("/add-product", methods=["POST"])
def add_product():
    try:
        data = request.json
        product_number = data.get("product_number")
        product_name = data.get("product_name")
        product_price = data.get("product_price")
        product_description = data.get("product_description")
        category_id_fk = data.get("category_id_fk")

        if not all([product_number, product_name, product_price, category_id_fk]):
            return jsonify({"error": "All fields except description are required"}), 400

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        product_stock = 0  # ✅ Default stock is always set to 0

        # Insert product into database
        query = """
            INSERT INTO products (product_number, product_name, product_price, product_stock, product_description, created_at, category_id_fk)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (product_number, product_name, product_price, product_stock, product_description, created_at, category_id_fk))
        db.commit()

        product_id = cursor.lastrowid  # Get the last inserted product ID

        return jsonify({
            "message": "Product added successfully",
            "product": {
                "product_id": product_id,
                "product_number": product_number,
                "product_name": product_name,
                "product_price": product_price,
                "product_stock": product_stock,  # ✅ Stock is always 0
                "product_description": product_description,
                "category_id_fk": category_id_fk,
                "created_at": created_at
            }
        }), 201

    except Exception as e:
        print("Error adding product:", e)
        return jsonify({"error": "Internal server error"}), 500

    
@app.route("/get-categories", methods=["GET"])
def get_categories():
    try:
        if not db.is_connected():
            db.reconnect()  # Ensure connection is active
        
        cursor = db.cursor(dictionary=True)  # Create a new cursor for this query

        cursor.execute("SELECT category_id, category_name FROM categories ORDER BY category_name ASC")
        categories = cursor.fetchall()

        cursor.close()  # Close the cursor after fetching

        return jsonify({"categories": categories}), 200
    except Exception as e:
        print("Error fetching categories:", e)
        return jsonify({"error": "Internal server error"}), 500
    
@app.route("/add-category", methods=["POST"])
def add_category():
    try:
        data = request.json
        category_name = data.get("category_name")

        if not category_name:
            return jsonify({"error": "Category name is required."}), 400

        # Insert new category (MySQL UNIQUE constraint will enforce uniqueness)
        cursor.execute("INSERT INTO categories (category_name) VALUES (%s)", (category_name,))
        db.commit()

        return jsonify({"message": "Category added successfully"}), 201

    except mysql.connector.IntegrityError as e:
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Category already exists."}), 400
        return jsonify({"error": "Database error."}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/update-product/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        cursor = db.cursor(dictionary=True)

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
                data["category_id_fk"] if data["category_id_fk"] else None,  # Ensure None if empty
                product_id,
            ),
        )

        db.commit()
        cursor.close()

        return jsonify({"message": "Product updated successfully!"}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"MySQL Error: {str(err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Get all suppliers
@app.route("/suppliers", methods=["GET"])
def get_suppliers():
    cursor.execute("SELECT * FROM suppliers")
    suppliers = cursor.fetchall()
    return jsonify(suppliers)

@app.route("/check-supplier-exists/<supplier_name>", methods=["GET"])
def check_supplier_exists(supplier_name):
    try:
        cursor.execute("SELECT COUNT(*) FROM suppliers WHERE supplier_name = %s", (supplier_name,))
        count = cursor.fetchone()[0]
        return jsonify({"exists": count > 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Add supplier
@app.route("/add-supplier", methods=["POST"])
def add_supplier():
    try:
        data = request.json
        supplier_name = data.get("supplier_name")
        contact_person = data.get("contact_person", "")
        phone = data.get("phone_number", "")
        email = data.get("email", "")
        address = data.get("address", "")

        if not supplier_name:
            return jsonify({"error": "Supplier name is required"}), 400

        cursor.execute("INSERT INTO suppliers (supplier_name, contact_person, phone_number, email, address) VALUES (%s, %s, %s, %s, %s)",
                       (supplier_name, contact_person, phone, email, address))
        db.commit()

        return jsonify({"message": "Supplier added successfully!"}), 201
    except mysql.connector.IntegrityError:
        return jsonify({"error": "Supplier name must be unique"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Delete supplier
@app.route("/delete-supplier/<int:supplier_id>", methods=["DELETE"])
def delete_supplier(supplier_id):
    try:
        cursor.execute("DELETE FROM suppliers WHERE supplier_id = %s", (supplier_id,))
        db.commit()
        return jsonify({"message": "Supplier deleted successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500        


@app.route("/update-supplier/<int:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
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
        cursor.execute("SELECT * FROM suppliers WHERE supplier_id = %s", (supplier_id,))
        existing_supplier = cursor.fetchone()
        if not existing_supplier:
            return jsonify({"error": "Supplier not found"}), 404

        # Check if another supplier has the same name
        cursor.execute(
            "SELECT supplier_id FROM suppliers WHERE supplier_name = %s AND supplier_id != %s",
            (supplier_name, supplier_id),
        )
        duplicate_supplier = cursor.fetchone()
        if duplicate_supplier:
            return jsonify({"error": "Supplier name already exists"}), 400

        # Update the supplier
        cursor.execute(
            "UPDATE suppliers SET supplier_name = %s, contact_person = %s, phone_number = %s, email = %s, address = %s WHERE supplier_id = %s",
            (supplier_name, contact_person, phone_number, email, address, supplier_id),
        )
        db.commit()

        return jsonify({"message": "Supplier updated successfully!"}), 200
    except Exception as e:
        print("Error:", str(e))  # Debugging output
        return jsonify({"error": str(e)}), 500


# Fetch Supplier Products with Product ID Included
@app.route('/supplier-products/<int:supplier_id>', methods=['GET'])
def get_supplier_products(supplier_id):
    cursor = db.cursor(dictionary=True)
    query = """
        SELECT sp.supplier_product_id, p.product_id, p.product_name, sp.price, sp.stock_supplied, sp.supply_date
        FROM supplier_products sp
        JOIN products p ON sp.product_id = p.product_id
        WHERE sp.supplier_id = %s
    """
    cursor.execute(query, (supplier_id,))
    products = cursor.fetchall()
    cursor.close()

    # ✅ Format `supply_date` to "YYYY-MM-DD" if it's not None
    for product in products:
        if product["supply_date"]:
            product["supply_date"] = product["supply_date"].strftime("%Y-%m-%d")

    return jsonify(products)


@app.route("/supplier-products/<int:supplier_id>/add", methods=["POST"])
def add_supplier_product(supplier_id):
    try:
        data = request.json
        print("Received Data:", data)  # Debugging

        if not all(key in data for key in ["product_id", "stock_supplied", "price", "supply_date"]):
            return jsonify({"error": "Missing required fields"}), 400

        # Convert data types
        product_id = int(data["product_id"])
        stock_supplied = int(data["stock_supplied"])
        price = float(data["price"])  # Convert to decimal/float
        supply_date = data["supply_date"]  # Assuming it's a valid date string

        # Insert into supplier_products
        query = """
            INSERT INTO supplier_products (supplier_id, product_id, stock_supplied, price, supply_date)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (supplier_id, product_id, stock_supplied, price, supply_date))

        # Update product stock in the products table
        update_stock_query = """
            UPDATE products 
            SET product_stock = product_stock + %s
            WHERE product_id = %s
        """
        cursor.execute(update_stock_query, (stock_supplied, product_id))

        # Commit both changes
        db.commit()

        return jsonify({"message": "Supply record added and product stock updated successfully"}), 201

    except ValueError as ve:
        return jsonify({"error": f"Invalid data type: {ve}"}), 400
    except Exception as e:
        print("Error:", e)
        db.rollback()  # Rollback in case of failure
        return jsonify({"error": "Internal Server Error"}), 500
    
# Endpoint to handle supplier payments
@app.route("/supplier-payments", methods=["POST"])
def add_supplier_payment():
    try:
        data = request.json
        print("Received Data:", data)  # Debugging to check received data

        supplier_id = data.get("supplier_id")
        supplier_product_id = data.get("supplier_product_id")
        amount = Decimal(str(data.get("amount")))  # ✅ Convert amount to Decimal
        payment_method = data.get("payment_method")
        reference = data.get("reference")  # Now it will accept any value, including None
        payment_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Get total payments made for this supplier_product_id
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM supplier_payments WHERE supplier_product_id = %s",
            (supplier_product_id,),
        )
        total_paid_result = cursor.fetchone()
        total_paid = Decimal(total_paid_result["total_paid"])  # ✅ Convert fetched total to Decimal

        # Get product price from the supplier_products table
        cursor.execute(
            "SELECT price FROM supplier_products WHERE supplier_product_id = %s",
            (supplier_product_id,),
        )
        product_result = cursor.fetchone()
        product_price = Decimal(product_result["price"])  # ✅ Convert to Decimal

        # Calculate new balance
        new_total_paid = total_paid + amount  # ✅ Fix: Adding Decimal with Decimal
        balance_remaining = product_price - new_total_paid

        # Insert payment into supplier_payments table
        sql = """
        INSERT INTO supplier_payments (supplier_id, supplier_product_id, amount, payment_date, payment_method, reference)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (supplier_id, supplier_product_id, amount, payment_date, payment_method, reference))
        db.commit()

        print(f"✅ Payment successfully inserted into database! New Balance: {balance_remaining}")

        return jsonify({
            "message": "Payment recorded successfully!",
            "balance_remaining": float(balance_remaining)  # ✅ Convert Decimal to float for JSON response
        }), 201

    except Exception as e:
        print("Error:", str(e))  # Debugging errors
        return jsonify({"error": "Failed to record payment.", "details": str(e)}), 500

@app.route("/supplier-payments/<int:supplier_id>/<int:supplier_product_id>", methods=["GET"])
def get_supplier_payments(supplier_id, supplier_product_id):
    try:
        # Fetch all payments for the given supplier_product_id
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

        # Calculate total amount paid
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM supplier_payments WHERE supplier_product_id = %s",
            (supplier_product_id,)
        )
        total_paid_result = cursor.fetchone()
        total_paid = float(total_paid_result["total_paid"])

        # Get product price from supplier_products table
        cursor.execute(
            "SELECT price FROM supplier_products WHERE supplier_product_id = %s",
            (supplier_product_id,)
        )
        product_result = cursor.fetchone()
        product_price = float(product_result["price"]) if product_result else 0.0

        # Calculate balance remaining
        balance_remaining = product_price - total_paid

        return jsonify({
            "payments": payments,
            "total_paid": total_paid,
            "balance_remaining": balance_remaining
        }), 200

    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": "Failed to fetch payment history.", "details": str(e)}), 500
    
@app.route('/api/v1/supplier/<int:supplier_id>', methods=['GET'])
def get_supplier_name(supplier_id):
    db = get_db_connection()

    if db is None:
        print("❌ No valid database connection")
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    try:
        cursor = db.cursor(dictionary=True)
        query = "SELECT supplier_name FROM suppliers WHERE supplier_id = %s"
        cursor.execute(query, (supplier_id,))
        supplier = cursor.fetchone()

        if supplier:
            return jsonify(supplier)
        else:
            return jsonify({"error": "Supplier not found"}), 404

    except mysql.connector.Error as err:
        print(f"❌ Database Error: {err}")
        return jsonify({"error": "Database error"}), 500

    finally:
        if cursor:
            cursor.close()  # ✅ Close the cursor
        if db and db.is_connected():
            db.close()  # ✅ Close the connection to prevent sleep connections





@app.route('/api/v1/update-supplier-product/<int:supplier_product_id>', methods=['PUT'])
def update_supplier_product(supplier_product_id):
    global db  # Ensure we use the global database connection

    try:
        if not db.is_connected():  # Check if the connection is active
            db.reconnect()  # Reconnect if it's lost

        cursor = db.cursor(dictionary=True)  # Get a new cursor
        data = request.json
        new_stock_supplied = int(data.get("stock_supplied"))
        new_price = data.get("price")
        new_supply_date = data.get("supply_date")

        # Fetch existing stock and product_id
        cursor.execute("SELECT stock_supplied, product_id FROM supplier_products WHERE supplier_product_id = %s", (supplier_product_id,))
        existing_product = cursor.fetchone()

        if not existing_product:
            return jsonify({"error": "Product not found"}), 404

        old_stock_supplied = int(existing_product["stock_supplied"])
        product_id = existing_product["product_id"]

        # Calculate stock difference
        stock_difference = new_stock_supplied - old_stock_supplied

        # Update supplier_products table
        cursor.execute("""
            UPDATE supplier_products 
            SET stock_supplied = %s, price = %s, supply_date = %s 
            WHERE supplier_product_id = %s
        """, (new_stock_supplied, new_price, new_supply_date, supplier_product_id))

        # Update products table stock
        cursor.execute("""
            UPDATE products 
            SET product_stock = product_stock + %s 
            WHERE product_id = %s
        """, (stock_difference, product_id))

        db.commit()
        return jsonify({"message": "Supplier product updated successfully"})
    
    except mysql.connector.Error as err:
        print(f"❌ Database Error: {err}")  # Log the error for debugging
        return jsonify({"error": "Database connection error"}), 500


# Process Sale Endpoint
@app.route("/process-sale", methods=["POST"])
def process_sale():
    data = request.json
    customer_id = data.get("customer_id")  # Can be NULL for guest
    payment_type = data.get("payment_type")
    cart_items = data.get("cart_items")  # [{ product_id, quantity, subtotal }]
    vat = data.get("vat", 0.00)  # Default to 0.00 if not provided
    discount = data.get("discount", 0.00)  # Default to 0.00 if not provided
    status = "completed"

    print("Received customer_id:", customer_id)  # Debugging
    print("Received VAT:", vat)  # Debugging
    print("Received Discount:", discount)  # Debugging

    if not cart_items or payment_type not in ["Mpesa", "Cash"]:
        return jsonify({"error": "Invalid request"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection not available"}), 500

    try:
        cursor = conn.cursor()

        # ✅ Start transaction
        conn.start_transaction()

        # ✅ Convert subtotal to float before summing
        total_amount = sum(float(item["subtotal"]) for item in cart_items)

        # ✅ Calculate final total after VAT and discount
        final_total = total_amount + vat - discount

        # ✅ Insert sale with VAT and discount
        cursor.execute(
            """
            INSERT INTO sales (customer_id, total_price, payment_type, vat, discount,status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (customer_id if customer_id else None, final_total, payment_type, vat, discount,status),
        )
        sale_id = cursor.lastrowid  # Get the inserted sale ID

        for item in cart_items:
            product_id = item["product_id"]
            quantity = int(item["quantity"])  # ✅ Ensure quantity is an integer
            subtotal = float(item["subtotal"])  # ✅ Convert subtotal to float

            # ✅ Check stock before processing
            cursor.execute(
                "SELECT product_stock FROM products WHERE product_id = %s FOR UPDATE",
                (product_id,),
            )
            product = cursor.fetchone()
            if not product or product[0] < quantity:
                conn.rollback()  # Rollback transaction if stock is insufficient
                return jsonify({"error": f"Insufficient stock for product ID {product_id}"}), 400

            # ✅ Insert sale item
            cursor.execute(
                "INSERT INTO sales_items (sale_id, product_id, quantity, subtotal) VALUES (%s, %s, %s, %s)",
                (sale_id, product_id, quantity, subtotal),
            )

            # ✅ Update product stock
            cursor.execute(
                "UPDATE products SET product_stock = product_stock - %s WHERE product_id = %s",
                (quantity, product_id),
            )

        # ✅ Commit transaction
        conn.commit()
        return jsonify({"message": "Sale processed successfully"}), 201

    except Error as e:
        conn.rollback()  # Rollback on error
        print("❌ ERROR in process_sale:", str(e))
        return jsonify({"error": str(e)}), 500

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

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) AS total FROM products")
        total_products = cursor.fetchone()
        total_products = total_products["total"] if total_products else 0

        cursor.execute(
            """
            SELECT p.product_id, p.product_number, p.product_name, 
                   p.product_price, p.product_stock, p.product_description, 
                   p.created_at, p.category_id_fk, c.category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id_fk = c.category_id
            ORDER BY p.created_at DESC 
            LIMIT %s OFFSET %s
            """,
            (per_page, offset),
        )
        products = cursor.fetchall()

        formatted_products = [
            {
                "product_id": row["product_id"],
                "product_number": row["product_number"],
                "product_name": row["product_name"],
                "product_price": row["product_price"],
                "product_stock": row["product_stock"],
                "product_description": row["product_description"],
                "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row["created_at"] else None,
                "category_id_fk": row["category_id_fk"],
                "category_name": row["category_name"]
            }
            for row in products
        ]

        return jsonify({"products": formatted_products, "total_products": total_products, "page": page}), 200

    except mysql.connector.Error as e:
        print("❌ ERROR in get_sales_products:", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()  # ✅ Release connection back to the pool



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

# API Endpoint to Fetch Orders
# Updated API Endpoint to Fetch Orders
@app.route("/get-orders", methods=["GET"])
def get_orders():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    # Get date range from query parameters
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    # Build the SQL query to use product_price from products table
    query = """
        SELECT 
            s.sale_id,
            s.customer_id,
            c.customer_name,
            s.total_price,
            s.payment_type,
            s.sale_date,
             s.status,  # ADDED THIS LINE TO INCLUDE STATUS
            s.vat,
            s.discount,
            si.product_id,
            p.product_name,
            p.product_price,  # Changed from si.price to p.product_price
            si.quantity,
            (p.product_price * si.quantity) AS subtotal  # Calculate subtotal using product_price
        FROM 
            sales s
        LEFT JOIN 
            customers c ON s.customer_id = c.customer_id
        LEFT JOIN 
            sales_items si ON s.sale_id = si.sale_id
        LEFT JOIN 
            products p ON si.product_id = p.product_id
    """

    # Add date filtering if start_date and end_date are provided
    if start_date and end_date:
        query += f" WHERE DATE(s.sale_date) BETWEEN '{start_date}' AND '{end_date}'"

    query += " ORDER BY s.sale_date DESC;"

    cursor = conn.cursor(dictionary=True)
    cursor.execute(query)
    results = cursor.fetchall()
    cursor.close()
    conn.close()

    # Group orders by sale_id
    grouped_orders = {}
    for order in results:
        sale_id = order["sale_id"]
        if sale_id not in grouped_orders:
            grouped_orders[sale_id] = {
                "sale_id": sale_id,
                "customer_id": order["customer_id"],
                "customer_name": order["customer_name"],
                "total_price": order["total_price"],
                "payment_type": order["payment_type"],
                "sale_date": order["sale_date"],
                "vat": order["vat"],
                "discount": order["discount"],
                "status": order["status"],  # ADDED THIS LINE TO INCLUDE STATUS
                "items": [],
            }
        grouped_orders[sale_id]["items"].append({
            "product_id": order["product_id"],
            "product_name": order["product_name"],
            "product_price": order["product_price"],  # Now using product_price
            "quantity": order["quantity"],
            "subtotal": order["subtotal"],
        })

    return jsonify({"orders": list(grouped_orders.values())})



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
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE sales SET status = %s WHERE sale_id = %s",
            (new_status, sale_id)
        )
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()



if __name__ == "__main__":
    app.run(debug=True)
