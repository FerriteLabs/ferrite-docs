---
sidebar_position: 1
title: Contributing to Ferrite
description: Learn how to contribute to Ferrite. Covers development setup, coding style, pull request process, testing, and documentation guidelines.
keywords: [contributing ferrite, open source rust, ferrite development, pull request guide]
maturity: stable
---

# Contributing

We welcome contributions to Ferrite! This guide will help you get started.

## Ways to Contribute

- **Bug Reports** - Found a bug? Open an issue
- **Feature Requests** - Have an idea? Start a discussion
- **Documentation** - Improve docs, fix typos
- **Code** - Fix bugs, add features
- **Testing** - Test on different platforms, report issues

## Development Setup

### Prerequisites

- Rust 1.88 or later
- Git
- Docker (optional, for integration tests)

### Clone and Build

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/ferrite.git
cd ferrite

# Add upstream remote
git remote add upstream https://github.com/ferrite-rs/ferrite.git

# Build
cargo build

# Run tests
cargo test

# Run benchmarks
cargo bench
```

### Development Commands

```bash
# Format code
cargo fmt

# Run clippy
cargo clippy -- -D warnings

# Run all checks (format, clippy, test)
cargo fmt --check && cargo clippy -- -D warnings && cargo test

# Generate documentation
cargo doc --open

# Run with debug logging
RUST_LOG=ferrite=debug cargo run
```

## Pull Request Process

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/my-feature
```

### 2. Make Changes

- Follow the [coding style](#coding-style)
- Add tests for new functionality
- Update documentation if needed

### 3. Test

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_name

# Run integration tests
cargo test --test integration
```

### 4. Commit

Write clear commit messages:

```bash
git commit -m "feat: add vector search filtering

- Add filter expression parser
- Implement pre-filter and post-filter strategies
- Add tests for common filter patterns

Closes #123"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting, no code change
- `refactor:` - Code change without feature/fix
- `test:` - Adding tests
- `chore:` - Build process, dependencies

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Then open a Pull Request on GitHub.

## Coding Style

### Rust Style

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `rustfmt` with default settings
- All public items must have documentation
- Prefer `Result<T, E>` over panics
- Use `thiserror` for error definitions

### Naming Conventions

```rust
// Types: PascalCase
struct VectorIndex { }

// Functions/methods: snake_case
fn search_vectors() { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_DIMENSIONS: usize = 4096;

// Modules: snake_case
mod vector_search;
```

### Error Handling

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VectorError {
    #[error("index not found: {0}")]
    IndexNotFound(String),

    #[error("dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },

    #[error("storage error: {0}")]
    Storage(#[from] std::io::Error),
}
```

### Documentation

```rust
/// Searches for similar vectors in the index.
///
/// # Arguments
///
/// * `query` - The query vector (must match index dimensions)
/// * `k` - Number of results to return
///
/// # Returns
///
/// A vector of search results, sorted by similarity score.
///
/// # Errors
///
/// Returns `VectorError::DimensionMismatch` if the query vector
/// dimensions don't match the index.
///
/// # Examples
///
/// ```
/// let results = index.search(&query_vector, 10)?;
/// for result in results {
///     println!("{}: {}", result.id, result.score);
/// }
/// ```
pub fn search(&self, query: &[f32], k: usize) -> Result<Vec<SearchResult>, VectorError> {
    // ...
}
```

### Unsafe Code

Every `unsafe` block must have a `// SAFETY:` comment:

```rust
// SAFETY: We have exclusive access to this memory because:
// 1. The epoch system guarantees no other thread holds a reference
// 2. The buffer is properly aligned for T
unsafe {
    std::ptr::write(addr as *mut T, value);
}
```

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_search() {
        let index = VectorIndex::new(384, DistanceMetric::Cosine);
        // ... test implementation
    }
}
```

### Integration Tests

Add integration tests in `tests/`:

```rust
// tests/vector_search.rs
use ferrite::prelude::*;

#[test]
fn test_end_to_end_vector_search() {
    let db = Database::open_temp().unwrap();
    // ... test implementation
}
```

### Benchmarks

Add benchmarks in `benches/`:

```rust
// benches/vector.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_vector_search(c: &mut Criterion) {
    c.bench_function("vector_search_1m", |b| {
        // ... benchmark implementation
    });
}

criterion_group!(benches, bench_vector_search);
criterion_main!(benches);
```

## Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and ideas
- **Discord** - Real-time chat

## Code of Conduct

Be respectful and inclusive. We follow the [Rust Code of Conduct](https://www.rust-lang.org/policies/code-of-conduct).

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 license.
