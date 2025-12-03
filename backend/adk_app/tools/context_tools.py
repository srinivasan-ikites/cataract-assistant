from __future__ import annotations

from typing import List, Literal

from google.adk.tools import FunctionTool

from adk_app.telemetry.logger import get_logger
from adk_app.utils.data_loader import get_clinic_data, get_patient_data

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
    surgery = patient.get("surgery", {})
    return (
        f"Patient: {patient.get('name', {}).get('first')} {patient.get('name', {}).get('last')}\n"
        f"Eye: {patient.get('diagnosis', {}).get('eye')} | "
        f"Cataract type: {patient.get('diagnosis', {}).get('condition')}\n"
        f"Surgery date: {surgery.get('date')} with surgeon {surgery.get('surgeon_id')}"
    )


def _patient_medications(patient: dict) -> str:
    lines = ["Current medication plan:"]
    for med in patient.get("medications", []):
        lines.append(
            f"- {med.get('name')} {med.get('dose')} {med.get('frequency')} "
            f"({med.get('start_date')} to {med.get('end_date')})"
        )
    return "\n".join(lines)


def _patient_follow_up(patient: dict) -> str:
    lines = ["Scheduled follow-ups:"]
    for visit in patient.get("follow_up_schedule", []):
        lines.append(
            f"- {visit.get('visit')}: {visit.get('date')} ({visit.get('status')})"
        )
    return "\n".join(lines)


def _patient_surgery(patient: dict) -> str:
    surgery = patient.get("surgery", {})
    iols = surgery.get("iol_plan", [])
    lines = [
        f"Surgery status: {surgery.get('status')} on {surgery.get('date')} with {surgery.get('surgeon_id')}",
        f"Anesthesia: {surgery.get('anesthesia')}",
        "Lens considerations:",
    ]
    for plan in iols:
        lines.append(
            f"- {plan.get('type')} ({plan.get('model')}), {plan.get('priority')} choice"
        )
    if surgery.get("special_considerations"):
        lines.append(
            "Special notes: " + "; ".join(surgery.get("special_considerations"))
        )
    return "\n".join(lines)


def _patient_alerts(patient: dict) -> str:
    alerts = patient.get("alerts") or []
    return "Alerts:\n" + ("\n".join(f"- {alert}" for alert in alerts) or "None.")


def _patient_lens_plan(patient: dict) -> str:
    surgery = patient.get("surgery", {})
    plans = surgery.get("iol_plan") or []
    if not plans:
        return "No custom lens plan recorded for this patient."
    lines = ["Lens plan:"]
    for plan in plans:
        lines.append(
            f"- {plan.get('model','Unknown model')} ({plan.get('type','Unknown type')}), "
            f"{plan.get('priority','priority not set')} choice. "
            f"Coverage: {plan.get('coverage','unspecified')}."
        )
    return "\n".join(lines)


def _patient_insurance(patient: dict) -> str:
    insurance = patient.get("insurance") or {}
    if not insurance:
        return "No patient-specific insurance record."
    lines = [
        "Patient insurance:",
        f"- Provider: {insurance.get('provider','N/A')}",
        f"- Policy #: {insurance.get('policy_number','N/A')}",
        f"- Notes: {insurance.get('coverage_notes','No notes available.')}",
    ]
    return "\n".join(lines)


