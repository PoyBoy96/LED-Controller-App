from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .logging_utils import get_logger


logger = get_logger("led_driver")


@dataclass
class DriverInfo:
    mode: str
    detail: str


class MockLedDriver:
    def __init__(self, led_count: int):
        self.led_count = led_count
        self.active_pixels: set[int] = set()
        self.info = DriverInfo(mode="mock", detail="Using in-memory LED state")
        logger.info("driver initialized mode=mock led_count=%s", led_count)

    def set_pixel(self, physical_id: int, active: bool) -> None:
        if active:
            self.active_pixels.add(physical_id)
        else:
            self.active_pixels.discard(physical_id)
        logger.info("mock set_pixel physical_id=%s active=%s active_count=%s", physical_id, active, len(self.active_pixels))

    def clear(self) -> None:
        self.active_pixels.clear()
        logger.info("mock clear")

    def sync_from_ids(self, active_ids: Iterable[int]) -> None:
        self.active_pixels = set(active_ids)
        logger.info("mock sync_from_ids active_ids=%s", sorted(self.active_pixels))


class RpiWs281xDriver:
    def __init__(self, settings: dict):
        from rpi_ws281x import Color, PixelStrip

        self._color_builder = Color
        self.led_count = settings["led_count"]
        self.active_pixels: set[int] = set()
        self.active_color = settings.get("active_color", [255, 170, 48])
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
            "driver initialized mode=real led_count=%s pin=%s freq_hz=%s dma=%s invert=%s brightness=%s channel=%s color=%s",
            self.led_count,
            self.pin,
            self.frequency_hz,
            self.dma_channel,
            self.invert_signal,
            self.default_brightness,
            self.channel,
            self.active_color,
        )

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
        logger.info("real clear pin=%s", self.pin)

    def sync_from_ids(self, active_ids: Iterable[int]) -> None:
        target_ids = set(active_ids)
        for physical_id in range(1, self.led_count + 1):
            color = self._active_color_value() if physical_id in target_ids else self._color_builder(0, 0, 0)
            self.strip.setPixelColor(physical_id - 1, color)
        self.strip.show()
        self.active_pixels = target_ids
        logger.info("real sync_from_ids pin=%s active_ids=%s", self.pin, sorted(self.active_pixels))


def build_led_driver(settings: dict):
    requested_mode = settings.get("driver", "auto").lower()
    logger.info("build_led_driver requested_mode=%s settings_pin=%s settings_channel=%s", requested_mode, settings.get("pin"), settings.get("channel"))
    if requested_mode == "mock":
        return MockLedDriver(settings["led_count"])

    try:
        return RpiWs281xDriver(settings)
    except Exception as exc:  # pragma: no cover
        logger.exception("real driver init failed requested_mode=%s error=%s", requested_mode, exc)
        if requested_mode == "real":
            raise RuntimeError(f"Unable to initialize real LED driver: {exc}") from exc
        return MockLedDriver(settings["led_count"])
