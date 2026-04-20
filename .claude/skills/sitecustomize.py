"""Auto-start coverage in every Python subprocess for test runs.

Activated by setting COVERAGE_PROCESS_START=<path-to-.coveragerc> in the
child's environment. The presence of this file on sys.path is enough for
Python to import it at startup.
"""
import coverage  # noqa: PLC0415

coverage.process_startup()
