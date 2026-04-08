from __future__ import annotations

import logging
from pathlib import Path


def setup_logging(log_file: Path | None = None) -> logging.Logger:
    """Set up logging for the essay chain pipeline."""
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    timestamp_format = "%Y-%m-%d %H:%M:%S"

    logger = logging.getLogger("essay_chain")
    logger.setLevel(logging.DEBUG)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(log_format, datefmt=timestamp_format)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # File handler (if log_file is provided)
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(log_format, datefmt=timestamp_format)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger for a specific module."""
    return logging.getLogger(f"essay_chain.{name}")
