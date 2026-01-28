from __future__ import annotations

from typing import List, Literal

from google.adk.tools import FunctionTool

from adk_app.telemetry.logger import get_logger
# Use Supabase data loader instead of JSON-based one
from adk_app.utils.supabase_data_loader import get_clinic_data, get_patient_data

logger = get_logger(__name__)  # noqa: F401


def _format_money(value: float | int, currency: str | None) -> str:
    try:
        return f"{currency or 'USD'} {float(value):,.2f}"
    except Exception:
        return str(value)


def clinic_context_tool(
    clinic_id: str,
    info_type: Literal[
        "overview",
        "packages",
        "insurance",
        "follow_up",
        "pre_op",
        "post_op",
        "red_flags",
        "surgeons",
    ] = "overview",
) -> str:
    """Returns clinic-specific information requested by the agent."""
    clinic = get_clinic_data(clinic_id)
    # logger.info(
    #     "context.clinic",
    #     extra={"clinic_id": clinic_id, "info_type": info_type},
    # )
    handlers = {
        "overview": _clinic_overview,
        "packages": _clinic_packages,
        "insurance": _clinic_insurance,
        "follow_up": _clinic_follow_up,
        "pre_op": _clinic_pre_op,
        "post_op": _clinic_post_op,
        "red_flags": _clinic_red_flags,
        "surgeons": _clinic_surgeons,
    }
    return handlers[info_type](clinic)


def patient_context_tool(
    patient_id: str,
    info_type: Literal[
        "summary",
        "medications",
        "follow_up",
        "surgery",
        "alerts",
        "lens_plan",
        "insurance",
    ] = "summary",
) -> str:
    """Returns patient-specific context without exposing entire record."""
    patient = get_patient_data(patient_id)
    # logger.info(
    #     "context.patient",
    #     extra={"patient_id": patient_id, "info_type": info_type},
    # )
    handlers = {
        "summary": _patient_summary,
        "medications": _patient_medications,
        "follow_up": _patient_follow_up,
        "surgery": _patient_surgery,
        "alerts": _patient_alerts,
        "lens_plan": _patient_lens_plan,
        "insurance": _patient_insurance,
    }
    return handlers[info_type](patient)


def build_context_tools() -> List[FunctionTool]:
    """Builds FunctionTool wrappers for clinic/patient context helpers."""
    return [
        FunctionTool(clinic_context_tool),
        FunctionTool(patient_context_tool),
    ]


def _clinic_overview(clinic: dict) -> str:
    return (
        f"Clinic: {clinic.get('name')}\n"
        f"Address: {clinic.get('address', {}).get('line1', '')}, "
        f"{clinic.get('address', {}).get('city', '')}\n"
        f"Contacts: "
        + "; ".join(
            f"{c.get('role')}: {c.get('phone')}"
            for c in clinic.get("primary_contacts", [])
        )
    )


def _clinic_packages(clinic: dict) -> str:
    lines = ["Available packages:"]
    for pkg in clinic.get("packages", []):
        base = _format_money(pkg.get("base_price", 0), pkg.get("currency"))
        lines.append(
            f"- {pkg.get('name')}: {base}. {pkg.get('description','')}"
        )
    return "\n".join(lines)


def _clinic_insurance(clinic: dict) -> str:
    insurance = clinic.get("insurance", {})
    accepted = insurance.get("accepted_providers", [])
    lines = ["Insurance summary:"]
    for item in accepted:
        lines.append(
            f"- {item.get('name')}: standard {item.get('coverage_for_standard_package')}, "
            f"premium {item.get('coverage_for_premium_package','N/A')}"
        )
    if insurance.get("not_accepted"):
        lines.append(f"Not accepted: {', '.join(insurance['not_accepted'])}")
    if insurance.get("emi_options", {}).get("available"):
        emi = insurance["emi_options"]
        lines.append(
            f"EMI via {', '.join(emi.get('providers', []))} starting at "
            f"{_format_money(emi.get('min_amount', 0), 'USD')}."
        )
    return "\n".join(lines)


def _clinic_follow_up(clinic: dict) -> str:
    visits = clinic.get("follow_up", {}).get("visits", [])
    lines = ["Follow-up schedule:"]
    for visit in visits:
        lines.append(
            f"- Day {visit.get('day')}: {visit.get('purpose')} ({visit.get('notes','')})"
        )
    return "\n".join(lines)


def _clinic_pre_op(clinic: dict) -> str:
    checklist = clinic.get("pre_op", {}).get("checklist", [])
    lines = ["Pre-op checklist:"]
    for item in checklist:
        lines.append(
            f"- {item.get('item')} ({item.get('deadline')}): {item.get('notes','')}"
        )
    return "\n".join(lines)


def _clinic_post_op(clinic: dict) -> str:
    timeline = clinic.get("post_op", {}).get("timeline") or clinic.get("post_op", {})
    if isinstance(timeline, dict):
        lines = ["Post-op guidance:"]
        for key, value in timeline.items():
            lines.append(f"- {key}: {value}")
        return "\n".join(lines)
    return "Post-op guidance not available."


def _clinic_red_flags(clinic: dict) -> str:
    lines = ["Clinic-defined red flags:"]
    for flag in clinic.get("red_flags", []):
        lines.append(f"- {flag.get('symptom')}: {flag.get('action')}")
    return "\n".join(lines)


def _clinic_surgeons(clinic: dict) -> str:
    lines = ["Surgeon roster:"]
    for doc in clinic.get("surgeons", []):
        lines.append(
            f"- {doc.get('name')} ({doc.get('designation')}), {doc.get('experience_years')} yrs exp"
        )
    return "\n".join(lines)


def _patient_summary(patient: dict) -> str:
    clinical = patient.get("clinical_context", {})
    diagnosis = clinical.get("diagnosis", {})
    surgery = patient.get("surgical_recommendations_by_doctor", {})
    return (
        f"Patient: {patient.get('name', {}).get('first')} {patient.get('name', {}).get('last')}\n"
        f"Cataract type: {diagnosis.get('type','N/A')} ({diagnosis.get('pathology','N/A')})\n"
        f"Surgery date: {surgery.get('scheduling', {}).get('surgery_date', 'Upcoming')}"
    )


def _patient_medications(patient: dict) -> str:
    # Reviewed record might not have high-level medications list yet, check medical_history
    history = patient.get("medical_history", {})
    conditions = history.get("systemic_conditions", [])
    allergies = history.get("allergies", [])
    lines = ["Medical History & Medications:"]
    if conditions:
        lines.append(f"- Conditions: {', '.join(conditions)}")
    if allergies:
        lines.append(f"- Allergies: {', '.join(allergies)}")
    return "\n".join(lines)


def _patient_follow_up(patient: dict) -> str:
    scheduling = patient.get("surgical_recommendations_by_doctor", {}).get("scheduling", {})
    lines = ["Scheduled follow-ups:"]
    if scheduling.get("post_op_visit_1"):
        lines.append(f"- Post-Op Visit 1: {scheduling.get('post_op_visit_1')}")
    if scheduling.get("post_op_visit_2"):
        lines.append(f"- Post-Op Visit 2: {scheduling.get('post_op_visit_2')}")
    return "\n".join(lines) if len(lines) > 1 else "No specific follow-up dates scheduled yet."


def _patient_surgery(patient: dict) -> str:
    surgery = patient.get("surgical_recommendations_by_doctor", {})
    implants = surgery.get("selected_implants", {})
    lines = [
        f"Surgeon ID: {surgery.get('doctor_ref_id')}",
        "Lens Selection:",
    ]
    for eye, plan in implants.items():
        if isinstance(plan, dict) and plan.get("model"):
            lines.append(
                f"- {eye.upper()}: {plan.get('model')} ({plan.get('cylinder', 'Non-toric')}), Power: {plan.get('power')}"
            )
    return "\n".join(lines)


def _patient_alerts(patient: dict) -> str:
    clinical = patient.get("clinical_context", {})
    comorbidities = clinical.get("comorbidities") or []
    alerts = clinical.get("triggered_alerts") or []
    lines = ["Patient Alerts & Comorbidities:"]
    if comorbidities:
        lines.append("- " + ", ".join(comorbidities))
    for alert in alerts:
        if isinstance(alert, dict) and alert.get("message"):
            lines.append(f"- {alert.get('message')}")
    return "\n".join(lines) if len(lines) > 1 else "No alerts or comorbidities found."


def _patient_lens_plan(patient: dict) -> str:
    surgery = patient.get("surgical_recommendations_by_doctor", {})
    options = surgery.get("recommended_lens_options") or []
    if not options:
        return "No specific lens options discussed with the patient yet."
    lines = ["Recommended Lens Options:"]
    for opt in options:
        status = " (SELECTED)" if opt.get("is_selected_preference") else ""
        lines.append(
            f"- {opt.get('name')}{status}: {opt.get('description','')} - Reason: {opt.get('reason','')}"
        )
    return "\n".join(lines)


def _patient_insurance(patient: dict) -> str:
    # Reviewed record might have insurance info in extra or documents
    docs = patient.get("documents", {}).get("signed_consents", [])
    lines = ["Patient Documents & Insurance:"]
    if docs:
        for doc in docs:
            name = doc.get("name")
            date = doc.get("date", "N/A")
            lines.append(f"- Signed {name} on {date}")
    return "\n".join(lines) if len(lines) > 1 else "No specific insurance or document records."


