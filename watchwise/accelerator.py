"""Device abstraction so the same code runs unchanged across Kaggle's menu.

Kaggle exposes: **None** (CPU), **GPU T4 x2** (two CUDA GPUs), **GPU P100** (one
CUDA GPU), and **TPU v5e-8** (8 TPU cores). Locally we also support Apple Silicon
(**MPS**). Rather than sprinkle ``.cuda()`` / ``.to("mps")`` / ``torch_xla`` calls
through the models, every device decision lives here.

Model and training code must go through an :class:`Accelerator`:

    accel = Accelerator("auto")
    model = accel.wrap(model)             # to device (+ DataParallel for T4 x2)
    for batch in loader:
        batch = accel.to_device(batch)
        loss.backward()
        accel.step(optimizer)             # xm.optimizer_step on TPU, else optimizer.step
        accel.mark_step()                 # xm.mark_step on TPU, else no-op

Design choices:
* ``torch_xla`` is imported lazily, so non-TPU environments never need it installed.
* TPU runs on a **single XLA core** by design — the WatchWise models are tiny, so
  multi-core ``xmp.spawn`` (which would restructure the whole program) buys nothing
  and hurts reproducibility. The accelerator still *runs* on the TPU.
* Multi-GPU (T4 x2) uses ``nn.DataParallel`` — simplest correct choice for models
  this small; no distributed launcher required.
"""
from __future__ import annotations

import os
from typing import Any

import torch
import torch.nn as nn

# Friendly aliases mapped to canonical modes (mirrors the Kaggle menu wording).
_ALIASES = {
    "none": "cpu",
    "p100": "cuda",
    "gpu_p100": "cuda",
    "gpu": "cuda",
    "t4x2": "cuda_multi",
    "t4_x2": "cuda_multi",
    "gpu_t4x2": "cuda_multi",
    "multi": "cuda_multi",
    "tpu_v5e": "tpu",
    "tpu_v5e_8": "tpu",
    "xla": "tpu",
}
_CANONICAL = {"auto", "cpu", "mps", "cuda", "cuda_multi", "tpu"}


def _xla():
    """Import torch_xla lazily; return the module or None if unavailable."""
    try:
        import torch_xla.core.xla_model as xm  # type: ignore
        return xm
    except Exception:
        return None


class Accelerator:
    """Resolves a compute mode and exposes uniform train/inference primitives."""

    def __init__(self, mode: str = "auto", tpu_cores: int = 1, verbose: bool = True):
        raw = (mode or "auto").strip().lower()
        mode = _ALIASES.get(raw, raw)
        if mode not in _CANONICAL:
            raise ValueError(
                f"Unknown accelerator '{raw}'. Use one of "
                f"{sorted(_CANONICAL)} or an alias {sorted(_ALIASES)}."
            )

        self.requested = mode
        self.tpu_cores = tpu_cores
        self.xm = None
        self.is_tpu = False
        self.is_cuda = False
        self.is_mps = False
        self.multi_gpu = False
        self.n_gpu = 0

        if mode == "auto":
            mode = self._auto_detect()

        if mode == "tpu":
            self.xm = _xla()
            if self.xm is None:
                raise RuntimeError(
                    "accelerator='tpu' requested but torch_xla is not importable. "
                    "On Kaggle select the 'TPU v5e-8' accelerator, or use --accelerator cpu."
                )
            self.is_tpu = True
            self._device = self.xm.xla_device()
        elif mode == "cuda" or mode == "cuda_multi":
            if not torch.cuda.is_available():
                raise RuntimeError(
                    f"accelerator='{mode}' requested but CUDA is not available. "
                    "Select a GPU runtime, or use --accelerator cpu / mps."
                )
            self.is_cuda = True
            self.n_gpu = torch.cuda.device_count()
            self.multi_gpu = (mode == "cuda_multi") and self.n_gpu > 1
            self._device = torch.device("cuda:0")
        elif mode == "mps":
            if not torch.backends.mps.is_available():
                raise RuntimeError("accelerator='mps' requested but MPS is unavailable.")
            self.is_mps = True
            self._device = torch.device("mps")
        else:  # cpu
            self._device = torch.device("cpu")

        self.mode = mode
        if verbose:
            print(f"[Accelerator] requested={self.requested!r} -> resolved={self.label}")

    # ------------------------------------------------------------------ #
    @staticmethod
    def _auto_detect() -> str:
        if _xla() is not None and (
            os.environ.get("TPU_NAME") or os.environ.get("XRT_TPU_CONFIG")
            or os.environ.get("PJRT_DEVICE", "").upper() == "TPU"
        ):
            return "tpu"
        if torch.cuda.is_available():
            return "cuda_multi" if torch.cuda.device_count() > 1 else "cuda"
        if torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    # ------------------------------------------------------------------ #
    @property
    def device(self) -> torch.device:
        return self._device

    @property
    def label(self) -> str:
        if self.is_tpu:
            return "TPU (single XLA core)"
        if self.multi_gpu:
            names = {torch.cuda.get_device_name(i) for i in range(self.n_gpu)}
            return f"CUDA x{self.n_gpu} DataParallel ({', '.join(sorted(names))})"
        if self.is_cuda:
            return f"CUDA ({torch.cuda.get_device_name(0)})"
        if self.is_mps:
            return "Apple MPS"
        return "CPU"

    # ------------------------------------------------------------------ #
    def wrap(self, model: nn.Module) -> nn.Module:
        """Move a model to the device and apply DataParallel for multi-GPU."""
        model = model.to(self._device)
        if self.multi_gpu:
            model = nn.DataParallel(model, device_ids=list(range(self.n_gpu)))
        return model

    @staticmethod
    def unwrap(model: nn.Module) -> nn.Module:
        """Strip a DataParallel wrapper to reach the raw module (for saving/inference)."""
        return model.module if isinstance(model, nn.DataParallel) else model

    def to_device(self, x: Any) -> Any:
        """Recursively move tensors (and tensors inside tuples/lists/dicts) to device."""
        if torch.is_tensor(x):
            return x.to(self._device)
        if isinstance(x, (list, tuple)):
            moved = [self.to_device(v) for v in x]
            return type(x)(moved)
        if isinstance(x, dict):
            return {k: self.to_device(v) for k, v in x.items()}
        return x

    def step(self, optimizer: torch.optim.Optimizer) -> None:
        """Optimizer step that does the right thing on TPU (XLA graph execution)."""
        if self.is_tpu:
            self.xm.optimizer_step(optimizer, barrier=True)
        else:
            optimizer.step()

    def mark_step(self) -> None:
        """Flush the XLA graph on TPU; no-op everywhere else."""
        if self.is_tpu:
            self.xm.mark_step()

    def sync(self) -> None:
        """Block until queued device work finishes (for honest timing)."""
        if self.is_tpu:
            self.xm.mark_step()
        elif self.is_cuda:
            torch.cuda.synchronize()
        elif self.is_mps:
            torch.mps.synchronize()

    def scale_batch_size(self, base: int) -> int:
        """Multi-GPU DataParallel splits a batch across cards, so widen it."""
        return base * self.n_gpu if self.multi_gpu else base

    def __repr__(self) -> str:
        return f"Accelerator(mode={self.mode!r}, device={self._device}, label={self.label!r})"
