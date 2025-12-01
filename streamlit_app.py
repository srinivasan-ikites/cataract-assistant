from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

import requests
import streamlit as st
from dotenv import load_dotenv


load_dotenv()


DEFAULT_API_BASE = "http://localhost:8000"


@st.cache_data(show_spinner=False)
def load_patients() -> List[Dict]:
    """Load patient seed data for the selector UI."""
    path = Path("data/patient/sample_patient.json")
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("patients", [])


@st.cache_data(show_spinner=False)
def load_clinic_lookup() -> Dict[str, str]:
    """Return a mapping of clinic_id -> clinic name for quick display."""
    lookup: Dict[str, str] = {}
    clinic_dir = Path("data/clinic")
    if not clinic_dir.exists():
        return lookup
    for file in clinic_dir.glob("*.json"):
        try:
            with file.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            clinic_id = payload.get("clinic_id")
            name = payload.get("name")
            if clinic_id and name:
                lookup[clinic_id] = name
        except json.JSONDecodeError:
            continue
    return lookup


def ping_health(api_base: str) -> Tuple[str, str]:
    try:
        resp = requests.get(f"{api_base.rstrip('/')}/healthz", timeout=5)
        resp.raise_for_status()
        body = resp.json()
        return "online", body.get("status", "ok")
    except Exception as exc:  # noqa: BLE001
        return "offline", str(exc)


def call_agent_api(api_base: str, patient_id: str, question: str) -> Dict:
    resp = requests.post(
        f"{api_base.rstrip('/')}/ask",
        json={"patient_id": patient_id, "question": question},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def format_patient_badge(patient: Dict, clinic_lookup: Dict[str, str]) -> str:
    name = f"{patient['name']['first']} {patient['name']['last']}"
    clinic_name = clinic_lookup.get(patient["clinic_id"], patient["clinic_id"])
    return f"{name} — {clinic_name} ({patient['patient_id']})"


def render_patient_snapshot(patient: Dict, clinic_lookup: Dict[str, str]) -> None:
    st.subheader("Patient Snapshot")
    col1, col2, col3 = st.columns(3)
    col1.metric("Patient ID", patient["patient_id"])
    col2.metric("Clinic", clinic_lookup.get(patient["clinic_id"], patient["clinic_id"]))
    surgery = patient.get("surgery", {})
    col3.metric("Surgery Date", surgery.get("date", "TBD"))

    st.markdown(
        f"""
        **Diagnosis:** {patient.get('diagnosis', {}).get('condition', 'N/A')} ({patient.get('diagnosis', {}).get('eye', 'both eyes')})  
        **Preferred Language:** {patient.get('language_preference', 'English')}  
        **Insurance:** {patient.get('insurance', {}).get('provider', 'Unknown')}
        """
    )

    st.markdown("**Current IOL Plan:**")
    for plan in patient.get("surgery", {}).get("iol_plan", []):
        st.write(
            f"- {plan.get('type')} – {plan.get('model')} "
            f"({plan.get('priority', 'standard')})"
        )

    alerts = patient.get("alerts", [])
    if alerts:
        st.markdown("**Alerts & Preferences:**")
        st.write("\n".join(f"- {alert}" for alert in alerts))


def main() -> None:
    st.set_page_config(page_title="Cataract Counsellor", layout="wide")
    st.title("Cataract Counsellor – Patient Console")

    api_default = os.getenv("FASTAPI_URL", DEFAULT_API_BASE)
    st.sidebar.header("Backend")
    api_base = st.sidebar.text_input("FastAPI base URL", api_default).strip() or DEFAULT_API_BASE
    health_state, health_detail = ping_health(api_base)
    if health_state == "online":
        st.sidebar.success(f"API: {health_detail}")
    else:
        st.sidebar.error(f"API offline: {health_detail}")

    patients = load_patients()
    clinic_lookup = load_clinic_lookup()

    if not patients:
        st.error("No patient seed data found. Please populate data/patient/sample_patient.json.")
        return

    patient_labels = {format_patient_badge(p, clinic_lookup): p for p in patients}
    selected_label = st.sidebar.selectbox("Select patient profile", list(patient_labels.keys()), index=0)
    selected_patient = patient_labels[selected_label]

    render_patient_snapshot(selected_patient, clinic_lookup)

    st.divider()
    st.subheader("Ask a Question")
    with st.form("ask_form"):
        question = st.text_area(
            "What would you like to ask?",
            placeholder="e.g. Will my insurance cover the toric upgrade mentioned for my surgery?",
            height=120,
        )
        submitted = st.form_submit_button("Send to Counsellor")

    if submitted:
        if not question.strip():
            st.warning("Please enter a question before submitting.")
        else:
            with st.spinner("Contacting FastAPI agent..."):
                try:
                    response = call_agent_api(api_base, selected_patient["patient_id"], question.strip())
                    st.success("Received response from agent.")
                    st.markdown("### Assistant Answer")
                    st.write(response.get("answer", "No answer returned."))
                    st.markdown("### Router Summary")
                    st.json(response.get("router_summary", {}))
                    st.markdown("### Context Sources")
                    st.json(response.get("context_sources", {}))
                except requests.HTTPError as http_err:
                    st.error(f"API error ({http_err.response.status_code}): {http_err.response.text}")
                except Exception as exc:  # noqa: BLE001
                    st.error(f"Failed to reach FastAPI backend: {exc}")


if __name__ == "__main__":
    main()

