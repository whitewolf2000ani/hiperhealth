"""API Request/ Reponse schemas."""

from typing import List, Optional

from pydantic import BaseModel


class DemographicsRequest(BaseModel):
    """Request schema for updating demographics."""

    age: int
    gender: str
    weight_kg: float
    height_kg: float


class DemographicsResponse(BaseModel):
    """Response schema for demographics."""

    success: bool
    next_step: str
    patient_id: str


class lifestyleRequest(BaseModel):
    """Request schema for updating lifestyle."""

    diet: str
    sleep_hours: float
    physical_activity: str
    mental_excercises: str


class LifestyleReponse(BaseModel):
    """Repoonse schema for lifestyle."""

    success: bool
    next_step: str
    patient_id: str


class SymptomsRequest(BaseModel):
    """Request schema for updating symptoms."""

    symptoms: str


class SymptomsReponse(BaseModel):
    """Response schema for symptoms."""

    success: bool
    next_step: str
    patient_id: str


class MentalHealthRequest(BaseModel):
    """Request schema for updating mental health."""

    mental_haalth: str


class MentalHealthResponse(BaseModel):
    """Response schema for mental health."""

    success: bool
    next_step: str
    patient_id: str


class ConsultationStatusResponse(BaseModel):
    """Response for consultation status."""

    patient_id: str
    current_step: str
    completed_steps: List[str]
    is_complete: bool
    patient_data: dict
    lang: str


class PatientSummary(BaseModel):
    """Summary of a patient for dashboard listing."""

    patient_id: str
    created_at: Optional[str] = None
    current_step: str
