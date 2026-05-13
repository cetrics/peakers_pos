# db.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
import logging
from typing import Optional, Dict, Any, Generator
import urllib.parse  # ADDED: For URL-encoding the password

logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '',
    'database': 'peakers_pos'
}

# URL-encode the password to handle special characters (@, !, etc.)
encoded_password = urllib.parse.quote_plus(DB_CONFIG['password'])

# Create engine with optimized pooling for high concurrency
# Using encoded password in the connection string
engine = create_engine(
    f"mysql+pymysql://{DB_CONFIG['user']}:{encoded_password}@{DB_CONFIG['host']}/{DB_CONFIG['database']}",
    poolclass=QueuePool,
    pool_size=20,              # Base connections
    max_overflow=30,            # Additional connections when pool is exhausted
    pool_pre_ping=True,         # Verify connections before using
    pool_recycle=3600,          # Recycle connections after 1 hour
    pool_timeout=30,            # Timeout for getting connection from pool
    echo=False,
    connect_args={
        'connect_timeout': 10
    }
)

# Create session factory (not a global scoped session)
SessionFactory = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

@contextmanager
def get_db() -> Generator:
    """
    Context manager for database sessions
    Creates a NEW session for each request/operation
    Automatically closes and returns connection to pool
    """
    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        logger.debug("Database session closed, connection returned to pool")

def execute_query(query: str, params: Optional[Dict[str, Any]] = None, fetch_all: bool = True):
    """
    Execute a query and return results
    Creates its own session (automatically closed)
    """
    with get_db() as db:
        result = db.execute(text(query), params or {})
        if fetch_all and result.returns_rows:
            return [dict(row._mapping) for row in result]
        return result

def execute_insert(query: str, params: Optional[Dict[str, Any]] = None):
    """
    Execute an insert and return last insert id
    Creates its own session (automatically closed)
    """
    with get_db() as db:
        result = db.execute(text(query), params or {})
        db.flush()
        return result.lastrowid

def execute_update(query: str, params: Optional[Dict[str, Any]] = None):
    """
    Execute an update/delete and return row count
    Creates its own session (automatically closed)
    """
    with get_db() as db:
        result = db.execute(text(query), params or {})
        return result.rowcount

def get_db_connection():
    """
    Returns a raw DB-API connection
    Warning: Use sparingly, prefer execute_query functions
    """
    with get_db() as db:
        return db.connection()

def get_pool_status():
    """Get current connection pool status for monitoring"""
    pool = engine.pool
    return {
        'size': pool.size(),
        'checked_in': pool.checkedin(),
        'overflow': pool.overflow(),
        'total': pool.total(),
        'status': 'healthy' if pool.total() <= (pool.size() + pool.max_overflow()) else 'critical',
        'connections_in_use': pool.total() - pool.checkedin()
    }

def init_app(app):
    """Initialize the database for Flask app (optional)"""
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        """Close any remaining sessions at end of request"""
        # This is a safety net, but our context managers handle it
        pass