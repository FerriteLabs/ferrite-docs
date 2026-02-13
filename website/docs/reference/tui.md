---
maturity: beta
---

# TUI Reference

Reference for the Ferrite Terminal User Interface (TUI), an interactive visual tool for monitoring and managing Ferrite.

## Overview

The Ferrite TUI provides a real-time dashboard for monitoring server status, viewing data, and executing commands with a visual interface.

## Starting the TUI

```bash
# Connect to local server
ferrite-tui

# Connect to remote server
ferrite-tui -h redis.example.com -p 6380

# With authentication
ferrite-tui -a mypassword

# Connect to cluster
ferrite-tui --cluster node1:6380,node2:6380,node3:6380
```

## Command-Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--host <HOST>` | `-h` | Server hostname | `127.0.0.1` |
| `--port <PORT>` | `-p` | Server port | `6380` |
| `--password <PASS>` | `-a` | Authentication password | |
| `--user <USER>` | | ACL username | `default` |
| `--tls` | | Enable TLS | false |
| `--cluster` | `-c` | Cluster connection string | |
| `--refresh <MS>` | `-r` | Refresh interval | `1000` |
| `--theme <THEME>` | `-t` | Color theme | `dark` |
| `--help` | | Print help | |

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Ferrite TUI v1.0.0           localhost:6380           [?] Help     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [1] Overview  [2] Keys  [3] Clients  [4] Memory  [5] Commands     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         Main Content Area                           │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Status: Connected  │  Keys: 1.2M  │  Memory: 2.1GB  │  Ops: 45K/s │
└─────────────────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

### Global Shortcuts

| Key | Action |
|-----|--------|
| `?` / `F1` | Show help |
| `q` / `Ctrl+C` | Quit |
| `1-9` | Switch to tab |
| `Tab` | Next panel |
| `Shift+Tab` | Previous panel |
| `Ctrl+R` | Force refresh |
| `Ctrl+P` | Toggle pause |
| `/` | Open command bar |
| `Escape` | Close dialog/Cancel |

### Navigation

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `←` / `h` | Move left |
| `→` / `l` | Move right |
| `Page Up` | Page up |
| `Page Down` | Page down |
| `Home` / `g` | Go to top |
| `End` / `G` | Go to bottom |

### Selection

| Key | Action |
|-----|--------|
| `Enter` | Select / Confirm |
| `Space` | Toggle selection |
| `a` | Select all |
| `n` | Select none |
| `i` | Invert selection |

## Screens

### Overview (Tab 1)

Server dashboard showing:
- Server info (version, uptime, OS)
- Memory usage (graph)
- CPU usage (graph)
- Operations per second (graph)
- Connected clients
- Key count
- Hit rate
- Network I/O

#### Key Bindings

| Key | Action |
|-----|--------|
| `m` | Toggle memory graph |
| `c` | Toggle CPU graph |
| `o` | Toggle ops graph |
| `t` | Change time range |

### Keys Browser (Tab 2)

Browse and manage keys:
- Key list with type, TTL, size
- Pattern filter
- Key details panel
- Value preview

#### Key Bindings

| Key | Action |
|-----|--------|
| `f` | Filter by pattern |
| `s` | Sort by (name/type/ttl/size) |
| `d` | Delete selected key(s) |
| `e` | Edit key |
| `r` | Rename key |
| `t` | Set TTL |
| `c` | Copy key name |
| `Enter` | View key details |
| `n` | Create new key |

#### Filtering

```
Filter: user:*
Type: [All ▾]  TTL: [Any ▾]  Size: [Any ▾]
```

### Clients (Tab 3)

Connected clients information:
- Client list (ID, address, age, idle, database)
- Client details
- Kill client option

#### Key Bindings

| Key | Action |
|-----|--------|
| `k` | Kill selected client |
| `s` | Sort by (id/addr/age/idle) |
| `f` | Filter clients |

### Memory (Tab 4)

Memory analysis:
- Memory breakdown by type
- Top keys by memory
- Memory fragmentation
- Eviction policy status

#### Key Bindings

| Key | Action |
|-----|--------|
| `a` | Analyze memory |
| `t` | Show top keys |
| `f` | Show fragmentation |

### Commands (Tab 5)

Command statistics:
- Command count and latency
- Slow log
- Command history

#### Key Bindings

| Key | Action |
|-----|--------|
| `s` | Show slow log |
| `h` | Show command history |
| `c` | Clear slow log |

### Cluster (Tab 6, if cluster mode)

Cluster management:
- Node status
- Slot distribution
- Replication status
- Failover controls

#### Key Bindings

| Key | Action |
|-----|--------|
| `f` | Failover node |
| `r` | Rebalance slots |
| `a` | Add node |
| `m` | Remove node |

## Command Bar

Press `/` to open the command bar:

```
┌─────────────────────────────────────────────────────────────────────┐
│ > SET user:123 "Alice"                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

- Command autocomplete (Tab)
- Command history (Up/Down arrows)
- Multi-line input (Shift+Enter)
- Result preview

### Special Commands

| Command | Description |
|---------|-------------|
| `:set <option> <value>` | Set TUI option |
| `:theme <name>` | Change theme |
| `:refresh <ms>` | Set refresh rate |
| `:connect <host:port>` | Connect to server |
| `:export <file>` | Export current view |
| `:import <file>` | Import data |

## Key Details View

When viewing a key (Enter on Keys tab):

```
┌─ Key: user:123 ──────────────────────────────────────────────────────┐
│                                                                      │
│  Type: hash          TTL: 3599s           Size: 256 bytes           │
│                                                                      │
│  ┌─ Fields ──────────────────────────────────────────────────────┐  │
│  │ name      │ Alice                                             │  │
│  │ email     │ alice@example.com                                 │  │
│  │ age       │ 30                                                │  │
│  │ created   │ 2024-01-15T10:30:00Z                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [e] Edit  [d] Delete  [t] TTL  [r] Rename  [Esc] Close            │
└──────────────────────────────────────────────────────────────────────┘
```

### Type-Specific Views

#### String

```
Value: "Hello, World!"
Encoding: embstr
Length: 13 characters
```

#### List

```
Index │ Value
──────┼───────────────
    0 │ "first item"
    1 │ "second item"
    2 │ "third item"
```

#### Hash

```
Field     │ Value
──────────┼───────────────────
name      │ "Alice"
email     │ "alice@example.com"
```

#### Set

```
Members (3)
───────────────────
"member1"
"member2"
"member3"
```

#### Sorted Set

```
Score     │ Member
──────────┼───────────────
100.0     │ "alice"
95.0      │ "bob"
90.0      │ "carol"
```

#### Stream

```
ID                    │ Fields
──────────────────────┼─────────────────────
1704067200000-0       │ type=click, page=/home
1704067201000-0       │ type=view, page=/about
```

## Themes

### Built-in Themes

| Theme | Description |
|-------|-------------|
| `dark` | Dark background (default) |
| `light` | Light background |
| `monokai` | Monokai colors |
| `dracula` | Dracula colors |
| `solarized-dark` | Solarized dark |
| `solarized-light` | Solarized light |

### Changing Theme

```bash
# Command line
ferrite-tui --theme monokai

# In TUI
:theme monokai

# Persistent (config file)
# ~/.config/ferrite/tui.toml
theme = "monokai"
```

### Custom Theme

```toml
# ~/.config/ferrite/themes/custom.toml
[colors]
background = "#1a1b26"
foreground = "#c0caf5"
selection = "#33467c"
border = "#3b4261"

[colors.syntax]
key = "#7aa2f7"
string = "#9ece6a"
number = "#ff9e64"
boolean = "#bb9af7"
null = "#565f89"

[colors.status]
success = "#9ece6a"
warning = "#e0af68"
error = "#f7768e"
info = "#7aa2f7"
```

## Configuration

### Config File

`~/.config/ferrite/tui.toml`:

```toml
# Connection defaults
[connection]
host = "localhost"
port = 6380
# password = "secret"

# Display settings
[display]
theme = "dark"
refresh_ms = 1000
unicode = true
mouse = true

# Key browser settings
[keys]
page_size = 100
default_pattern = "*"
show_ttl = true
show_size = true

# Memory settings
[memory]
size_unit = "auto"  # auto, bytes, kb, mb, gb

# Keybindings (vim-style is default)
[keybindings]
style = "vim"  # vim, emacs, default
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `FERRITE_TUI_HOST` | Default host |
| `FERRITE_TUI_PORT` | Default port |
| `FERRITE_TUI_THEME` | Theme name |
| `FERRITE_TUI_REFRESH` | Refresh interval |
| `NO_COLOR` | Disable colors |

## Mouse Support

Mouse interactions (if enabled):
- Click to select items
- Scroll to navigate lists
- Double-click to view details
- Right-click for context menu

## Accessibility

- Screen reader support (experimental)
- High contrast themes available
- Keyboard-only navigation
- Configurable refresh rate

## Troubleshooting

### Terminal Issues

```bash
# If display is garbled, try:
TERM=xterm-256color ferrite-tui

# If unicode doesn't work:
ferrite-tui --no-unicode

# If colors don't work:
NO_COLOR=1 ferrite-tui
```

### Connection Issues

```bash
# Test connection first
ferrite-cli -h host -p 6380 PING

# Debug mode
RUST_LOG=debug ferrite-tui
```

## See Also

- [CLI Reference](/docs/reference/cli)
- [Configuration Reference](/docs/reference/configuration)
- [Commands Reference](/docs/reference/commands/strings)
