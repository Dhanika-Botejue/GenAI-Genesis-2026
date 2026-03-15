import os
import uuid
from datetime import datetime, timedelta
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
import certifi

load_dotenv()

_client = None
_db = None


def get_db():
    global _client, _db
    if _db is not None:
        return _db

    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/genai_app")
    tls_kwargs = {"tlsCAFile": certifi.where()} if "mongodb+srv" in mongo_uri else {}

    _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, **tls_kwargs)
    # Use the database name from the URI; fall back to genai_app.
    try:
        _db = _client.get_default_database()
    except Exception:
        _db = _client["genai_app"]
    return _db


def init_db():
    """Initializes the database connection and seeds data if empty."""
    db = get_db()
    if db.residents.count_documents({}) == 0:
        print("Seeding MongoDB with demo data...")
        seed_data(db)
    else:
        print(f"MongoDB already seeded ({db.residents.count_documents({})} residents)")


# ── SEED ────────────────────────────────────────────────────────────────────────

FACILITY_ID = "fac00000-0000-4000-a000-000000000001"

def seed_data(db):
    now = datetime.utcnow()
    yesterday = now - timedelta(days=1)

    # ── Facility ────────────────────────────────────────────────────────
    db.facilities.insert_one({
        "_id": FACILITY_ID,
        "name": "Maplewood Care Centre",
        "address": "142 Maplewood Drive, Toronto, ON M4B 1Z3",
        "phone": "+1-416-555-0100",
        "timezone": "America/Toronto",
        "metadata": {"ibm_cloud_region": "us-south", "watsonx_project_id": "proj-maplewood-001"},
        "created_at": now,
    })

    # ── Floor ───────────────────────────────────────────────────────────
    db.floors.insert_one({
        "_id": "f1000000-0000-4000-a000-000000000001",
        "facility_id": FACILITY_ID,
        "floor_number": 1,
        "label": "Ground Floor — Residential Wing",
        "created_at": now,
    })

    # ── Rooms ───────────────────────────────────────────────────────────
    rooms = [
        {"_id": f"aa000000-0000-4000-a000-00000000000{i}", "floor_id": "f1000000-0000-4000-a000-000000000001",
         "room_number": num, "room_type": rtype, "capacity": cap,
         "model_coords": coords, "created_at": now}
        for i, num, rtype, cap, coords in [
            (1, "101", "resident", 1, {"x": 1, "y": 0, "z": 1}),
            (2, "102", "resident", 1, {"x": 3, "y": 0, "z": 1}),
            (3, "103", "resident", 1, {"x": 5, "y": 0, "z": 1}),
            (4, "104", "resident", 1, {"x": 1, "y": 0, "z": 5}),
            (5, "105", "resident", 1, {"x": 3, "y": 0, "z": 5}),
            (6, "106", "resident", 1, {"x": 5, "y": 0, "z": 5}),
            (7, "NS1", "office",   4, {"x": 3, "y": 0, "z": 3}),
            (8, "CR1", "common",  20, {"x": 7, "y": 0, "z": 3}),
        ]
    ]
    db.rooms.insert_many(rooms)

    # ── Staff ───────────────────────────────────────────────────────────
    staff = [
        {"_id": f"bb000000-0000-4000-a000-00000000000{i}", "facility_id": FACILITY_ID,
         "full_name": name, "role": role, "phone": phone, "email": email, "is_active": True, "created_at": now}
        for i, name, role, phone, email in [
            (1, "Sandra Okafor",    "admin",      "+1-416-555-0201", "sandra.okafor@maplewood.ca"),
            (2, "Dr. James Harlow", "doctor",     "+1-416-555-0202", "j.harlow@maplewood.ca"),
            (3, "Carlos Rivera",    "nurse",      "+1-416-555-0203", "c.rivera@maplewood.ca"),
            (4, "Aisha Tremblay",   "nurse",      "+1-416-555-0204", "a.tremblay@maplewood.ca"),
            (5, "Marcus Webb",      "caregiver",  "+1-416-555-0205", "m.webb@maplewood.ca"),
            (6, "Derek Novak",      "technician", "+1-416-555-0206", "d.novak@maplewood.ca"),
        ]
    ]
    db.staff.insert_many(staff)

    # ── Residents (all 6) ───────────────────────────────────────────────
    residents = [
        {
            "_id": "cc000000-0000-4000-a000-000000000001",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000001",
            "room_number": "101", "mrn": "MRN-1001",
            "full_name": "Eleanor Whitfield", "date_of_birth": "1938-03-12", "sex": "female",
            "primary_language": "en", "admission_date": "2022-06-01",
            "emergency_contact": {"name": "Robert Whitfield", "relation": "son", "phone": "+1-416-555-1001"},
            "allergies": ["Penicillin"],
            "diagnoses": ["Type 2 Diabetes", "Hypertension", "Mild Cognitive Impairment"],
            "model_coords": {"highlight_regions": ["head", "left_leg"]},
            "phone_number": "+16479150931",
            "created_at": now,
        },
        {
            "_id": "cc000000-0000-4000-a000-000000000002",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000002",
            "room_number": "102", "mrn": "MRN-1002",
            "full_name": "Harold Steinberg", "date_of_birth": "1942-07-28", "sex": "male",
            "primary_language": "en", "admission_date": "2023-01-15",
            "emergency_contact": {"name": "Karen Steinberg", "relation": "daughter", "phone": "+1-416-555-1002"},
            "allergies": ["Sulfa drugs", "Latex"],
            "diagnoses": ["Parkinson's Disease", "Osteoporosis", "Depression"],
            "model_coords": {"highlight_regions": ["hands", "lower_back"]},
            "created_at": now,
        },
        {
            "_id": "cc000000-0000-4000-a000-000000000003",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000003",
            "room_number": "103", "mrn": "MRN-1003",
            "full_name": "Marie-Claire Bouchard", "date_of_birth": "1935-11-05", "sex": "female",
            "primary_language": "fr", "admission_date": "2021-09-20",
            "emergency_contact": {"name": "Pierre Bouchard", "relation": "son", "phone": "+1-514-555-1003"},
            "allergies": ["Aspirin", "NSAIDs"],
            "diagnoses": ["Congestive Heart Failure", "Atrial Fibrillation", "Arthritis"],
            "model_coords": {"highlight_regions": ["chest", "both_hands"]},
            "created_at": now,
        },
        {
            "_id": "cc000000-0000-4000-a000-000000000004",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000004",
            "room_number": "104", "mrn": "MRN-1004",
            "full_name": "George Nakamura", "date_of_birth": "1940-02-19", "sex": "male",
            "primary_language": "en", "admission_date": "2023-04-10",
            "emergency_contact": {"name": "Susan Nakamura", "relation": "wife", "phone": "+1-416-555-1004"},
            "allergies": [],
            "diagnoses": ["COPD", "Type 2 Diabetes", "Chronic Kidney Disease Stage 3"],
            "model_coords": {"highlight_regions": ["lungs", "kidneys"]},
            "created_at": now,
        },
        {
            "_id": "cc000000-0000-4000-a000-000000000005",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000005",
            "room_number": "105", "mrn": "MRN-1005",
            "full_name": "Agnes Kowalski", "date_of_birth": "1944-09-30", "sex": "female",
            "primary_language": "en", "admission_date": "2022-11-03",
            "emergency_contact": {"name": "Tom Kowalski", "relation": "son", "phone": "+1-905-555-1005"},
            "allergies": ["Codeine"],
            "diagnoses": ["Alzheimer's Disease (Moderate)", "Hypertension"],
            "model_coords": {"highlight_regions": ["head"]},
            "created_at": now,
        },
        {
            "_id": "cc000000-0000-4000-a000-000000000006",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000006",
            "room_number": "106", "mrn": "MRN-1006",
            "full_name": "Raymond Osei", "date_of_birth": "1948-04-14", "sex": "male",
            "primary_language": "en", "admission_date": "2024-02-28",
            "emergency_contact": {"name": "Grace Osei", "relation": "daughter", "phone": "+1-647-555-1006"},
            "allergies": ["Warfarin sensitivity"],
            "diagnoses": ["Post-Stroke Recovery", "Dysphagia", "Hypertension"],
            "model_coords": {"highlight_regions": ["head", "right_arm", "right_leg"]},
            "created_at": now,
        },
        # ── Patients matching frontend mock-patient-rooms.ts IDs ──────────
        # Room 102: dd000000... (cardiac/respiratory, age 85)
        {
            "_id": "dd000000-0000-4000-b000-000000000002",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000002",
            "room_number": "102", "mrn": "MRN-1007",
            "first_name": "Harold", "last_name": "Chen",
            "full_name": "Harold Chen", "date_of_birth": "1941-04-12", "sex": "male",
            "primary_language": "en", "admission_date": "2023-01-15",
            "emergency_contact": {"name": "Karen Chen", "relation": "daughter", "relationship": "daughter", "phone": "+1-416-555-1007"},
            "allergies": ["Sulfa drugs"],
            "diagnoses": ["Congestive Heart Failure", "Respiratory Distress", "Orthostatic Hypotension"],
            "medications": ["Lisinopril 10mg (once daily)", "Furosemide 40mg (once daily)"],
            "model_coords": {"highlight_regions": ["chest", "lungs", "head"]},
            "phone_number": "+16479150932",
            "notes": "Chest tightness worsens when lying flat. Head-of-bed elevation required. Supervised transfers — dizziness on standing.",
            "created_at": now,
        },
        # Room 103: ee000000... (back pain/GI, age 71)
        {
            "_id": "ee000000-0000-4000-c000-000000000003",
            "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000003",
            "room_number": "103", "mrn": "MRN-1008",
            "first_name": "Margaret", "last_name": "Oduya",
            "full_name": "Margaret Oduya", "date_of_birth": "1955-08-22", "sex": "female",
            "primary_language": "en", "admission_date": "2024-02-10",
            "emergency_contact": {"name": "James Oduya", "relation": "son", "relationship": "son", "phone": "+1-647-555-1008"},
            "allergies": [],
            "diagnoses": ["Chronic Lower Back Pain", "Gastroesophageal Reflux Disease", "Fatigue"],
            "medications": ["Aspirin 81mg (once daily)", "Atorvastatin 20mg (once daily)"],
            "model_coords": {"highlight_regions": ["lower_back", "abdomen"]},
            "phone_number": "+16479150933",
            "notes": "Dull lower back pain rated 5/10. Post-meal stomach discomfort — small frequent meals. Generally fatigued.",
            "created_at": now,
        },
    ]
    db.residents.insert_many(residents)

    # ── Devices (cameras + tablets per room, common room speaker) ──────
    devices = [
        # Room 101
        {"_id": "ee000000-0000-4000-a000-000000000001", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000001",
         "device_type": "camera", "serial_number": "CAM-101", "label": "Room 101 Camera", "is_active": True,
         "model_coords": {"x":1,"y":2.5,"z":1}, "metadata": {"resolution":"1080p"}, "created_at": now},
        {"_id": "ee000000-0000-4000-a000-000000000002", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000001",
         "device_type": "bedside_tablet", "serial_number": "TAB-101", "label": "Room 101 Tablet", "is_active": True,
         "model_coords": {"x":1,"y":1.2,"z":1}, "created_at": now},
        # Room 102
        {"_id": "ee000000-0000-4000-a000-000000000003", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000002",
         "device_type": "camera", "serial_number": "CAM-102", "label": "Room 102 Camera", "is_active": True,
         "model_coords": {"x":3,"y":2.5,"z":1}, "created_at": now},
        {"_id": "ee000000-0000-4000-a000-000000000004", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000002",
         "device_type": "bedside_tablet", "serial_number": "TAB-102", "label": "Room 102 Tablet", "is_active": True,
         "model_coords": {"x":3,"y":1.2,"z":1}, "created_at": now},
        # Room 106
        {"_id": "ee000000-0000-4000-a000-000000000011", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000006",
         "device_type": "camera", "serial_number": "CAM-106", "label": "Room 106 Camera", "is_active": True,
         "model_coords": {"x":5,"y":2.5,"z":5}, "created_at": now},
        {"_id": "ee000000-0000-4000-a000-000000000012", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000006",
         "device_type": "bedside_tablet", "serial_number": "TAB-106", "label": "Room 106 Tablet", "is_active": True,
         "model_coords": {"x":5,"y":1.2,"z":5}, "created_at": now},
        # Common room
        {"_id": "ee000000-0000-4000-a000-000000000013", "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000008",
         "device_type": "smart_speaker", "serial_number": "SPK-CR1", "label": "Common Room Speaker", "is_active": True,
         "model_coords": {"x":7,"y":1.5,"z":3}, "created_at": now},
    ]
    db.devices.insert_many(devices)

    # ── Medications ─────────────────────────────────────────────────────
    meds = [
        # Eleanor
        {"_id": "ff000000-0000-4000-a000-000000000001", "resident_id": "cc000000-0000-4000-a000-000000000001",
         "name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "route": "oral", "is_active": True, "start_date": "2022-06-01"},
        {"_id": "ff000000-0000-4000-a000-000000000002", "resident_id": "cc000000-0000-4000-a000-000000000001",
         "name": "Lisinopril", "dosage": "10mg", "frequency": "once daily", "route": "oral", "is_active": True, "start_date": "2022-06-01"},
        {"_id": "ff000000-0000-4000-a000-000000000003", "resident_id": "cc000000-0000-4000-a000-000000000001",
         "name": "Donepezil", "dosage": "5mg", "frequency": "once daily", "route": "oral", "is_active": True, "start_date": "2022-08-10"},
        # Harold
        {"_id": "ff000000-0000-4000-a000-000000000004", "resident_id": "cc000000-0000-4000-a000-000000000002",
         "name": "Levodopa/Carbidopa", "dosage": "25/100mg", "frequency": "three times daily", "route": "oral", "is_active": True, "start_date": "2023-01-15"},
        {"_id": "ff000000-0000-4000-a000-000000000005", "resident_id": "cc000000-0000-4000-a000-000000000002",
         "name": "Sertraline", "dosage": "50mg", "frequency": "once daily", "route": "oral", "is_active": True, "start_date": "2023-01-15"},
        # Marie-Claire
        {"_id": "ff000000-0000-4000-a000-000000000007", "resident_id": "cc000000-0000-4000-a000-000000000003",
         "name": "Furosemide", "dosage": "40mg", "frequency": "once daily", "route": "oral", "is_active": True, "start_date": "2021-09-20"},
        {"_id": "ff000000-0000-4000-a000-000000000008", "resident_id": "cc000000-0000-4000-a000-000000000003",
         "name": "Apixaban", "dosage": "5mg", "frequency": "twice daily", "route": "oral", "is_active": True, "start_date": "2021-09-20"},
        # George
        {"_id": "ff000000-0000-4000-a000-000000000009", "resident_id": "cc000000-0000-4000-a000-000000000004",
         "name": "Tiotropium", "dosage": "18mcg", "frequency": "once daily", "route": "inhaled", "is_active": True, "start_date": "2023-04-10"},
        {"_id": "ff000000-0000-4000-a000-000000000010", "resident_id": "cc000000-0000-4000-a000-000000000004",
         "name": "Insulin Glargine", "dosage": "20 units", "frequency": "once nightly", "route": "subcutaneous", "is_active": True, "start_date": "2023-04-10"},
        # Agnes
        {"_id": "ff000000-0000-4000-a000-000000000011", "resident_id": "cc000000-0000-4000-a000-000000000005",
         "name": "Memantine", "dosage": "10mg", "frequency": "twice daily", "route": "oral", "is_active": True, "start_date": "2022-11-03"},
        {"_id": "ff000000-0000-4000-a000-000000000012", "resident_id": "cc000000-0000-4000-a000-000000000005",
         "name": "Amlodipine", "dosage": "5mg", "frequency": "once daily", "route": "oral", "is_active": True, "start_date": "2022-11-03"},
        # Raymond
        {"_id": "ff000000-0000-4000-a000-000000000013", "resident_id": "cc000000-0000-4000-a000-000000000006",
         "name": "Clopidogrel", "dosage": "75mg", "frequency": "once daily", "route": "oral", "is_active": True, "start_date": "2024-02-28"},
        {"_id": "ff000000-0000-4000-a000-000000000014", "resident_id": "cc000000-0000-4000-a000-000000000006",
         "name": "Atorvastatin", "dosage": "40mg", "frequency": "once nightly", "route": "oral", "is_active": True, "start_date": "2024-02-28"},
    ]
    db.medications.insert_many(meds)

    # ── AI Sessions (3 demo sessions) ──────────────────────────────────
    sessions = [
        {
            "_id": "a2000000-0000-4000-a000-000000000001",
            "resident_id": "cc000000-0000-4000-a000-000000000001",
            "device_id": "ee000000-0000-4000-a000-000000000002",
            "trigger_type": "scheduled", "status": "completed", "language": "en",
            "started_at": now - timedelta(hours=28), "ended_at": now - timedelta(hours=27, minutes=52),
            "duration_secs": 480,
            "raw_transcript": "AI: Good morning Eleanor, how are you feeling today? Eleanor: Oh, I am alright I suppose. My left knee is bothering me a bit. AI: On a scale of 0 to 10, how would you rate your pain? Eleanor: Maybe a 4. AI: Did you sleep well last night? Eleanor: Not too bad, woke up once.",
            "speech_analysis": {"slurring_score": 0.05, "word_repetition": False, "pattern_deviation": 0.08,
                                "stroke_risk_flag": False, "dizziness_flag": False, "sentiment_score": 0.20},
            "care_note": {"pain_level": 4, "sleep_quality": 7, "mood": "calm",
                          "symptoms": ["left knee pain"], "mobility_notes": "Ambulatory with minor discomfort.",
                          "ai_summary": "Resident reports mild left knee pain (4/10) and adequate sleep. No acute concerns. Monitor knee mobility.",
                          "is_pre_visit": False},
            "created_at": now - timedelta(hours=28),
        },
        {
            "_id": "a2000000-0000-4000-a000-000000000002",
            "resident_id": "cc000000-0000-4000-a000-000000000002",
            "device_id": "ee000000-0000-4000-a000-000000000004",
            "trigger_type": "scheduled", "status": "completed", "language": "en",
            "started_at": now - timedelta(hours=28), "ended_at": now - timedelta(hours=27, minutes=54),
            "duration_secs": 360,
            "raw_transcript": "AI: Good morning Harold. How are you feeling? Harold: My hands are shaking more than usual this morning. AI: Are you having any pain? Harold: No pain. Just stiff. AI: Did you sleep well? Harold: I slept about six hours.",
            "speech_analysis": {"slurring_score": 0.12, "word_repetition": False, "pattern_deviation": 0.15,
                                "stroke_risk_flag": False, "dizziness_flag": False, "sentiment_score": -0.10},
            "care_note": {"pain_level": 0, "sleep_quality": 6, "mood": "flat",
                          "symptoms": ["increased hand tremors", "morning stiffness"],
                          "mobility_notes": "Noticeable tremor increase; needs assistance with breakfast.",
                          "ai_summary": "Harold reports worsening hand tremors and morning stiffness. No pain. Sleep adequate. Recommend notifying Dr. Harlow to review Levodopa dosage.",
                          "is_pre_visit": False},
            "created_at": now - timedelta(hours=28),
        },
        {
            "_id": "a2000000-0000-4000-a000-000000000003",
            "resident_id": "cc000000-0000-4000-a000-000000000006",
            "device_id": "ee000000-0000-4000-a000-000000000012",
            "initiated_by": "bb000000-0000-4000-a000-000000000004",
            "trigger_type": "caregiver_launched", "status": "completed", "language": "en",
            "started_at": now - timedelta(hours=3), "ended_at": now - timedelta(hours=2, minutes=53),
            "duration_secs": 420,
            "raw_transcript": "AI: Hello Raymond, I am checking in with you. Are you feeling dizzy or weak? Raymond: A little dizzy when I stand up. AI: How long has this been happening? Raymond: Since this morning. AI: Any chest pain or trouble breathing? Raymond: No. Just dizzy.",
            "speech_analysis": {"slurring_score": 0.08, "word_repetition": False, "pattern_deviation": 0.22,
                                "stroke_risk_flag": False, "dizziness_flag": True, "sentiment_score": -0.30},
            "care_note": {"pain_level": 0, "mood": "anxious",
                          "symptoms": ["orthostatic dizziness"],
                          "ai_summary": "Raymond reports dizziness on standing since this morning. No chest pain or dyspnea. Likely orthostatic hypotension given post-stroke history. Urgent BP monitoring required.",
                          "is_pre_visit": False},
            "created_at": now - timedelta(hours=3),
        },
    ]
    db.ai_sessions.insert_many(sessions)

    # ── Alerts (3 open) ────────────────────────────────────────────────
    alerts = [
        {
            "_id": "a6000000-0000-4000-a000-000000000001",
            "facility_id": FACILITY_ID,
            "resident_id": "cc000000-0000-4000-a000-000000000006",
            "device_id": "ee000000-0000-4000-a000-000000000012",
            "session_id": "a2000000-0000-4000-a000-000000000003",
            "urgency": "urgent", "source": "voice_session",
            "alert_type": "orthostatic_dizziness",
            "description": "Raymond Osei (Room 106) reports dizziness on standing since this morning. Post-stroke patient — orthostatic hypotension suspected. Immediate BP check required.",
            "status": "open", "created_at": now - timedelta(hours=3),
        },
        {
            "_id": "a6000000-0000-4000-a000-000000000002",
            "facility_id": FACILITY_ID,
            "resident_id": "cc000000-0000-4000-a000-000000000002",
            "session_id": "a2000000-0000-4000-a000-000000000002",
            "urgency": "mid", "source": "voice_session",
            "alert_type": "symptom_change",
            "description": "Harold Steinberg (Room 102) reports increased hand tremors and morning stiffness. Parkinson's patient — possible medication adjustment needed. Notify Dr. Harlow.",
            "status": "open", "created_at": now - timedelta(hours=28),
        },
        {
            "_id": "a6000000-0000-4000-a000-000000000003",
            "facility_id": FACILITY_ID,
            "resident_id": "cc000000-0000-4000-a000-000000000001",
            "urgency": "low", "source": "manual",
            "alert_type": "pain_reported",
            "description": "Eleanor Whitfield (Room 101) reported left knee pain of 4/10 during morning check-in. Monitor and reassess this afternoon.",
            "status": "open", "created_at": now - timedelta(hours=28),
        },
    ]
    db.alerts.insert_many(alerts)

    # ── Vital Signs ────────────────────────────────────────────────────
    vitals = [
        {"_id": f"a7000000-0000-4000-a000-00000000000{i}", "resident_id": rid, "recorded_by": nurse,
         "heart_rate": hr, "systolic_bp": sbp, "diastolic_bp": dbp, "temperature": temp, "spo2": spo2,
         "recorded_at": yesterday, "created_at": yesterday}
        for i, rid, nurse, hr, sbp, dbp, temp, spo2 in [
            (1, "cc000000-0000-4000-a000-000000000001", "bb000000-0000-4000-a000-000000000003", 72, 138, 82, 36.6, 98),
            (2, "cc000000-0000-4000-a000-000000000002", "bb000000-0000-4000-a000-000000000003", 68, 125, 78, 36.4, 97),
            (3, "cc000000-0000-4000-a000-000000000003", "bb000000-0000-4000-a000-000000000003", 88, 142, 90, 36.8, 95),
            (4, "cc000000-0000-4000-a000-000000000004", "bb000000-0000-4000-a000-000000000004", 76, 130, 80, 36.5, 93),
            (5, "cc000000-0000-4000-a000-000000000005", "bb000000-0000-4000-a000-000000000004", 70, 148, 88, 36.7, 98),
            (6, "cc000000-0000-4000-a000-000000000006", "bb000000-0000-4000-a000-000000000004", 82, 158, 95, 36.9, 97),
        ]
    ]
    db.vital_signs.insert_many(vitals)

    print("MongoDB seed complete — 6 residents, 6 staff, devices, medications, sessions, alerts, vitals.")


# ── CRUD OPERATIONS ─────────────────────────────────────────────────────────────

def read_db():
    """Returns residents, open alerts, and recent sessions for the frontend."""
    db = get_db()
    residents = list(db.residents.find())
    alerts = list(db.alerts.find({"status": "open"}).sort("created_at", DESCENDING))
    sessions = list(db.ai_sessions.find().sort("created_at", DESCENDING).limit(20))

    # Make _id JSON-serialisable (ObjectId → str, or already a string)
    def clean(doc):
        doc["id"] = str(doc["_id"])
        doc["_id"] = str(doc["_id"])
        # Convert datetimes to ISO strings for JSON
        for k, v in doc.items():
            if isinstance(v, datetime):
                doc[k] = v.isoformat()
        return doc

    return {
        "patients": [clean(r) for r in residents],
        "alerts":   [clean(a) for a in alerts],
        "sessions": [clean(s) for s in sessions],
    }


def get_resident(resident_id):
    """Fetch a single resident by _id."""
    db = get_db()
    return db.residents.find_one({"_id": resident_id})


def get_resident_by_phone(phone_number):
    """Fetch a resident by phone_number field."""
    db = get_db()
    return db.residents.find_one({"phone_number": phone_number})


def clear_patient(phone_number):
    """Legacy wrapper — marks any in-progress sessions for this patient as completed."""
    db = get_db()
    resident = db.residents.find_one({"phone_number": phone_number})
    if resident:
        db.ai_sessions.update_many(
            {"resident_id": resident["_id"], "status": "in_progress"},
            {"$set": {"status": "completed", "ended_at": datetime.utcnow()}}
        )


def append_response(phone_number, question, answer):
    """Called by the Twilio endpoint when a patient answers a question."""
    db = get_db()
    resident = db.residents.find_one({"phone_number": phone_number})
    if not resident:
        print(f"[{phone_number}] No resident found, cannot save response.")
        return

    session = db.ai_sessions.find_one(
        {"resident_id": resident["_id"], "status": "in_progress"},
        sort=[("created_at", DESCENDING)]
    )

    transcript_addition = f"Q: {question}\nA: {answer}\n"

    if session:
        new_transcript = session.get("raw_transcript", "") + transcript_addition
        db.ai_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"raw_transcript": new_transcript}}
        )
    else:
        db.ai_sessions.insert_one({
            "_id": str(uuid.uuid4()),
            "resident_id": resident["_id"],
            "trigger_type": "scheduled",
            "status": "in_progress",
            "raw_transcript": transcript_addition,
            "created_at": datetime.utcnow()
        })
    print(f"[{phone_number}] Response saved to MongoDB.")


def log_alert(resident_id, urgency, source, alert_type, description, fall_event=None):
    """Creates a new alert document."""
    db = get_db()
    doc = {
        "_id": str(uuid.uuid4()),
        "facility_id": FACILITY_ID,
        "resident_id": resident_id,
        "urgency": urgency,
        "source": source,
        "alert_type": alert_type,
        "description": description,
        "status": "open",
        "created_at": datetime.utcnow(),
    }
    if fall_event:
        doc["fall_event"] = fall_event
    db.alerts.insert_one(doc)
    return doc["_id"]


def save_ai_session(resident_id, trigger_type, status, language, raw_transcript,
                    speech_analysis=None, care_note=None):
    """Saves a completed AI session with embedded speech analysis and care note."""
    db = get_db()
    doc = {
        "_id": str(uuid.uuid4()),
        "resident_id": resident_id,
        "trigger_type": trigger_type,
        "status": status,
        "language": language,
        "raw_transcript": raw_transcript,
        "created_at": datetime.utcnow(),
    }
    if speech_analysis:
        doc["speech_analysis"] = speech_analysis
    if care_note:
        doc["care_note"] = care_note
    db.ai_sessions.insert_one(doc)
    return doc["_id"]


def get_medications(resident_id):
    """Get active medications for a resident."""
    db = get_db()
    return list(db.medications.find({"resident_id": resident_id, "is_active": True}))


def get_vital_signs(resident_id, limit=10):
    """Get recent vital signs for a resident."""
    db = get_db()
    return list(db.vital_signs.find({"resident_id": resident_id}).sort("recorded_at", DESCENDING).limit(limit))
