"use strict";

const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const crypto = require("crypto");

// ── Sync user to public.users ─────────────────────────────────────────────
// Called on login/init to ensure the auth user exists in the public.users table
// (required by chat_threads FK constraint).
router.post("/sync-user", async (req, res) => {
  try {
    const { user_id, email, display_name, avatar_url } = req.body;
    if (!user_id || !email) {
      return res.status(400).json({ error: "user_id and email are required" });
    }

    const { error } = await supabase.from("users").upsert(
      {
        id: user_id,
        email,
        display_name: display_name || email.split("@")[0],
        avatar_url: avatar_url || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error syncing user:", error);
      return res.status(500).json({ error: "Failed to sync user" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("sync-user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get all threads + messages for a user ─────────────────────────────────
router.get("/threads", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const { data: threads, error: tErr } = await supabase
      .from("chat_threads")
      .select("*")
      .eq("user_id", user_id)
      .order("updated_at", { ascending: false });

    if (tErr) {
      console.error("Error loading threads:", tErr);
      return res.status(500).json({ error: "Failed to load threads" });
    }

    const { data: messages, error: mErr } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });

    if (mErr) {
      console.error("Error loading messages:", mErr);
      return res.status(500).json({ error: "Failed to load messages" });
    }

    res.json({ threads: threads || [], messages: messages || [] });
  } catch (err) {
    console.error("get threads error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create a new thread ───────────────────────────────────────────────────
router.post("/threads", async (req, res) => {
  try {
    const { id, user_id, title, email, display_name, avatar_url } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Ensure user exists in public.users (handles FK constraint)
    if (email) {
      const { error: uErr } = await supabase.from("users").upsert(
        {
          id: user_id,
          email,
          display_name: display_name || email.split("@")[0],
          avatar_url: avatar_url || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (uErr) {
        console.error("Error ensuring user exists:", uErr);
      }
    }

    // Client is the source of truth for the thread id. Upsert idempotently so
    // repeated "ensure exists" calls never create duplicate/orphan threads and
    // never clobber an existing title (ignoreDuplicates skips the row on conflict).
    const threadId = id || crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.from("chat_threads").upsert(
      {
        id: threadId,
        user_id,
        title: title || "New Chat",
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      console.error("Error creating thread:", error);
      return res.status(500).json({ error: "Failed to create thread" });
    }

    res.json({ id: threadId, title: title || "New Chat", created_at: now, updated_at: now });
  } catch (err) {
    console.error("create thread error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update thread title ───────────────────────────────────────────────────
router.patch("/threads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const { error } = await supabase
      .from("chat_threads")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error updating thread title:", error);
      return res.status(500).json({ error: "Failed to update thread" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("update thread error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Delete a thread ───────────────────────────────────────────────────────
router.delete("/threads/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete messages first (if no cascade)
    await supabase.from("chat_messages").delete().eq("thread_id", id);
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);

    if (error) {
      console.error("Error deleting thread:", error);
      return res.status(500).json({ error: "Failed to delete thread" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("delete thread error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Persist a message (idempotent full-state upsert) ──────────────────────
// The client is the source of truth for the message id and always sends the
// FULL current state of the message. Upserting on the id means the same call
// both creates the row and later updates it in place (e.g. an "executing"
// message transitioning to its final "result"/"error" state). This is what
// guarantees the final answer of every conversation is never lost.
router.post("/threads/:threadId/messages", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { user_id, message_id, type, content, created_at } = req.body;

    if (!user_id || !message_id) {
      return res.status(400).json({ error: "user_id and message_id are required" });
    }

    const { error } = await supabase.from("chat_messages").upsert(
      {
        id: message_id,
        thread_id: threadId,
        user_id,
        type,
        content,
        created_at: created_at || new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error persisting message:", error);
      return res.status(500).json({ error: "Failed to persist message" });
    }

    // Keep the thread at the top of the sidebar (most-recent-activity order).
    await supabase
      .from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    res.json({ success: true });
  } catch (err) {
    console.error("persist message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update a message ──────────────────────────────────────────────────────
router.patch("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content, created_at } = req.body;

    const updates = {};
    if (type) updates.type = type;
    if (content) updates.content = content;
    if (created_at) updates.created_at = created_at;

    const { error } = await supabase
      .from("chat_messages")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating message:", error);
      return res.status(500).json({ error: "Failed to update message" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("update message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
