---
sidebar_position: 5
description: Governance model for the Ferrite open source project, including roles, decision-making, and contribution processes.
maturity: stable
---

# Project Governance

This document describes the governance model for the Ferrite project.

## Overview

Ferrite is an open-source project that welcomes contributions from the community. The project is governed by a meritocratic model where decision-making power is earned through consistent, quality contributions.

## Roles

### Users

Anyone who uses Ferrite. Users may:
- Use Ferrite for any purpose
- Report bugs and request features
- Participate in discussions
- Contribute documentation or examples

### Contributors

Anyone who contributes to the project. Contributors may:
- Submit pull requests
- Review code (non-binding)
- Participate in design discussions
- Help other users

### Committers

Contributors who have demonstrated:
- Sustained contributions over time
- Understanding of the codebase
- Good judgment in code review
- Collaboration with the community

Committers may:
- Merge pull requests
- Participate in release decisions
- Mentor new contributors

### Maintainers

Experienced committers who take responsibility for:
- Project direction and roadmap
- Release management
- Security vulnerability handling
- Dispute resolution
- Governance decisions

Current maintainers:
- **Core Team**: Architecture, storage engine, networking
- **Features Team**: Extended features (vector, document, graph)
- **Platform Team**: Deployment, operations, SDKs
- **Community Team**: Documentation, community management

## Decision Making

### Lazy Consensus

Most decisions use lazy consensus:
1. A proposal is made (issue, PR, discussion)
2. Community members may comment
3. After a reasonable time (typically 72 hours for significant changes):
   - If no objections: proposal is accepted
   - If objections: discussion continues until resolved

### Voting

For major decisions (breaking changes, governance, etc.):
- Requires majority of active maintainers
- Voting period: 1 week
- Results are public

### Technical Decisions

- **Small changes**: Single committer approval
- **Medium changes**: Two committer approvals
- **Large changes**: Design proposal, maintainer review
- **Breaking changes**: RFC process, maintainer vote

## RFC Process

For significant changes, we use Request for Comments (RFC):

1. **Draft**: Author creates RFC in `/rfcs/NNNN-feature-name.md`
2. **Discussion**: Community feedback period (2+ weeks)
3. **Review**: Maintainer review and feedback
4. **Decision**: Accept, reject, or request changes
5. **Implementation**: If accepted, can be implemented

RFC template:
```markdown
# RFC: Feature Name

## Summary
One paragraph explanation.

## Motivation
Why are we doing this?

## Design
Detailed technical design.

## Alternatives
What other designs were considered?

## Unresolved Questions
What needs more discussion?
```

## Code of Conduct

All participants must follow our [Code of Conduct](https://github.com/ferrite-rs/ferrite/blob/main/CODE_OF_CONDUCT.md).

Key principles:
- Be respectful and inclusive
- Focus on constructive feedback
- Assume good intent
- No harassment or discrimination

Violations should be reported to conduct@ferrite.dev.

## Contribution Process

### Bug Fixes

1. Check existing issues
2. Create issue if not exists
3. Submit PR with fix
4. Address review feedback
5. Committer merges

### New Features

1. Create issue/discussion for feature
2. Get preliminary feedback
3. For large features: create RFC
4. Implement and submit PR
5. Address review feedback
6. Committer merges

### Documentation

1. Submit PR with changes
2. Documentation team reviews
3. Merged after approval

## Release Process

### Version Numbering

Ferrite follows [Semantic Versioning](https://semver.org/):
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, security patches

### Release Schedule

- **Major releases**: Annually
- **Minor releases**: Quarterly
- **Patch releases**: As needed

### Release Checklist

1. Feature freeze (1 week before)
2. Release candidate testing
3. Changelog finalized
4. Security review
5. Documentation updated
6. Release announcement
7. Package publishing

## Security

### Reporting Vulnerabilities

**DO NOT** create public issues for security vulnerabilities.

Email: security@ferrite.dev

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Process

1. **Acknowledgment**: Within 24 hours
2. **Assessment**: Within 72 hours
3. **Fix Development**: Based on severity
4. **Disclosure**: Coordinated with reporter

### Severity Levels

| Level | Response Time | Description |
|-------|---------------|-------------|
| Critical | 24 hours | Remote code execution, data loss |
| High | 72 hours | Authentication bypass, data exposure |
| Medium | 1 week | Denial of service, limited exposure |
| Low | 2 weeks | Minor issues |

## Becoming a Committer

To be nominated as committer:

1. **Sustained contributions**: 6+ months of regular contributions
2. **Quality**: PRs are well-designed and tested
3. **Review**: Provides thoughtful code reviews
4. **Community**: Helps other contributors
5. **Alignment**: Understands project goals

Process:
1. Existing committer nominates candidate
2. Private discussion among committers
3. Lazy consensus (no objections in 1 week)
4. Announcement and access granted

## Becoming a Maintainer

Maintainers are selected from committers who have:

1. **Leadership**: Shown technical leadership
2. **Vision**: Contributed to project direction
3. **Responsibility**: Demonstrated reliability
4. **Community**: Built trust with community

Process:
1. Existing maintainer nominates
2. Discussion among maintainers
3. Supermajority vote (>2/3)
4. Announcement

## Project Resources

### Official Channels

- **GitHub**: [github.com/ferrite-rs/ferrite](https://github.com/ferrite-rs/ferrite)
- **Discord**: [discord.gg/ferrite](https://discord.gg/ferrite)
- **Twitter**: [@ferritedb](https://twitter.com/ferritedb)
- **Blog**: [ferrite.rs/blog](/blog)

### Meetings

- **Community Call**: Monthly, first Tuesday
- **Maintainer Sync**: Weekly, internal

### Trademarks

"Ferrite" and the Ferrite logo are trademarks. Usage:
- Allowed: Referring to the project
- Not allowed: Implying endorsement, modified versions

## Changes to Governance

This document can be modified by:
1. Proposal via PR
2. Discussion period (2 weeks)
3. Maintainer vote (supermajority)

## Acknowledgments

This governance model is inspired by:
- Apache Software Foundation
- Rust Project
- Kubernetes
- Linux Foundation projects
