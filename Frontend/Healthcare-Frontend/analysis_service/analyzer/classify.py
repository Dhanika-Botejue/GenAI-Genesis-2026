from __future__ import annotations

from .schemas import WarningModel


def get_warnings() -> list[WarningModel]:
    return [
        WarningModel(
            id="rich-analysis",
            level="info",
            message="Room extraction was produced by the local OpenCV sidecar and may still be approximate.",
            code="geometry-approximate",
        )
    ]
