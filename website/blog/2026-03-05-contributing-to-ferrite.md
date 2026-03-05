---
slug: contributing-to-ferrite
title: "Your First Ferrite Contribution: A Step-by-Step Walkthrough"
authors: [ferrite-team]
tags: [community, contributing, open-source, rust]
description: "A friendly, detailed walkthrough of making your first contribution to Ferrite — from finding a good-first-issue to getting your PR merged."
---

Open source thrives on contributions, and Ferrite is designed to be contribution-friendly from day one. Whether you're a Rust expert or have never written Rust before, there's a way to contribute. This post walks through the entire process.

<!-- truncate -->

## Finding Something to Work On

### Good First Issues

We maintain a curated list of [good-first-issue](https://github.com/ferritelabs/ferrite/labels/good-first-issue) tickets specifically designed for new contributors. These issues:

- Have clear, scoped requirements
- Include pointers to relevant code
- Don't require deep architectural knowledge
- Are reviewed promptly (target: 3-5 business days)

### Other Contribution Areas

Not ready for code? These are equally valuable:

| Area | Examples | Repo |
|------|----------|------|
| **Documentation** | Fix typos, add examples, improve guides | [ferrite-docs](https://github.com/ferritelabs/ferrite-docs) |
| **Benchmarks** | Add scenarios, improve methodology | [ferrite-bench](https://github.com/ferritelabs/ferrite-bench) |
| **IDE Extensions** | Add snippets, improve highlighting | [vscode-ferrite](https://github.com/ferritelabs/vscode-ferrite) / [jetbrains-ferrite](https://github.com/ferritelabs/jetbrains-ferrite) |
| **Bug Reports** | Detailed reproduction steps | [ferrite](https://github.com/ferritelabs/ferrite/issues) |
| **Deployment** | Terraform modules, Ansible roles | [ferrite-ops](https://github.com/ferritelabs/ferrite-ops) |

## Setting Up Your Environment

### Prerequisites

- Rust 1.80+ (we recommend 1.88+ for the full development toolchain)
- Git
- A text editor (VS Code with our extension, or any JetBrains IDE with our plugin)

### Clone and Build

```bash
git clone https://github.com/ferritelabs/ferrite.git
cd ferrite

# One-time setup: installs git hooks, checks toolchain
make setup

# Verify everything works
make test-fast   # ~6 seconds
```

That's it. If `make test-fast` passes, you're ready to develop.

### Development Loop

The inner development loop is fast by design:

```bash
# Edit code, then:
make test-fast     # Unit tests only (~6 seconds)

# Before committing:
make check         # Format + clippy + full tests (~45 seconds)

# For auto-reload while developing:
make dev-test      # Watches for changes and re-runs tests
```

## Example: Adding a Redis Command

Let's walk through adding a new command — the most common type of contribution.

### Step 1: Add the Command Variant

In `src/commands/parser.rs`, add a new variant to the `Command` enum:

```rust
/// GETDEL key — Get the value and delete the key
GetDel { key: Bytes },
```

### Step 2: Add the Parser

In the same file, add a match arm in `Command::from_frame` and a parse function:

```rust
"GETDEL" => parse_getdel(args),

fn parse_getdel(args: &[Frame]) -> Result<Command> {
    if args.len() != 1 {
        return Err(FerriteError::WrongArity("GETDEL".to_string()));
    }
    Ok(Command::GetDel {
        key: get_bytes(&args[0])?,
    })
}
```

### Step 3: Add ACL Metadata

In `src/commands/executor.rs`, add command metadata:

```rust
Command::GetDel { key } => CommandMeta {
    name: "GETDEL",
    category: "string",
    keys: vec![key.clone()],
    permission: Permission::Write,
},
```

### Step 4: Add Execution

In the same file, add the execution handler:

```rust
Command::GetDel { key } => strings::getdel(&self.store, db, &key),
```

### Step 5: Implement the Logic

In `src/commands/strings.rs`:

```rust
pub fn getdel(store: &Arc<Store>, db: u8, key: &Bytes) -> Frame {
    match store.get(db, key) {
        Some(Value::String(data)) => {
            store.del(db, &[key.clone()]);
            Frame::bulk(data)
        }
        _ => Frame::null(),
    }
}
```

### Step 6: Verify

```bash
make test-fast    # Unit tests pass
make check        # Full quality gate
```

## Submitting Your PR

1. **Branch naming**: `feat/getdel-command` or `fix/issue-123-ttl-bug`
2. **Commit messages**: Use [conventional commits](https://www.conventionalcommits.org/) — `feat: add GETDEL command`, `fix: correct TTL expiry edge case`
3. **PR description**: Fill in the template — describe what changes and why

### What Happens Next

1. CI runs automatically (format, clippy, tests, Redis compatibility)
2. A maintainer reviews within 3-5 business days
3. If changes are needed, we'll explain clearly what and why
4. Once approved, we merge and you become a contributor! 🎉

## Recognition

Every contributor is recognized in our release notes and [CONTRIBUTORS.md](https://github.com/ferritelabs/ferrite/blob/main/CONTRIBUTORS.md). Your Git co-author trailer is preserved so GitHub links contributions to your profile.

## Getting Help

- **GitHub Discussions**: Ask questions, share ideas
- **Issue comments**: Tag `@josedab` if you're stuck on an issue
- **Contributing docs**: [CONTRIBUTING.md](https://github.com/ferritelabs/ferrite/blob/main/CONTRIBUTING.md) has the full guidelines

Every contribution matters. A typo fix, a better error message, a new test case — they all make Ferrite better. We're excited to see what you build.
