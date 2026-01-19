# sync.py
from db import get_db_connection, get_ubuntu_db_connection

def sync_table(table_name, columns, update_columns):
    local_conn = get_db_connection()
    if not local_conn:
        print(f"❌ Local DB not available for {table_name}")
        return

    ubuntu_conn = get_ubuntu_db_connection()
    if not ubuntu_conn:
        print(f"❌ Ubuntu DB not available for {table_name}")
        local_conn.close()
        return

    try:
        local_cursor = local_conn.cursor(dictionary=True)
        ubuntu_cursor = ubuntu_conn.cursor()

        col_str = ", ".join(columns)
        update_str = ", ".join(f"{col}=VALUES({col})" for col in update_columns)

        local_cursor.execute(f"SELECT {col_str} FROM {table_name}")
        rows = local_cursor.fetchall()
        print(f"📦 Found {len(rows)} rows to sync in {table_name}")

        for row in rows:
            values = tuple(row[col] for col in columns)
            placeholders = ", ".join(["%s"] * len(columns))
            query = f"""
                INSERT INTO {table_name} ({col_str})
                VALUES ({placeholders})
                ON DUPLICATE KEY UPDATE {update_str}
            """
            ubuntu_cursor.execute(query, values)

        ubuntu_conn.commit()
        print(f"✅ {table_name} sync completed successfully")

    except Exception as e:
        ubuntu_conn.rollback()
        print(f"❌ Sync failed for {table_name}:", e)

    finally:
        local_cursor.close()
        ubuntu_cursor.close()
        local_conn.close()
        ubuntu_conn.close()


def sync_all_tables():
    # --- USERS table ---
    sync_table(
        table_name="users",
        columns=["username", "user_email", "user_password"],
        update_columns=["user_password"]
    )

    # --- CUSTOMERS table ---
    sync_table(
        table_name="customers",
        columns=["customer_name", "phone", "email", "address"],
        update_columns=["phone", "email", "address"]
    )

    sync_table(
    table_name="products",
    columns=[
        "product_number",
        "product_name",
        "product_price",
        "buying_price",
        "product_stock",
        "product_description",
        "created_at",
        "category_id_fk",
        "unit",
        "expiry_date",
        "reorder_threshold"
    ],
    update_columns=[
        "product_name",
        "product_price",
        "buying_price",
        "product_stock",
        "product_description",
        "category_id_fk",
        "unit",
        "expiry_date",
        "reorder_threshold"
    ]
)

sync_table(
    table_name="product_bundles",
    columns=[
        "bundle_id",
        "parent_product_id",
        "child_product_id",
        "quantity",
        "selling_price"
    ],
    update_columns=[
        "quantity",
        "selling_price"
    ]
)

sync_table(
    table_name="raw_materials",
    columns=[
        "material_id",
        "material_name",
        "unit"
    ],
    update_columns=[
        "material_name",
        "unit"
    ]
)

sync_table(
    table_name="product_recipes",
    columns=[
        "product_id",
        "material_id",
        "quantity"
    ],
    update_columns=[
        "quantity"
    ]
)

sync_table(
    table_name="material_supplies",
    columns=[
        "supply_id",
        "material_id",
        "supplier_name",
        "quantity",
        "unit_price",
        "total_cost"
    ],
    update_columns=[
        "supplier_name",
        "unit_price",
        "total_cost"
    ]
)

sync_table(
    table_name="categories",
    columns=[
        "category_id",
        "category_name"
    ],
    update_columns=[
        "category_name"
    ]
)


sync_table(
    table_name="suppliers",
    columns=[
        "supplier_id",
        "supplier_name",
        "contact_person",
        "phone_number",
        "email",
        "address"
    ],
    update_columns=[
        "contact_person",
        "phone_number",
        "email",
        "address"
    ]
)


sync_table(
    table_name="supplier_products",
    columns=[
        "supplier_product_id",
        "supplier_id",
        "product_id",
        "stock_supplied",
        "price",
        "supply_date"
    ],
    update_columns=[
        "price"
    ]
)



    # --- Add other tables here as needed ---

    # --- PRODUCTS table example ---
    # sync_table(
    #     table_name="products",
    #     columns=["product_id", "name", "price", "stock"],
    #     update_columns=["price", "stock"]
    # )

    # --- Add more tables here ---
