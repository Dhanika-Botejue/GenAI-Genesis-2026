from __future__ import annotations

import math

import numpy as np

from .schemas import RectModel, RoomCandidateModel

OCCUPIED = 255


def build_room_candidates(threshold: np.ndarray, bounds: tuple[int, int, int, int]) -> list[RoomCandidateModel]:
    x, y, width, height = bounds
    legend_band = detect_legend_band(threshold, bounds)
    effective_width = max(60, width - legend_band.width)
    effective_bounds = (x, y, effective_width, height)

    pad_x = max(8, effective_width * 0.028)
    pad_y = max(8, height * 0.03)
    top_band = make_rect(x + pad_x, y + pad_y, effective_width - pad_x * 2, height * 0.23)
    bottom_band = make_rect(x + pad_x, y + height * 0.7, effective_width - pad_x * 2, height * 0.22)
    left_band = make_rect(x + pad_x * 0.4, y + height * 0.2, effective_width * 0.19, height * 0.52)
    right_band = make_rect(x + effective_width * 0.75, y + height * 0.28, effective_width * 0.17, height * 0.34)

    top_count = clamp(estimate_column_segments(threshold, top_band, 0.14), 2, 6)
    bottom_count = clamp(estimate_column_segments(threshold, bottom_band, 0.14), 2, 6)
    left_count = clamp(estimate_row_segments(threshold, left_band, 0.14), 1, 4)
    service_count = clamp(estimate_row_segments(threshold, right_band, 0.12), 2, 5)

    top_range = get_occupied_range_x(threshold, top_band) or {"min": top_band.x, "max": top_band.x + top_band.width}
    bottom_range = get_occupied_range_x(threshold, bottom_band) or {
        "min": bottom_band.x + bottom_band.width * 0.34,
        "max": bottom_band.x + bottom_band.width,
    }
    left_range = get_occupied_range_y(threshold, left_band) or {"min": left_band.y, "max": left_band.y + left_band.height}
    service_range = get_occupied_range_y(threshold, right_band) or {"min": right_band.y, "max": right_band.y + right_band.height}

    right_service_width = max(effective_width * 0.14, 44)
    common_x = x + max(effective_width * 0.18, left_band.width + pad_x * 1.1)
    common_right = x + effective_width - right_service_width - pad_x * 1.1
    common_y = y + height * 0.27
    common_bottom = y + height * 0.68
    common_rect = make_rect(common_x, common_y, max(90, common_right - common_x), max(90, common_bottom - common_y))

    rooms: list[RoomCandidateModel] = [
        create_rect("common-area", "Common Area", common_rect),
        create_rect(
            "dining-room",
            "Dining Room",
            make_rect(
                common_rect.x + common_rect.width * 0.3,
                common_rect.y + common_rect.height * 0.16,
                common_rect.width * 0.18,
                common_rect.height * 0.25,
            ),
        ),
        create_rect(
            "kitchen",
            "Kitchen",
            make_rect(
                common_rect.x + common_rect.width * 0.65,
                common_rect.y + common_rect.height * 0.18,
                common_rect.width * 0.18,
                common_rect.height * 0.22,
            ),
        ),
    ]

    rooms.extend(
        build_horizontal_band_rooms(
            prefix="resident-top",
            label_start=101,
            occupied_range=top_range,
            count=top_count,
            y=top_band.y + top_band.height * 0.1,
            height=top_band.height * 0.72,
        )
    )
    rooms.extend(
        build_vertical_band_rooms(
            prefix="resident-left",
            label_start=201,
            occupied_range=left_range,
            count=left_count,
            x=left_band.x,
            width=left_band.width * 0.92,
        )
    )
    rooms.extend(
        build_horizontal_band_rooms(
            prefix="resident-bottom",
            label_start=301,
            occupied_range=bottom_range,
            count=bottom_count,
            y=bottom_band.y + bottom_band.height * 0.08,
            height=bottom_band.height * 0.72,
        )
    )
    rooms.extend(
        build_vertical_services(
            band=right_band,
            occupied_range=service_range,
            count=service_count,
            width=right_service_width,
        )
    )

    return rooms


def build_horizontal_band_rooms(
    *,
    prefix: str,
    label_start: int,
    occupied_range: dict[str, float],
    count: int,
    y: float,
    height: float,
) -> list[RoomCandidateModel]:
    total_width = max(60, occupied_range["max"] - occupied_range["min"])
    gap = max(8, total_width * 0.03)
    room_width = max(34, (total_width - gap * (count - 1)) / count)

    return [
        create_rect(
            f"{prefix}-{index + 1}",
            f"Room {label_start + index}",
            make_rect(occupied_range["min"] + index * (room_width + gap), y, room_width, height),
        )
        for index in range(count)
    ]


def build_vertical_band_rooms(
    *,
    prefix: str,
    label_start: int,
    occupied_range: dict[str, float],
    count: int,
    x: float,
    width: float,
) -> list[RoomCandidateModel]:
    total_height = max(60, occupied_range["max"] - occupied_range["min"])
    gap = max(8, total_height * 0.04)
    room_height = max(38, (total_height - gap * (count - 1)) / count)

    return [
        create_rect(
            f"{prefix}-{index + 1}",
            f"Room {label_start + index}",
            make_rect(x, occupied_range["min"] + index * (room_height + gap), width, room_height),
        )
        for index in range(count)
    ]


def build_vertical_services(
    *,
    band: RectModel,
    occupied_range: dict[str, float],
    count: int,
    width: float,
) -> list[RoomCandidateModel]:
    labels = ["Storage", "Utility", "Mechanical", "Pantry", "Office"]
    total_height = max(50, occupied_range["max"] - occupied_range["min"])
    gap = max(7, total_height * 0.04)
    room_height = max(26, (total_height - gap * (count - 1)) / count)

    return [
        create_rect(
            f"service-{index + 1}",
            labels[index] if index < len(labels) else f"Service {index + 1}",
            make_rect(band.x + band.width * 0.08, occupied_range["min"] + index * (room_height + gap), width, room_height),
        )
        for index in range(count)
    ]


def detect_legend_band(threshold: np.ndarray, bounds: tuple[int, int, int, int]) -> RectModel:
    x, y, width, height = bounds
    candidate_width = round(width * 0.2)
    if candidate_width < 70:
        return make_rect(x + width, y, 0, 0)

    strip = make_rect(x + width - candidate_width, y, candidate_width, height)
    full_density = get_density(threshold, make_rect(x, y, width, height))
    strip_density = get_density(threshold, strip)
    separator = get_lowest_density_column(
        threshold,
        make_rect(x + width - candidate_width * 1.4, y, candidate_width * 0.5, height),
    )

    if strip_density < full_density * 0.72 and separator is not None:
        return make_rect(separator, y, x + width - separator, height)

    return make_rect(x + width, y, 0, 0)


def estimate_column_segments(threshold: np.ndarray, band: RectModel, density_threshold: float) -> int:
    densities = smooth(build_column_densities(threshold, band), 5)
    return count_segments(densities, density_threshold, 3)


def estimate_row_segments(threshold: np.ndarray, band: RectModel, density_threshold: float) -> int:
    densities = smooth(build_row_densities(threshold, band), 5)
    return count_segments(densities, density_threshold, 3)


def build_column_densities(threshold: np.ndarray, band: RectModel) -> list[float]:
    densities: list[float] = []
    y0, y1 = clamp_range(band.y, band.height, threshold.shape[0])
    x0, x1 = clamp_range(band.x, band.width, threshold.shape[1])

    for column in range(x0, x1):
        stripe = threshold[y0:y1, column]
        total = max(len(stripe), 1)
        densities.append(float(np.count_nonzero(stripe == OCCUPIED)) / total)

    return densities


def build_row_densities(threshold: np.ndarray, band: RectModel) -> list[float]:
    densities: list[float] = []
    y0, y1 = clamp_range(band.y, band.height, threshold.shape[0])
    x0, x1 = clamp_range(band.x, band.width, threshold.shape[1])

    for row in range(y0, y1):
        stripe = threshold[row, x0:x1]
        total = max(len(stripe), 1)
        densities.append(float(np.count_nonzero(stripe == OCCUPIED)) / total)

    return densities


def get_occupied_range_x(threshold: np.ndarray, band: RectModel) -> dict[str, int] | None:
    y0, y1 = clamp_range(band.y, band.height, threshold.shape[0])
    x0, x1 = clamp_range(band.x, band.width, threshold.shape[1])
    mask = threshold[y0:y1, x0:x1] == OCCUPIED
    occupied_columns = np.where(mask.any(axis=0))[0]

    if occupied_columns.size == 0:
        return None

    return {
        "min": int(x0 + occupied_columns.min()),
        "max": int(x0 + occupied_columns.max()),
    }


def get_occupied_range_y(threshold: np.ndarray, band: RectModel) -> dict[str, int] | None:
    y0, y1 = clamp_range(band.y, band.height, threshold.shape[0])
    x0, x1 = clamp_range(band.x, band.width, threshold.shape[1])
    mask = threshold[y0:y1, x0:x1] == OCCUPIED
    occupied_rows = np.where(mask.any(axis=1))[0]

    if occupied_rows.size == 0:
        return None

    return {
        "min": int(y0 + occupied_rows.min()),
        "max": int(y0 + occupied_rows.max()),
    }


def get_density(threshold: np.ndarray, band: RectModel) -> float:
    y0, y1 = clamp_range(band.y, band.height, threshold.shape[0])
    x0, x1 = clamp_range(band.x, band.width, threshold.shape[1])
    area = threshold[y0:y1, x0:x1]
    return float(np.count_nonzero(area == OCCUPIED)) / max(area.size, 1)


def get_lowest_density_column(threshold: np.ndarray, band: RectModel) -> int | None:
    y0, y1 = clamp_range(band.y, band.height, threshold.shape[0])
    x0, x1 = clamp_range(band.x, band.width, threshold.shape[1])
    lowest_density = math.inf
    lowest_column: int | None = None

    for column in range(x0, x1):
        stripe = threshold[y0:y1, column]
        density = float(np.count_nonzero(stripe == OCCUPIED)) / max(len(stripe), 1)
        if density < lowest_density:
            lowest_density = density
            lowest_column = column

    return lowest_column if lowest_density < 0.08 else None


def smooth(values: list[float], radius: int) -> list[float]:
    smoothed: list[float] = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        window = values[start:end]
        smoothed.append(sum(window) / max(len(window), 1))
    return smoothed


def count_segments(values: list[float], threshold: float, minimum_length: int) -> int:
    count = 0
    run_length = 0

    for value in values:
        if value >= threshold:
            run_length += 1
            continue

        if run_length >= minimum_length:
            count += 1
        run_length = 0

    if run_length >= minimum_length:
        count += 1

    return count


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def clamp_range(origin: float, length: float, limit: int) -> tuple[int, int]:
    start = max(0, int(math.floor(origin)))
    end = min(limit, int(math.ceil(origin + length)))
    return start, max(start + 1, end)


def create_rect(room_id: str, name: str, rect: RectModel) -> RoomCandidateModel:
    return RoomCandidateModel(
        id=room_id,
        name=name,
        parsedLabel=name,
        labelSource="heuristic",
        confidence=0.72 if name.startswith("Room") else 0.78,
        rect=rect,
    )


def make_rect(x: float, y: float, width: float, height: float) -> RectModel:
    return RectModel(
        x=round(x),
        y=round(y),
        width=max(0, round(width)),
        height=max(0, round(height)),
    )
