---
sidebar_position: 6
description: Get help with Ferrite through community resources, documentation, and commercial support options.
maturity: stable
---

# Getting Support

There are several ways to get help with Ferrite, from community resources to commercial support.

## Community Support

### GitHub Discussions

The best place for questions and discussions:

[github.com/ferrite-rs/ferrite/discussions](https://github.com/ferrite-rs/ferrite/discussions)

Categories:
- **Q&A**: Ask questions and get answers
- **Ideas**: Suggest new features
- **Show and Tell**: Share your projects
- **General**: General discussion

### Discord

Real-time chat with the community:

[discord.gg/ferrite](https://discord.gg/ferrite)

Channels:
- `#general` - General discussion
- `#help` - Get help with issues
- `#development` - Contributor discussion
- `#announcements` - News and updates

### Stack Overflow

Use the `ferrite` tag for questions:

[stackoverflow.com/questions/tagged/ferrite](https://stackoverflow.com/questions/tagged/ferrite)

Tips for good questions:
- Include Ferrite version
- Show relevant configuration
- Include error messages
- Provide minimal reproduction steps

## Documentation

### Official Docs

Comprehensive documentation at:

[ferrite.rs/docs](/docs)

Includes:
- Getting started guides
- Feature documentation
- API reference
- Tutorials

### API Reference

Generated API documentation:

[docs.rs/ferrite](https://docs.rs/ferrite)

### Examples

Example projects and configurations:

[github.com/ferrite-rs/examples](https://github.com/ferrite-rs/examples)

## Reporting Issues

### Bug Reports

Report bugs on GitHub:

[github.com/ferrite-rs/ferrite/issues/new?template=bug_report.md](https://github.com/ferrite-rs/ferrite/issues/new)

Include:
1. **Version**: Output of `ferrite --version`
2. **Environment**: OS, memory, disk type
3. **Configuration**: Relevant config settings
4. **Steps to reproduce**: Minimal reproduction
5. **Expected behavior**: What should happen
6. **Actual behavior**: What happens instead
7. **Logs**: Relevant log output

### Feature Requests

Suggest features on GitHub:

[github.com/ferrite-rs/ferrite/issues/new?template=feature_request.md](https://github.com/ferrite-rs/ferrite/issues/new)

Include:
1. **Use case**: What problem does this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives**: Other ways to solve this?

### Security Issues

**DO NOT** report security vulnerabilities publicly.

Email: [security@ferrite.dev](mailto:security@ferrite.dev)

We will:
- Acknowledge within 24 hours
- Investigate within 72 hours
- Coordinate disclosure

## Commercial Support

### Ferrite Enterprise

Enterprise features and support:

**Features:**
- 24/7 support with SLA
- At-rest encryption
- Advanced audit logging
- Multi-datacenter replication
- Professional services

**Support tiers:**

| Tier | Response Time | Channels | Price |
|------|---------------|----------|-------|
| Standard | 24 hours | Email, tickets | Contact sales |
| Premium | 4 hours | Email, tickets, phone | Contact sales |
| Enterprise | 1 hour | Dedicated support | Contact sales |

**Contact:** [sales@ferrite.dev](mailto:sales@ferrite.dev)

### Professional Services

- **Migration assistance**: Help migrating from Redis
- **Architecture review**: Design review and optimization
- **Training**: Team training on Ferrite
- **Custom development**: Feature development

### Consulting Partners

Certified consulting partners:

- **DataStream Consulting** - North America
- **CloudScale Partners** - Europe
- **TechForward** - Asia Pacific

Contact [partners@ferrite.dev](mailto:partners@ferrite.dev) for introductions.

## Training & Education

### Official Training

- **Ferrite Fundamentals** (2 days)
- **Ferrite for Developers** (3 days)
- **Ferrite Operations** (2 days)
- **Ferrite Security** (1 day)

Virtual and on-site options available.

### Tutorials

Free tutorials on our blog:

[ferrite.rs/blog](/blog)

### Video Content

YouTube channel with demos and tutorials:

[youtube.com/@ferritedb](https://youtube.com/@ferritedb)

## Troubleshooting Resources

### Common Issues

Check the FAQ for common issues:

[FAQ](/docs/community/faq)

### Performance Tuning

Performance optimization guide:

[Performance Tuning Guide](/docs/operations/performance-tuning)

### Debug Mode

Enable debug logging:

```bash
RUST_LOG=ferrite=debug ferrite

# Or in config
[logging]
level = "debug"
```

### Health Checks

Verify Ferrite is healthy:

```bash
# CLI check
ferrite-cli PING

# HTTP health endpoint
curl http://localhost:9090/health

# Detailed info
ferrite-cli INFO
```

## Staying Updated

### Release Announcements

- **Blog**: [ferrite.rs/blog](/blog)
- **Twitter**: [@ferritedb](https://twitter.com/ferritedb)
- **Discord**: #announcements channel
- **Newsletter**: [Subscribe](https://ferrite.rs/newsletter)

### Changelog

All changes documented:

[Changelog](/docs/community/changelog)

### Roadmap

See what's planned:

[Roadmap](/docs/community/roadmap)

## Contributing

Want to help improve Ferrite?

See our [Contributing Guide](/docs/community/contributing).

Ways to contribute:
- Fix bugs
- Improve documentation
- Add features
- Help other users
- Report issues

## Contact Summary

| Need | Channel |
|------|---------|
| Question | GitHub Discussions, Discord, Stack Overflow |
| Bug report | GitHub Issues |
| Feature request | GitHub Issues |
| Security issue | security@ferrite.dev |
| Commercial support | sales@ferrite.dev |
| Partnership | partners@ferrite.dev |
| General inquiry | hello@ferrite.dev |
