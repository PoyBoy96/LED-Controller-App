from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

from .logging_utils import get_logger


logger = get_logger("led_driver")
WHITE_COLOR = [255, 255, 255]


@dataclass
class DriverInfo:
    mode: str
    detail: str


def normalize_color(color: Iterable[int] | None) -> list[int]:
    if color is None:
        return WHITE_COLOR.copy()
    channels = list(color)
    if len(channels) != 3:
        return WHITE_COLOR.copy()
    normalized = []
    for channel in channels:
        try:
            normalized.append(max(0, min(255, int(channel))))
        except (TypeError, ValueError):
            return WHITE_COLOR.copy()
    return normalized


class MockLedDriver:
    def __init__(self, led_count: int, settings: dict | None = None):
        self.led_count = led_count
        self.active_pixels: set[int] = set()
        self.active_colors: dict[int, list[int]] = {}
        self.default_brightness = 96
        if settings:
            self.update_settings(settings)
        self.info = DriverInfo(mode="mock", detail="Using in-memory LED state")
        logger.info("driver initialized mode=mock led_count=%s", led_count)

    def set_pixel(self, physical_id: int, active: bool, color: Iterable[int] | None = None) -> None:
        if active:
            self.active_pixels.add(physical_id)
            self.active_colors[physical_id] = normalize_color(color)
        else:
            self.active_pixels.discard(physical_id)
            self.active_colors.pop(physical_id, None)
        logger.info("mock set_pixel physical_id=%s active=%s active_count=%s", physical_id, active, len(self.active_pixels))

    def clear(self) -> None:
        self.active_pixels.clear()
        self.active_colors.clear()
        logger.info("mock clear")

    def sync_from_colors(self, active_colors: Mapping[int, Iterable[int]]) -> None:
        self.active_colors = {int(physical_id): normalize_color(color) for physical_id, color in active_colors.items()}
        self.active_pixels = set(self.active_colors)
        logger.info("mock sync_from_colors active_ids=%s", sorted(self.active_pixels))

    def update_settings(self, settings: dict) -> None:
        self.default_brightness = int(settings.get("default_brightness", 96))
        logger.info(
            "mock update_settings brightness=%s",
            self.default_brightness,
        )


class RpiWs281xDriver:
    def __init__(self, settings: dict):
        from rpi_ws281x import Color, PixelStrip

        self._color_builder = Color
        self.led_count = settings["led_count"]
        self.active_pixels: set[int] = set()
        self.active_colors: dict[int, list[int]] = {}
        self.pin = settings.get("pin", 18)
        self.frequency_hz = settings.get("frequency_hz", 800000)
        self.dma_channel = settings.get("dma_channel", 10)
        self.invert_signal = settings.get("invert_signal", False)
        self.default_brightness = settings.get("default_brightness", 96)
        self.channel = settings.get("channel", 0)
        self.strip = PixelStrip(
            self.led_count,
            self.pin,
            self.frequency_hz,
            self.dma_channel,
            self.invert_signal,
            self.default_brightness,
            self.channel,
        )
        self.strip.begin()
        self.info = DriverInfo(mode="real", detail="rpi_ws281x active")
        logger.info(
            "driver initialized mode=real led_count=%s pin=%s freq_hz=%s dma=%s invert=%s brightness=%s channel=%s",
            self.led_count,
            self.pin,
            self.frequency_hz,
            self.dma_channel,
            self.invert_signal,
            self.default_brightness,
            self.channel,
        )

    def _color_value(self, color: Iterable[int] | None):
        red, green, blue = normalize_color(color)
        return self._color_builder(red, green, blue)

    def set_pixel(self, physical_id: int, active: bool, color: Iterable[int] | None = None) -> None:
        pixel_color = self._color_value(color) if active else self._color_builder(0, 0, 0)
        self.strip.setPixelColor(physical_id - 1, pixel_color)
        self.strip.show()
        if active:
            self.active_pixels.add(physical_id)
            self.active_colors[physical_id] = normalize_color(color)
        else:
            self.active_pixels.discard(physical_id)
            self.active_colors.pop(physical_id, None)
        logger.info(
            "real set_pixel physical_id=%s active=%s pin=%s active_count=%s active_ids=%s",
            physical_id,
            active,
            self.pin,
            len(self.active_pixels),
            sorted(self.active_pixels),
        )

    def clear(self) -> None:
        for index in range(self.led_count):
            self.strip.setPixelColor(index, self._color_builder(0, 0, 0))
        self.strip.show()
        self.active_pixels.clear()
        self.active_colors.clear()
        logger.info("real clear pin=%s", self.pin)

    def sync_from_colors(self, active_colors: Mapping[int, Iterable[int]]) -> None:
        normalized_colors = {int(physical_id): normalize_color(color) for physical_id, color in active_colors.items()}
        for physical_id in range(1, self.led_count + 1):
            color = normalized_colors.get(physical_id)
            pixel_color = self._color_value(color) if color is not None else self._color_builder(0, 0, 0)
            self.strip.setPixelColor(physical_id - 1, pixel_color)
        self.strip.show()
        self.active_colors = normalized_colors
        self.active_pixels = set(normalized_colors)
        logger.info("real sync_from_colors pin=%s active_ids=%s", self.pin, sorted(self.active_pixels))

    def update_settings(self, settings: dict) -> None:
        self.default_brightness = int(settings.get("default_brightness", 96))
        self.strip.setBrightness(self.default_brightness)
        logger.info(
            "real update_settings pin=%s brightness=%s",
            self.pin,
            self.default_brightness,
        )


def build_led_driver(settings: dict):
    requested_mode = settings.get("driver", "auto").lower()
    logger.info("build_led_driver requested_mode=%s settings_pin=%s settings_channel=%s", requested_mode, settings.get("pin"), settings.get("channel"))
    if requested_mode == "mock":
        return MockLedDriver(settings["led_count"], settings=settings)

    try:
        return RpiWs281xDriver(settings)
    except Exception as exc:  # pragma: no cover
        logger.exception("real driver init failed requested_mode=%s error=%s", requested_mode, exc)
        if requested_mode == "real":
            raise RuntimeError(f"Unable to initialize real LED driver: {exc}") from exc
        return MockLedDriver(settings["led_count"], settings=settings)
