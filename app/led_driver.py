from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass
class DriverInfo:
    mode: str
    detail: str


class MockLedDriver:
    def __init__(self, led_count: int):
        self.led_count = led_count
        self.active_pixels: set[int] = set()
        self.info = DriverInfo(mode="mock", detail="Using in-memory LED state")

    def set_pixel(self, physical_id: int, active: bool) -> None:
        if active:
            self.active_pixels.add(physical_id)
        else:
            self.active_pixels.discard(physical_id)

    def clear(self) -> None:
        self.active_pixels.clear()

    def sync_from_ids(self, active_ids: Iterable[int]) -> None:
        self.active_pixels = set(active_ids)


class RpiWs281xDriver:
    def __init__(self, settings: dict):
        from rpi_ws281x import Color, PixelStrip

        self._color_builder = Color
        self.led_count = settings["led_count"]
        self.active_pixels: set[int] = set()
        self.active_color = settings.get("active_color", [255, 170, 48])
        self.strip = PixelStrip(
            self.led_count,
            settings.get("pin", 18),
            settings.get("frequency_hz", 800000),
            settings.get("dma_channel", 10),
            settings.get("invert_signal", False),
            settings.get("default_brightness", 96),
            settings.get("channel", 0),
        )
        self.strip.begin()
        self.info = DriverInfo(mode="real", detail="rpi_ws281x active")

    def _active_color_value(self):
        red, green, blue = self.active_color
        return self._color_builder(red, green, blue)

    def set_pixel(self, physical_id: int, active: bool) -> None:
        color = self._active_color_value() if active else self._color_builder(0, 0, 0)
        self.strip.setPixelColor(physical_id - 1, color)
        self.strip.show()
        if active:
            self.active_pixels.add(physical_id)
        else:
            self.active_pixels.discard(physical_id)

    def clear(self) -> None:
        for index in range(self.led_count):
            self.strip.setPixelColor(index, self._color_builder(0, 0, 0))
        self.strip.show()
        self.active_pixels.clear()

    def sync_from_ids(self, active_ids: Iterable[int]) -> None:
        target_ids = set(active_ids)
        for physical_id in range(1, self.led_count + 1):
            color = self._active_color_value() if physical_id in target_ids else self._color_builder(0, 0, 0)
            self.strip.setPixelColor(physical_id - 1, color)
        self.strip.show()
        self.active_pixels = target_ids


def build_led_driver(settings: dict):
    requested_mode = settings.get("driver", "auto").lower()
    if requested_mode == "mock":
        return MockLedDriver(settings["led_count"])

    try:
        return RpiWs281xDriver(settings)
    except Exception as exc:  # pragma: no cover
        if requested_mode == "real":
            raise RuntimeError(f"Unable to initialize real LED driver: {exc}") from exc
        return MockLedDriver(settings["led_count"])
