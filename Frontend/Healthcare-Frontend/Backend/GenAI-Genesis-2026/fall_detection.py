"""
Fall detection via MediaPipe Pose Landmarker (Tasks API — mediapipe 0.10.x).

Runs as a background daemon thread watching a camera feed.
When a fall is confirmed over several consecutive frames it calls
alert_callback(urgency, message) where urgency is one of:
  "urgent" — body is clearly horizontal (full fall)
  "mid"    — body at a steep angle (stumble / partial fall)
  "low"    — body posture is ambiguous but abnormal

On first run a ~7 MB pose landmarker model is downloaded automatically.
"""

import logging
import os
import threading
import time
import urllib.request
from typing import Callable

log = logging.getLogger(__name__)

# ── Optional imports ──────────────────────────────────────────────────────────
try:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python as _mp_tasks
    from mediapipe.tasks.python import vision as _mp_vision
    _CV_AVAILABLE = True
except ImportError as _err:
    _CV_AVAILABLE = False
    log.warning(
        "Fall detection disabled — missing dependency (%s). "
        "Install with: pip install opencv-python mediapipe",
        _err,
    )

# ── Pose landmark indices (same numbering as the old solutions API) ───────────
_LEFT_SHOULDER  = 11
_RIGHT_SHOULDER = 12
_LEFT_KNEE      = 25
_RIGHT_KNEE     = 26

# ── Model ─────────────────────────────────────────────────────────────────────
_MODEL_URL  = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/1/"
    "pose_landmarker_lite.task"
)
_MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker.task")


def _ensure_model() -> str:
    if not os.path.exists(_MODEL_PATH):
        log.info("Downloading pose landmarker model (~7 MB) — one-time setup …")
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        log.info("Model saved to %s", _MODEL_PATH)
    return _MODEL_PATH


# ── Urgency thresholds ────────────────────────────────────────────────────────
_THRESHOLDS = {
    "urgent": {"aspect_ratio": 1.5, "vertical_spread": 0.30},
    "mid":    {"aspect_ratio": 1.2, "vertical_spread": 0.40},
    "low":    {"aspect_ratio": 1.0, "vertical_spread": 0.50},
}


def classify_pose(landmarks: list) -> tuple[bool, str]:
    """
    Inspect a list of NormalizedLandmark and return (fall_detected, urgency).
    urgency is "" when no fall is detected.
    """
    left_shoulder  = landmarks[_LEFT_SHOULDER]
    right_shoulder = landmarks[_RIGHT_SHOULDER]
    left_knee      = landmarks[_LEFT_KNEE]
    right_knee     = landmarks[_RIGHT_KNEE]

    avg_shoulder_y  = (left_shoulder.y  + right_shoulder.y)  / 2
    avg_knee_y      = (left_knee.y      + right_knee.y)      / 2
    vertical_spread = abs(avg_shoulder_y - avg_knee_y)

    xs = [lm.x for lm in landmarks]
    ys = [lm.y for lm in landmarks]
    width  = max(xs) - min(xs)
    height = max(ys) - min(ys)
    if height < 0.01:
        return False, ""

    aspect_ratio = width / height

    for urgency in ("urgent", "mid", "low"):
        t = _THRESHOLDS[urgency]
        if aspect_ratio >= t["aspect_ratio"] and vertical_spread <= t["vertical_spread"]:
            return True, urgency

    return False, ""


class FallDetector:
    """
    Background daemon thread that reads from a camera and calls
    alert_callback whenever a fall is confirmed.

    Parameters
    ----------
    alert_callback : Callable[[str, str], None]
        Called as alert_callback(urgency, message).
    camera_index : int
        OpenCV camera index (0 = default webcam).
    confirmation_frames : int
        Consecutive fall frames required before the alert fires.
    cooldown_sec : int
        Minimum seconds between repeated alerts.
    """

    def __init__(
        self,
        alert_callback: Callable[[str, str], None],
        camera_index: int = 0,
        confirmation_frames: int = 6,
        cooldown_sec: int = 30,
    ) -> None:
        self._alert_callback      = alert_callback
        self._camera_index        = camera_index
        self._confirmation_frames = confirmation_frames
        self._cooldown_sec        = cooldown_sec
        self._stop_event          = threading.Event()
        self._thread              = threading.Thread(
            target=self._run,
            daemon=True,
            name="FallDetector",
        )
        self._fall_streak   = 0
        self._last_alert_ts = 0.0

    def start(self) -> None:
        if not _CV_AVAILABLE:
            log.warning("FallDetector not started — cv2/mediapipe unavailable.")
            return
        self._thread.start()
        log.info("FallDetector started (camera index %d).", self._camera_index)

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=5)

    # ── internal ──────────────────────────────────────────────────────────────

    def _run(self) -> None:
        try:
            model_path = _ensure_model()
        except Exception as exc:
            log.error("Could not download pose model: %s — fall detection disabled.", exc)
            return

        cap = cv2.VideoCapture(self._camera_index)
        if not cap.isOpened():
            log.warning(
                "Cannot open camera %d — fall detection disabled.",
                self._camera_index,
            )
            return

        log.info("Camera opened — fall detection is active.")

        base_options = _mp_tasks.BaseOptions(model_asset_path=model_path)
        options = _mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=_mp_vision.RunningMode.VIDEO,
        )

        # Skeleton connections to draw (pairs of landmark indices)
        _CONNECTIONS = [
            (11, 12),  # shoulders
            (11, 13), (13, 15),  # left arm
            (12, 14), (14, 16),  # right arm
            (11, 23), (12, 24),  # torso sides
            (23, 24),            # hips
            (23, 25), (25, 27),  # left leg
            (24, 26), (26, 28),  # right leg
        ]

        # Create a resizable named window before the loop
        cv2.namedWindow("Senior Care — Fall Detection", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Senior Care — Fall Detection", 1280, 720)

        with _mp_vision.PoseLandmarker.create_from_options(options) as landmarker:
            start_ms   = int(time.time() * 1000)
            warmup     = 0          # discard first frames until camera stabilises

            while not self._stop_event.is_set():
                ret, frame = cap.read()
                if not ret or frame is None:
                    time.sleep(0.05)
                    continue

                # Skip the first 20 frames — webcams often return black/dark
                # frames until the sensor auto-exposure stabilises
                if warmup < 20:
                    warmup += 1
                    continue

                h, w = frame.shape[:2]
                rgb      = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                ts_ms    = int(time.time() * 1000) - start_ms

                result = landmarker.detect_for_video(mp_image, ts_ms)

                fallen   = False
                urgency  = ""
                status   = "Monitoring…"
                overlay_color = (0, 200, 0)   # green = OK

                if result.pose_landmarks:
                    lms = result.pose_landmarks[0]
                    fallen, urgency = classify_pose(lms)

                    # Draw skeleton
                    for a, b in _CONNECTIONS:
                        if a < len(lms) and b < len(lms):
                            x1, y1 = int(lms[a].x * w), int(lms[a].y * h)
                            x2, y2 = int(lms[b].x * w), int(lms[b].y * h)
                            cv2.line(frame, (x1, y1), (x2, y2), (200, 200, 200), 2)

                    # Draw joint dots
                    for lm in lms:
                        cx, cy = int(lm.x * w), int(lm.y * h)
                        cv2.circle(frame, (cx, cy), 4, (255, 255, 255), -1)

                    if fallen:
                        self._fall_streak += 1
                        urgency_colors = {
                            "urgent": (0, 0, 255),
                            "mid":    (0, 140, 255),
                            "low":    (0, 215, 255),
                        }
                        overlay_color = urgency_colors.get(urgency, (0, 0, 255))
                        status        = f"FALL DETECTED [{urgency.upper()}]  ({self._fall_streak}/{self._confirmation_frames})"

                        if self._fall_streak >= self._confirmation_frames:
                            now = time.time()
                            if now - self._last_alert_ts >= self._cooldown_sec:
                                self._last_alert_ts = now
                                self._fall_streak   = 0
                                self._alert_callback(
                                    urgency,
                                    "Fall detected by camera vision system.",
                                )
                    else:
                        self._fall_streak = max(0, self._fall_streak - 1)

                # Resize first, then draw HUD so text is sharp at display res
                display  = cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_LINEAR)
                dh, dw   = display.shape[:2]

                # Semi-transparent top bar
                overlay = display.copy()
                cv2.rectangle(overlay, (0, 0), (dw, 48), (20, 20, 20), -1)
                cv2.addWeighted(overlay, 0.65, display, 0.35, 0, display)

                cv2.putText(
                    display, f"  Fall Detection  |  {status}",
                    (8, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                    overlay_color, 2, cv2.LINE_AA,
                )

                streak_pct = min(self._fall_streak / max(self._confirmation_frames, 1), 1.0)
                bar_w      = int(dw * streak_pct)
                cv2.rectangle(display, (0, 48), (bar_w, 54), overlay_color, -1)

                cv2.imshow("Senior Care — Fall Detection", display)

                # Allow OpenCV window to process events; 'q' quits detection
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    log.info("Fall detection window closed by user.")
                    break

        cap.release()
        cv2.destroyAllWindows()
        log.info("Camera released.")
