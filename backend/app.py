import os
import re
from datetime import datetime

import pymysql
import pymysql.cursors
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "research_portal"),
    "cursorclass": pymysql.cursors.DictCursor,
    "autocommit": True,
}

FIELDS = [
    "title", "description", "research_area", "faculty_name", "department",
    "required_skills", "available_positions", "application_deadline", "status",
]
TEXT_FIELDS = ["title", "description", "research_area", "faculty_name", "department", "required_skills"]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def get_connection():
    return pymysql.connect(**DB_CONFIG)


def is_valid_date(value):
    if not isinstance(value, str) or not DATE_RE.match(value):
        return False
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def validate(body, require_all):
    """Validates the fields present in body. If require_all, every field
    except status is mandatory. Returns (errors, data)."""
    errors = []
    data = {}

    if not isinstance(body, dict):
        return ["Request body must be a JSON object"], data

    for field in FIELDS:
        present = field in body and body[field] is not None
        if not present:
            if require_all and field != "status":
                errors.append(f"{field} is required")
            continue

        value = body[field]

        if field in TEXT_FIELDS:
            if not isinstance(value, str) or value.strip() == "":
                errors.append(f"{field} must be a non-empty string")
                continue
            value = value.strip()
        elif field == "available_positions":
            try:
                num = int(value)
                is_whole = float(value) == num
            except (ValueError, TypeError):
                errors.append("available_positions must be a whole number between 1 and 1000")
                continue
            if not is_whole or num < 1 or num > 1000:
                errors.append("available_positions must be a whole number between 1 and 1000")
                continue
            value = num
        elif field == "application_deadline":
            if not is_valid_date(value):
                errors.append("application_deadline must be a valid date in YYYY-MM-DD format")
                continue
        elif field == "status":
            if value not in ("Open", "Closed"):
                errors.append("status must be either 'Open' or 'Closed'")
                continue

        data[field] = value

    return errors, data


def parse_id(raw):
    if raw is not None and raw.isdigit() and int(raw) > 0:
        return int(raw)
    return None


def find_by_id(conn, opp_id):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM research_opportunities WHERE id = %s", (opp_id,))
        row = cur.fetchone()
    if row and row.get("application_deadline") is not None:
        row["application_deadline"] = row["application_deadline"].strftime("%Y-%m-%d")
    return row


# 1. CREATE
@app.post("/api/opportunities")
def create_opportunity():
    body = request.get_json(silent=True)
    errors, data = validate(body, require_all=True)
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400
    data.setdefault("status", "Open")

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO research_opportunities
                   (title, description, research_area, faculty_name, department,
                    required_skills, available_positions, application_deadline, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                tuple(data[f] for f in FIELDS),
            )
            new_id = cur.lastrowid
        created = find_by_id(conn, new_id)
        conn.close()
        return jsonify(created), 201
    except Exception as e:
        app.logger.error(e)
        return jsonify({"error": "Internal server error"}), 500


# 2. READ ALL
@app.get("/api/opportunities")
def get_all_opportunities():
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM research_opportunities ORDER BY id DESC")
            rows = cur.fetchall()
        conn.close()
        for row in rows:
            if row.get("application_deadline") is not None:
                row["application_deadline"] = row["application_deadline"].strftime("%Y-%m-%d")
        return jsonify(rows), 200
    except Exception as e:
        app.logger.error(e)
        return jsonify({"error": "Internal server error"}), 500


# 3. READ ONE
@app.get("/api/opportunities/<raw_id>")
def get_one_opportunity(raw_id):
    opp_id = parse_id(raw_id)
    if not opp_id:
        return jsonify({"error": "ID must be a positive integer"}), 400
    try:
        conn = get_connection()
        row = find_by_id(conn, opp_id)
        conn.close()
        if not row:
            return jsonify({"error": f"Research opportunity with ID {opp_id} not found"}), 404
        return jsonify(row), 200
    except Exception as e:
        app.logger.error(e)
        return jsonify({"error": "Internal server error"}), 500


# 4. UPDATE
@app.put("/api/opportunities/<raw_id>")
def update_opportunity(raw_id):
    opp_id = parse_id(raw_id)
    if not opp_id:
        return jsonify({"error": "ID must be a positive integer"}), 400

    try:
        conn = get_connection()
        existing = find_by_id(conn, opp_id)
        if not existing:
            conn.close()
            return jsonify({"error": f"Research opportunity with ID {opp_id} not found"}), 404

        body = request.get_json(silent=True)
        errors, data = validate(body, require_all=False)
        if errors:
            conn.close()
            return jsonify({"error": "Validation failed", "details": errors}), 400
        if not data:
            conn.close()
            return jsonify({"error": "Validation failed", "details": ["No valid fields provided to update"]}), 400

        set_clause = ", ".join(f"{key} = %s" for key in data.keys())
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE research_opportunities SET {set_clause} WHERE id = %s",
                (*data.values(), opp_id),
            )
        updated = find_by_id(conn, opp_id)
        conn.close()
        return jsonify(updated), 200
    except Exception as e:
        app.logger.error(e)
        return jsonify({"error": "Internal server error"}), 500


# 5. DELETE
@app.delete("/api/opportunities/<raw_id>")
def delete_opportunity(raw_id):
    opp_id = parse_id(raw_id)
    if not opp_id:
        return jsonify({"error": "ID must be a positive integer"}), 400
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM research_opportunities WHERE id = %s", (opp_id,))
            affected = cur.rowcount
        conn.close()
        if affected == 0:
            return jsonify({"error": f"Research opportunity with ID {opp_id} not found"}), 404
        return jsonify({"message": f"Research opportunity {opp_id} deleted successfully"}), 200
    except Exception as e:
        app.logger.error(e)
        return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api"):
        return jsonify({"error": "API route not found"}), 404
    return send_from_directory(FRONTEND_DIR, "index.html")


# Serve the frontend
@app.get("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    print(f"Server running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
