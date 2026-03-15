from pydantic import BaseModel
from typing import List


class WarningModel(BaseModel):
    id: str
    level: str
    message: str
    code: str


class RectModel(BaseModel):
    x: float
    y: float
    width: float
    height: float


class RoomCandidateModel(BaseModel):
    id: str
    name: str
    parsedLabel: str
    labelSource: str
    confidence: float
    kind: str = "rect"
    rect: RectModel
    source: str = "rich"


class AnalysisResponse(BaseModel):
    warnings: List[WarningModel]
    roomCandidates: List[RoomCandidateModel]
    labels: list
    ignoredRegions: list
    wallHints: list
