---
slug: /
sidebar_position: 1
---

# Introduction

Koya is a fast, type-safe application framework for TypeScript, bringing Laravel/FuelPHP-like productivity to edge and serverless runtimes.

## Philosophy

Koya provides a complete application skeleton that integrates controllers, services, configuration, lifecycle management, error handling, testing, and more — all connected through a unified type contract.

### Core Values

- **Fast** — Practical startup and execution speed for Cloudflare Workers and serverless cold starts
- **Type-safe** — Schema → request → controller → response → DI → test double are all connected through the same type contract
- **Application-oriented** — Provides the "application backbone" that integrates controller / service / repository / config / lifecycle / error handling / testing

## Why Koya?

Modern TypeScript backend development often requires piecing together multiple libraries for routing, validation, dependency injection, and testing. Koya provides these out of the box with a cohesive, type-safe API.

Unlike traditional frameworks, Koya is designed from the ground up for edge and serverless environments where cold start performance matters.

## Packages

| Package | Description |
|---------|-------------|
| `@koya/core` | DI, lifecycle, validation, error handling, and HTTP core |
| `@koya/adapter-node` | Node.js server adapter |
| `@koya/contract` | Type generation and OpenAPI output |
| `@koya/testing` | Test utilities |

Workers / Lambda adapters will be provided as subpaths of `@koya/core` (`@koya/core/workers`, `@koya/core/lambda`).

## Status

**pre-alpha** — Breaking changes may occur in minor versions during 0.x.
