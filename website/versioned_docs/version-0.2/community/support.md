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

[github.com/ferritelabs/ferrite/discussions](https://github.com/ferritelabs/ferrite/discussions)

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

[Ferrite examples](https://github.com/FerriteLabs/ferrite/tree/main/examples)

## Reporting Issues

### Bug Reports

Report bugs on GitHub:

[github.com/ferritelabs/ferrite/issues/new?template=bug_report.md](https://github.com/ferritelabs/ferrite/issues/new)

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

[github.com/ferritelabs/ferrite/issues/new?template=feature_request.md](https://github.com/ferritelabs/ferrite/issues/new)

Include:
1. **Use case**: What problem does this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives**: Other ways to solve this?

### Security Issues

**DO NOT** report security vulnerabilities publicly.

[Report the vulnerability privately through GitHub Security Advisories](https://github.com/ferritelabs/ferrite/security/advisories/new).

We will:
- Acknowledge within 24 hours
- Investigate within 72 hours
- Coordinate disclosure

## Commercial Support

FerriteLabs does not currently advertise a public commercial-support offering or partner directory. Use [GitHub Discussions](https://github.com/ferritelabs/ferrite/discussions) for general project questions.

## Training & Education

### Tutorials

Free tutorials are available in the [documentation](/docs/) and [blog](/blog).

### Video Content

Community demos and walkthroughs:

[Ferrite Discussions](https://github.com/FerriteLabs/ferrite/discussions)

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

- **Blog**: [Ferrite blog](/blog)
- **Twitter**: [@ferritedb](https://twitter.com/ferritedb)
- **Discord**: #announcements channel

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
| Security issue | [Private vulnerability report](https://github.com/ferritelabs/ferrite/security/advisories/new) |
| Commercial or partnership inquiry | [GitHub Discussions](https://github.com/ferritelabs/ferrite/discussions) |
| General inquiry | [GitHub Discussions](https://github.com/ferritelabs/ferrite/discussions) |

GitHub Discussions is public. For commercial, partnership, or general inquiries, use it only to request maintainer coordination and do not include confidential business, customer, procurement, contact, or security information.
