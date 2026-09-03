import os
import sys
import threading
from datetime import datetime
import pandas as pd
from .models import Enquiry, Appointment, Feedback

_chatbot_instance = None
_chatbot_lock = threading.Lock()
_chatbot_test_module = None
ENABLE_LLM_REPHRASING = os.getenv('ENABLE_LLM_REPHRASING', 'false').lower() in {
    '1',
    'true',
    'yes',
    'on',
}

ENQUIRY_COLUMNS = [
    'ENQUIRY ID',
    'Customer Name',
    'Vehicle Name / Model',
    'Enquiry Source',
    'Enquiry Date',
    'Status',
    'Temperature',
    'Phone Number',
    'Email',
    'Gender',
    'Appointment Date',
    'City / State',
    'Customer Type',
    'Payment Type',
    'Test Ride Taken',
]

APPOINTMENT_COLUMNS = [
    'Enquiry ID',
    'Customer Name',
    'Vehicle',
    'Appointment Date',
    'Time',
    'Status',
]

FEEDBACK_COLUMNS = [
    'Enquiry ID',
    'Customer Name',
    'Vehicle',
    'Date',
    'Feedback',
    'Rating',
]


def _get_chatbot_test_module():
    global _chatbot_test_module

    if _chatbot_test_module is None:
        import importlib.util

        llm_path = os.path.abspath(os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'llm',
            'Platinum_Sales_Chatbot-main',
        ))
        if llm_path not in sys.path:
            sys.path.insert(0, llm_path)

        spec = importlib.util.spec_from_file_location(
            "chatbot_test_module",
            os.path.join(llm_path, "test.py"),
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules["test"] = module
        spec.loader.exec_module(module)
        _chatbot_test_module = module

    return _chatbot_test_module


_get_chatbot_test_module()


class EmptySalesChatbot:
    """Fallback chatbot used when CRM tables are valid but contain no records."""

    def __init__(self):
        self.history = []
        self.use_llm = False

    def chat(self, raw_query: str) -> tuple:
        answer = "No CRM records found yet. Add enquiries, appointments, or feedback and ask again."
        self.history.append(("You", raw_query))
        self.history.append(("Assistant", answer))
        return answer, 0, "empty_crm"


def fetch_crm_data_for_chatbot():
    """Fetch live data from PostgreSQL via Django ORM"""
    # Enquiry
    enq_qs = Enquiry.objects.all().values()
    df_enq = pd.DataFrame(list(enq_qs))
    if not df_enq.empty:
        df_enq = df_enq.rename(columns={
            'enquiry_id': 'ENQUIRY ID',
            'customer': 'Customer Name',
            'vehicle': 'Vehicle Name / Model',
            'source': 'Enquiry Source',
            'date': 'Enquiry Date',
            'status': 'Status',
            'temperature': 'Temperature',
        })
        for col in ENQUIRY_COLUMNS:
            if col not in df_enq.columns:
                df_enq[col] = ''
    else:
        df_enq = pd.DataFrame(columns=ENQUIRY_COLUMNS)

    # Appointment
    app_qs = Appointment.objects.all().values()
    df_app = pd.DataFrame(list(app_qs))
    if not df_app.empty:
        df_app = df_app.rename(columns={
            'appointment_id': 'Enquiry ID',
            'customer': 'Customer Name',
            'vehicle': 'Vehicle',
            'date': 'Appointment Date',
            'time': 'Time',
            'status': 'Status',
        })
    else:
        df_app = pd.DataFrame(columns=APPOINTMENT_COLUMNS)

    # Feedback
    fb_qs = Feedback.objects.all().values()
    df_fb = pd.DataFrame(list(fb_qs))
    if not df_fb.empty:
        df_fb = df_fb.rename(columns={
            'enquiry_id': 'Enquiry ID',
            'customer': 'Customer Name',
            'date': 'Date',
            'status': 'Feedback',
        })
        df_fb['Rating'] = 3  # placeholder
    else:
        df_fb = pd.DataFrame(columns=FEEDBACK_COLUMNS)

    return {
        "Enquiry": df_enq,
        "Appointment": df_app,
        "Feedback": df_fb
    }


def reset_chatbot_instance():
    """Force the next chat request to rebuild the retriever from current CRM data."""
    global _chatbot_instance
    with _chatbot_lock:
        _chatbot_instance = None


def is_llm_enabled():
    return ENABLE_LLM_REPHRASING


def get_chatbot_instance():
    """Singleton pattern for chatbot with live DB data"""
    global _chatbot_instance
    with _chatbot_lock:
        if _chatbot_instance is None:
            print(" Building chatbot retriever from live CRM data...")
            chatbot_test_module = _get_chatbot_test_module()
            dfs = fetch_crm_data_for_chatbot()
            searchable_dfs = {
                source: df
                for source, df in dfs.items()
                if not df.empty
            }

            if not searchable_dfs:
                _chatbot_instance = EmptySalesChatbot()
                print(" Chatbot ready with empty CRM fallback.")
                return _chatbot_instance
            
            # Update known names
            for df in searchable_dfs.values():
                for col in df.columns:
                    if "name" in col.lower():
                        chatbot_test_module._KNOWN_NAMES_SET.update(
                            str(x) for x in df[col].dropna().unique() if str(x).strip()
                        )
            
            docs = chatbot_test_module.build_docs_per_source(searchable_dfs)
            retriever = chatbot_test_module.IntelligentRetriever(searchable_dfs, docs)
            
            if ENABLE_LLM_REPHRASING and not chatbot_test_module._llm_ready:
                threading.Thread(target=chatbot_test_module._load_llm, daemon=True).start()
            
            _chatbot_instance = chatbot_test_module.IntelligentSalesChatbot(retriever)
            _chatbot_instance.use_llm = ENABLE_LLM_REPHRASING
            print(" Chatbot ready with dynamic CRM data!")
    return _chatbot_instance


def process_chat_query(query: str) -> dict:
    try:
        lower_query = query.lower()

        injection_keywords = [
            "ignore previous", "disregard", "system prompt", "reveal prompt", 
            "bypass", "hack", "hack system","you are now", "act as", "forget instructions",
            "ignore all instructions","developer mode"
        ]
        if any(keyword in lower_query for keyword in injection_keywords):
            return {
                "status": "error",
                "message": "Security alert: Unsafe or restricted prompt detected."
            }

        harmful_keywords = [
            "delete database", "drop table", "select * from", 
            "shutdown", "rm -rf"
        ]
        if any(keyword in lower_query for keyword in harmful_keywords):
            return {
                "status": "error",
                "message": "Security alert: Action not permitted."
            }

        chatbot = get_chatbot_instance()
        answer, elapsed, intent = chatbot.chat(query)

        lower_answer = str(answer).lower()

        leakage_keywords = [
            "traceback", "api_key", "secret_key", "django.db", 
            "psycopg2", "password"
        ]
        if any(keyword in lower_answer for keyword in leakage_keywords):
            return {
                "status": "error",
                "message": "Security alert: Response blocked due to sensitive content."
            }

        return {
            "status": "success",
            "response": answer,
            "intent": intent,
            "latency": round(elapsed, 3)
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": "An unexpected error occurred while processing your request."
        }
