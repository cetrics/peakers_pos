from flask import Flask, render_template, request, redirect, url_for, session, jsonify, make_response
import mysql.connector
import smtplib
from email.message import EmailMessage
import hashlib
from itsdangerous import URLSafeTimedSerializer
from flask_cors import CORS
from datetime import datetime
from decimal import Decimal



app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Change this to a secure key
CORS(app)

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
    email = verify_token(token)  # Verify token with expiration time

    if not email:
        return jsonify({"error": "Invalid or expired token"}), 400  # Expired token

    if request.method == 'POST':
        data = request.json
        new_password = data.get("password")

        if not new_password:
            return jsonify({"error": "Password is required"}), 400

        hashed_password = hashlib.sha256(new_password.encode()).hexdigest()
        cursor.execute("UPDATE users SET user_password = %s WHERE user_email = %s", (hashed_password, email))
        db.commit()

        return jsonify({"message": "Password reset successful!"}), 200

    return render_template("reset_password.html", token=token)

#Admin Dashboard
@app.route("/sales-data")
def sales_data():
    # Dummy sales data (Replace with real DB query)
    sales_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    sales_values = [1000, 1500, 1200, 1800, 1600, 2000]  # Example sales revenue

    return jsonify({"labels": sales_labels, "sales": sales_values})

# ✅ Route to Register and Fetch Customers
@app.route("/get-customers", methods=["GET"])
def get_customers():
    # Pagination logic (unchanged)
    page = request.args.get("page", 1, type=int)
    per_page = 20
    offset = (page - 1) * per_page

    try:
        cursor.execute("SELECT COUNT(*) AS total FROM customers")
        total_customers = cursor.fetchone()["total"]

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

        return jsonify(
            {"customers": formatted_customers, "total_customers": total_customers, "page": page}
        ), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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


#For SupplierProducts
@app.route('/supplier-products/<int:supplier_id>', methods=['GET'])
def get_supplier_products(supplier_id):
    cursor = db.cursor(dictionary=True)
    query = """
        SELECT sp.supplier_product_id, p.product_name, sp.price, sp.stock_supplied, sp.supply_date
        FROM supplier_products sp
        JOIN products p ON sp.product_id = p.product_id
        WHERE sp.supplier_id = %s
    """
    cursor.execute(query, (supplier_id,))
    products = cursor.fetchall()
    cursor.close()
    
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
def get_supplier_product_payments(supplier_id, supplier_product_id):
    try:
        cursor.execute(
            "SELECT payment_id, amount, payment_method, reference, payment_date "
            "FROM supplier_payments WHERE supplier_id = %s AND supplier_product_id = %s "
            "ORDER BY payment_date DESC",
            (supplier_id, supplier_product_id)
        )
        payments = cursor.fetchall()
        return jsonify(payments)
    except Exception as e:
        return jsonify({"error": "Failed to retrieve payments", "details": str(e)}), 500






if __name__ == "__main__":
    app.run(debug=True)
