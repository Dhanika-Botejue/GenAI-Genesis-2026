import os
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
import certifi

load_dotenv()

_client = None
_db = None


def init_db():
    """Connect to MongoDB. Tries Atlas first, falls back to local."""
    global _client, _db
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")

    # Try Atlas first
    if "mongodb+srv" in mongo_uri:
        try:
            _client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=15000,   # 15s — gives Atlas time to find primary
                connectTimeoutMS=10000,           # 10s per node
                socketTimeoutMS=20000,
                tlsCAFile=certifi.where(),
                retryWrites=True,
                w="majority",
            )
            _client.admin.command("ping")
            _db = _client["nursing_home"]
            _db.patients.create_index("phone", unique=True)
            _db.call_sessions.create_index("patient_id")
            print(f"MongoDB Atlas connected — {_db.patients.count_documents({})} patients in DB")
            return
        except Exception as e:
            print(f"Atlas connection failed ({e}), falling back to local MongoDB...")

    # Fallback to local
    _client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=3000)
    _db = _client["nursing_home"]
    _db.patients.create_index("phone", unique=True)
    _db.call_sessions.create_index("patient_id")
    print(f"Local MongoDB connected — {_db.patients.count_documents({})} patients in DB")


def _get_db():
    if _db is None:
        init_db()
    return _db


# ── Helpers ──────────────────────────────────────────────────────────────────

def _serialize(doc):
    """Convert MongoDB doc to JSON-safe dict (ObjectId → str, datetime → ISO)."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, list):
            out[k] = [_serialize(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, dict):
            out[k] = _serialize(v)
        else:
            out[k] = v
    return out


# ── Patient CRUD ─────────────────────────────────────────────────────────────

def add_patient(first_name: str, last_name: str, phone: str) -> dict:
    db = _get_db()
    doc = {
        "firstName": first_name,
        "lastName": last_name,
        "phone": phone,
        # Medical profile — all empty, filled in by the doctor/manager only
        "dateOfBirth": "",
        "room": "",
        "primaryDiagnosis": "",
        "secondaryDiagnoses": [],
        "allergies": [],
        "medications": [],
        "emergencyContact": {"name": "", "relationship": "", "phone": ""},
        "notes": "",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = db.patients.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def update_patient(patient_id: str, fields: dict) -> dict | None:
    """Partially update a patient's profile. Only updates provided fields."""
    db = _get_db()
    # Prevent overwriting identity/index fields via this route
    fields.pop("_id", None)
    fields.pop("created_at", None)
    fields["updated_at"] = datetime.utcnow()
    db.patients.update_one({"_id": ObjectId(patient_id)}, {"$set": fields})
    return get_patient_by_id(patient_id)


def get_patients() -> list:
    db = _get_db()
    return [_serialize(p) for p in db.patients.find().sort("created_at", DESCENDING)]


def get_patient_by_id(patient_id: str) -> dict | None:
    db = _get_db()
    doc = db.patients.find_one({"_id": ObjectId(patient_id)})
    return _serialize(doc)


def get_patient_by_phone(phone: str) -> dict | None:
    db = _get_db()
    doc = db.patients.find_one({"phone": phone})
    return _serialize(doc)


# ── Call Session CRUD ────────────────────────────────────────────────────────

def create_call_session(patient_id: str, questions: list[str], greeting: str = "") -> str:
    """Creates a new in-progress call session. Returns session_id as string."""
    db = _get_db()
    doc = {
        "patient_id": ObjectId(patient_id),
        "questions_asked": questions,
        "answers": [],
        "greeting_used": greeting,
        "greeting_notes": "",
        "status": "in_progress",
        "created_at": datetime.utcnow(),
    }
    result = db.call_sessions.insert_one(doc)
    return str(result.inserted_id)


def save_greeting_notes(session_id: str, notes: str):
    """Saves what the patient said in response to the greeting."""
    db = _get_db()
    db.call_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"greeting_notes": notes}}
    )


def save_answer(session_id: str, question: str, clean_answer: str):
    """Appends one clean answer to an active call session."""
    db = _get_db()
    db.call_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$push": {"answers": {"question": question, "answer": clean_answer}}}
    )


def complete_session(session_id: str):
    """Marks a call session as completed."""
    db = _get_db()
    db.call_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )


def get_call_history(patient_id: str) -> list:
    """Returns all past call sessions for a patient, newest first."""
    db = _get_db()
    sessions = db.call_sessions.find(
        {"patient_id": ObjectId(patient_id)}
    ).sort("created_at", DESCENDING)
    return [_serialize(s) for s in sessions]


def get_session(session_id: str) -> dict | None:
    db = _get_db()
    doc = db.call_sessions.find_one({"_id": ObjectId(session_id)})
    return _serialize(doc)


# ── Legacy compat (used by old database.json code, now no-ops) ───────────────

def read_db():
    """Legacy — returns empty dict. Frontend should use /api/patients instead."""
    return {}


def clear_patient(phone_number):
    """Legacy no-op."""
    pass


def append_response(phone_number, question, answer):
    """Legacy no-op — use save_answer(session_id, ...) instead."""
    pass
