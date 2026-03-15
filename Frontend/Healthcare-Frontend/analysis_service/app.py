from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile

from analyzer.classify import get_warnings
from analyzer.ocr import extract_labels
from analyzer.preprocess import decode_image, find_content_bounds, preprocess_image
from analyzer.regions import build_room_candidates
from analyzer.schemas import AnalysisResponse


app = FastAPI(title="Floorplan Analysis Service")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/analyze-floorplan", response_model=AnalysisResponse)
async def analyze_floorplan(file: UploadFile = File(...)):
    file_bytes = await file.read()
    try:
        image = decode_image(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _, threshold = preprocess_image(image)
    bounds = find_content_bounds(threshold)
    room_candidates = build_room_candidates(threshold, bounds)
    return AnalysisResponse(
        warnings=get_warnings(),
        roomCandidates=room_candidates,
        labels=extract_labels(),
        ignoredRegions=[],
        wallHints=[],
    )
