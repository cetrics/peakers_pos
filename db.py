# db.py
from mysql.connector import pooling, connect

# Local MySQL settings
mysql_settings = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "peakers_pos_test",
}

try:
    pool = pooling.MySQLConnectionPool(
        pool_name="mypool",
        pool_size=5,
        **mysql_settings
    )
    print("✅ Connection pool created successfully")
except Exception as e:
    print("❌ Failed to create connection pool:", e)
    pool = None

def get_db_connection():
    if pool is None:
        print("❌ Connection pool not available")
        return None
    return pool.get_connection()

# Ubuntu MySQL settings
ubuntu_mysql_settings = {
    "host": "102.221.34.228",
    "port": 3306,
    "user": "pos_sync",
    "password": "1234",
    "database": "peakers_pos_system",
}

def get_ubuntu_db_connection():
    try:
        return connect(**ubuntu_mysql_settings)
    except Exception as e:
        print("⚠️ Ubuntu DB unreachable:", e)
        return None
