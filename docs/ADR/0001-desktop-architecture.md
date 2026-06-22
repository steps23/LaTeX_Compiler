# ADR 0001: Initial macOS Desktop Direction

## Status

Superseded by ADR 0002.

## Context

The initial desktop proposal targeted only macOS Apple Silicon and described future filesystem, SQLite and local TeX integrations. Those integrations were proposals, not implemented behavior.

## Superseding Decision

ADR 0002 replaces the single-platform foundation with shared Tauri 2 targets for macOS Apple Silicon and Intel, Windows x64 and Linux x64. Platform-specific storage locations, TeX detection and process adapters are deferred to their dedicated phases and must not be inferred from this historical ADR.
