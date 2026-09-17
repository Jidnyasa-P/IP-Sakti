from typing import Optional, Any
from pydantic import BaseModel


class ProductInformation(BaseModel):
    product_name: str = ""
    product_type: str = ""
    dosage_form: str = ""
    ingredients: Any = ""
    classical_reference: Optional[str] = None
    manufacturing_info: str = ""
    intended_use: str = ""
    claims: str = ""
    target_market: str = "Domestic (India)"
    biological_source_details: Optional[str] = None


class ProductAnalyzeRequest(BaseModel):
    product_information: Optional[ProductInformation] = None
    # Also accept a flat body (matches existing frontend, which posts the fields directly)
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    dosage_form: Optional[str] = None
    ingredients: Optional[Any] = None
    classical_reference: Optional[str] = None
    manufacturing_info: Optional[str] = None
    intended_use: Optional[str] = None
    claims: Optional[str] = None
    target_market: Optional[str] = None
    biological_source_details: Optional[str] = None

    def as_product_dict(self) -> dict:
        if self.product_information:
            return self.product_information.model_dump()
        return {
            "product_name": self.product_name or "",
            "product_type": self.product_type or "",
            "dosage_form": self.dosage_form or "",
            "ingredients": self.ingredients or "",
            "classical_reference": self.classical_reference,
            "manufacturing_info": self.manufacturing_info or "",
            "intended_use": self.intended_use or "",
            "claims": self.claims or "",
            "target_market": self.target_market or "Domestic (India)",
            "biological_source_details": self.biological_source_details,
        }


class IPRNavigatorRequest(BaseModel):
    asset_type: str
    description: Optional[str] = ""
    is_classical_text_derived: Optional[bool] = None
    has_synergistic_data: Optional[bool] = None
    is_biological_sourced_india: Optional[bool] = None
    is_novel_extraction_process: Optional[bool] = None
    uses_biological_resource: Optional[bool] = None
    has_traditional_basis: Optional[bool] = None
    has_synergy_data: Optional[bool] = None
    is_already_commercialized: Optional[bool] = None


class TKABSRequest(BaseModel):
    biological_resource: Optional[str] = ""
    plant_material: Optional[str] = ""
    geographic_origin: Optional[str] = ""
    traditional_use: Optional[str] = ""
    source_community_info: Optional[str] = ""
    intended_use: str = "Domestic commercial utilization"


class DocumentIngestRequest(BaseModel):
    title: str
    source: str
    authority: str
    url: Optional[str] = None
    document_type: str = "Guidelines"
    jurisdiction: str = "India"
    topic: str = "AYUSH"
    summary: Optional[str] = ""
    raw_text: str
