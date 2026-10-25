"""Future worker boundary. No scheduler is started or executed in version 1."""

from typing import Protocol

MONITORING_ENABLED = False


class ObservationJobs(Protocol):
    """A future scheduler may call the existing application service through this port."""

    def validate(self) -> dict: ...
    def portfolios(self) -> list[dict]: ...


def run_scheduled_observations(jobs: ObservationJobs):
    raise RuntimeError("Autonome Überwachung ist in Guru v1 nicht implementiert.")
