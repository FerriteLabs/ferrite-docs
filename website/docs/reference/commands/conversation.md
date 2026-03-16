---
sidebar_position: 36
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Conversation Commands

Commands for conversation memory management.

## Overview

Conversation commands provide server-side conversation state management optimized for LLM applications. Store, retrieve, and manage multi-turn conversation histories with built-in context window management.

## Commands

### CONV.CREATE

Create a new conversation.

```bash
CONV.CREATE conversation_id [MODEL model_name] [MAX_TOKENS n] [TTL seconds]
```

**Time Complexity:** O(1)

**Parameters:**
- `conversation_id` - Unique conversation identifier
- `MODEL` - Associated LLM model name (optional)
- `MAX_TOKENS` - Maximum context window tokens (optional)
- `TTL` - Conversation expiration in seconds (optional)

**Examples:**
```bash
CONV.CREATE chat:user:1001 MODEL gpt-4 MAX_TOKENS 8192
# OK

CONV.CREATE session:abc123 TTL 3600
# OK
```

**Returns:** OK

---

### CONV.DELETE

Delete a conversation and all its messages.

```bash
CONV.DELETE conversation_id
```

**Time Complexity:** O(N) where N is the number of messages in the conversation

**Examples:**
```bash
CONV.DELETE chat:user:1001
# (integer) 1
```

**Returns:** Integer — 1 if deleted, 0 if not found

---

### CONV.MESSAGE

Add a message to a conversation.

```bash
CONV.MESSAGE conversation_id role content [METADATA json]
```

**Time Complexity:** O(1)

**Parameters:**
- `role` - Message role: `system`, `user`, `assistant`, or `tool`
- `content` - Message content
- `METADATA` - Optional JSON metadata

**Examples:**
```bash
CONV.MESSAGE chat:user:1001 user "What is the capital of France?"
# OK

CONV.MESSAGE chat:user:1001 assistant "Paris is the capital of France."
# OK

CONV.MESSAGE chat:user:1001 user "Tell me more about it." METADATA '{"intent":"follow_up"}'
# OK
```

**Returns:** OK

---

### CONV.CONTEXT

Get the conversation context window (messages that fit within token limits).

```bash
CONV.CONTEXT conversation_id [MAX_TOKENS n] [FORMAT json|text]
```

**Time Complexity:** O(N) where N is the number of messages in the context window

**Examples:**
```bash
CONV.CONTEXT chat:user:1001
# 1) 1) "role"
#    2) "user"
#    3) "content"
#    4) "What is the capital of France?"
# 2) 1) "role"
#    2) "assistant"
#    3) "content"
#    4) "Paris is the capital of France."

CONV.CONTEXT chat:user:1001 MAX_TOKENS 4096 FORMAT json
# [{"role":"user","content":"What is the capital of France?"},
#  {"role":"assistant","content":"Paris is the capital of France."}]
```

**Returns:** Array of messages within the context window

---

### CONV.LIST

List conversations matching a pattern.

```bash
CONV.LIST [PATTERN pattern] [COUNT n]
```

**Time Complexity:** O(N) where N is the number of conversations

**Examples:**
```bash
CONV.LIST
# 1) "chat:user:1001"
# 2) "chat:user:1002"
# 3) "session:abc123"

CONV.LIST PATTERN "chat:user:*" COUNT 10
# 1) "chat:user:1001"
# 2) "chat:user:1002"
```

**Returns:** Array of conversation IDs

---

### CONV.INFO

Get conversation metadata.

```bash
CONV.INFO conversation_id
```

**Time Complexity:** O(1)

**Examples:**
```bash
CONV.INFO chat:user:1001
# {
#   "id": "chat:user:1001",
#   "model": "gpt-4",
#   "max_tokens": 8192,
#   "message_count": 12,
#   "total_tokens": 3500,
#   "created_at": "2026-01-20T10:00:00Z",
#   "last_message_at": "2026-01-20T10:15:00Z"
# }
```

**Returns:** Map of conversation metadata

---

### CONV.CLEAR

Clear all messages from a conversation while keeping the conversation itself.

```bash
CONV.CLEAR conversation_id
```

**Time Complexity:** O(N) where N is the number of messages in the conversation

**Examples:**
```bash
CONV.CLEAR chat:user:1001
# OK
```

**Returns:** OK

---

### CONV.SYSTEM

Set or update the system prompt for a conversation.

```bash
CONV.SYSTEM conversation_id content
```

**Time Complexity:** O(1)

**Examples:**
```bash
CONV.SYSTEM chat:user:1001 "You are a helpful assistant specializing in geography."
# OK
```

**Returns:** OK

---

### CONV.STATS

Get conversation memory statistics.

```bash
CONV.STATS
```

**Time Complexity:** O(1)

**Examples:**
```bash
CONV.STATS
# {
#   "total_conversations": 150,
#   "total_messages": 4500,
#   "total_tokens": 1200000,
#   "memory_usage_bytes": 8388608,
#   "avg_messages_per_conversation": 30
# }
```

**Returns:** Map of statistics

---

### CONV.SAVE

Persist conversation state to store (survives restart).

```bash
CONV.SAVE
```

**Time Complexity:** O(N) where N is the total number of conversations and messages

**Examples:**
```bash
CONV.SAVE
# OK
```

**Returns:** OK

## Use Cases

### LLM Chat Application

```bash
# Create conversation with model-specific settings
CONV.CREATE chat:user:1001 MODEL gpt-4 MAX_TOKENS 8192

# Set system prompt
CONV.SYSTEM chat:user:1001 "You are a helpful coding assistant."

# Add messages
CONV.MESSAGE chat:user:1001 user "How do I sort a list in Python?"
CONV.MESSAGE chat:user:1001 assistant "You can use sorted() or list.sort()..."

# Get context window for next LLM call
CONV.CONTEXT chat:user:1001 MAX_TOKENS 4096
```

### Multi-Session Management

```bash
# List active sessions
CONV.LIST PATTERN "chat:*" COUNT 100

# Check session details
CONV.INFO chat:user:1001

# Clean up expired sessions
CONV.DELETE chat:user:old_session
```

## Related Commands

- [Semantic Commands](/docs/reference/commands/semantic) - Semantic caching
- [Strings Commands](/docs/reference/commands/strings) - Basic key-value storage
- [Streams Commands](/docs/reference/commands/streams) - Event streaming
